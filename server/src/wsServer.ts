import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Orchestrator } from "./orchestrator.js";
import type { ClientMessage, ServerMessage } from "./types.js";

function safeSend(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function broadcast(wss: WebSocketServer, message: ServerMessage): void {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function attachWebSocketServer(server: HttpServer, orchestrator: Orchestrator): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  orchestrator.on("state", (state) => broadcast(wss, { type: "state", state }));
  orchestrator.on("log", (line) => broadcast(wss, { type: "log", line }));
  orchestrator.on("phase_update", (phase) => broadcast(wss, { type: "phase_update", phase }));
  orchestrator.on("claude_usage", (stats, rateLimit) =>
    broadcast(wss, { type: "claude_usage", stats, rateLimit })
  );
  orchestrator.on("gemini_usage", (stats) => broadcast(wss, { type: "gemini_usage", stats }));
  orchestrator.on("pipeline_done", (status) => broadcast(wss, { type: "pipeline_done", status }));

  wss.on("connection", (socket) => {
    safeSend(socket, { type: "state", state: orchestrator.getState() });

    socket.on("message", (raw) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        safeSend(socket, { type: "error", message: "Malformed message payload" });
        return;
      }

      switch (message.type) {
        case "start":
          orchestrator.start(message.prompt).catch((err) => {
            safeSend(socket, {
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            });
          });
          break;
        case "cancel":
          orchestrator.cancel();
          break;
        case "request_state":
          safeSend(socket, { type: "state", state: orchestrator.getState() });
          break;
        default:
          safeSend(socket, { type: "error", message: "Unknown message type" });
      }
    });
  });

  return wss;
}
