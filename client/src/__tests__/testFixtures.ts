import type { ClaudeSessionStats, GeminiUsage, PipelineState, RateLimitHealth } from "../lib/types";

export function makePhases(overrides: Partial<PipelineState["phases"]> = {}): PipelineState["phases"] {
  return {
    plan: { id: "plan", label: "Architect & Plan", status: "completed", startedAt: 1, finishedAt: 2, exitCode: 0 },
    generate: { id: "generate", label: "Bulk Coding", status: "active", startedAt: 2, finishedAt: null, exitCode: null },
    verify: { id: "verify", label: "Autonomous Testing & Fixes", status: "pending", startedAt: null, finishedAt: null, exitCode: null },
    ...overrides,
  };
}

export function makeClaudeStats(overrides: Partial<ClaudeSessionStats> = {}): ClaudeSessionStats {
  return {
    turnCount: 4,
    inputTokens: 12000,
    outputTokens: 3400,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalCostUsd: 0.5821,
    turns: [],
    windowStartedAt: Date.now(),
    ...overrides,
  };
}

export function makeGeminiStats(overrides: Partial<GeminiUsage> = {}): GeminiUsage {
  return {
    requests: 2,
    estimatedInputTokens: 8000,
    estimatedOutputTokens: 15000,
    lastStatus: "ok",
    ...overrides,
  };
}

export function makeRateLimit(overrides: Partial<RateLimitHealth> = {}): RateLimitHealth {
  return {
    utilizationPct: 42,
    windowMinutes: 300,
    turnsInWindow: 19,
    estimatedTurnsRemaining: 26,
    status: "healthy",
    ...overrides,
  };
}
