# AutoBuild Pipeline Dashboard

A PWA dashboard that orchestrates a three-phase autonomous software development
pipeline, driving the **Claude Code CLI** and **OpenCode (Gemini)** as child
processes and streaming their output live over WebSockets.

```
Phase 1  Architect & Plan   claude -p "<prompt>" --output-format json --dangerously-skip-permissions
Phase 2  Bulk Coding        opencode run "Read SPEC.md and generate source code" --auto --dir <work> --print-logs
Phase 3  Verification       claude -p "Inspect repo, run tests, fix errors until 100% pass" --output-format json --dangerously-skip-permissions
```

## Stack

- **server/** — Node.js + TypeScript, Express, `ws`, `child_process` orchestrator
- **client/** — React + Vite, Tailwind CSS, Lucide icons, `vite-plugin-pwa`

## Prerequisites

- Node.js >= 18.18
- [`claude`](https://docs.claude.com/en/docs/claude-code) CLI installed and authenticated on `PATH`
- [`opencode`](https://opencode.ai) CLI installed on `PATH`, authenticated to a
  provider — check with `opencode auth list`, or set one up from the
  dashboard's Settings panel (gear icon), see below.

## Setup

```bash
npm install
cp .env.example .env   # optional — fill in PIPELINE_WORK_DIR if you want a
                        # non-default location; GEMINI_API_KEY can be set
                        # from the dashboard itself, see below
```

`PIPELINE_WORK_DIR` should point at the repository the pipeline will operate
on (where `SPEC.md` and generated source land). It defaults to
`<repo root>/work/` if unset.

## Changing the Gemini API key

Click the gear icon in the header to open **Settings**. You can set, view
(masked), or remove the Gemini API key from there at any time — including
mid-session if the current one runs out of quota — with no server restart
needed.

Saving writes directly into **opencode's own credential store**,
`~/.local/share/opencode/auth.json` — the same file `opencode auth login`
writes to (`PUT /api/settings` → `server/src/opencodeAuth.ts`). This matters
because opencode ignores environment variables entirely for a provider once
*any* credential is stored there for it; setting `GEMINI_API_KEY` alone has
no effect in that case; it only serves as a best-effort fallback for a
machine that has never run `opencode auth login` at all
(`server/src/envFile.ts` handles that half). If you only set the env var and
wonder why opencode still seems to be using an old/different key, this is
why — use Settings (or `opencode auth login` directly) instead.

"Remove stored credential" is equivalent to `opencode auth logout google`.

## Development

```bash
npm run dev
```

Starts the API/WebSocket server on `:3001` and the Vite dev server on
`:5173` (which proxies `/api` and `/ws` to the backend).

## Production build

```bash
npm run build
npm run start -w server   # serve the API; deploy client/dist as static assets
```

`npm run build` type-checks and bundles both workspaces; the client build
also emits `manifest.webmanifest`, `sw.js`, and precached assets via
`vite-plugin-pwa` so the dashboard is installable and has an offline app
shell.

## Tests

```bash
npm run test
```

Runs the backend orchestrator test suite (Vitest, with `child_process.spawn`
mocked so no real CLIs are invoked) and the frontend component test suite
(Vitest + React Testing Library).

## How usage/cost tracking works

The `plan` and `verify` phases invoke `claude` with `--output-format json`,
which prints a single JSON result object (turn count, token usage,
`total_cost_usd`) to stdout when the run finishes. `server/src/claudeParser.ts`
extracts and parses that object; `server/src/orchestrator.ts` aggregates it
into running session totals broadcast to the UI as `claude_usage` events.
`server/src/rateLimit.ts` estimates rolling-window utilization from turn
timestamps — this is a UX estimate only, since the CLI does not expose exact
remaining quota.

## Environment variables

See `.env.example`. Notably `CLAUDE_WINDOW_MINUTES` /
`CLAUDE_MAX_TURNS_PER_WINDOW` tune the rate-limit health estimate to match
your actual Claude plan.

## Troubleshooting

**Phase 2 ("Bulk Coding") appears to hang with no output.** Most likely the
Gemini/Google API key `opencode` is authenticated with has hit its quota
(the free tier is 20 requests). `opencode`'s own retries against a
rate-limited provider don't stop on their own and are otherwise silent, so
without `--print-logs` (which the orchestrator always passes) the phase
just looks frozen instead of failing. With it, you'll see repeating
`AI_APICallError: You exceeded your current quota...` lines in the Live
Terminal Output — that confirms it's a provider-side quota issue, not an
app bug. Check https://ai.dev/rate-limit, wait for the window to reset, or
paste a different key into **Settings** (gear icon, top right) — it applies
immediately, no restart required. If a phase is still stuck after several
minutes, the orchestrator force-kills it and marks it failed after 15
minutes (`phaseTimeoutMs` in `Orchestrator`'s constructor options).

**Phase 2 fails with `spawn opencode ENOENT`.** On Windows, npm installs
most CLIs (including `opencode`) as `.cmd`/`.ps1` shims with no bare `.exe`
on `PATH`. Node's `child_process.spawn` with `shell: false` can't resolve
those directly. The orchestrator spawns via
[`cross-spawn`](https://www.npmjs.com/package/cross-spawn) specifically to
handle this without needing `shell: true` (which would reopen
shell-injection risk from the user prompt). If you still hit this, confirm
`opencode` is actually installed and on `PATH` for the same shell context
the server process runs in (`Get-Command opencode` in PowerShell — not just
git-bash's `which`, which resolves `PATH` differently).

**Generated files show up in an unexpected folder.** All three phases run
with their cwd set to `PIPELINE_WORK_DIR` (default: `<repo root>/work/`,
auto-created). If that folder doesn't have what you expect, check `.env`.

**I set a new key in Settings but it's still quota-exceeded / AI Studio shows
zero usage on the new key.** This was a real bug: opencode ignores
`GEMINI_API_KEY` entirely for the Google provider once *any* credential is
already stored in `~/.local/share/opencode/auth.json` — env vars are only
consulted when that file has no entry for the provider at all. Settings now
writes directly into that file, not just the env var, so this should no
longer happen; if it still does, run `opencode auth list` to see which
credential is actually stored, and cross-check its key preview against what
Settings shows.

**The Live Terminal Output shows every line doubled (or worse, tripled and
climbing) during a long dev session.** React 18 StrictMode double-invokes
effects in development to catch missing cleanup; `useOrchestrator`'s
WebSocket-connect effect used to leave a stale socket's handlers attached
after `close()` (an async operation), so a message arriving during that
window could land on both the old and new socket. Worse, if that stale
socket's `onclose` fired later, it would blindly null the tracked ref and
schedule a phantom reconnect — spawning yet another socket while the
previous one silently leaked, orphaned but still receiving every broadcast,
compounding over the length of the session. Fixed by detaching handlers
before `close()` in the effect cleanup, and by having every handler check
it's still the currently-tracked socket before doing anything. Dev-only
(`npm run dev`) — StrictMode's double-invoke is stripped from production
builds, so `client/dist` was never affected.
