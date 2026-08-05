import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import type { SpawnFn } from "../orchestrator.js";

export interface MockChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: (signal?: string) => void;
}

export function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {
    queueMicrotask(() => child.emit("close", null));
  };
  return child;
}

/**
 * Builds a fake `spawn` that hands back scripted child processes in call
 * order, so tests can drive each pipeline phase's stdout/stderr/exit
 * deterministically without touching real CLIs.
 */
export function createScriptedSpawn(
  scripts: Array<(child: MockChild) => void>
): { spawnFn: SpawnFn; calls: Array<{ command: string; args: string[] }> } {
  let callIndex = 0;
  const calls: Array<{ command: string; args: string[] }> = [];

  const spawnFn: SpawnFn = (command, args) => {
    calls.push({ command, args });
    const child = createMockChild();
    const script = scripts[callIndex];
    callIndex += 1;
    if (script) {
      queueMicrotask(() => script(child));
    } else {
      queueMicrotask(() => child.emit("close", 0));
    }
    return child as unknown as ChildProcess;
  };

  return { spawnFn, calls };
}

export function claudeJsonStdout(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 1200,
    num_turns: 1,
    total_cost_usd: 0.042,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    result: "ok",
    session_id: "test-session",
    ...overrides,
  });
}
