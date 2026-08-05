import type { RateLimitHealth } from "./types.js";

export interface RateLimitConfig {
  /** Length of the rolling window Anthropic uses to bucket usage, in minutes. */
  windowMinutes: number;
  /** Rough estimate of how many CLI turns fit in one window on the active plan. */
  maxTurnsPerWindow: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMinutes: Number(process.env.CLAUDE_WINDOW_MINUTES ?? 300),
  maxTurnsPerWindow: Number(process.env.CLAUDE_MAX_TURNS_PER_WINDOW ?? 45),
};

/**
 * Estimates how much of the current rolling rate-limit window has been
 * consumed, based on turn timestamps captured from parsed Claude CLI runs.
 * This is a client-side estimate for UX purposes only — Anthropic does not
 * expose exact remaining-quota figures via the CLI.
 */
export function computeRateLimitHealth(
  turnTimestamps: number[],
  now: number = Date.now(),
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): RateLimitHealth {
  const windowMs = config.windowMinutes * 60_000;
  const windowStart = now - windowMs;
  const turnsInWindow = turnTimestamps.filter((t) => t >= windowStart && t <= now).length;

  const utilizationPct = config.maxTurnsPerWindow > 0
    ? Math.min(100, Math.round((turnsInWindow / config.maxTurnsPerWindow) * 100))
    : 0;

  const estimatedTurnsRemaining = Math.max(0, config.maxTurnsPerWindow - turnsInWindow);

  let status: RateLimitHealth["status"] = "healthy";
  if (utilizationPct >= 90) status = "critical";
  else if (utilizationPct >= 60) status = "warning";

  return {
    utilizationPct,
    windowMinutes: config.windowMinutes,
    turnsInWindow,
    estimatedTurnsRemaining,
    status,
  };
}
