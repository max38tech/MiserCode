import { Gauge } from "lucide-react";
import type { RateLimitHealth } from "../lib/types";

const STATUS_COLOR: Record<RateLimitHealth["status"], string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

const STATUS_TEXT: Record<RateLimitHealth["status"], string> = {
  healthy: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

export function RateLimitBar({ rateLimit }: { rateLimit: RateLimitHealth }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-900 p-4" data-testid="rate-limit-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-medium text-slate-200">Rate Limit Health</h3>
        </div>
        <span className={`text-xs font-semibold uppercase ${STATUS_TEXT[rateLimit.status]}`}>
          {rateLimit.status}
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-surface-800"
        role="progressbar"
        aria-valuenow={rateLimit.utilizationPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${STATUS_COLOR[rateLimit.status]}`}
          style={{ width: `${rateLimit.utilizationPct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {rateLimit.turnsInWindow} turns in {rateLimit.windowMinutes / 60}h window
        </span>
        <span className="font-mono text-slate-200">{rateLimit.utilizationPct}%</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        ~{rateLimit.estimatedTurnsRemaining} turns remaining (estimate)
      </p>
    </div>
  );
}
