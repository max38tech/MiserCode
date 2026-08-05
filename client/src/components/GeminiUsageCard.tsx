import { Cpu } from "lucide-react";
import type { GeminiUsage } from "../lib/types";

const STATUS_LABEL: Record<GeminiUsage["lastStatus"], string> = {
  idle: "Idle",
  running: "Running",
  ok: "OK",
  error: "Error",
};

const STATUS_DOT: Record<GeminiUsage["lastStatus"], string> = {
  idle: "bg-slate-500",
  running: "bg-amber-400 animate-pulse-dot",
  ok: "bg-emerald-400",
  error: "bg-red-400",
};

export function GeminiUsageCard({ stats }: { stats: GeminiUsage }) {
  const throughput = stats.estimatedInputTokens + stats.estimatedOutputTokens;

  return (
    <div className="rounded-xl border border-surface-700 bg-surface-900 p-4" data-testid="gemini-usage-card">
      <div className="mb-3 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-medium text-slate-200">Gemini AI Studio Usage</h3>
      </div>

      <div className="grid grid-cols-2 gap-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Requests</p>
          <p className="font-mono text-lg font-semibold text-slate-100">{stats.requests}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Est. Throughput</p>
          <p className="font-mono text-lg font-semibold text-slate-100">{throughput.toLocaleString()} tok</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-surface-700 pt-3">
        <span className="text-xs text-slate-400">Status</span>
        <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-200">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[stats.lastStatus]}`} />
          {STATUS_LABEL[stats.lastStatus]}
        </span>
      </div>
    </div>
  );
}
