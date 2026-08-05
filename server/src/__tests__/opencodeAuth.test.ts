import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearGoogleApiKey, getGoogleCredentialStatus, setGoogleApiKey } from "../opencodeAuth.js";

describe("opencodeAuth", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-auth-test-"));
    filePath = path.join(dir, "auth.json");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports not configured when the file doesn't exist", () => {
    const status = getGoogleCredentialStatus(filePath);
    expect(status.configured).toBe(false);
    expect(status.preview).toBeNull();
  });

  it("reports not configured when the file exists but has no google entry", () => {
    fs.writeFileSync(filePath, JSON.stringify({ anthropic: { type: "api", key: "sk-ant-xxx" } }));
    const status = getGoogleCredentialStatus(filePath);
    expect(status.configured).toBe(false);
  });

  it("sets a google credential in the same shape opencode auth login writes", () => {
    setGoogleApiKey(filePath, "AIzaSyABCDEFGHIJKLMNOP1234");
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(raw.google).toEqual({ type: "api", key: "AIzaSyABCDEFGHIJKLMNOP1234" });

    const status = getGoogleCredentialStatus(filePath);
    expect(status.configured).toBe(true);
    expect(status.preview).toBe("AIza••••1234");
  });

  it("preserves other providers' credentials when setting the google key", () => {
    fs.writeFileSync(filePath, JSON.stringify({ anthropic: { type: "api", key: "sk-ant-xxx" } }));
    setGoogleApiKey(filePath, "new-google-key-1234");
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(raw.anthropic).toEqual({ type: "api", key: "sk-ant-xxx" });
    expect(raw.google.key).toBe("new-google-key-1234");
  });

  it("creates parent directories if they don't exist yet", () => {
    const nestedPath = path.join(dir, "nested", "deeper", "auth.json");
    setGoogleApiKey(nestedPath, "some-key");
    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  it("clears only the google entry, leaving other providers intact", () => {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        google: { type: "api", key: "google-key" },
        anthropic: { type: "api", key: "sk-ant-xxx" },
      })
    );
    clearGoogleApiKey(filePath);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(raw.google).toBeUndefined();
    expect(raw.anthropic).toEqual({ type: "api", key: "sk-ant-xxx" });

    const status = getGoogleCredentialStatus(filePath);
    expect(status.configured).toBe(false);
  });

  it("treats a malformed auth.json as empty rather than throwing", () => {
    fs.writeFileSync(filePath, "{ not valid json");
    expect(() => getGoogleCredentialStatus(filePath)).not.toThrow();
    expect(getGoogleCredentialStatus(filePath).configured).toBe(false);
  });
});
