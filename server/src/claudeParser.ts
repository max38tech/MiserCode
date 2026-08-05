import type { ClaudeTurnResult, ClaudeUsage, PhaseId } from "./types.js";

interface RawClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface RawClaudeResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  cost_usd?: number;
  usage?: RawClaudeUsage;
  result?: string;
  session_id?: string;
}

const emptyUsage = (): ClaudeUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
});

/**
 * `claude -p ... --output-format json` prints exactly one JSON object to
 * stdout once the run finishes. In practice the stream can carry leading/
 * trailing whitespace or (rarely) benign log noise around it, so we scan for
 * the last balanced top-level JSON object in the buffer rather than doing a
 * naive JSON.parse on the whole thing.
 */
export function extractLastJsonObject(buffer: string): string | null {
  let depth = 0;
  let start = -1;
  let lastComplete: string | null = null;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          lastComplete = buffer.slice(start, i + 1);
        }
      }
    }
  }

  return lastComplete;
}

export function parseClaudeOutput(
  phase: PhaseId,
  stdoutBuffer: string,
  durationMs: number,
  fallbackIsError: boolean
): ClaudeTurnResult {
  const jsonText = extractLastJsonObject(stdoutBuffer);

  if (!jsonText) {
    return {
      phase,
      turnCount: 0,
      usage: emptyUsage(),
      totalCostUsd: 0,
      durationMs,
      isError: fallbackIsError,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as RawClaudeResult;
    const usage = parsed.usage ?? {};

    return {
      phase,
      turnCount: parsed.num_turns ?? 1,
      usage: {
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      },
      totalCostUsd: parsed.total_cost_usd ?? parsed.cost_usd ?? 0,
      durationMs: parsed.duration_ms ?? durationMs,
      isError: parsed.is_error ?? fallbackIsError,
      raw: parsed,
    };
  } catch {
    return {
      phase,
      turnCount: 0,
      usage: emptyUsage(),
      totalCostUsd: 0,
      durationMs,
      isError: fallbackIsError,
    };
  }
}
