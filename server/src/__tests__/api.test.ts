import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { createServer } from "../index.js";
import { Orchestrator } from "../orchestrator.js";
import { createScriptedSpawn, claudeJsonStdout, type MockChild } from "./testUtils.js";
import type { ServerMessage } from "../types.js";

function successfulPlan(child: MockChild) {
  child.stdout.emit("data", Buffer.from(claudeJsonStdout()));
  child.emit("close", 0);
}
function successfulGenerate(child: MockChild) {
  child.stdout.emit("data", Buffer.from("done\n"));
  child.emit("close", 0);
}
function successfulVerify(child: MockChild) {
  child.stdout.emit("data", Buffer.from(claudeJsonStdout()));
  child.emit("close", 0);
}

describe("HTTP + WebSocket server", () => {
  let server: ReturnType<typeof createServer>["server"];
  let baseUrl: string;
  let wsUrl: string;
  let envDir: string;
  let envPath: string;
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;

  beforeEach(async () => {
    envDir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-test-"));
    envPath = path.join(envDir, ".env");
    delete process.env.GEMINI_API_KEY;

    const { spawnFn } = createScriptedSpawn([successfulPlan, successfulGenerate, successfulVerify]);
    const orchestrator = new Orchestrator({ spawnFn });
    ({ server } = createServer(orchestrator, { envPath }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
    wsUrl = `ws://localhost:${port}/ws`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(envDir, { recursive: true, force: true });
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
  });

  it("responds to /api/health", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects /api/start with an empty prompt", async () => {
    const res = await fetch(`${baseUrl}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts /api/start and reports state as running then completed", async () => {
    const res = await fetch(`${baseUrl}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Build a todo app" }),
    });
    expect(res.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const stateRes = await fetch(`${baseUrl}/api/state`);
    const state = await stateRes.json();
    expect(state.status).toBe("completed");
    expect(state.phases.plan.status).toBe("completed");
  });

  it("streams pipeline events to connected WebSocket clients", async () => {
    const socket = new WebSocket(wsUrl);
    const messages: ServerMessage[] = [];

    await new Promise<void>((resolve, reject) => {
      socket.on("open", resolve);
      socket.on("error", reject);
    });

    socket.on("message", (raw) => {
      messages.push(JSON.parse(raw.toString()));
    });

    const done = new Promise<void>((resolve) => {
      socket.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as ServerMessage;
        if (msg.type === "pipeline_done") resolve();
      });
    });

    socket.send(JSON.stringify({ type: "start", prompt: "Build a todo app" }));
    await done;
    socket.close();

    expect(messages.some((m) => m.type === "state")).toBe(true);
    expect(messages.some((m) => m.type === "log")).toBe(true);
    expect(messages.some((m) => m.type === "phase_update")).toBe(true);
    expect(messages.some((m) => m.type === "claude_usage")).toBe(true);
  });

  it("reports no Gemini key configured by default", async () => {
    const res = await fetch(`${baseUrl}/api/settings`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.geminiApiKeyConfigured).toBe(false);
    expect(body.geminiApiKeyPreview).toBeNull();
  });

  it("sets the Gemini key, masks it in the response, persists it to disk, and applies it live", async () => {
    const putRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiApiKey: "AIzaSyABCDEFGHIJKLMNOP1234" }),
    });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.ok).toBe(true);
    expect(putBody.geminiApiKeyConfigured).toBe(true);
    expect(putBody.geminiApiKeyPreview).toBe("AIza••••1234");
    expect(putBody.geminiApiKeyPreview).not.toContain("ABCDEFGHIJKLMNOP");

    expect(process.env.GEMINI_API_KEY).toBe("AIzaSyABCDEFGHIJKLMNOP1234");
    expect(fs.readFileSync(envPath, "utf8")).toContain(
      "GEMINI_API_KEY=AIzaSyABCDEFGHIJKLMNOP1234"
    );

    const getRes = await fetch(`${baseUrl}/api/settings`);
    const getBody = await getRes.json();
    expect(getBody.geminiApiKeyConfigured).toBe(true);
    expect(getBody.geminiApiKeyPreview).toBe("AIza••••1234");
  });

  it("clears the Gemini key when given an empty string", async () => {
    await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiApiKey: "some-key-value" }),
    });

    const clearRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiApiKey: "" }),
    });
    const clearBody = await clearRes.json();
    expect(clearBody.geminiApiKeyConfigured).toBe(false);
    expect(process.env.GEMINI_API_KEY).toBe("");
  });

  it("rejects a non-string geminiApiKey", async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiApiKey: 12345 }),
    });
    expect(res.status).toBe(400);
  });
});
