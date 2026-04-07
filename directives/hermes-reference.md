# Hermes Agent — Architecture Reference

## What Hermes IS

Hermes Agent is a CLI-first AI assistant with **tool-calling capabilities**. It uses any LLM (currently Gemini 2.5 Flash via Google AI Studio) and wraps it with persistent tools: terminal, file I/O, browser automation, web search, skills, memory, cron jobs, and delegation.

## How to Talk to Hermes

### CLI (one-shot query)
```bash
hermes chat -q "your request" --quiet --skills apple-mail
```
- `--quiet` = suppress the banner
- `--skills` = preload specific skills
- `--yolo` = skip dangerous command approval

### Gateway API (programmatic, from dashboard)
```bash
curl http://localhost:8642/v1/chat/completions \
  -H "Authorization: Bearer hermes-system-local-key" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Check my mail"}]}'
```
- Runs on port `8642` (configured in `~/.hermes/.env`)
- OpenAI-compatible API format
- Returns JSON with the agent's response + any tool outputs
- **This is the right way to integrate with the dashboard** — not `hermes chat -q` spawning processes

### Sessions
```bash
hermes -c                    # Resume most recent session
hermes -c "project name"     # Resume named session
hermes --resume SESSION_ID   # Resume specific session
```

## Tool System

17/18 tools enabled on CLI:
- `terminal` — Run shell commands
- `read_file`, `write_file`, `patch`, `search_files` — File operations
- `browser_*` — Full browser automation (navigate, click, type, snapshot)
- `web_search`, `web_extract` — Web search and scraping
- `execute_code` — Run Python scripts with tool access
- `delegate_task` — Spawn sub-agents
- `cronjob` — Schedule automated tasks
- `memory` — Persistent memory across sessions
- `skills_list`, `skill_view` — Load and use skills
- `todo` — Task tracking
- `tts` — Text to speech
- `session_search` — Search past conversations

## Skills System

### Built-in Skills (67 total, in `~/.hermes/hermes-agent/skills/`)

**Apple:**
- `apple-notes` — Apple Notes via memo CLI
- `apple-reminders` — Apple Reminders via `remindctl` (needs `brew install steipete/tap/remindctl`)
- `imessage` — iMessage via imsg CLI
- `findmy` — Find My devices

**No built-in calendar skill** — Calendar access is done via AppleScript through the terminal tool.

**No built-in weather skill** — Weather is done via web search or APIs.

**Productivity:**
- `google-workspace` — Google Sheets, Slides, Drive, Calendar
- `notion`, `linear`, `obsidian` — Note/project tools
- `ocr-and-documents` — Document processing

**Creative:**
- `excalidraw` — Generate diagrams as PNG from Excalidraw JSON (NOT an interactive whiteboard — it renders static images)
- `p5js` — Creative coding
- `manim-video` — Math animations

### Hub-Installed Skills (in `~/.hermes/skills/`)
- `apple-mail` — Apple Mail via AppleScript scripts (get-emails.sh, send-email.sh, etc.)
- `excalidraw` — (duplicate from hub, same as built-in)

### How Skills Work
1. Skills are Markdown files (SKILL.md) with instructions + optional scripts
2. The agent reads the SKILL.md and follows the instructions
3. Scripts in the skill directory provide deterministic execution
4. Preload with `--skills skill-name` or the agent auto-discovers them

## Configuration

- `~/.hermes/.env` — API keys, server settings, env vars
- `~/.hermes/config.yaml` — Full config (model, tools, behavior, etc.)
- `~/.hermes/SOUL.md` — Agent persona
- `~/.hermes/memories/` — Persistent memory (MEMORY.md, USER.md)

## Key Architectural Notes

1. **Hermes does NOT have a built-in calendar skill or weather skill.** Calendar = AppleScript via terminal. Weather = web search or API.
2. **The Excalidraw skill generates static PNGs** — it's NOT an interactive whiteboard. It renders diagrams from JSON.
3. **The Gateway API is the right integration point** for our dashboard. It's OpenAI-compatible, returns structured responses, and the agent has full tool access.
4. **Apple Reminders (`remindctl`)** is the built-in TODO system — syncs to iPhone.
5. **`hermes cron`** can schedule recurring tasks (e.g., check mail every 30 min, refresh weather).

## Dashboard Integration Pattern

```
Jeff speaks → Antigravity → Execution Script → Hermes Gateway API (port 8642)
                                             → Dashboard WebSocket (port 3111)
```

For routine data (mail, calendar, weather): use **execution scripts** that call native APIs (AppleScript, curl) directly — faster than going through the LLM.

For complex requests: route through the **Gateway API** so Hermes can use its full tool chain.
