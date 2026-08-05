import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, TerminalSquare } from "lucide-react";
import type { LogLine } from "../lib/types";

const LEVEL_CLASSES: Record<LogLine["level"], string> = {
  info: "text-slate-300",
  success: "text-emerald-400",
  error: "text-red-400",
  warn: "text-amber-400",
};

const PHASE_BADGE: Record<string, string> = {
  plan: "bg-indigo-500/20 text-indigo-300",
  generate: "bg-blue-500/20 text-blue-300",
  verify: "bg-violet-500/20 text-violet-300",
  system: "bg-surface-700 text-slate-400",
};

export function TerminalLog({ lines }: { lines: LogLine[] }) {
  const [scrollLocked, setScrollLocked] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollLocked || !containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [lines, scrollLocked]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setScrollLocked(atBottom);
  };

  return (
    <section className="flex flex-col rounded-xl border border-surface-700 bg-black/60">
      <div className="flex items-center justify-between border-b border-surface-700 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-medium text-slate-200">Live Terminal Output</h3>
        </div>
        <button
          type="button"
          onClick={() => setScrollLocked((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-surface-800 hover:text-slate-200"
          aria-pressed={scrollLocked}
        >
          {scrollLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          {scrollLocked ? "Scroll Locked" : "Scroll Unlocked"}
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        data-testid="terminal-log"
        className="scrollbar-thin h-80 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed sm:h-96"
      >
        {lines.length === 0 ? (
          <p className="text-slate-600">Waiting for pipeline output…</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex gap-2 whitespace-pre-wrap break-all">
              <span
                className={`shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-[18px] ${PHASE_BADGE[line.phase] ?? PHASE_BADGE.system}`}
              >
                {line.phase}
              </span>
              <span className={LEVEL_CLASSES[line.level]}>{line.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
