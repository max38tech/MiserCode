import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { config as loadEnv } from "dotenv";
import { Orchestrator } from "./orchestrator.js";
import { attachWebSocketServer } from "./wsServer.js";
import { upsertEnvValue } from "./envFile.js";
import {
  clearGoogleApiKey,
  defaultOpencodeAuthPath,
  getGoogleCredentialStatus,
  setGoogleApiKey,
} from "./opencodeAuth.js";

// __dirname here is server/src (dev, via tsx) or server/dist (built), so
// "../.." reaches the repo root in both cases. Loading the root .env
// explicitly means it's picked up regardless of which directory the
// process was actually launched from (npm workspaces run scripts with
// cwd set to the workspace folder, not the repo root).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
loadEnv({ path: ENV_PATH, quiet: true });
const OPENCODE_AUTH_PATH = defaultOpencodeAuthPath();

const PORT = Number(process.env.PORT ?? 3001);

// Defaults to a dedicated "work/" folder at the repo root, rather than
// process.cwd(), so pipeline output lands in a predictable place no matter
// which workspace directory the server process happens to be launched from.
const WORK_DIR = process.env.PIPELINE_WORK_DIR
  ? path.resolve(REPO_ROOT, process.env.PIPELINE_WORK_DIR)
  : path.join(REPO_ROOT, "work");
fs.mkdirSync(WORK_DIR, { recursive: true });

export function createApp(
  orchestrator: Orchestrator,
  options: { envPath?: string; opencodeAuthPath?: string } = {}
) {
  const envPath = options.envPath ?? ENV_PATH;
  const opencodeAuthPath = options.opencodeAuthPath ?? OPENCODE_AUTH_PATH;
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.get("/api/state", (_req: Request, res: Response) => {
    res.json(orchestrator.getState());
  });

  app.get("/api/settings", (_req: Request, res: Response) => {
    // getGoogleCredentialStatus reflects opencode's actual credential store
    // (~/.local/share/opencode/auth.json), which is what genuinely
    // determines which key opencode calls with. GEMINI_API_KEY is written
    // alongside it as a best-effort fallback for machines that have never
    // run `opencode auth login` at all, but once any credential is stored
    // there, opencode ignores the env var entirely - so that store, not
    // the env var, is the source of truth reported here.
    const status = getGoogleCredentialStatus(opencodeAuthPath);
    res.json({
      geminiApiKeyConfigured: status.configured,
      geminiApiKeyPreview: status.preview,
      workDir: orchestrator.getWorkDir(),
    });
  });

  app.put("/api/settings", (req: Request, res: Response) => {
    const { geminiApiKey } = req.body ?? {};
    if (typeof geminiApiKey !== "string") {
      res.status(400).json({ ok: false, error: "geminiApiKey must be a string" });
      return;
    }

    const trimmed = geminiApiKey.trim();

    if (trimmed) {
      // Equivalent to running `opencode auth login` and pasting this key -
      // the only thing that reliably makes opencode actually use it.
      setGoogleApiKey(opencodeAuthPath, trimmed);
      process.env.GEMINI_API_KEY = trimmed;
      upsertEnvValue(envPath, "GEMINI_API_KEY", trimmed);
    } else {
      // Equivalent to `opencode auth logout google`.
      clearGoogleApiKey(opencodeAuthPath);
      process.env.GEMINI_API_KEY = "";
      upsertEnvValue(envPath, "GEMINI_API_KEY", "");
    }

    const status = getGoogleCredentialStatus(opencodeAuthPath);
    res.json({
      ok: true,
      geminiApiKeyConfigured: status.configured,
      geminiApiKeyPreview: status.preview,
    });
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

export function createServer(
  orchestrator: Orchestrator = new Orchestrator({ workDir: WORK_DIR }),
  options: { envPath?: string; opencodeAuthPath?: string } = {}
) {
  const app = createApp(orchestrator, options);
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
