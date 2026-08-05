import { describe, expect, it } from "vitest";
import { formatDuration } from "../hooks/useStopwatch";

describe("formatDuration", () => {
  it("formats sub-hour durations as mm:ss", () => {
    expect(formatDuration(65_000)).toBe("01:05");
  });

  it("formats hour-plus durations as hh:mm:ss", () => {
    expect(formatDuration(3_725_000)).toBe("01:02:05");
  });

  it("clamps negative durations to zero", () => {
    expect(formatDuration(-500)).toBe("00:00");
  });
});
