---
description: How to manage the browser and dashboard — rules for efficient browser control
---

# Browser & Dashboard Operations

## RULE #1: THE BROWSER IS JEFF'S DISPLAY

**Everything visual goes to the browser IMMEDIATELY.** No exceptions. No showing things only in chat.

```bash
osascript -e 'tell application "Google Chrome"
  activate
  if (count of windows) is 0 then make new window
  set URL of active tab of front window to "http://localhost:3111/"
end tell'
```

## RULE #2: NEVER ASK, JUST BUILD

If Jeff says he wants something, BUILD IT. Don't ask "do you want me to set that up?" — obviously yes. If it needs to work (persistence, visibility, collaboration), make it work COMPLETELY before showing it. Half-working demos are unacceptable.

**Bad:** "Want me to set up self-hosted Excalidraw?"
**Good:** *sets it up, shows working result* "Whiteboard is live. Your drawings save to the project and I can see them."

## RULE #3: THINK AHEAD

When building a feature, think through what Jeff will obviously need next:
- If it's a whiteboard → he needs persistence, he needs me to see it
- If it's email → he needs it sorted, dated, more than 5 items
- If it's a display → he needs it to look premium, not amateur

Build the complete thing. Don't ship v0.1 and iterate in front of him.

## RULE #4: AUTO-RUN EVERYTHING

Mark all safe commands as SafeToAutoRun=true. Jeff should never see "Allow this?" prompts from command execution. Screenshots, curl, osascript, file reads — all auto-run.

## RULE #5: SINGULAR BROWSER CONTROL

Maintain absolute, dictatorial control over the browser session. If multiple identical tabs are open causing state conflict, actively close them and force the active remaining tab into the correct focus context. The user expects you to drive the display perfectly.

## RULE #6: ALWAYS VISUALLY VERIFY

Never assume a DOM manipulation worked because the code looks right. Capture backend screenshots if necessary, but remember Rule #7.

## RULE #7: NO MOUSE/CURSOR AUTOMATION

DO NOT use browser subagents to physically "click" around the user's dashboard to verify things. The user hates having their cursor or active session hijacked by simulated mouse events. If you need to switch the view to Image Studio, DO NOT click the studio button using browser AI—USE THE WEBSOCKET BACKEND (`curl http://localhost:3111/api/push`) to invisibly switch the scene state.

## Core Browser Commands

```bash
# Refresh dashboard
osascript -e 'tell application "Google Chrome" to tell active tab of front window to reload'

# Switch scene via API
curl -s -X POST http://localhost:3111/api/push -H "Content-Type: application/json" -d '{"type":"scene","scene":"home"}'

# Close Duplicate Localhost Tabs 
osascript -e 'tell application "Google Chrome"
  set theTabs to tabs of window 1 whose URL contains "localhost:3111"
  if (count of theTabs) > 1 then close item 2 of theTabs
end tell'
```
