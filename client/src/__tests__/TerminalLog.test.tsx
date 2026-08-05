import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalLog } from "../components/TerminalLog";
import type { LogLine } from "../lib/types";

function line(overrides: Partial<LogLine>): LogLine {
  return {
    id: Math.random().toString(36),
    phase: "plan",
    stream: "stdout",
    text: "hello",
    level: "info",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("TerminalLog", () => {
  it("shows a placeholder when there are no log lines", () => {
    render(<TerminalLog lines={[]} />);
    expect(screen.getByText(/waiting for pipeline output/i)).toBeInTheDocument();
  });

  it("renders each log line's text and phase badge", () => {
    const lines = [
      line({ text: "5 tests passed", level: "success", phase: "verify" }),
      line({ text: "TypeError: boom", level: "error", phase: "generate" }),
    ];
    render(<TerminalLog lines={lines} />);
    expect(screen.getByText("5 tests passed")).toBeInTheDocument();
    expect(screen.getByText("TypeError: boom")).toBeInTheDocument();
    expect(screen.getByText("verify")).toBeInTheDocument();
    expect(screen.getByText("generate")).toBeInTheDocument();
  });

  it("starts with scroll lock engaged", () => {
    render(<TerminalLog lines={[line({})]} />);
    expect(screen.getByText(/scroll locked/i)).toBeInTheDocument();
  });
});
