import { EventEmitter } from "node:events";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import crossSpawn from "cross-spawn";
import { nanoid } from "nanoid";
import { parseClaudeOutput } from "./claudeParser.js";
import { computeRateLimitHealth, DEFAULT_RATE_LIMIT_CONFIG, type RateLimitConfig } from "./rateLimit.js";
import type {
  ClaudeSessionStats,
  GeminiUsage,
  LogLine,
  PhaseId,
  PhaseState,
  PipelineState,
  RateLimitHealth,
} from "./types.js";

export type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptions
) => ChildProcess;

export interface OrchestratorOptions {
  spawnFn?: SpawnFn;
  workDir?: string;
  rateLimitConfig?: RateLimitConfig;
  claudeBin?: string;
  openCodeBin?: string;
  /** Kills a phase's child process if it hasn't exited within this long. */
  phaseTimeoutMs?: number;
}

const DEFAULT_PHASE_TIMEOUT_MS = 15 * 60_000;

const PHASE_ORDER: PhaseId[] = ["plan", "generate", "verify"];

const PHASE_LABELS: Record<PhaseId, string> = {
  plan: "Architect & Plan",
  generate: "Bulk Coding",
  verify: "Autonomous Testing & Fixes",
};

function initialPhaseState(id: PhaseId): PhaseState {
  return {
    id,
    label: PHASE_LABELS[id],
    status: "pending",
    startedAt: null,
    finishedAt: null,
    exitCode: null,
  };
}

function initialClaudeStats(): ClaudeSessionStats {
  return {
    turnCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalCostUsd: 0,
    turns: [],
    windowStartedAt: null,
  };
}

function initialGeminiStats(): GeminiUsage {
  return {
    requests: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    lastStatus: "idle",
  };
}

function classifyLine(text: string): LogLine["level"] {
  const lower = text.toLowerCase();
  if (/\b(error|exception|traceback|fail(ed|ure)?)\b/.test(lower)) return "error";
  if (/\b(pass(ed)?|success|done|completed)\b|✓/.test(lower)) return "success";
  if (/\bwarn(ing)?\b/.test(lower)) return "warn";
  return "info";
}

/**
 * Drives the three-phase autonomous build pipeline (plan -> generate ->
 * verify), spawning the configured CLIs as child processes and emitting
 * granular events so a transport layer (WebSocket, tests, etc.) can observe
 * progress without depending on process internals.
 */
export class Orchestrator extends EventEmitter {
  private readonly spawnFn: SpawnFn;
  private readonly workDir: string;
  private readonly rateLimitConfig: RateLimitConfig;
  private readonly claudeBin: string;
  private readonly openCodeBin: string;
  private readonly phaseTimeoutMs: number;
  private currentChild: ChildProcess | null = null;
  private turnTimestamps: number[] = [];
  private cancelled = false;

  state: PipelineState;

  constructor(options: OrchestratorOptions = {}) {
    super();
    // cross-spawn (not node:child_process directly) because on Windows npm
    // installs most CLIs (e.g. opencode) as .cmd/.ps1 shims with no bare
    // .exe on PATH; Node's spawn with shell:false can't resolve those and
    // fails with ENOENT, while cross-spawn resolves them correctly without
    // needing shell:true (which would reopen shell-injection risk).
    this.spawnFn = options.spawnFn ?? (crossSpawn as SpawnFn);
    this.workDir = options.workDir ?? process.cwd();
    this.rateLimitConfig = options.rateLimitConfig ?? DEFAULT_RATE_LIMIT_CONFIG;
    this.claudeBin = options.claudeBin ?? "claude";
    this.openCodeBin = options.openCodeBin ?? "opencode";
    this.phaseTimeoutMs = options.phaseTimeoutMs ?? DEFAULT_PHASE_TIMEOUT_MS;
    this.state = this.freshState();
  }

  private freshState(): PipelineState {
    return {
      runId: null,
      prompt: "",
      status: "idle",
      startedAt: null,
      finishedAt: null,
      phases: {
        plan: initialPhaseState("plan"),
        generate: initialPhaseState("generate"),
        verify: initialPhaseState("verify"),
      },
      claude: initialClaudeStats(),
      gemini: initialGeminiStats(),
      rateLimit: computeRateLimitHealth([], Date.now(), this.rateLimitConfig),
    };
  }

  getState(): PipelineState {
    return this.state;
  }

  isRunning(): boolean {
    return this.state.status === "running";
  }

  cancel(): void {
    if (!this.isRunning()) return;
    this.cancelled = true;
    if (this.currentChild) {
      this.currentChild.kill("SIGTERM");
    }
  }

  async start(prompt: string): Promise<void> {
    if (this.isRunning()) {
      throw new Error("A pipeline run is already in progress");
    }
    if (!prompt || !prompt.trim()) {
      throw new Error("Prompt must not be empty");
    }

    this.cancelled = false;
    this.state = this.freshState();
    this.state.runId = nanoid(10);
    this.state.prompt = prompt;
    this.state.status = "running";
    this.state.startedAt = Date.now();
    this.emitState();

    this.log("system", "system", `Starting autonomous build run ${this.state.runId}`, "info");

    try {
      for (const phaseId of PHASE_ORDER) {
        if (this.cancelled) break;
        await this.runPhase(phaseId, prompt);
        if (this.cancelled) break;
        if (this.state.phases[phaseId].status === "failed") {
          this.state.status = "failed";
          break;
        }
      }

      if (this.cancelled) {
        this.state.status = "failed";
        this.log("system", "system", "Pipeline run cancelled by user", "warn");
      } else if (this.state.status !== "failed") {
        this.state.status = "completed";
        this.log("system", "system", "Pipeline run completed successfully", "success");
      }
    } catch (err) {
      this.state.status = "failed";
      const message = err instanceof Error ? err.message : String(err);
      this.log("system", "system", `Pipeline run crashed: ${message}`, "error");
    } finally {
      this.state.finishedAt = Date.now();
      this.emit("pipeline_done", this.state.status);
      this.emitState();
    }
  }

  private async runPhase(phaseId: PhaseId, prompt: string): Promise<void> {
    const phase = this.state.phases[phaseId];
    phase.status = "active";
    phase.startedAt = Date.now();
    this.emitPhase(phase);
    this.log(phaseId, "system", `Phase started: ${phase.label}`, "info");

    const { command, args, env } = this.buildCommand(phaseId, prompt);

    let stdoutBuffer = "";
    let sawError = false;

    try {
      const exitCode = await this.spawnAndStream(phaseId, command, args, env, (chunk) => {
        stdoutBuffer += chunk;
      });

      sawError = exitCode !== 0;

      if (phaseId === "plan" || phaseId === "verify") {
        const durationMs = Date.now() - (phase.startedAt ?? Date.now());
        const result = parseClaudeOutput(phaseId, stdoutBuffer, durationMs, sawError);
        this.recordClaudeTurn(result);
        if (result.isError) sawError = true;
      } else if (phaseId === "generate") {
        this.recordGeminiCompletion(sawError);
      }

      phase.status = sawError ? "failed" : "completed";
      phase.exitCode = exitCode;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(phaseId, "system", `Phase crashed: ${message}`, "error");
      phase.status = "failed";
      phase.exitCode = -1;
    } finally {
      phase.finishedAt = Date.now();
      this.emitPhase(phase);
      this.log(
        phaseId,
        "system",
        `Phase ${phase.status}: ${phase.label}`,
        phase.status === "failed" ? "error" : "success"
      );
    }
  }

  private buildCommand(
    phaseId: PhaseId,
    prompt: string
  ): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
    const env = { ...process.env };

    switch (phaseId) {
      case "plan":
        return {
          command: this.claudeBin,
          args: [
            "-p",
            `${prompt}\n\nProduce a complete SPEC.md describing the architecture, file layout, and implementation plan for this task.`,
            "--output-format",
            "json",
            "--dangerously-skip-permissions",
          ],
          env,
        };
      case "generate":
        // Only overrides GEMINI_API_KEY when one is actually configured.
        // Forcing it to "" when unset would shadow a valid credential
        // opencode already has stored via `opencode auth login`
        // (~/.local/share/opencode/auth.json), turning a working setup into
        // a broken one.
        return {
          command: this.openCodeBin,
          args: [
            "run",
            "Read SPEC.md and generate source code",
            // --auto: without it, opencode blocks on an interactive
            // file-write permission prompt that never resolves headlessly
            // (mirrors claude's --dangerously-skip-permissions above).
            "--auto",
            // opencode does not reliably honor the spawned process's cwd
            // for file operations; --dir pins it explicitly.
            "--dir",
            this.workDir,
            // Without this, provider errors (e.g. a rate-limited/quota-
            // exhausted API key) are retried silently forever with zero
            // stdout/stderr — the phase looks hung instead of visibly
            // failing. --print-logs surfaces those retry/error lines so
            // they show up in the streamed terminal log.
            "--print-logs",
          ],
          env: process.env.GEMINI_API_KEY
            ? { ...env, GEMINI_API_KEY: process.env.GEMINI_API_KEY }
            : env,
        };
      case "verify":
        return {
          command: this.claudeBin,
          args: [
            "-p",
            "Inspect repo, run tests, fix errors until 100% pass",
            "--output-format",
            "json",
            "--dangerously-skip-permissions",
          ],
          env,
        };
    }
  }

  private spawnAndStream(
    phaseId: PhaseId,
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    onStdoutChunk: (chunk: string) => void
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = this.spawnFn(command, args, {
        cwd: this.workDir,
        env,
        shell: false,
        // Explicitly closed rather than left as an open, empty pipe: some
        // CLIs (opencode observed) block indefinitely waiting for stdin
        // EOF that never comes when stdio defaults to "pipe" under
        // child_process. claude has its own 3s "no stdin" fallback, but
        // not every CLI does, so this is applied uniformly.
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.currentChild = child;

      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Timed out after ${Math.round(this.phaseTimeoutMs / 1000)}s with no exit`));
      }, this.phaseTimeoutMs);

      child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        onStdoutChunk(text);
        this.streamLines(phaseId, "stdout", text);
      });

      child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        this.streamLines(phaseId, "stderr", text);
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        this.currentChild = null;
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        this.currentChild = null;
        resolve(code ?? 0);
      });
    });
  }

  private streamLines(phaseId: PhaseId, stream: "stdout" | "stderr", text: string): void {
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    for (const line of lines) {
      const level = stream === "stderr" ? "error" : classifyLine(line);
      this.log(phaseId, stream, line, level);
    }
  }

  private recordClaudeTurn(result: import("./types.js").ClaudeTurnResult): void {
    const stats = this.state.claude;
    stats.turnCount += result.turnCount || 1;
    stats.inputTokens += result.usage.inputTokens;
    stats.outputTokens += result.usage.outputTokens;
    stats.cacheCreationInputTokens += result.usage.cacheCreationInputTokens;
    stats.cacheReadInputTokens += result.usage.cacheReadInputTokens;
    stats.totalCostUsd += result.totalCostUsd;
    stats.turns.push(result);
    if (stats.windowStartedAt === null) stats.windowStartedAt = Date.now();

    const now = Date.now();
    for (let i = 0; i < (result.turnCount || 1); i++) {
      this.turnTimestamps.push(now);
    }

    const rateLimit = computeRateLimitHealth(this.turnTimestamps, now, this.rateLimitConfig);
    this.state.rateLimit = rateLimit;

    this.emit("claude_usage", stats, rateLimit);
  }

  private recordGeminiCompletion(isError: boolean): void {
    const stats = this.state.gemini;
    stats.requests += 1;
    stats.lastStatus = isError ? "error" : "ok";
    this.emit("gemini_usage", stats);
  }

  private log(phase: PhaseId | "system", stream: LogLine["stream"], text: string, level: LogLine["level"]): void {
    const line: LogLine = {
      id: nanoid(8),
      phase,
      stream,
      text,
      level,
      timestamp: Date.now(),
    };
    this.emit("log", line);
  }

  private emitPhase(phase: PhaseState): void {
    this.emit("phase_update", { ...phase });
  }

  private emitState(): void {
    this.emit("state", this.state);
  }
}
