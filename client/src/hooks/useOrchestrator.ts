import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClaudeSessionStats,
  ClientMessage,
  GeminiUsage,
  LogLine,
  PipelineState,
  RateLimitHealth,
  ServerMessage,
} from "../lib/types";

export type ConnectionStatus = "connecting" | "open" | "closed";

const MAX_LOG_LINES = 4000;
const RECONNECT_BASE_DELAY_MS = 800;
const RECONNECT_MAX_DELAY_MS = 8000;

function wsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function emptyState(): PipelineState {
  return {
    runId: null,
    prompt: "",
    status: "idle",
    startedAt: null,
    finishedAt: null,
    phases: {
      plan: { id: "plan", label: "Architect & Plan", status: "pending", startedAt: null, finishedAt: null, exitCode: null },
      generate: { id: "generate", label: "Bulk Coding", status: "pending", startedAt: null, finishedAt: null, exitCode: null },
      verify: { id: "verify", label: "Autonomous Testing & Fixes", status: "pending", startedAt: null, finishedAt: null, exitCode: null },
    },
    claude: {
      turnCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalCostUsd: 0,
      turns: [],
      windowStartedAt: null,
    },
    gemini: { requests: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, lastStatus: "idle" },
    rateLimit: { utilizationPct: 0, windowMinutes: 300, turnsInWindow: 0, estimatedTurnsRemaining: 0, status: "healthy" },
  };
}

export function useOrchestrator() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<PipelineState>(emptyState);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [claudeStats, setClaudeStats] = useState<ClaudeSessionStats>(emptyState().claude);
  const [rateLimit, setRateLimit] = useState<RateLimitHealth>(emptyState().rateLimit);
  const [geminiStats, setGeminiStats] = useState<GeminiUsage>(emptyState().gemini);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    setConnectionStatus("connecting");

    const socket = new WebSocket(wsUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionStatus("open");
    };

    socket.onclose = () => {
      setConnectionStatus("closed");
      socketRef.current = null;
      if (unmountedRef.current) return;
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (message.type) {
        case "state":
          setState(message.state);
          setClaudeStats(message.state.claude);
          setGeminiStats(message.state.gemini);
          setRateLimit(message.state.rateLimit);
          break;
        case "log":
          setLogLines((prev) => {
            const next = [...prev, message.line];
            return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
          });
          break;
        case "phase_update":
          setState((prev) => ({
            ...prev,
            phases: { ...prev.phases, [message.phase.id]: message.phase },
          }));
          break;
        case "claude_usage":
          setClaudeStats(message.stats);
          setRateLimit(message.rateLimit);
          break;
        case "gemini_usage":
          setGeminiStats(message.stats);
          break;
        case "pipeline_done":
          setState((prev) => ({ ...prev, status: message.status }));
          break;
        case "error":
          setLastError(message.message);
          break;
      }
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

      // Detach handlers before closing, not just close(): WebSocket.close()
      // is async (real close handshake), so under React 18 StrictMode's
      // dev-only double-invoke of effects, a message can still arrive on
      // this socket after close() is called but before the connection
      // actually drops — while the *next* mount's socket is also live and
      // receiving the same broadcast. Without this, that race double-fires
      // every server message (log lines, phase updates, etc.) into state.
      const socket = socketRef.current;
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLastError("Not connected to the orchestrator server");
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  const startBuild = useCallback(
    (prompt: string) => {
      setLogLines([]);
      setLastError(null);
      send({ type: "start", prompt });
    },
    [send]
  );

  const cancelBuild = useCallback(() => {
    send({ type: "cancel" });
  }, [send]);

  return {
    connectionStatus,
    state,
    logLines,
    claudeStats,
    geminiStats,
    rateLimit,
    lastError,
    startBuild,
    cancelBuild,
  };
}
