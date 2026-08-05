import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Header } from "./components/Header";
import { PromptPanel } from "./components/PromptPanel";
import { PipelineStepper } from "./components/PipelineStepper";
import { ClaudeUsageCard } from "./components/ClaudeUsageCard";
import { GeminiUsageCard } from "./components/GeminiUsageCard";
import { RateLimitBar } from "./components/RateLimitBar";
import { TerminalLog } from "./components/TerminalLog";
import { SettingsModal } from "./components/SettingsModal";
import { useOrchestrator } from "./hooks/useOrchestrator";
import { useStopwatch } from "./hooks/useStopwatch";
import { useInstallPrompt } from "./hooks/useInstallPrompt";

export default function App() {
  const {
    connectionStatus,
    state,
    logLines,
    claudeStats,
    geminiStats,
    rateLimit,
    lastError,
    startBuild,
    cancelBuild,
  } = useOrchestrator();

  const { canInstall, promptInstall } = useInstallPrompt();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isRunning = state.status === "running";
  const elapsed = useStopwatch(isRunning, state.startedAt, state.finishedAt);

  return (
    <div className="min-h-screen bg-surface-950">
      <Header
        connectionStatus={connectionStatus}
        elapsed={elapsed}
        canInstall={canInstall}
        onInstall={promptInstall}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {lastError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {lastError}
          </div>
        )}

        <PromptPanel
          isRunning={isRunning}
          disabled={connectionStatus !== "open"}
          onLaunch={startBuild}
          onCancel={cancelBuild}
        />

        <PipelineStepper phases={state.phases} />

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ClaudeUsageCard stats={claudeStats} rateLimit={rateLimit} />
          <GeminiUsageCard stats={geminiStats} />
          <RateLimitBar rateLimit={rateLimit} />
        </section>

        <TerminalLog lines={logLines} />
      </main>
    </div>
  );
}
