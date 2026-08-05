import { describe, expect, it } from "vitest";
import { computeRateLimitHealth } from "../rateLimit.js";

const config = { windowMinutes: 60, maxTurnsPerWindow: 10 };

describe("computeRateLimitHealth", () => {
  it("reports 0% utilization with no turns", () => {
    const health = computeRateLimitHealth([], Date.now(), config);
    expect(health.utilizationPct).toBe(0);
    expect(health.status).toBe("healthy");
    expect(health.estimatedTurnsRemaining).toBe(10);
  });

  it("excludes turns outside the rolling window", () => {
    const now = Date.now();
    const staleTurn = now - 61 * 60_000;
    const health = computeRateLimitHealth([staleTurn], now, config);
    expect(health.turnsInWindow).toBe(0);
  });

  it("flags warning status past 60% utilization", () => {
    const now = Date.now();
    const turns = Array.from({ length: 6 }, () => now);
    const health = computeRateLimitHealth(turns, now, config);
    expect(health.utilizationPct).toBe(60);
    expect(health.status).toBe("warning");
  });

  it("flags critical status past 90% utilization and clamps at 100", () => {
    const now = Date.now();
    const turns = Array.from({ length: 15 }, () => now);
    const health = computeRateLimitHealth(turns, now, config);
    expect(health.utilizationPct).toBe(100);
    expect(health.status).toBe("critical");
    expect(health.estimatedTurnsRemaining).toBe(0);
  });
});
