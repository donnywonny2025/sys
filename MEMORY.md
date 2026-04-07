# SYSTEM Memory — Persistent State

> **This file is the single source of truth for cross-session continuity.**
> Every agent session MUST read this file at startup and update it before ending.
> Committed to GitHub so nothing is ever lost.

---

## Last Updated
`2026-04-07T05:16:00-04:00` — Session: OpenClaw Migration

## Current Architecture
```
User (Jeff) → Antigravity (orchestrator) → OpenClaw Gateway (18789) → Dashboard (3111)
```

## Active Services

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| OpenClaw Gateway | 18789 | ✅ LIVE | LaunchAgent `ai.openclaw.gateway`, auto-starts on boot |
| Dashboard Server | 3111 | ✅ LIVE | WebSocket + HTTP, serves `dashboard/public/` |
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

## Dashboard Data Scripts
| Script | Depends On | Status |
|--------|-----------|--------|
| `execution/check_weather.sh` | wttr.in (no API key) | ✅ Working |
| `execution/check_calendar.sh` | Apple Calendar AppleScript | ✅ Working (needs Calendar.app running) |
| `execution/check_mail.sh` | Apple Mail AppleScript | ✅ Rewritten — no longer depends on Hermes |
| `execution/openclaw.sh` | OpenClaw Gateway API | ✅ Working |

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

## Errors Encountered & Fixes
| Error | Root Cause | Fix |
|-------|-----------|-----|
| `check_mail.sh` fails | Referenced `$HOME/.hermes/skills/apple-mail/` which is archived | Rewrote to use direct AppleScript |
| OpenClaw Control UI blank | Web component `<openclaw-app>` mounts but doesn't render | Not critical — our dashboard at 3111 is primary |
| `openclaw agent --message` fails | Requires `--to`, `--session-id`, or `--agent` flag | Use HTTP API `/v1/chat/completions` instead |
| Calendar "Application isn't running" | Calendar.app not open | Non-blocking — script still pushes empty array |
| `openclaw doctor` hangs on git update | Interactive prompt asks to update from git | Use `--skip-update` flag or answer No |

## User Preferences (Immutable)
- **READ-ONLY** for all Apple integrations (Calendar, Mail) — never write/send
- **No-Wait Philosophy** — 10s command timeout max
- **Browser is Jeff's display** — always push results visually
- **Never ask, just build** — ship complete features, not questions
- **External drive only** — project code stays on `/Volumes/WORK 2TB/`
- **Product engineer mindset** — make the dashboard a daily command center

## Next Steps / TODO
- [ ] Wire calendar data into dashboard (run check_calendar.sh when Calendar.app is available)
- [ ] Test rewritten check_mail.sh against live Mail.app
- [ ] Fix OpenClaw Control UI blank screen (low priority)
- [ ] Update AGENTS.md to reflect OpenClaw instead of Hermes
- [ ] Fix whiteboard component
- [ ] Add auto-refresh cron for dashboard data feeds

---

*This file lives at `/Volumes/WORK 2TB/WORK 2026/SYSTEM/MEMORY.md` and is committed to GitHub.*
