# SYSTEM Architecture

## The Three Layers

```
USER (Jeff)
  ↕
ANTIGRAVITY (Orchestrator — decision-making, routing, monitoring)
  ↕
OPENCLAW (Execution Engine — does the actual work)
  ↕
DASHBOARD (Display — http://localhost:3111 — shows everything to the user)
```

## How It Works

### OpenClaw = Execution Layer
- OpenClaw is the execution engine. It runs tasks, checks mail, manages channels, handles scheduling.
- ALL execution flows through OpenClaw. Antigravity does NOT bypass OpenClaw with raw crontab entries, manual bash scripts, or direct system calls for recurring work.
- OpenClaw has: `tasks`, `agent`, `channels`, `system`, `webhooks` — use them.
- CLI: `openclaw agent --message "..."` sends work to the agent.
- Gateway: `ws://127.0.0.1:18789` (port 18789)

### Antigravity = Orchestrator
- Reads directives, makes decisions, routes commands to OpenClaw.
- Monitors OpenClaw's activity and displays it on the dashboard.
- Does NOT do execution work itself. No raw cron jobs. No parallel systems.
- Antigravity talks TO OpenClaw, OpenClaw does the work, results come back.

### Dashboard = The Display
- URL: http://localhost:3111
- Shows: Schedule, Inbox, Weather, Today's Focus, Activity Feed
- **Sidebar tabs**: Home, Mail, Calendar, Whiteboard, Image Studio, Chat Live Feed, OpenClaw Control
- **OPENCLAW CONSOLE**: The bottom panel. Shows ALL OpenClaw activity in real-time.
- **CHAT LIVE FEED** (scene-chat): Full-screen view of OpenClaw back-and-forth as chat bubbles.
  - → messages become right-aligned user bubbles (dark blue-grey)
  - ← messages become left-aligned assistant bubbles with "OPENCLAW" label
  - System/feed messages are filtered out — only chat traffic shows
  - NO input bar — this is a monitoring view, not a messaging interface
  - Messages arrive via WebSocket from the session watcher
- **Feed Timers**: Each section (Schedule, Inbox) shows countdown timers to next refresh
- **Green Dot**: Top-right OPENCLAW indicator. Green = gateway connected.
- **Persistence**: Feed data persisted to `dashboard/data/feed-cache.json`. Survives server restarts AND page refreshes.

## Console Rules
- The console is NOT just a log. It is a LIVE WINDOW into OpenClaw's execution.
- Everything OpenClaw does must be visible there.
- Every cron job, every task, every message, every background operation.
- The user watches this to understand what the system is doing.

## What NOT To Do
- ❌ Do NOT set up macOS crontab entries for recurring tasks
- ❌ Do NOT run bash scripts directly for things OpenClaw can do
- ❌ Do NOT bypass OpenClaw with manual execution
- ❌ Do NOT show a green OPENCLAW light unless the gateway is actually responding
- ❌ Do NOT lose feed data on page refresh (data must be cached server-side)

## Talking to OpenClaw (WORKING — verified 2026-04-07 07:36 EDT)

### CLI Command (primary method)
```bash
openclaw agent --agent main --message "Your message here"
```
- This sends a message to the `main` agent via the gateway
- OpenClaw processes it (Gemini 2.5 Flash) and responds
- The exchange is written to the active session JSONL file
- The dashboard session watcher picks it up and pushes it to the console
- User sees the prompt and response in both the console AND the chat live feed

### ⚠️ CRITICAL: CLI stdout is NOT the response
- The CLI only outputs `completed` — it does NOT return the model's actual response text
- The REAL response is in the JSONL session files
- The session watcher handles all display
- The `/api/openclaw-chat` endpoint is fire-and-forget: returns `{"ok": true}`
- NEVER parse CLI stdout for the response — it's always just `completed`

### Pairing (FIXED)
- The CLI device (`40802b48...`) was originally scoped to `operator.read` only
- We upgraded it to full scopes in `~/.openclaw/devices/paired.json`:
  `operator.admin`, `operator.read`, `operator.write`, `operator.approvals`, `operator.pairing`
- If pairing breaks again, re-run the scope upgrade on the CLI device ID
- The gateway must be restarted after scope changes: `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway`

### Console Pipeline
```
Antigravity sends CLI command
  → OpenClaw processes via Gemini
    → Response written to ~/.openclaw/agents/main/sessions/*.jsonl
      → Dashboard session watcher (startSessionWatcher in server.js) tails the JSONL
        → Parsed messages broadcast to browser via WebSocket
          → Console panel displays: → user message / ← assistant response
```

## Current State (2026-04-07)

### Services
| Service | Port | Status |
|---------|------|--------|
| Dashboard | 3111 | `node server.js` (manual start, nohup) |
| OpenClaw Gateway | 18789 | LaunchAgent `ai.openclaw.gateway` (auto-start) |

### Key Files
| File | Purpose |
|------|---------|
| `dashboard/server.js` | Dashboard server — WebSocket, feed cache, session watcher, console push |
| `dashboard/public/app.js` | Client — timers, console rendering, scene switching, status polling |
| `dashboard/public/index.html` | Dashboard layout — panels, console, scenes |
| `dashboard/public/style.css` | Dashboard styles |
| `directives/system-architecture.md` | THIS FILE — the authoritative system reference |
| `execution/check_mail.sh` | Mail fetch (via macOS Mail.app) — **temporary cron, migrate to OpenClaw** |
| `execution/check_calendar.sh` | Calendar fetch (via macOS Calendar.app) — **temporary cron, migrate to OpenClaw** |
| `execution/check_weather.sh` | Weather fetch (via wttr.in) — **temporary cron, migrate to OpenClaw** |

### OpenClaw Paths
| Path | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | Main config (auth profiles, model settings) |
| `~/.openclaw/agents/main/agent/auth-profiles.json` | Gemini API key (gitignored) |
| `~/.openclaw/agents/main/sessions/*.jsonl` | Chat sessions (tailed by dashboard) |
| `~/.openclaw/logs/gateway.log` | Gateway log (tailed by dashboard) |
| `~/.openclaw/devices/paired.json` | Device pairing & scopes |
| `/Users/jeffkerr/Library/pnpm/openclaw` | CLI binary |

### Cron (temporary — to be migrated to OpenClaw)
```
*/5 * * * *  check_mail.sh    (every 5 min)
*/15 * * * * check_calendar.sh (every 15 min)
*/30 * * * * check_weather.sh  (every 30 min)
```

## Known Issues
- **OpenClaw can't access Google Calendar directly**: Needs `gog` CLI setup (OAuth). Currently using macOS Calendar.app via AppleScript as workaround.
- **Dashboard server not auto-started**: Needs a LaunchAgent or the dashboard needs to be started manually after reboot.

## Migration TODO
- [x] Establish Antigravity ↔ OpenClaw communication (CLI: `openclaw agent --agent main --message "..."`)
- [x] Verify communication shows in dashboard console
- [x] Fix duplicate console messages (dedup in pushToConsole — 5s rolling window)
- [x] Build Chat Live Feed tab (scene-chat) — mirrors console as chat bubbles
- [x] Fix static file cache-busting (query string stripping in server.js)
- [ ] Migrate mail/calendar/weather checks from crontab into OpenClaw scheduled tasks
- [ ] Remove raw crontab entries once OpenClaw handles scheduling
- [ ] Set up dashboard server as LaunchAgent for auto-start

