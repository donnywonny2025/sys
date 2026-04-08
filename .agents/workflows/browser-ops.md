---
description: How to manage the browser and dashboard — rules for efficient browser control
---

# Browser & Dashboard Operations

## THE IRON RULES

### 1. ONE TAB ONLY

The dashboard runs in a single Chrome tab. Always. If a second tab appears for any reason, close it immediately. There is never a reason for two tabs.

```bash
# Close any non-dashboard tabs
osascript -e 'tell application "Google Chrome"
  set tabCount to count of tabs of window 1
  if tabCount > 1 then
    repeat with i from tabCount to 1 by -1
      set t to tab i of window 1
      if URL of t does not contain "localhost:3111" then close t
    end repeat
  end if
end tell'
```

### 2. NO PLAYWRIGHT, NO BROWSER SUBAGENT, EVER

Never use `browser_subagent`. Never use Playwright. Never automate mouse clicks. Never open URLs through browser automation tools. The browser is Jeff's visual display — not a tool for Antigravity to poke at.

All interaction happens through backend APIs. The browser just renders what the backend tells it to.

### 3. EVERYTHING THROUGH THE API

Scene switches, data pushes, chat messages, refreshes — all via `curl` to `localhost:3111`. Never touch the browser directly.

```bash
# Switch scene
curl -s -X POST http://localhost:3111/api/push -H "Content-Type: application/json" \
  -d '{"type":"scene","scene":"home"}'
# Valid scenes: home, mail, calendar, whiteboard, studio, chat, contacts

# Force refresh (pushes reload to browser via WebSocket)
curl -s -X POST http://localhost:3111/api/refresh

# Push data
curl -s -X POST http://localhost:3111/api/push -H "Content-Type: application/json" \
  -d '{"type":"weather","data":{"summary":"72F"}}'

# Chat with OpenClaw
curl -s -X POST http://localhost:3111/api/openclaw-chat -H "Content-Type: application/json" \
  -d '{"message":"check my calendar"}'
```

### 4. THE BROWSER IS JEFF'S DISPLAY

Push everything visual immediately. No showing things only in chat. If Jeff needs to see it, it goes to the dashboard.

### 5. NEVER ASK, JUST BUILD

If Jeff says he wants something, build it completely and show the working result. Don't ask "do you want me to set that up?" Half-working demos are unacceptable.

### 6. THINK AHEAD

When building a feature, think through what Jeff will obviously need next and build the complete thing. Don't ship v0.1 and iterate in front of him.

## Opening the Dashboard (First Boot Only)

```bash
osascript -e 'tell application "Google Chrome"
  activate
  if (count of windows) is 0 then make new window
  set URL of active tab of front window to "http://localhost:3111/"
end tell'
```

## Refreshing Chrome

```bash
osascript -e 'tell application "Google Chrome" to tell active tab of front window to reload'
```

## Verification

Verify results through backend data, not browser automation:
- Check `dashboard/data/history.json` for console/chat history
- Check `dashboard/data/feed-cache.json` for feed data
- Use `curl` to hit API endpoints and check responses
- Read JSONL session files for OpenClaw conversation state
