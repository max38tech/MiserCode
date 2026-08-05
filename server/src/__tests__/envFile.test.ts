import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { maskSecret, upsertEnvValue } from "../envFile.js";

describe("upsertEnvValue", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "envfile-test-"));
    filePath = path.join(dir, ".env");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates the file with the new key when it doesn't exist", () => {
    upsertEnvValue(filePath, "GEMINI_API_KEY", "secret123");
    expect(fs.readFileSync(filePath, "utf8")).toContain("GEMINI_API_KEY=secret123");
  });

  it("replaces an existing key's value in place, preserving other lines", () => {
    fs.writeFileSync(filePath, "PORT=3001\nGEMINI_API_KEY=old-value\nCLAUDE_WINDOW_MINUTES=300\n");
    upsertEnvValue(filePath, "GEMINI_API_KEY", "new-value");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("PORT=3001");
    expect(content).toContain("GEMINI_API_KEY=new-value");
    expect(content).toContain("CLAUDE_WINDOW_MINUTES=300");
    expect(content).not.toContain("old-value");
  });

  it("preserves comments and blank lines", () => {
    fs.writeFileSync(filePath, "# a comment\n\nGEMINI_API_KEY=x\n");
    upsertEnvValue(filePath, "GEMINI_API_KEY", "y");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("# a comment");
    expect(content).toContain("GEMINI_API_KEY=y");
  });

  it("appends a new key rather than clobbering unrelated content", () => {
    fs.writeFileSync(filePath, "PORT=3001\n");
    upsertEnvValue(filePath, "GEMINI_API_KEY", "abc");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("PORT=3001");
    expect(content).toContain("GEMINI_API_KEY=abc");
  });

  it("can set an empty value to clear a key", () => {
    fs.writeFileSync(filePath, "GEMINI_API_KEY=something\n");
    upsertEnvValue(filePath, "GEMINI_API_KEY", "");
    expect(fs.readFileSync(filePath, "utf8")).toContain("GEMINI_API_KEY=\n");
  });
});

describe("maskSecret", () => {
  it("shows first 4 and last 4 characters for long values", () => {
    expect(maskSecret("AIzaSyABCDEFGHIJKLMNOP1234")).toBe("AIza••••1234");
  });

  it("fully masks short values", () => {
    expect(maskSecret("short")).toBe("••••");
  });
});
