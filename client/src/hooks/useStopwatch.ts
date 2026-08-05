import { useEffect, useState } from "react";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Ticks a running elapsed-time counter anchored to startedAt while `running`
 * is true, and freezes at the final elapsed value once it stops.
 */
export function useStopwatch(running: boolean, startedAt: number | null, finishedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!startedAt) return "00:00";
  const end = running ? now : (finishedAt ?? now);
  return formatDuration(end - startedAt);
}
