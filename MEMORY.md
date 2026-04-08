# SYSTEM Memory — Persistent State

> **This file is the single source of truth for cross-session continuity.**
> Every agent session MUST read this file at startup and update it before ending.
> Run `bash execution/health.sh` first thing to verify everything is alive.
> Committed to GitHub so nothing is ever lost.

---

## Last Updated
`2026-04-07T17:35:00-04:00` — Session: OpenClaw Chat Fix + System Boot

## Who Does What
```
Jeff (human) → speaks naturally, gives direction, reviews output
Antigravity (orchestrator) → reads MEMORY.md, makes decisions, writes code, manages OpenClaw
OpenClaw (executor) → runs skills, sends messages, executes tasks via gateway
Dashboard (visual) → localhost:3111, the command center Jeff sees every day
```

**Jeff just talks. Antigravity handles everything underneath.**

## Response Timing Benchmarks
| Query | Time | Notes |
|-------|------|-------|
| Simple text ("say OK") | 9.0s | Baseline, no tool use |
| Weather check (wttr.in) | 27s | Used weather skill |
| Reminders query | 13.2s | Used apple-reminders skill, returned real data |
| Tool listing | 38s | Listed all 51 skills |

**Target:** Sub-10s for simple queries, sub-20s for tool use.

## Current Architecture
```
User (Jeff) → Antigravity (orchestrator) → OpenClaw Gateway (18789) → Dashboard (3111)
```

## Active Services

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| OpenClaw Gateway | 18789 | ✅ LIVE | LaunchAgent `ai.openclaw.gateway`, auto-starts on boot |
| Dashboard Server | 3111 | ✅ LIVE | WebSocket + HTTP, serves `dashboard/public/` |
| Telemetry Strip | (global) | ✅ LIVE | Always visible above console on ALL pages |
| OpenClaw Console | (global) | ✅ LIVE | Always visible at bottom on ALL pages, shows real-time activity |
| OpenClaw Control UI | 18789 (web) | ⚠️ BLANK | Not critical, our dashboard is primary |

## Dashboard Pages

| Page | Sidebar Icon | What It Shows |
|------|-------------|---------------|
| **Home** | 🏠 House | Today's Focus, Schedule, Inbox, Board + drawing canvas |
| **Mail** | ✉️ Envelope | Split-pane inbox: list left, preview right. Click to read. |
| **Calendar** | 📅 Calendar | Schedule detail view |
| **Board** | ✏️ Pencil | Task board + whiteboard |
| **Studio** | 🖼 Picture | Nano Banana image generation studio |
| **Chat** | 💬 Bubble | Live OpenClaw chat interface |
| **Contacts** | 👥 People | Priority-ordered contact cards with project context |

**Global elements (always visible on every page):**
- Telemetry Status Strip (ONLINE, CPU, MEM, SESSION, ACTIVITY chain, LATENCY)
- OpenClaw Console (scrolling log of all system activity)

## OpenClaw Auth & API Key Architecture
- **OpenClaw auth:** OAuth via Google account (`donnywonny2023@gmail.com`) — managed in `~/.openclaw/openclaw.json`
- **Provider:** `google-antigravity` — tokens auto-refresh, no static key needed
- **Default model:** `google/gemini-2.5-flash`
- **Available models:** 50 total (see `research/gemini-models.md`)
- **Rate limits (Tier 1):** 150 RPM, 1M TPM, 10K RPD
- **Gateway token:** stored in `~/.openclaw/openclaw.json` → `gateway.auth.token`
- **Gemini API key (admin only):** `AIzaSyDeaDQNsaRBcBv54RHkOCGiuUONFdyJGAw` — project `493315853766`
  - Use ONLY for research (listing models, checking billing)
  - All production execution goes through OpenClaw (never call Gemini API directly)
  - Stored in `SYSTEM/.env` (gitignored)

**CRITICAL:** `~/.hermes/` is an OLD unrelated framework. Never reference it. OpenClaw config is `~/.openclaw/`.

## Working API Patterns
```bash
# Health (no auth)
curl -s http://127.0.0.1:18789/health
# → {"ok":true,"status":"live"}

# Models (auth required)
curl -s http://127.0.0.1:18789/v1/models -H "Authorization: Bearer $TOKEN"
# → openclaw, openclaw/default, openclaw/main

# Chat (auth required, enabled in config)
curl -s http://127.0.0.1:18789/v1/chat/completions -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"model":"openclaw/default","messages":[{"role":"user","content":"..."}]}'

# Direct tool invoke (auth required, always enabled)
curl -sS http://127.0.0.1:18789/tools/invoke -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"tool":"sessions_list","action":"json","args":{}}'

# Chat via dashboard (preferred — uses direct HTTP API, no stale sessions)
curl -s -X POST http://localhost:3111/api/openclaw-chat -H "Content-Type: application/json" -d '{"message":"..."}'
# CRITICAL: Dashboard chat uses HTTP API internally, NOT `openclaw agent --message` CLI.
# The CLI reuses old sessions that accumulate prompt-errors. HTTP API creates fresh sessions.

# Scene switch (instant — no mouse needed)
curl -s -X POST http://localhost:3111/api/scene -H "Content-Type: application/json" -d '{"scene":"home"}'
# Valid scenes: home, mail, calendar, whiteboard, studio, chat, contacts, openclaw

# Force browser refresh
curl -s -X POST http://localhost:3111/api/refresh -H "Content-Type: application/json"
```

## Dashboard Data Flow
All data retrieval goes through deterministic scripts. No LLM tokens used for data feeds.
```
Cron → scripts → AppleScript/curl/API → JSON → POST /api/push → Dashboard renders
```

### Data Feed Scripts
| Script | Depends On | Status | Cron |
|--------|-----------|--------|------|
| `execution/check_mail_himalaya.py` | himalaya CLI (IMAP → iCloud) | ✅ Working | Every 5 min, ~1.5s |
| `execution/check_calendar.sh` | Apple Calendar (AppleScript) | ✅ Working | Every 15 min, ~0.2s |
| `execution/check_weather.py` | Open-Meteo API (free, no key) | ✅ Working | Every 30 min, ~0.9s |
| `execution/check_contacts.sh` | Apple Contacts (AppleScript) | ✅ Working | Manual / on-demand |

**Calendar script auto-launches Calendar.app** if not running (uses `pgrep` + `open -a Calendar`). Times are 12-hour AM/PM, all-day events show "All Day".

**Contacts script** also symlinked at `~/.local/bin/check_contacts` for OpenClaw access. Supports: `search "name"`, `list`, `count`.

**Deleted legacy scripts:** `check_mail.sh`, `check_weather.sh`, `check_mail_openclaw.sh` — replaced by himalaya + Open-Meteo versions.

### Cron Jobs (Auto-Refresh)
**Calendar** runs on system `crontab` (reliable, zero tokens).
**Mail + Weather** should run on OpenClaw cron for portability.

| Interval | Script | Engine | Status |
|----------|--------|--------|--------|
| Every 5 min | `check_mail_himalaya.py` | ⚠️ NEEDS SETUP — OpenClaw cron | Pending |
| Every 15 min | `check_calendar.sh` | ✅ System crontab | Working |
| Every 30 min | `check_weather.py` | ⚠️ NEEDS SETUP — OpenClaw cron | Pending |

**IMPORTANT — Cron job creation:**
- OpenClaw cron uses `agentTurn` payload kind which burns a full Gemini inference just to exec a script
- Previous crons failed because `delivery: announce` tried Telegram `@heartbeat` which doesn't exist
- Use `delivery: { mode: "none" }` (silent) for data feed crons
- Create via `./execution/agent_cmd.sh` or chat: "Create cron check-mail every 5 minutes, silent delivery, exec python3 /path/to/check_mail_himalaya.py"
- The scripts themselves are fast (<2s each), the slowness was only from the AI inference wrapping them

### Monitoring & Logging
| What | Where | Persists? |
|------|-------|---------| 
| OpenClaw health | Dashboard polls `/api/hermes-status` every 15s | No (live only) |
| Console log | `dashboard/data/history.json` | ✅ Yes — reloads on page refresh |
| OpenClaw raw logs | `~/.openclaw/logs/gateway.log` | ✅ Yes |

## Telegram Integration
- **Bot paired:** User ID `7095320256`, fully verified two-way messaging
- **Outbound command:** `openclaw message send --channel telegram --target "7095320256" --message "..."`
- **Inbound:** Messages from Telegram flow into the active JSONL session and render in the Dashboard chat UI
- **Session file:** `~/.openclaw/agents/main/sessions/*.jsonl` (most recent by mtime)

## Contacts System
- **Data source:** Apple Contacts via AppleScript (`execution/check_contacts.sh`)
- **OpenClaw access:** Symlinked at `~/.local/bin/check_contacts` (avoids space-in-path issues)
- **Dashboard page:** `contacts.js` renders card grid sorted by priority
- **Current contacts:** Dare'l McMillian (#1), Callie Bea (#2), J. Kerr (#3), Court (#4), Mike Steems (#5)
- **Card features:** Avatar initials, org, email, phone, project tags, hover animations

## Key File Locations
- **OpenClaw source:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/openclaw/`
- **OpenClaw config:** `~/.openclaw/openclaw.json`
- **OpenClaw workspace:** `~/.openclaw/workspace/`
- **OpenClaw logs:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- **Dashboard code:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/dashboard/`
- **Dashboard data:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/dashboard/data/`
- **Execution scripts:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/execution/`
- **Directives:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/directives/`

## OpenClaw Capabilities (audited 2026-04-07)
- **Files:** `read`, `edit`, `write`
- **Shell:** `exec`, `process`
- **Scheduling:** `cron` (reminders, recurring tasks, deferred follow-ups)
- **Media:** `image_generate`, `music_generate`, `video_generate`
- **Web:** `web_search` (via Firecrawl)
- **Multi-Agent:** `sessions_spawn`, `sessions_send`, `sessions_yield`, `sessions_list`, `sessions_history`
- **Contacts:** via `~/.local/bin/check_contacts` (custom AppleScript bridge)
- **Email:** `himalaya` (configured for iCloud, colour8k@mac.com)

## Telemetry Strip (global — always visible)
- **Row 1:** ONLINE dot, UPTIME, SESSION ID, TURNS, CPU sparkline, MEM bar
- **Row 2:** Activity event chain (colored pills), ↓/↑ data counters, LATENCY sparkline
- **Position:** Above OpenClaw Console, outside scene container, persists on ALL pages
- **Data sources:** OS module (CPU/MEM), JSONL log tailing (events), zero API cost

## Errors Encountered & Fixes
| Error | Root Cause | Fix |
|-------|-----------|-----|
| `check_mail.sh` fails | Referenced `$HOME/.hermes/skills/apple-mail/` which is archived | Rewrote to use direct AppleScript |
| Calendar "Application isn't running" | Calendar.app not open | Script now auto-launches via `open -a Calendar` |
| Calendar shows 0 events | Bash `IFS='|||'` splits on each `|` individually | Rewrote JSON builder in Python |
| Calendar shows military time | AppleScript returns 24h format | Python converts to 12h AM/PM, 00:00 → "All Day" |
| Data feed scripts vanish from git | Accidentally deleted in prior git restore | Recovered from history, re-committed with proper tracking |
| OpenClaw Control UI blank | Web component doesn't render | Not critical — our dashboard at 3111 is primary |
| `openclaw agent --message` fails | Requires flags | Use HTTP API `/v1/chat/completions` instead |
| Calendar path spaces | OpenClaw can't exec paths with spaces | Symlinked to `~/.local/bin/check_contacts` |
| `EAGAIN` Node.js Exception | `tailProc.kill()` leaked zombies | `killall tail`, migrated to streaming |
| Duplicate Chat Bubbles | Redundant broadcast from chat endpoint | JSONL watcher is single source of truth |
| OpenClaw chat timeout (60s) | `openclaw agent --message` CLI reuses stale sessions with accumulated `prompt-error` entries | Rewrote dashboard chat to use direct HTTP API (`/v1/chat/completions`) — fast, creates fresh sessions |
| Double response in chat | Both direct API and JSONL watcher broadcast the same response | Normalized dedup key in `pushToConsole` strips timing prefix before comparing |
| `health.sh` reports false failures | Script checked for deleted legacy scripts (`check_mail.sh`, `check_weather.sh`) | Updated to check current names (`check_mail_himalaya.py`, `check_weather.py`) |

## User Preferences (Immutable)
- **READ-ONLY** for all Apple integrations (Calendar, Mail) — never write/send
- **No-Wait Philosophy** — 10s command timeout max
- **Browser is Jeff's display** — always push results visually
- **Never ask, just build** — ship complete features, not questions
- **External drive only** — project code stays on `/Volumes/WORK 2TB/`
- **Product engineer mindset** — make the dashboard a daily command center
- **Telemetry transparency** — all OpenClaw commands go through `agent_cmd.sh` for console visibility
- **Jeff just talks** — Antigravity handles all technical execution and OpenClaw management
- **ONE TAB ONLY** — never open new browser tabs. Dashboard runs in a single tab, always.
- **NO PLAYWRIGHT** — never use browser_subagent or Playwright automation. All interaction via backend API (curl). Browser is visual only.
- **NEVER call `openclaw agent --message` for chat** — always use the HTTP API (`/v1/chat/completions`). The CLI reuses stale sessions.
- **ALL OpenClaw interaction visible in dashboard** — every message to/from OpenClaw must go through the chat API (`/api/openclaw-chat`) so Jeff sees it in the chat UI and console. Never run invisible CLI commands.
- **OpenClaw owns all cron jobs** — never use system crontab. All scheduled tasks go through `openclaw cron add` with `--session isolated --no-deliver`. Gateway LaunchAgent keeps them alive across reboots.

## Dashboard Frontend Architecture (Modular — refactored 2026-04-07)
The monolithic `app.js` (1,104 lines) was split into 7 focused modules:

| Module | Purpose | Exposes |
|--------|---------|--------|
| `core.js` | Clock, date, scene switching, `window.DASH` namespace | `DASH.*` |
| `feeds.js` | Email, calendar, weather, focus rendering | `DASH.renderInbox`, `DASH.renderCalendar`, etc. |
| `studio.js` | Nano Banana image generation studio | `DASH.renderStudio` |
| `chat.js` | OpenClaw chat interface | `DASH.renderChat`, `DASH.sendChat` |
| `telemetry.js` | System metrics, activity chain, feed timers | `DASH.updateTelem` |
| `openclaw.js` | Console log, health polling | `DASH.addConsoleEntry` |
| `websocket.js` | WebSocket dispatch — loaded LAST | Central event router |
| `tv.js` | TV scene — live streams, YouTube, world cams | Category tabs, click-to-play |

**Load order in index.html:** core → feeds → studio → board → chat → telemetry → openclaw → tv → contacts → websocket

**Key pattern:** All modules attach to `window.DASH`. WebSocket is loaded last so it can dispatch to any module.
**Backup:** Old monolith saved as `_app.js.bak`.
**Backend:** `server.js` remains monolithic — still manageable, split when needed.

## Dashboard Persistence (LaunchAgent)
The dashboard server is managed by a macOS LaunchAgent — it auto-starts on boot and auto-restarts on crash.
- **Plist:** `~/Library/LaunchAgents/com.system.dashboard.plist`
- **KeepAlive:** `true` — macOS restarts it within seconds if it dies
- **RunAtLoad:** `true` — starts automatically on login
- **Logs:** `/tmp/dashboard-stdout.log`, `/tmp/dashboard-stderr.log`
- **Reload:** `launchctl unload ~/Library/LaunchAgents/com.system.dashboard.plist && launchctl load ~/Library/LaunchAgents/com.system.dashboard.plist`
- **Same pattern as:** `ai.openclaw.gateway` LaunchAgent

## Next Steps / TODO
- [x] Wire calendar data into dashboard (30-day lookahead via AppleScript)
- [x] Test rewritten check_mail.sh against live Mail.app
- [x] Add auto-refresh cron for dashboard data feeds
- [x] Add OpenClaw console panel to dashboard
- [x] Fix openclaw.sh multiline parsing
- [x] Add telemetry strip (system metrics + activity chain)
- [x] Audit OpenClaw capabilities
- [x] Stream CLI diagnostics dynamically to Dashboard console
- [x] Fix JSONL telemetry regex feed string bug
- [x] Update AGENTS.md to reflect OpenClaw instead of Hermes
- [x] Pair Telegram bot with user account
- [x] Configure himalaya email skill (iCloud IMAP)
- [x] Fix duplicate chat bubbles in dashboard
- [x] Fix "Runtime finished" rendering as assistant bubble
- [x] Build Contacts page with card grid UI
- [x] Create check_contacts.sh for Apple Contacts access
- [x] Teach OpenClaw to use contacts script
- [x] Move telemetry strip to global position (visible on all pages)
- [x] Fix calendar auto-launch, 12h time format, JSON parsing
- [x] Restore lost data feed scripts from git history
- [x] Install cron jobs for data freshness
- [x] Create boot health check script (execution/health.sh)
- [x] Refactor dashboard frontend into modules (core, feeds, studio, chat, telemetry, openclaw, websocket)
- [x] Replace mail script with himalaya-based check_mail_himalaya.py
- [x] Replace weather script with Open-Meteo-based check_weather.py
- [x] Remove ugly weather timer from header display
- [x] Fix OpenClaw chat — switch from CLI to direct HTTP API (no stale sessions)
- [x] Fix duplicate chat responses (dedup normalization in pushToConsole)
- [x] Fix health.sh to check correct script names (himalaya, Open-Meteo)
- [x] **Create OpenClaw cron jobs for mail + weather + calendar (via `openclaw cron add`)**
- [x] **Fix dashboard persistence — LaunchAgent auto-restart (com.system.dashboard)**
- [x] Add cron heartbeat API endpoint (`/api/cron-heartbeat`)
- [x] Wire telemetry MAIL/CAL/WX indicators to live cron heartbeat data
- [x] Add TV tab (live streams, news, space, music, nature)
- [ ] Add more live activity to console (show OpenClaw thinking/executing in real-time)
- [ ] Animate dashboard (micro-interactions, transitions, hover effects)
- [ ] Fix whiteboard component
- [ ] Add smart summarization (OpenClaw summarizes calendar + inbox)
- [ ] Configure Google Workspace auth for `gog` skill

---

*This file lives at `/Volumes/WORK 2TB/WORK 2026/SYSTEM/MEMORY.md` and is committed to GitHub.*
