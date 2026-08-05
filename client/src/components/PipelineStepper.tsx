import { Check, Loader2, X, Circle } from "lucide-react";
import type { PhaseState, PhaseStatus, PipelineState } from "../lib/types";
import { PHASE_ORDER } from "../lib/types";

const STATUS_STYLES: Record<PhaseStatus, { ring: string; icon: JSX.Element; label: string }> = {
  pending: {
    ring: "border-surface-600 bg-surface-800 text-slate-500",
    icon: <Circle className="h-4 w-4" />,
    label: "Pending",
  },
  active: {
    ring: "border-indigo-500 bg-indigo-500/10 text-indigo-300",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: "In Progress",
  },
  completed: {
    ring: "border-emerald-500 bg-emerald-500/10 text-emerald-300",
    icon: <Check className="h-4 w-4" />,
    label: "Completed",
  },
  failed: {
    ring: "border-red-500 bg-red-500/10 text-red-300",
    icon: <X className="h-4 w-4" />,
    label: "Failed",
  },
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  plan: "claude -p (SPEC.md)",
  generate: "opencode run (Gemini)",
  verify: "claude -p (tests & fixes)",
};

export function PipelineStepper({ phases }: { phases: PipelineState["phases"] }) {
  return (
    <section
      className="rounded-xl border border-surface-700 bg-surface-900 p-4 sm:p-5"
      aria-label="Pipeline progress"
    >
      <h2 className="mb-4 text-sm font-medium text-slate-200">Pipeline Progress</h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PHASE_ORDER.map((id, index) => {
          const phase: PhaseState = phases[id];
          const style = STATUS_STYLES[phase.status];
          return (
            <li
              key={id}
              data-testid={`phase-${id}`}
              data-status={phase.status}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${style.ring}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current">
                {style.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Phase {index + 1}
                </p>
                <p className="truncate text-sm font-medium text-slate-100">{phase.label}</p>
                <p className="truncate font-mono text-[11px] text-slate-500">{PHASE_DESCRIPTIONS[id]}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
