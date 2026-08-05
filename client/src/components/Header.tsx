import { Download, Settings, Terminal, Wifi, WifiOff, Loader2 } from "lucide-react";
import type { ConnectionStatus } from "../hooks/useOrchestrator";

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  elapsed: string;
  canInstall: boolean;
  onInstall: () => void;
  onOpenSettings: () => void;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; className: string; icon: typeof Wifi }> = {
  open: { label: "Connected", className: "text-emerald-400", icon: Wifi },
  connecting: { label: "Connecting…", className: "text-amber-400", icon: Loader2 },
  closed: { label: "Disconnected", className: "text-red-400", icon: WifiOff },
};

export function Header({ connectionStatus, elapsed, canInstall, onInstall, onOpenSettings }: HeaderProps) {
  const status = STATUS_CONFIG[connectionStatus];
  const StatusIcon = status.icon;

  return (
    <header className="sticky top-0 z-20 border-b border-surface-700 bg-surface-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-slate-50 sm:text-base">
              AutoBuild Pipeline
            </h1>
            <p className="text-xs text-slate-400">Claude Code + Gemini orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div
            className="flex items-center gap-1.5 text-xs font-medium sm:text-sm"
            data-testid="connection-status"
          >
            <StatusIcon
              className={`h-4 w-4 ${status.className} ${connectionStatus === "connecting" ? "animate-spin" : ""}`}
            />
            <span className={status.className}>{status.label}</span>
          </div>

          <div className="hidden items-center gap-1.5 rounded-md bg-surface-800 px-2.5 py-1 font-mono text-xs text-slate-300 sm:flex" data-testid="timer">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {elapsed}
          </div>

          {canInstall && (
            <button
              type="button"
              onClick={onInstall}
              className="flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-600/20 px-2.5 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-600/30"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-surface-800 hover:text-slate-200"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
