import { describe, expect, it } from "vitest";
import { extractLastJsonObject, parseClaudeOutput } from "../claudeParser.js";
import { claudeJsonStdout } from "./testUtils.js";

describe("extractLastJsonObject", () => {
  it("returns null when there is no JSON in the buffer", () => {
    expect(extractLastJsonObject("just some plain text output")).toBeNull();
  });

  it("extracts a single well-formed JSON object", () => {
    const json = extractLastJsonObject('{"a": 1, "b": {"c": 2}}');
    expect(json && JSON.parse(json)).toEqual({ a: 1, b: { c: 2 } });
  });

  it("ignores braces inside string values", () => {
    const json = extractLastJsonObject('{"text": "a { b } c"}');
    expect(json && JSON.parse(json)).toEqual({ text: "a { b } c" });
  });

  it("picks the last complete top-level object when several are present", () => {
    const buffer = 'log noise {"first": true}\nmore noise {"second": true}';
    const json = extractLastJsonObject(buffer);
    expect(json && JSON.parse(json)).toEqual({ second: true });
  });
});

describe("parseClaudeOutput", () => {
  it("parses usage, cost and turn count from a well-formed CLI result", () => {
    const stdout = claudeJsonStdout({
      num_turns: 3,
      total_cost_usd: 0.1234,
      usage: {
        input_tokens: 500,
        output_tokens: 250,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 20,
      },
    });

    const result = parseClaudeOutput("plan", stdout, 1000, false);

    expect(result.turnCount).toBe(3);
    expect(result.totalCostUsd).toBeCloseTo(0.1234);
    expect(result.usage).toEqual({
      inputTokens: 500,
      outputTokens: 250,
      cacheCreationInputTokens: 10,
      cacheReadInputTokens: 20,
    });
    expect(result.isError).toBe(false);
  });

  it("falls back gracefully when stdout has no JSON", () => {
    const result = parseClaudeOutput("verify", "no json here", 500, true);
    expect(result.turnCount).toBe(0);
    expect(result.totalCostUsd).toBe(0);
    expect(result.isError).toBe(true);
  });

  it("respects is_error from the parsed payload even if the process exited 0", () => {
    const stdout = claudeJsonStdout({ is_error: true });
    const result = parseClaudeOutput("verify", stdout, 100, false);
    expect(result.isError).toBe(true);
  });
});
