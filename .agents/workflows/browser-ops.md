---
description: How to manage the browser and dashboard — rules for efficient browser control
---

# Browser & Dashboard Operations

## Core Rules

1. **The SYSTEM dashboard tab (localhost:3111) is ALWAYS open.** Never close it. Never navigate away from it.
2. **Close any tab that isn't the dashboard.** If you open a tab for research, close it when done.
3. **Don't spawn browser subagents just to check your work.** Use `curl` to test API endpoints instead.
4. **When you must use the browser subagent, be precise.** One clear task, get in, get out.
5. **After code changes, push a test message via curl to verify.** Don't refresh the browser unless CSS/HTML changed.

## Testing the Dashboard Pipe

Instead of opening a browser subagent, test with curl:
```bash
# Push text
curl -s -X POST http://localhost:3111/api/push \
  -H "Content-Type: application/json" \
  -d '{"type":"info","content":"Test message"}'

# Check it worked
curl -s http://localhost:3111/api/history | tail -1
```

## Restarting the Server

When HTML/CSS/JS changes require a browser refresh:
1. Kill the server process
2. Clear history if needed: `rm -f dashboard/data/history.json`
3. Restart: `cd dashboard && node server.js`
4. The browser auto-reconnects via WebSocket — no manual refresh needed for data changes
5. For HTML/CSS changes, push a reload command or use browser subagent ONCE

## Browser Tab Management (AppleScript)

Use `osascript` for tab control — it's instant and reliable:
```bash
# Close all about:blank tabs
osascript -e 'tell application "Google Chrome" to close (every tab of every window whose URL is "about:blank")'

# Close a tab by URL
osascript -e 'tell application "Google Chrome" to close (every tab of every window whose URL contains "example.com")'

# List all tabs
osascript -e 'tell application "Google Chrome" to get URL of every tab of every window'

# Open a URL in existing tab
osascript -e 'tell application "Google Chrome" to set URL of active tab of front window to "http://localhost:3111/"'
```

**NEVER use the browser subagent to close or manage tabs.** AppleScript is instant and doesn't require permission dialogs.

## Reading Dashboard State (JavaScript via AppleScript)

"Allow JavaScript from Apple Events" is ENABLED. Read the dashboard directly:
```bash
# Read page text
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.querySelector(\"#feed\").innerText"'

# Count messages
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.querySelectorAll(\".message\").length"'

# Refresh the page
osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "location.reload()"'
```

## Quick Screen Check
```bash
# Screenshot (no dialog, silent)
screencapture -x /tmp/dashboard_check.png
```

## Browser Tab Policy

- Only ONE tab should be open: `http://localhost:3111/`
- Research goes through `firecrawl_search` or `read_url_content`, NOT browser tabs
- If a stray tab appears, close it immediately — don't leave about:blank tabs hanging
