import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { useSettings } from "../hooks/useSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, loading, error, saving, saveGeminiApiKey, clearGeminiApiKey } = useSettings();
  const [inputValue, setInputValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue("");
      setJustSaved(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const ok = await saveGeminiApiKey(inputValue);
    if (ok) {
      setInputValue("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    }
  };

  const handleClear = async () => {
    const ok = await clearGeminiApiKey();
    if (ok) {
      setJustSaved(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-400" />
            <h2 id="settings-title" className="text-sm font-semibold text-slate-100">
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1 text-slate-400 transition hover:bg-surface-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="gemini-key" className="mb-1.5 block text-sm font-medium text-slate-200">
              Gemini API Key
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Used by Phase 2 (opencode / Gemini). Optional — if opencode already has a
              credential from <code className="text-slate-400">opencode auth login</code>, you
              only need this to override it or if that credential runs out of quota.
            </p>

            <div className="mb-2 text-xs text-slate-400" data-testid="settings-status">
              {loading ? (
                "Loading current status…"
              ) : settings?.geminiApiKeyConfigured ? (
                <>
                  Currently set:{" "}
                  <span className="font-mono text-slate-300">{settings.geminiApiKeyPreview}</span>
                </>
              ) : (
                "No key configured — using opencode's own stored credentials, if any."
              )}
            </div>

            <form onSubmit={handleSave} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  id="gemini-key"
                  type={reveal ? "text" : "password"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Paste a new Gemini API key…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-surface-600 bg-surface-800 py-2 pl-3 pr-9 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Hide key" : "Show key"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={saving || !inputValue.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClear}
                disabled={saving || !settings?.geminiApiKeyConfigured}
                className="text-xs text-slate-500 underline decoration-dotted hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
              >
                Clear saved key
              </button>
              {justSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved — takes effect immediately
                </span>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>

          {settings?.workDir && (
            <div className="border-t border-surface-700 pt-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Pipeline working directory
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-slate-400">{settings.workDir}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
