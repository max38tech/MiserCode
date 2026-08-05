import { describe, expect, it } from "vitest";
import { Orchestrator, type SpawnFn } from "../orchestrator.js";
import { createScriptedSpawn, createMockChild, claudeJsonStdout, type MockChild } from "./testUtils.js";
import type { LogLine, PhaseState } from "../types.js";
import type { ChildProcess } from "node:child_process";

function successfulPlan(child: MockChild) {
  child.stdout.emit("data", Buffer.from(claudeJsonStdout({ num_turns: 1, total_cost_usd: 0.01 })));
  child.emit("close", 0);
}

function successfulGenerate(child: MockChild) {
  child.stdout.emit("data", Buffer.from("Generated 12 files\n"));
  child.emit("close", 0);
}

function successfulVerify(child: MockChild) {
  child.stdout.emit("data", Buffer.from(claudeJsonStdout({ num_turns: 2, total_cost_usd: 0.02 })));
  child.emit("close", 0);
}

describe("Orchestrator", () => {
  it("runs all three phases in order and reaches a completed state", async () => {
    const { spawnFn, calls } = createScriptedSpawn([successfulPlan, successfulGenerate, successfulVerify]);
    const orchestrator = new Orchestrator({ spawnFn, workDir: "/tmp/project" });

    await orchestrator.start("Build a todo app");

    expect(calls).toHaveLength(3);
    expect(calls[0].command).toBe("claude");
    expect(calls[0].args).toContain("--dangerously-skip-permissions");
    expect(calls[1].command).toBe("opencode");
    expect(calls[1].args).toEqual([
      "run",
      "Read SPEC.md and generate source code",
      "--auto",
      "--dir",
      "/tmp/project",
      "--print-logs",
    ]);
    expect(calls[2].command).toBe("claude");

    const state = orchestrator.getState();
    expect(state.status).toBe("completed");
    expect(state.phases.plan.status).toBe("completed");
    expect(state.phases.generate.status).toBe("completed");
    expect(state.phases.verify.status).toBe("completed");
  });

  it("aggregates claude token usage and cost across the plan and verify phases", async () => {
    const { spawnFn } = createScriptedSpawn([successfulPlan, successfulGenerate, successfulVerify]);
    const orchestrator = new Orchestrator({ spawnFn });

    await orchestrator.start("Build a todo app");

    const { claude } = orchestrator.getState();
    expect(claude.turnCount).toBe(3);
    expect(claude.inputTokens).toBe(200);
    expect(claude.outputTokens).toBe(100);
    expect(claude.totalCostUsd).toBeCloseTo(0.03);
    expect(claude.turns).toHaveLength(2);
  });

  it("stops the pipeline and marks status failed when a phase exits non-zero", async () => {
    const { spawnFn, calls } = createScriptedSpawn([
      successfulPlan,
      (child) => {
        child.stderr.emit("data", Buffer.from("npm ERR! generation failed\n"));
        child.emit("close", 1);
      },
    ]);
    const orchestrator = new Orchestrator({ spawnFn });

    await orchestrator.start("Build a todo app");

    expect(calls).toHaveLength(2); // verify phase never runs
    const state = orchestrator.getState();
    expect(state.status).toBe("failed");
    expect(state.phases.plan.status).toBe("completed");
    expect(state.phases.generate.status).toBe("failed");
    expect(state.phases.verify.status).toBe("pending");
  });

  it("rejects starting a new run while one is already in progress", async () => {
    const { spawnFn } = createScriptedSpawn([
      (child) => {
        // never resolves within this test's synchronous window
        setTimeout(() => {
          child.stdout.emit("data", Buffer.from(claudeJsonStdout()));
          child.emit("close", 0);
        }, 50);
      },
    ]);
    const orchestrator = new Orchestrator({ spawnFn });

    const firstRun = orchestrator.start("first prompt");
    await expect(orchestrator.start("second prompt")).rejects.toThrow(/already in progress/);
    await firstRun;
  });

  it("rejects an empty prompt", async () => {
    const { spawnFn } = createScriptedSpawn([]);
    const orchestrator = new Orchestrator({ spawnFn });
    await expect(orchestrator.start("   ")).rejects.toThrow(/must not be empty/);
  });

  it("emits log lines classified by severity for stdout/stderr content", async () => {
    const { spawnFn } = createScriptedSpawn([
      (child) => {
        child.stdout.emit("data", Buffer.from("5 tests passed\n"));
        child.stderr.emit("data", Buffer.from("TypeError: undefined is not a function\n"));
        child.stdout.emit("data", Buffer.from(claudeJsonStdout()));
        child.emit("close", 0);
      },
      successfulGenerate,
      successfulVerify,
    ]);
    const orchestrator = new Orchestrator({ spawnFn });

    const lines: LogLine[] = [];
    orchestrator.on("log", (line: LogLine) => lines.push(line));

    await orchestrator.start("Build a todo app");

    const passLine = lines.find((l) => l.text.includes("tests passed"));
    const errorLine = lines.find((l) => l.text.includes("TypeError"));
    expect(passLine?.level).toBe("success");
    expect(errorLine?.level).toBe("error");
  });

  it("emits phase_update events with monotonically sane state transitions", async () => {
    const { spawnFn } = createScriptedSpawn([successfulPlan, successfulGenerate, successfulVerify]);
    const orchestrator = new Orchestrator({ spawnFn });

    const updates: PhaseState[] = [];
    orchestrator.on("phase_update", (phase: PhaseState) => updates.push({ ...phase }));

    await orchestrator.start("Build a todo app");

    const planUpdates = updates.filter((u) => u.id === "plan");
    expect(planUpdates.map((u) => u.status)).toEqual(["active", "completed"]);
  });

  it("marks the run failed and stops spawning further phases on cancel", async () => {
    let killed = false;
    const calls: Array<{ command: string; args: string[] }> = [];
    const spawnFn: SpawnFn = (command, args) => {
      calls.push({ command, args });
      const child = createMockChild();
      // Overridden synchronously, before control ever returns to the
      // caller, so cancel() (called right after start()) sees it.
      child.kill = () => {
        killed = true;
        queueMicrotask(() => child.emit("close", null));
      };
      return child as unknown as ChildProcess;
    };
    const orchestrator = new Orchestrator({ spawnFn });

    const run = orchestrator.start("Build a todo app");
    orchestrator.cancel();
    await run;

    expect(killed).toBe(true);
    expect(calls).toHaveLength(1);
    expect(orchestrator.getState().status).toBe("failed");
  });

  it("kills a hung phase and fails it once phaseTimeoutMs elapses with no exit", async () => {
    let killed = false;
    const spawnFn: SpawnFn = () => {
      const child = createMockChild();
      // Never emits "close" on its own, simulating a genuinely hung CLI
      // (observed in practice: opencode blocking forever on an unclosed
      // stdin pipe). kill() is what the timeout must call to recover.
      child.kill = () => {
        killed = true;
      };
      return child as unknown as ChildProcess;
    };
    const orchestrator = new Orchestrator({ spawnFn, phaseTimeoutMs: 20 });

    await orchestrator.start("Build a todo app");

    expect(killed).toBe(true);
    const state = orchestrator.getState();
    expect(state.status).toBe("failed");
    expect(state.phases.plan.status).toBe("failed");
  });
});
