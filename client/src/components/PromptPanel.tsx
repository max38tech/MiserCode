import { useState } from "react";
import { Rocket, Square } from "lucide-react";

interface PromptPanelProps {
  isRunning: boolean;
  disabled: boolean;
  onLaunch: (prompt: string) => void;
  onCancel: () => void;
}

export function PromptPanel({ isRunning, disabled, onLaunch, onCancel }: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;
    onLaunch(prompt.trim());
  };

  return (
    <section className="rounded-xl border border-surface-700 bg-surface-900 p-4 sm:p-5">
      <form onSubmit={handleSubmit}>
        <label htmlFor="prompt" className="mb-2 block text-sm font-medium text-slate-200">
          Describe the build task
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isRunning}
          rows={4}
          placeholder="e.g. Build a REST API for a habit tracker with SQLite persistence and JWT auth"
          className="w-full resize-none rounded-lg border border-surface-600 bg-surface-800 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Runs Plan → Generate → Verify autonomously via Claude Code and OpenCode/Gemini.
          </p>

          {isRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            >
              <Square className="h-4 w-4" />
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !prompt.trim()}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Rocket className="h-4 w-4" />
              Launch Autonomous Build
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
