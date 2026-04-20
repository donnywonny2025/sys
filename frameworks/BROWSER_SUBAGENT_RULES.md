# Browser Subagent Operating Rules

> Mandatory rules for every browser subagent dispatch. Read before every call.

---

## 0. Pre-Flight Health Check (BEFORE every dispatch)

**Always check the subagent's health before dispatching.**

1. Read `Browser State` from ADDITIONAL_METADATA.
2. If it says "No browser pages are currently open" → the subagent browser MAY be dead.
3. Attempt a minimal dispatch (navigate to about:blank or take screenshot) as a heartbeat.
4. If the heartbeat succeeds → proceed normally.
5. If it fails with "Agent terminated due to error" or hangs indefinitely → **ESCALATE immediately.**

### Escalation Protocol

When the subagent is confirmed dead:

1. **Tell the user immediately:**
   > "The browser subagent has crashed. Please restart Antigravity to restore it. I'll use CDP screenshots in the meantime."
2. **Switch to CDP fallback** — use `python3 browser_guardian.py screenshot` for visual verification until the user restarts.
3. **Do NOT retry the subagent more than twice.** Two failures = dead. Escalate.
4. **After user restarts Antigravity**, verify the subagent is back by checking Browser State metadata and doing a heartbeat dispatch.

---

## 1. Timeout Discipline

- **Page loads: 3 seconds max.** If the page isn't loaded in 3 seconds, take a screenshot of whatever is there and report back. Do NOT wait 10 seconds.
- **Element searches: 2 seconds max.** If an element isn't found in 2 seconds, report back with what you DO see. Do not keep retrying.
- **Total task budget: 30 seconds max.** If the entire task isn't done in 30 seconds, stop, take a screenshot, and report your progress so far.

## 2. Error Handling — Stop, Don't Loop

- **First error = immediate report.** If any action fails (element not found, click didn't work, page didn't load), STOP immediately and report:
  - What you were trying to do
  - What went wrong
  - A screenshot of the current state
- **Never retry blindly.** Do not attempt the same action more than once unless you changed your approach.
- **Never guess.** If you can't find an element, say so. Don't click something "close enough."

## 3. Stay On Task — No Plot Loss

- **Do exactly what was asked.** If the task says "click the search button," click the search button. Don't explore the page, don't read extra content, don't summarize things you weren't asked to summarize.
- **No improvisation.** If the task doesn't cover a situation you encounter, stop and report back. Let the dispatcher (Claude Opus) decide what to do next.
- **No unnecessary scrolling.** Don't scroll the entire page "to get context." Only scroll if the task requires seeing content below the fold.

## 4. Screenshot Protocol

- **Always take a screenshot before reporting back.** Every report must include visual proof of the final state.
- **Version screenshots when doing multi-step tasks.** Name them sequentially: `step_001_loaded.png`, `step_002_typed.png`, `step_003_submitted.png`
- **Screenshot on error too.** If something goes wrong, screenshot the broken state before reporting.

## 5. Reporting Format

Every subagent report must include:
1. **Status:** SUCCESS or FAILED
2. **What was done:** List of actions taken
3. **Current state:** Page title, URL, and screenshot
4. **If failed:** What went wrong and where it stopped

## 6. Dispatch Rules (for the dispatcher)

When I (Claude Opus) dispatch a subagent:
- **Include specific selectors.** Don't say "find the search box." Say "find the textarea with name='q' or aria-label='Search'."
- **Include the Page ID** from browser metadata so the subagent knows which tab to use.
- **State whether to navigate or not.** Explicitly say "page is already loaded, do NOT navigate" or "navigate to [URL]."
- **Set clear success criteria.** "You're done when the search results page is loaded and you've taken a screenshot."
- **Set clear abort criteria.** "If you can't find the element in 2 seconds, stop and report back."

## 7. Fallback Protocol (when subagent is down)

If the browser subagent returns a 503, capacity error, or "Agent terminated":

1. **Do not retry more than twice** with 15-second gaps.
2. **Fall back to CDP** — run `python3 browser_guardian.py screenshot` for visual verification.
3. **Tell the user to restart Antigravity** — this is the ONLY fix for the subagent's internal browser.
4. **Log the outage** — note the time and error for pattern tracking.
5. **Continue working** using CDP screenshots until the user confirms restart.

### CDP Fallback Commands

```bash
# Health check
python3 browser_guardian.py check

# Ensure Chrome is running
python3 browser_guardian.py ensure http://localhost:8080

# Take a screenshot (no subagent needed)
python3 browser_guardian.py screenshot

# List open tabs
python3 browser_guardian.py tabs

# Open/navigate to URL
python3 browser_guardian.py open <url>

# Run continuous watchdog
python3 browser_guardian.py watchdog
```

### Recovery Checklist (after Antigravity restart)

1. Check Browser State in ADDITIONAL_METADATA — should show pages
2. Dispatch minimal heartbeat: "Navigate to about:blank, take screenshot, return"
3. If heartbeat succeeds → subagent is recovered
4. Re-dispatch any failed tasks from before the crash

---

*Last updated: 2026-04-17*
