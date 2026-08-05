import { useCallback, useEffect, useState } from "react";

export interface SettingsData {
  geminiApiKeyConfigured: boolean;
  geminiApiKeyPreview: string | null;
  workDir: string;
}

interface UseSettingsResult {
  settings: SettingsData | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  refresh: () => Promise<void>;
  saveGeminiApiKey: (key: string) => Promise<boolean>;
  clearGeminiApiKey: () => Promise<boolean>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
      setSettings(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const putGeminiApiKey = useCallback(async (geminiApiKey: string): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed to save (${res.status})`);
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              geminiApiKeyConfigured: body.geminiApiKeyConfigured,
              geminiApiKeyPreview: body.geminiApiKeyPreview,
            }
          : prev
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API key");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveGeminiApiKey = useCallback((key: string) => putGeminiApiKey(key.trim()), [putGeminiApiKey]);
  const clearGeminiApiKey = useCallback(() => putGeminiApiKey(""), [putGeminiApiKey]);

  return { settings, loading, error, saving, refresh, saveGeminiApiKey, clearGeminiApiKey };
}
