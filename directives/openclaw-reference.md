# OpenClaw Reference — Execution Engine

## Architecture
```
User → Antigravity (orchestrator) → OpenClaw Gateway (18789) → Dashboard (3111)
```

## Gateway Details
- **Port:** 18789 (loopback only)
- **Config:** `~/.openclaw/openclaw.json`
- **Logs:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- **Workspace:** `~/.openclaw/workspace/`
- **Source:** `/Volumes/WORK 2TB/WORK 2026/SYSTEM/openclaw/`
- **Auth token:** stored in config at `gateway.auth.token`
- **LaunchAgent:** `ai.openclaw.gateway` (auto-starts on boot)

## Token Retrieval
```bash
TOKEN=$(cat ~/.openclaw/openclaw.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway',{}).get('auth',{}).get('token',''))")
```

## API Endpoints (all on port 18789)

### Health Check (no auth)
```bash
curl -s http://127.0.0.1:18789/health
# Returns: {"ok":true,"status":"live"}
```

### List Models (requires auth)
```bash
curl -s http://127.0.0.1:18789/v1/models \
  -H "Authorization: Bearer $TOKEN"
```

### Chat Completions (requires auth, must be enabled)
```bash
curl -s http://127.0.0.1:18789/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw/default","messages":[{"role":"user","content":"Hello"}]}'
```
**Enable with:** `openclaw config set gateway.http.endpoints.chatCompletions.enabled true`

### Direct Tool Invoke (requires auth, always enabled)
```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"sessions_list","action":"json","args":{}}'
```
**Note:** Some tools are denied by default over HTTP: exec, spawn, shell, fs_write, fs_delete, cron, gateway, nodes.

## Operator Commands
```bash
openclaw gateway status        # check if running
openclaw gateway restart       # restart service
openclaw gateway stop          # stop service
openclaw gateway install       # install LaunchAgent
openclaw health                # gateway health snapshot
openclaw status --all          # full local diagnosis
openclaw logs --follow         # tail live logs
openclaw doctor                # diagnose issues
openclaw config set KEY VALUE  # set config value
openclaw config get KEY        # read config value
```

## Rebuilding From Source
```bash
cd /Volumes/WORK\ 2TB/WORK\ 2026/SYSTEM/openclaw
pnpm install && pnpm build
pnpm link --global
openclaw gateway restart
```

## Installed Skills (51)
1password, apple-notes, apple-reminders, bear-notes, blogwatcher, blucli, camsnap,
clawhub, eightctl, gemini, gh-issues, gifgrep, github, gog, healthcheck, himalaya,
imsg, mcporter, model-usage, nano-pdf, node-connect, obsidian, openhue, oracle,
ordercli, peekaboo, session-logs, skill-creator, songsee, sonoscli, summarize,
things-mac, tmux, video-frames, wacli, weather, xurl, adapt, animate, audit, bolder,
clarify, colorize, critique, delight, distill, extract, find-skills, frontend-design,
harden, normalize, onboard, optimize, polish, quieter, teach-impeccable

## Key Skills for Dashboard Data
- **Calendar:** `apple-reminders` + direct AppleScript (check_calendar.sh still works independently)
- **Email:** `himalaya` — CLI email client for IMAP/SMTP
- **Weather:** `weather` skill
- **Notes:** `apple-notes`, `bear-notes`, `obsidian`
- **Camera:** `camsnap`, `peekaboo`

## Dashboard Integration
The dashboard at port 3111 checks OpenClaw health via:
- `GET /api/hermes-status` or `GET /api/openclaw-status` → probes `http://127.0.0.1:18789/health`
- Data is pushed to dashboard via `POST http://localhost:3111/api/push`

## Control UI (Port 18789 Web Interface)
The OpenClaw Control UI is a chat interface at `http://127.0.0.1:18789/#token=<TOKEN>`.
**Known issue:** Currently renders blank (web component mounts but doesn't initialize).
This is the THEIR chat UI — not our dashboard. Our dashboard at 3111 is fully functional.

## The Data Flow Pattern
Antigravity routes tasks through OpenClaw using the `/v1/chat/completions` endpoint:
```bash
curl -s http://127.0.0.1:18789/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw/default",
    "messages": [
      {"role":"system","content":"Retrieve data and return it as structured JSON."},
      {"role":"user","content":"Check my calendar for today and return events as JSON array"}
    ]
  }'
```

## Exception Rule
Calendar and mail scripts (`check_calendar.sh`, `check_mail.sh`) use direct AppleScript
for maximum reliability since they're READ-ONLY operations. This is acceptable because:
1. They don't require LLM reasoning
2. They push directly to the dashboard API
3. They bypass the token cost of an OpenClaw agent turn
