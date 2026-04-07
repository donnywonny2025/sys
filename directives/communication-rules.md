# UI/UX Communication Rules

**1. No Markdown Artifacts for Questions:**
- Never generate `implementation_plan.md` or task files just to ask a question. The user will not open side-panels to read plans.
- If you have a question or need to show the user a plan, **DO IT DIRECTLY IN CHAT**. Keep it fast, concise, and immediate.

**2. Visual-First Inference:**
- The workspace is split: Dashboard (Left) | IDE/Chat (Right).
- If you build something, update the dashboard immediately so the user sees the result on the left without having to click anything. 
- Use the Dashboard's WebSocket push API to flash messages, show designs, or prompt the user visually.

**3. The Execution Loop:**
- Me (Jeff) → You (Antigravity) → OpenClaw → Dashboard → Jeff
- Antigravity orchestrates; OpenClaw executes via Gemini 2.5 Flash
- Dashboard shows everything: chat feed, console, and telemetry strip
- Never ask for permission to build something safe. Just build it, push the result to the dashboard, and tell the user in chat.

**4. Token Efficiency:**
- Never bombard OpenClaw with unnecessary messages
- Use cheap prompts for testing (e.g., "Say hello in 5 words")
- Telemetry is derived from local OS stats + JSONL log tailing — zero API cost
- Frontend changes (HTML/CSS/JS) only need a browser refresh, NOT a server restart
