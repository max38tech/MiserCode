import fs from "node:fs";

/**
 * Sets KEY=value in a .env-style file, replacing an existing line for that
 * key in place (preserving every other line, including comments) or
 * appending a new one if the key isn't present yet. Creates the file if it
 * doesn't exist.
 */
export function upsertEnvValue(filePath: string, key: string, value: string): void {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const linePattern = new RegExp(`^${key}=`);

  let found = false;
  const nextLines = lines.map((line) => {
    if (linePattern.test(line)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, nextLines.join("\n"));
}

/**
 * Shows just enough of a secret to confirm which one is set, never the
 * full value: "AIza••••9f2k" style, or a flat mask for short values.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
