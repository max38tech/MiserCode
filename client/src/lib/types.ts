export type PhaseId = "plan" | "generate" | "verify";
export type PhaseStatus = "pending" | "active" | "completed" | "failed";
export type PipelineStatus = "idle" | "running" | "completed" | "failed";

export interface LogLine {
  id: string;
  phase: PhaseId | "system";
  stream: "stdout" | "stderr" | "system";
  text: string;
  level: "info" | "error" | "success" | "warn";
  timestamp: number;
}

export interface ClaudeTurnResult {
  phase: PhaseId;
  turnCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  totalCostUsd: number;
  durationMs: number;
  isError: boolean;
}

export interface ClaudeSessionStats {
  turnCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalCostUsd: number;
  turns: ClaudeTurnResult[];
  windowStartedAt: number | null;
}

export interface GeminiUsage {
  requests: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  lastStatus: "idle" | "running" | "ok" | "error";
}

export interface RateLimitHealth {
  utilizationPct: number;
  windowMinutes: number;
  turnsInWindow: number;
  estimatedTurnsRemaining: number;
  status: "healthy" | "warning" | "critical";
}

export interface PhaseState {
  id: PhaseId;
  label: string;
  status: PhaseStatus;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
}

export interface PipelineState {
  runId: string | null;
  prompt: string;
  status: PipelineStatus;
  startedAt: number | null;
  finishedAt: number | null;
  phases: Record<PhaseId, PhaseState>;
  claude: ClaudeSessionStats;
  gemini: GeminiUsage;
  rateLimit: RateLimitHealth;
}

export type ServerMessage =
  | { type: "state"; state: PipelineState }
  | { type: "log"; line: LogLine }
  | { type: "phase_update"; phase: PhaseState }
  | { type: "claude_usage"; stats: ClaudeSessionStats; rateLimit: RateLimitHealth }
  | { type: "gemini_usage"; stats: GeminiUsage }
  | { type: "pipeline_done"; status: PipelineStatus }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "start"; prompt: string }
  | { type: "cancel" }
  | { type: "request_state" };

export const PHASE_ORDER: PhaseId[] = ["plan", "generate", "verify"];
