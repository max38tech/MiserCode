import { Sparkles } from "lucide-react";
import type { ClaudeSessionStats, RateLimitHealth } from "../lib/types";

interface ClaudeUsageCardProps {
  stats: ClaudeSessionStats;
  rateLimit: RateLimitHealth;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-mono text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export function ClaudeUsageCard({ stats, rateLimit }: ClaudeUsageCardProps) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-900 p-4" data-testid="claude-usage-card">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-orange-400" />
        <h3 className="text-sm font-medium text-slate-200">Claude Pro Usage</h3>
      </div>

      <div className="grid grid-cols-2 gap-y-3">
        <Stat label="Turns" value={stats.turnCount.toString()} />
        <Stat label="Window (est.)" value={`${rateLimit.windowMinutes / 60}h rolling`} />
        <Stat label="Input Tokens" value={stats.inputTokens.toLocaleString()} />
        <Stat label="Output Tokens" value={stats.outputTokens.toLocaleString()} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-surface-700 pt-3">
        <span className="text-xs text-slate-400">Estimated Session Cost</span>
        <span className="font-mono text-sm font-semibold text-emerald-400">
          ${stats.totalCostUsd.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
