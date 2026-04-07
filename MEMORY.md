# SYSTEM Memory — Persistent State

> **This file is the single source of truth for cross-session continuity.**
> Every agent session MUST read this file at startup and update it before ending.
> Run `bash execution/health.sh` first thing to verify everything is alive.
> Committed to GitHub so nothing is ever lost.

---

## Last Updated
`2026-04-07T14:52:00-04:00` — Session: Scene Switch API, Split-Pane Inbox, Mail Snippets

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

## OpenClaw Auth
- Token stored in: `~/.openclaw/openclaw.json` → `gateway.auth.token`
- Token prefix: `17561131...`
- Retrieve with: `python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway',{}).get('auth',{}).get('token',''))" < ~/.openclaw/openclaw.json`

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

# Chat via dashboard (preferred — streams to console)
curl -s -X POST http://localhost:3111/api/openclaw-chat -H "Content-Type: application/json" -d '{"message":"..."}'

# Scene switch (instant — no mouse needed)
curl -s -X POST http://localhost:3111/api/scene -H "Content-Type: application/json" -d '{"scene":"home"}'
# Valid scenes: home, mail, calendar, whiteboard, studio, chat, contacts, openclaw

# Force browser refresh
curl -s -X POST http://localhost:3111/api/refresh -H "Content-Type: application/json"
```

## Dashboard Data Flow
All data retrieval goes through deterministic scripts. No LLM tokens used for data feeds.
```
Cron → bash scripts → AppleScript/curl → JSON → POST /api/push → Dashboard renders
```

### Data Feed Scripts
| Script | Depends On | Status | Cron |
|--------|-----------|--------|------|
| `execution/check_mail.sh` | Apple Mail (AppleScript) | ✅ Working | Every 5 min |
| `execution/check_calendar.sh` | Apple Calendar (AppleScript) | ✅ Working | Every 15 min |
| `execution/check_weather.sh` | wttr.in (no API key) | ✅ Working | Every 30 min |
| `execution/check_contacts.sh` | Apple Contacts (AppleScript) | ✅ Working | Manual / on-demand |

**Calendar script auto-launches Calendar.app** if not running (uses `pgrep` + `open -a Calendar`). Times are 12-hour AM/PM, all-day events show "All Day".

**Contacts script** also symlinked at `~/.local/bin/check_contacts` for OpenClaw access. Supports: `search "name"`, `list`, `count`.

### Cron Jobs (Auto-Refresh)
Installed via `crontab`. Dashboard data stays fresh without manual intervention.
| Interval | Script | What It Does |
|----------|--------|-------------|
| Every 5 min | `check_mail.sh 15` | Pulls latest 15 emails from Apple Mail → dashboard |
| Every 15 min | `check_calendar.sh` | 30-day lookahead from Apple Calendar → dashboard |
| Every 30 min | `check_weather.sh` | Weather from wttr.in → dashboard |

**Note:** These run direct AppleScript/curl — no LLM tokens used.

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

## User Preferences (Immutable)
- **READ-ONLY** for all Apple integrations (Calendar, Mail) — never write/send
- **No-Wait Philosophy** — 10s command timeout max
- **Browser is Jeff's display** — always push results visually
- **Never ask, just build** — ship complete features, not questions
- **External drive only** — project code stays on `/Volumes/WORK 2TB/`
- **Product engineer mindset** — make the dashboard a daily command center
- **Telemetry transparency** — all OpenClaw commands go through `agent_cmd.sh` for console visibility
- **Jeff just talks** — Antigravity handles all technical execution and OpenClaw management

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
- [ ] Add more live activity to console (show OpenClaw thinking/executing in real-time)
- [ ] Animate dashboard (micro-interactions, transitions, hover effects)
- [ ] Migrate cron jobs from crontab to OpenClaw's `cron` tool
- [ ] Fix whiteboard component
- [ ] Add smart summarization (OpenClaw summarizes calendar + inbox)
- [ ] Configure Google Workspace auth for `gog` skill

---

*This file lives at `/Volumes/WORK 2TB/WORK 2026/SYSTEM/MEMORY.md` and is committed to GitHub.*
