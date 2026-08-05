import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { maskSecret } from "./envFile.js";

/**
 * opencode stores provider credentials here (the same file `opencode auth
 * login` writes to), independent of any environment variable. Critically,
 * once an entry exists for a provider, opencode always uses it and never
 * falls back to checking env vars for that provider again — so this file,
 * not GEMINI_API_KEY, is the only thing that actually controls which
 * Google/Gemini credential opencode calls with.
 */
export function defaultOpencodeAuthPath(): string {
  return path.join(os.homedir(), ".local", "share", "opencode", "auth.json");
}

interface AuthEntry {
  type: string;
  key?: string;
  [extra: string]: unknown;
}

type AuthFile = Record<string, AuthEntry>;

function readAuthFile(filePath: string): AuthFile {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as AuthFile) : {};
  } catch {
    return {};
  }
}

function writeAuthFile(filePath: string, data: AuthFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export interface GoogleCredentialStatus {
  configured: boolean;
  preview: string | null;
}

export function getGoogleCredentialStatus(filePath: string): GoogleCredentialStatus {
  const key = readAuthFile(filePath).google?.key;
  if (typeof key === "string" && key.length > 0) {
    return { configured: true, preview: maskSecret(key) };
  }
  return { configured: false, preview: null };
}

/** Equivalent to `opencode auth login` choosing Google and pasting this key. */
export function setGoogleApiKey(filePath: string, key: string): void {
  const data = readAuthFile(filePath);
  data.google = { type: "api", key };
  writeAuthFile(filePath, data);
}

/** Equivalent to `opencode auth logout google`. */
export function clearGoogleApiKey(filePath: string): void {
  const data = readAuthFile(filePath);
  delete data.google;
  writeAuthFile(filePath, data);
}
