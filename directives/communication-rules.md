# UI/UX Communication Rules

**1. No Markdown Artifacts for Questions:**
- Never generate `implementation_plan.md` or task files just to ask a question. The user will not open side-panels to read plans.
- If you have a question or need to show the user a plan, **DO IT DIRECTLY IN CHAT**. Keep it fast, concise, and immediate.

**2. Visual-First Inference:**
- The workspace is split: Dashboard (Left) | IDE/Chat (Right).
- If you build something, update the dashboard immediately so the user sees the result on the left without having to click anything. 
- Use the Dashboard's WebSocket push API to flash messages, show designs, or prompt the user visually.

**3. The Execution Loop:**
- Me (Jeff) -> You (Antigravity) -> Hermes
- Never ask for permission to build something safe. Just build it, push the result to the dashboard, and tell the user in chat.
