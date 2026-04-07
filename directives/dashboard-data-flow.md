# Dashboard Data Flow & Chat Live Feed

## The Pipeline: Me (Jeff) → You (Antigravity) → OpenClaw → Dashboard

### The Law
1. **Never build a script if OpenClaw can do it.** Antigravity is the orchestrator, OpenClaw is the execution engine.
2. **Everything through OpenClaw.** No raw crontab entries for recurring work. No parallel systems.
3. **Everything visible.** All OpenClaw activity shows in the dashboard console AND the chat live feed.
4. **The Exception:** Only bypass OpenClaw for things architecturally beyond its capability (like the React whiteboard bridge).

## OpenClaw Communication (VERIFIED WORKING 2026-04-07)

### How to talk to OpenClaw
```bash
# Fire-and-forget via CLI
openclaw agent --agent main --message "Your message here"
```

### How it works
1. CLI sends message to OpenClaw gateway (port 18789)
2. OpenClaw processes via Gemini 2.5 Flash
3. **CLI returns `completed`** — NOT the actual response text
4. The actual response is written to `~/.openclaw/agents/main/sessions/*.jsonl`
5. Dashboard session watcher (`startSessionWatcher` in server.js) tails the JSONL
6. Both → (prompt) and ← (response) are pushed to all connected browsers via WebSocket

### ⚠️ CRITICAL: Never parse CLI stdout for the response
- The CLI only outputs `completed` or error text
- The REAL response comes from the JSONL session files
- The session watcher handles all display — both console AND chat feed
- The `/api/openclaw-chat` endpoint is **fire-and-forget**: it triggers the CLI and returns `{"ok": true}`

## Dashboard Chat Live Feed (scene-chat)

### What it is
- A full-screen view that mirrors the OpenClaw console traffic as chat bubbles
- Accessed via the speech bubble icon (💬) in the left sidebar
- Header shows "OPENCLAW LIVE FEED" and the model name

### How messages flow
```
Session watcher tails JSONL files
  → Detects new prompt (user message)
    → pushToConsole("→ message", "prompt")
      → WebSocket broadcast to all clients
        → Console panel shows the line
        → addChatFeedBubble() renders it as a right-aligned user bubble

  → Detects new response (assistant message)
    → pushToConsole("← OpenClaw: response", "response")
      → WebSocket broadcast to all clients
        → Console panel shows the line
        → addChatFeedBubble() renders it as a left-aligned assistant bubble with "OPENCLAW" label
```

### Chat bubble rendering rules (in app.js: addChatFeedBubble)
- Messages starting with `→` become **user bubbles** (right-aligned, dark blue-grey `#2a3a4a`)
- Messages starting with `←` become **assistant bubbles** (left-aligned, dark surface `var(--s2)`)
- All other console messages (system, feed refreshes) are SKIPPED in the chat feed
- The `→` prefix and timestamps are stripped from user bubbles
- The `← OpenClaw:` prefix is stripped from assistant bubbles
- The welcome screen disappears after the first message

### No input bar
- The chat feed is a **monitoring view**, not a messaging interface
- There is no text input or send button
- Messages are sent via backend (curl to `/api/openclaw-chat`)
- Antigravity sends messages; Jeff sees the results

## Console Dedup

### Problem
The session watcher and other sources can fire the same message. Without dedup, messages appear twice.

### Solution (in server.js: pushToConsole)
- A `recentMessages` buffer holds the last 20 messages with timestamps
- Before broadcasting, check if identical text appeared in the last 5 seconds
- If duplicate, skip it silently
- Buffer auto-prunes to prevent memory growth

## Dashboard API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/openclaw-chat` | POST | Fire-and-forget: sends message to OpenClaw via CLI |
| `/api/push` | POST | Push feed data (email, calendar, weather) to dashboard |
| `/api/openclaw-status` | GET | Check if OpenClaw gateway is alive |
| `/api/state` | GET | Get current dashboard state (for reload persistence) |
| `/api/history` | GET | Get console history for replay on reconnect |
| `/openclaw/*` | * | Reverse proxy to OpenClaw gateway (port 18789) |

## Feed Push Scripts (temporary — cron)

| Script | Interval | Pushes |
|--------|----------|--------|
| `check_mail.sh` | 5 min | Email data via `/api/push` type `email` |
| `check_calendar.sh` | 15 min | Calendar data via `/api/push` type `calendar` |
| `check_weather.sh` | 30 min | Weather data via `/api/push` type `weather` |

These are temporary cron jobs. Target: migrate into OpenClaw's scheduled task system.

## Static File Serving
- Server strips query strings before resolving paths (`req.url.split('?')[0]`)
- This enables cache-busting with `?v=N` params in HTML
- Current: `style.css?v=3` and `app.js?v=3`
- Bump the version number when making CSS/JS changes to force fresh loads

## Feed Persistence (CRITICAL)

### Problem solved
Previously, every server restart wiped all feed data (calendar, inbox, weather), leaving the dashboard blank until the next cron cycle pushed new data.

### How it works now
- Feed data is persisted to `dashboard/data/feed-cache.json`
- On server startup, `feedCache` is loaded from this file
- On every feed push (`/api/push`), the cache is written to disk via `saveFeedCache()`
- When a browser connects via WebSocket, cached feeds are replayed immediately
- **Result**: Server restarts, browser refreshes — feeds are always there

### Cache file location
```
dashboard/data/feed-cache.json
```
Contains keys: `email`, `calendar`, `weather` — each with the full feed payload and a `_cachedAt` timestamp.

## Server Startup Procedure

### Manual start (current)
```bash
cd /Volumes/WORK\ 2TB/WORK\ 2026/SYSTEM/dashboard
nohup node server.js > /tmp/system-dashboard.log 2>&1 &
```

### After restart, feeds load automatically
- No need to manually push feeds after restart
- The disk cache provides instant data
- Cron jobs continue to update feeds on their normal schedule

### To force-refresh all feeds manually
```bash
bash execution/check_calendar.sh
bash execution/check_mail.sh 15
bash execution/check_weather.sh
```

### To restart the server cleanly
```bash
lsof -ti:3111 | xargs kill -9 2>/dev/null
sleep 1
cd /Volumes/WORK\ 2TB/WORK\ 2026/SYSTEM/dashboard
nohup node server.js > /tmp/system-dashboard.log 2>&1 &
```
