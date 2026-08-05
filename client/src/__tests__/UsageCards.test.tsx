import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClaudeUsageCard } from "../components/ClaudeUsageCard";
import { GeminiUsageCard } from "../components/GeminiUsageCard";
import { RateLimitBar } from "../components/RateLimitBar";
import { makeClaudeStats, makeGeminiStats, makeRateLimit } from "./testFixtures";

describe("ClaudeUsageCard", () => {
  it("displays turn count, token totals and formatted cost", () => {
    render(<ClaudeUsageCard stats={makeClaudeStats()} rateLimit={makeRateLimit()} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("12,000")).toBeInTheDocument();
    expect(screen.getByText("3,400")).toBeInTheDocument();
    expect(screen.getByText("$0.5821")).toBeInTheDocument();
  });
});

describe("GeminiUsageCard", () => {
  it("displays request count and combined throughput", () => {
    render(<GeminiUsageCard stats={makeGeminiStats()} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("23,000 tok")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});

describe("RateLimitBar", () => {
  it("renders utilization percentage and status", () => {
    render(<RateLimitBar rateLimit={makeRateLimit({ utilizationPct: 75, status: "warning" })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("warning")).toBeInTheDocument();
  });
});
