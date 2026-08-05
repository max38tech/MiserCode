import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { config as loadEnv } from "dotenv";
import { Orchestrator } from "./orchestrator.js";
import { attachWebSocketServer } from "./wsServer.js";

// __dirname here is server/src (dev, via tsx) or server/dist (built), so
// "../.." reaches the repo root in both cases. Loading the root .env
// explicitly means it's picked up regardless of which directory the
// process was actually launched from (npm workspaces run scripts with
// cwd set to the workspace folder, not the repo root).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(REPO_ROOT, ".env"), quiet: true });

const PORT = Number(process.env.PORT ?? 3001);

// Defaults to a dedicated "work/" folder at the repo root, rather than
// process.cwd(), so pipeline output lands in a predictable place no matter
// which workspace directory the server process happens to be launched from.
const WORK_DIR = process.env.PIPELINE_WORK_DIR
  ? path.resolve(REPO_ROOT, process.env.PIPELINE_WORK_DIR)
  : path.join(REPO_ROOT, "work");
fs.mkdirSync(WORK_DIR, { recursive: true });

export function createApp(orchestrator: Orchestrator) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.get("/api/state", (_req: Request, res: Response) => {
    res.json(orchestrator.getState());
  });

  app.post("/api/start", async (req: Request, res: Response) => {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    if (!prompt.trim()) {
      res.status(400).json({ ok: false, error: "prompt is required" });
      return;
    }
    if (orchestrator.isRunning()) {
      res.status(409).json({ ok: false, error: "a pipeline run is already in progress" });
      return;
    }

    orchestrator.start(prompt).catch((err) => {
      // Errors from the pipeline itself surface via WebSocket events and
      // orchestrator.state; this catch only guards against unhandled rejection.
      console.error("Pipeline run failed:", err);
    });

    res.status(202).json({ ok: true, runId: orchestrator.getState().runId });
  });

  app.post("/api/cancel", (_req: Request, res: Response) => {
    orchestrator.cancel();
    res.json({ ok: true });
  });

  return app;
}

export function createServer(orchestrator: Orchestrator = new Orchestrator({ workDir: WORK_DIR })) {
  const app = createApp(orchestrator);
  const server = http.createServer(app);
  attachWebSocketServer(server, orchestrator);
  return { app, server, orchestrator };
}

// This module is only ever the process entry point (`tsx src/index.ts` /
// `node dist/index.js`); tests import createApp/createServer directly and
// never load this file, so it's safe to start listening unconditionally.
if (process.env.NODE_ENV !== "test") {
  const { server } = createServer();
  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT} (ws path: /ws)`);
  });
}
