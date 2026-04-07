# SYSTEM Memory — Persistent State

> **This file is the single source of truth for cross-session continuity.**
> Every agent session MUST read this file at startup and update it before ending.
> Committed to GitHub so nothing is ever lost.

---

## Last Updated
`2026-04-07T13:51:00-04:00` — Session: Telegram Integration, Himalaya Email & Chat Dedup Fixes

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
| Telemetry Strip | (in dashboard) | ✅ LIVE | 2-row system metrics + activity chain, zero token cost |
| OpenClaw Control UI | 18789 (web) | ⚠️ BLANK | Web component doesn't initialize — not critical, our dashboard is primary |

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
```

## Dashboard Data Flow (via OpenClaw)
All data retrieval goes through OpenClaw. The flow is:
```
Antigravity → curl OpenClaw /v1/chat/completions → OpenClaw uses skills → returns data → push to dashboard /api/push
```

### Available Skills for Dashboard
| Data | OpenClaw Skill | Status |
|------|---------------|--------|
| Weather | `weather` (wttr.in/Open-Meteo) | ✅ Verified — returned "☁️ +48°F" |
| Calendar | `gog` (Google Workspace) | ⚠️ Needs Google auth setup |
| Reminders | `apple-reminders` (remindctl CLI) | ✅ Verified — returned real reminders |
| Email | `himalaya` (IMAP/SMTP) | ✅ Configured — iCloud `colour8k@mac.com`, config at `~/.config/himalaya/config.toml` |
| Notes | `apple-notes` / `bear-notes` / `obsidian` | Available, untested |

### Fallback Scripts (still work independently)
| Script | Depends On | Status |
|--------|-----------|--------|
| `execution/check_weather.sh` | wttr.in (no API key) | ✅ Working |
| `execution/check_calendar.sh` | Apple Calendar AppleScript | ✅ Working (needs Calendar.app running) |
| `execution/check_mail.sh` | Apple Mail AppleScript | ✅ Rewritten — direct AppleScript |
| `execution/openclaw.sh` | OpenClaw Gateway API | ✅ Fixed — handles multiline, logs to console |

### Cron Jobs (Auto-Refresh)
Installed via `crontab` on 2026-04-07. Dashboard data stays fresh without manual intervention.
| Interval | Script | What It Does |
|----------|--------|-------------|
| Every 5 min | `check_mail.sh 15` | Pulls latest 15 emails from Apple Mail → dashboard |
| Every 15 min | `check_calendar.sh` | 30-day lookahead from Apple Calendar → dashboard |
| Every 30 min | `check_weather.sh` | Weather from wttr.in → dashboard |

**Note:** These run direct AppleScript/curl — no LLM tokens used.

### Monitoring & Logging
| What | Where | Persists? |
|------|-------|-----------|
| OpenClaw health | Dashboard polls `/api/hermes-status` every 15s | No (live only) |
| Console log | `dashboard/data/history.json` | ✅ Yes — reloads on page refresh |
| OpenClaw raw logs | `~/.openclaw/logs/gateway.log` | ✅ Yes |

## Telegram Integration
- **Bot paired:** User ID `7095320256`, fully verified two-way messaging
- **Outbound command:** `openclaw message send --channel telegram --target "7095320256" --message "..."`
- **Inbound:** Messages from Telegram flow into the active JSONL session and render in the Dashboard chat UI
- **Session file:** `~/.openclaw/agents/main/sessions/*.jsonl` (most recent by mtime)

## Key File Locations
- **OpenClaw source:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/openclaw/`
- **OpenClaw config:** `~/.openclaw/openclaw.json`
- **OpenClaw workspace:** `~/.openclaw/workspace/`
- **OpenClaw logs:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- **Dashboard code:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/dashboard/`
- **Dashboard data:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/dashboard/data/`
- **Execution scripts:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/execution/`
- **Directives:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/directives/`
- **Hermes backup:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/.archive/hermes-backup/`

## OpenClaw Capabilities (audited 2026-04-07)
- **Files:** `read`, `edit`, `write`
- **Shell:** `exec`, `process`
- **Scheduling:** `cron` (reminders, recurring tasks, deferred follow-ups)
- **Media:** `image_generate`, `music_generate`, `video_generate`
- **Web:** `web_search` (via Firecrawl)
- **Multi-Agent:** `sessions_spawn`, `sessions_send`, `sessions_yield`, `sessions_list`, `sessions_history`

## Telemetry Strip (added 2026-04-07)
- **Row 1:** ONLINE, UP, SESSION, TURNS, CPU sparkline, MEM bar
- **Row 2:** Activity event chain (colored pills: IN/THINK/EXEC/COMPLETE/OUT), ↓/↑ data counters, LATENCY sparkline
- **Data sources:** OS module (CPU/MEM), JSONL log tailing (events), zero API cost
- **Key files:** `app.js` (client), `server.js` (telemetry API + watcher), `style.css` (BBS aesthetic)

## Errors Encountered & Fixes
| Error | Root Cause | Fix |
|-------|-----------|-----|
| `check_mail.sh` fails | Referenced `$HOME/.hermes/skills/apple-mail/` which is archived | Rewrote to use direct AppleScript |
| OpenClaw Control UI blank | Web component `<openclaw-app>` mounts but doesn't render | Not critical — our dashboard at 3111 is primary |
| `openclaw agent --message` fails | Requires `--to`, `--session-id`, or `--agent` flag | Use HTTP API `/v1/chat/completions` instead |
| Calendar "Application isn't running" | Calendar.app not open | Non-blocking — script still pushes empty array |
| `openclaw doctor` hangs on git update | Interactive prompt asks to update from git | Use `--skip-update` flag or answer No |
| `EAGAIN` Node.js Exception | `tailProc.kill()` leaked file-watcher zombies | Used `killall tail`, migrated API logic to streaming |
| Dashboard Chat Missing Responses | JSONL Regex `/[\s\S]*?$/` was accidentally wiping active output | Fixed `server.js` strictly to match `/🦞 OpenClaw[\s\S]+?🪢 Queue:.*?\n/` |
| Silent Agent Execution | Direct CLI bash runs bypass WebSocket pushes | Implemented `agent_cmd.sh` to stream arbitrary OS actions securely back to `/api/push` |
| Duplicate Chat Bubbles | `/api/openclaw-chat` echoed user message AND JSONL watcher both emitted `→` prefix | Removed redundant broadcast from chat endpoint; JSONL watcher is now the single source |
| "Runtime finished" as Chat Bubble | `← Runtime finished` prefix matched assistant bubble filter | Changed prefix to `✅ Runtime finished` so it stays in console only |

## User Preferences (Immutable)
- **READ-ONLY** for all Apple integrations (Calendar, Mail) — never write/send
- **No-Wait Philosophy** — 10s command timeout max
- **Browser is Jeff's display** — always push results visually
- **Never ask, just build** — ship complete features, not questions
- **External drive only** — project code stays on `/Volumes/WORK 2TB/`
- **Product engineer mindset** — make the dashboard a daily command center

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
- [ ] Migrate cron jobs from crontab to OpenClaw's `cron` tool
- [ ] Fix OpenClaw Control UI blank screen (low priority)
- [ ] Fix whiteboard component
- [ ] Add smart summarization (OpenClaw summarizes calendar + inbox)
- [ ] Configure Google Workspace auth for `gog` skill

---

*This file lives at `/Volumes/WORK 2TB/WORK 2026/SYSTEM/MEMORY.md` and is committed to GitHub.*
