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

export interface ClaudeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface ClaudeTurnResult {
  phase: PhaseId;
  turnCount: number;
  usage: ClaudeUsage;
  totalCostUsd: number;
  durationMs: number;
  isError: boolean;
  raw?: unknown;
}

export interface GeminiUsage {
  requests: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  lastStatus: "idle" | "running" | "ok" | "error";
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

export interface RateLimitHealth {
  /** 0-100, percentage of the rolling window budget consumed */
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
