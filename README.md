# SYSTEM Portable AI Command Center

> A self-contained AI operations platform that runs from an external drive.
> Plug it in, start the dashboard, and you have a full command center.

---

## Quick Start

```bash
# 1. Health check make sure everything is alive
cd "/Volumes/WORK 2TB/WORK 2026/SYSTEM"
bash execution/health.sh

# 2. Start the dashboard server (if not already running)
cd dashboard && node server.js &

# 3. Open the dashboard in Chrome
open http://localhost:3111

# 4. Read memory for full context
cat MEMORY.md
```

**First thing every session:** Read `MEMORY.md` and run `bash execution/health.sh`.

---

## Architecture

```
Jeff (human) speaks naturally, gives direction
Antigravity (orchestrator) reads MEMORY.md, makes decisions, writes code, manages OpenClaw
OpenClaw (executor) runs skills, sends messages, executes background tasks
Dashboard (visual) localhost:3111, the command center Jeff sees
```

### The 3-Layer Pattern

| Layer | What | Where |
|-------|------|-------|
| **Directive** | SOPs what to do | `directives/*.md` |
| **Orchestration** | Decision-making Antigravity | This agent session |
| **Execution** | Deterministic scripts + OpenClaw | `execution/`, OpenClaw Gateway |

### Ports

| Service | Port | Purpose |
|---------|------|---------|
| Dashboard | `3111` | Web UI + WebSocket + API |
| OpenClaw Gateway | `18789` | AI executor backend |

---

## Dashboard

### Pages (sidebar icons, top to bottom)

| Icon | Page | Scene Name | Content |
|------|------|------------|---------|
| — | Home | `home` | Today's focus, schedule summary, inbox preview |
| — | Mail | `mail` | Split-pane inbox: list left, preview right |
| — | Calendar | `calendar` | Schedule detail view |
| — | Board | `whiteboard` | Task board + drawing canvas |
| — | Studio | `studio` | Nano Banana image generation |
| — | Chat | `chat` | Live OpenClaw chat interface |
| — | Contacts | `contacts` | Priority-ordered contact cards |

### Global Elements (always visible on every page)
- **Telemetry Strip:** ONLINE status, CPU, MEM, SESSION, ACTIVITY chain, LATENCY
- **OpenClaw Console:** Scrolling log of all system activity

### Frontend Architecture (modular)

The dashboard frontend is split into focused modules loaded in this order:

```
core.js feeds.js studio.js board.js chat.js telemetry.js openclaw.js contacts.js websocket.js
```

All modules attach to `window.DASH`. WebSocket is loaded last as the central event dispatcher.

| Module | Responsibility |
|--------|---------------|
| `core.js` | Clock, date, scene switching, `window.DASH` namespace |
| `feeds.js` | Email, calendar, weather, focus rendering |
| `studio.js` | Image generation studio |
| `chat.js` | OpenClaw chat interface |
| `telemetry.js` | System metrics, activity chain, feed timers |
| `openclaw.js` | Console log, health polling |
| `websocket.js` | WebSocket message dispatch MUST load last |

Backend: `server.js` (monolithic, ~809 lines) split when needed.

---

## Browser Control

### CRITICAL RULES
1. **Never ask Jeff to refresh** do it via API
2. **Never click with mouse automation** use the API to switch scenes
3. **Maintain one tab** if duplicates appear, close them immediately
4. **The browser is Jeff's display** push everything visual immediately

### Key Commands

```bash
# Switch scene (instant, no mouse needed)
curl -s -X POST http://localhost:3111/api/push \
 -H "Content-Type: application/json" \
 -d '{"type":"scene","scene":"home"}'
# Valid scenes: home, mail, calendar, whiteboard, studio, chat, contacts

# Force refresh
curl -s -X POST http://localhost:3111/api/refresh

# Push data to dashboard
curl -s -X POST http://localhost:3111/api/push \
 -H "Content-Type: application/json" \
 -d '{"type":"weather","data":{"summary":" 72F"}}'

# Send chat to OpenClaw (streams to console)
curl -s -X POST http://localhost:3111/api/openclaw-chat \
 -H "Content-Type: application/json" \
 -d '{"message":"check my calendar"}'

# Close duplicate localhost tabs in Chrome
osascript -e 'tell application "Google Chrome"
 set theTabs to tabs of window 1 whose URL contains "localhost:3111"
 if (count of theTabs) > 1 then close item 2 of theTabs
end tell'

# Open dashboard in Chrome
osascript -e 'tell application "Google Chrome"
 activate
 if (count of windows) is 0 then make new window
 set URL of active tab of front window to "http://localhost:3111/"
end tell'

# Refresh Chrome tab
osascript -e 'tell application "Google Chrome" to tell active tab of front window to reload'
```

---

## Data Feeds

All data feeds are deterministic scripts **zero AI tokens**. They fetch data and POST JSON to the dashboard.

| Script | Source | Speed | Schedule |
|--------|--------|-------|----------|
| `execution/check_mail_himalaya.py` | himalaya CLI iCloud IMAP | ~1.5s | Every 5 min |
| `execution/check_calendar.sh` | Apple Calendar via AppleScript | ~0.2s | Every 15 min |
| `execution/check_weather.py` | Open-Meteo API (free) | ~0.9s | Every 30 min |
| `execution/check_contacts.sh` | Apple Contacts via AppleScript | ~0.5s | On demand |

### Cron Jobs

Calendar runs on **system crontab**. Mail and weather should run on **OpenClaw cron** for portability.

```bash
# View current system crontab
crontab -l

# Current entry:
# */15 * * * * cd "/Volumes/WORK 2TB/WORK 2026/SYSTEM" && bash execution/check_calendar.sh > /dev/null 2>&1
```

**OpenClaw cron tips:**
- Use `delivery: { mode: "none" }` (silent) never `announce`
- Previous crons broke because `announce` tried Telegram `@heartbeat` which doesn't exist
- The scripts are fast (<2s) any slowness comes from the AI inference wrapper, not the scripts

---

## OpenClaw

### Health Check
```bash
curl -s http://127.0.0.1:18789/health
# {"ok":true,"status":"live"}
```

### Key Commands
```bash
openclaw gateway status # is it running?
openclaw gateway restart # restart
openclaw health # health snapshot
openclaw cron list # list cron jobs
openclaw status --all # full diagnosis
openclaw doctor # diagnose issues
```

### API Patterns
```bash
# Get auth token
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.openclaw/openclaw.json')).get('gateway',{}).get('auth',{}).get('token',''))")

# Chat completions
curl -s http://127.0.0.1:18789/v1/chat/completions \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"model":"openclaw/default","messages":[{"role":"user","content":"hello"}]}'
```

### ALL OpenClaw commands go through agent_cmd.sh
```bash
./execution/agent_cmd.sh "openclaw cron list"
```
This ensures output streams to the Dashboard console for Jeff to see.

### Installed Skills (51)
See `directives/openclaw-reference.md` for the full list.

Key skills for dashboard data: `himalaya` (email), `weather`, `apple-reminders`, `camsnap`, `peekaboo`

---

## File Map

```
SYSTEM/
 AGENTS.md # Agent operating instructions (read this)
 MEMORY.md # Persistent state across sessions (read FIRST)
 README.md # This file
 .env # API keys (gitignored)
 .agents/workflows/ # Antigravity workflows
 browser-ops.md # Browser control rules
 quality-standards.md
 dashboard/
 server.js # Express + WebSocket backend
 package.json
 data/ # Cached feed data + console history
 feed-cache.json
 history.json
 public/ # Frontend modules
 index.html # Main HTML shell
 style.css # Global styles
 core.js # Clock, DASH namespace, scene switching
 feeds.js # Mail, calendar, weather rendering
 studio.js # Image generation studio
 board.js # Task board + canvas
 chat.js # OpenClaw chat UI
 telemetry.js # System metrics, feed timers
 openclaw.js # Console log, health polling
 contacts.js # Contact cards
 websocket.js # WebSocket dispatch (loads LAST)
 ARCHITECTURE.md # Module dependency guide
 directives/ # SOPs for the system
 openclaw-reference.md # OpenClaw API + skills reference
 communication-rules.md
 dashboard-data-flow.md
 ...
 execution/ # Deterministic scripts
 health.sh # Boot health check
 agent_cmd.sh # OpenClaw command wrapper (streams to console)
 check_mail_himalaya.py # IMAP mail fetch dashboard
 check_weather.py # Open-Meteo weather dashboard
 check_calendar.sh # Apple Calendar dashboard
 check_contacts.sh # Apple Contacts dashboard
 generate_image.py # Image generation via Gemini
 edit_image.py # Image editing
 upscale_local.sh # Local image upscaling
 dash.sh # Chrome tab management
 openclaw/ # OpenClaw source (for rebuilding)
 research/ # Research notes
 changelog/ # Session logs
```

---

## User Preferences (Immutable)

- **READ-ONLY** for all Apple integrations never write/send
- **No-Wait** 10s command timeout max
- **Browser is Jeff's display** always push results visually
- **Never ask, just build** ship complete features, not questions
- **External drive only** project code stays on `/Volumes/WORK 2TB/`
- **All OpenClaw commands through `agent_cmd.sh`** for console visibility
- **Jeff just talks** Antigravity handles everything underneath

---

## Errors & Fixes

See `MEMORY.md` "Errors Encountered & Fixes" for the full list of known issues and their solutions.

---

*Lives on `/Volumes/WORK 2TB/WORK 2026/SYSTEM/`. Committed to GitHub at `donnywonny2025/sys`.*
