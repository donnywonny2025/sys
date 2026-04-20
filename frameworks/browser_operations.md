# Browser Operations Directive
> Install this file into any project's `directives/` folder to enable structured browser subagent operations.

## Purpose
This directive governs how the AI dispatches browser subagents, manages tabs, takes screenshots, and verifies its own visual output. The subagent is a blunt tool — it needs precise, minimal instructions or it will freestyle and get confused.

---

## 1. Pre-Dispatch Checklist (BEFORE every subagent call)

**Read the room before you talk.**

1. Read `Browser State` from ADDITIONAL_METADATA — know what tabs are open, their Page IDs, URLs, and viewport sizes.
2. Read `war_room/browser_tabs.json` if it exists — know the purpose of each tab.
3. Identify the EXACT Page ID of the tab you need.
4. Decide: navigate existing tab, or is the target already open?

**Rules:**
- If the page is already open → tell the subagent the Page ID and say "the page is already open, do NOT navigate."
- If it's not open → tell the subagent to navigate the ACTIVE tab (not a new one).
- NEVER open duplicate tabs. One tab per purpose.

---

## 2. Subagent Dispatch Rules

**The subagent is not smart. Treat it like a remote-control with 3 buttons.**

### Keep instructions to 2-3 steps MAX.
Bad: "Navigate to the page, scroll down to find the evidence section, check if all items are loaded, take a screenshot of the full page, and also check if the to-do items persist..."

Good: "Page ID ABC123 is already open showing the portal. Scroll to the bottom. Take a screenshot. Return."

### Be specific about elements.
- Give exact CSS selectors, IDs, or visible text: "Click the button with text 'Reset all'"
- Give coordinates if needed: "The section starts around Y=800"
- Never say "find the section" — tell it WHERE the section is.

### Tell it what to RETURN.
- "Return the text content of the page title"
- "Return a screenshot"  
- "Return whether the element with ID 'todoList' has any children"

### Tell it what NOT to do.
- "Do NOT click any links"
- "Do NOT navigate away from this page"
- "Do NOT scroll past the first viewport"

---

## 3. Screenshot Discipline

### When to screenshot:
- After ANY visual change (CSS, HTML, layout modification)
- When verifying UI state for the user
- When the user asks to "check" or "look at" something

### When NOT to screenshot:
- After non-visual changes (JS logic, data processing, file writes)
- When confirming a simple text operation
- Every routine step — only at verification points

### Screenshot naming:
Screenshots taken by the subagent land in `.system_generated/click_feedback/`. When referencing them:
- Don't dump raw screenshot paths into chat
- Report findings in text: "The portal loads correctly. To-Do section shows 3 items, all unchecked."
- Only embed screenshots if the user specifically asks to SEE it

---

## 4. Post-Dispatch Protocol

After EVERY subagent returns:

1. **Read the new Browser State** from the next message's metadata.
2. **Update `war_room/browser_tabs.json`** if any tabs changed (new tabs, closed tabs, URL changes).
3. **Report results in text.** Don't paste screenshots into chat unless asked.
4. **If the subagent failed or got confused** — don't retry with the same instructions. Diagnose what went wrong, simplify the instructions, and redispatch.

---

## 5. Self-Verification Pattern

When checking your own visual work:

```
1. Make the code change
2. Dispatch subagent: "Page [ID] is open. Refresh the page. Wait 2 seconds. Take a screenshot. Return."
3. Read the subagent's result
4. Report to user in TEXT: "Verified — the new Documents section renders correctly with 7 items."
5. If something's wrong → fix it → re-verify (one retry max, then ask user)
```

**Key rule:** Verify silently. The user doesn't need to see every intermediate screenshot — they need to hear "it works" or "here's what's broken."

---

## 6. Tab Registry (war_room/browser_tabs.json)

Maintain a JSON file tracking open tabs:

```json
{
  "last_updated": "2026-04-14T17:14:00-04:00",
  "tabs": {
    "gmail": {
      "page_id": "ABC123",
      "url": "https://mail.google.com/mail/u/3/#inbox",
      "purpose": "Email monitoring"
    },
    "portal": {
      "page_id": "DEF456",
      "url": "file:///path/to/portal/index.html",
      "purpose": "Case management dashboard"
    }
  }
}
```

**Update this file** whenever tabs change. It's the ground truth for what's open.

---

## 7. Common Failure Modes & Fixes

| Problem | Cause | Fix |
|---|---|---|
| Subagent opens wrong tab | No Page ID given | Always include the exact Page ID |
| Subagent clicks random things | Too many instructions | Limit to 2-3 steps |
| Subagent can't find element | Vague description | Give CSS selector or exact text |
| Subagent navigates away | No "do NOT navigate" guard | Add explicit guard |
| Duplicate tabs appear | Told to "open" instead of "navigate" | Use existing tab language |
| Screenshot shows wrong page | Active tab changed between dispatch | Re-read browser state first |

---

## Installation

1. Copy this file to your project: `directives/browser_operations.md`
2. Create `war_room/browser_tabs.json` with current tab state
3. Optionally copy `execution/browser_manager.py` for AppleScript tab control

The AI will read this directive when dispatching browser subagents within this project.
