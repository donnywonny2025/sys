# SYSTEM Architecture

## The Three Layers

```
USER (Jeff)
  ↕
ANTIGRAVITY (Orchestrator — decision-making, routing, monitoring)
  ↕
OPENCLAW (Execution Engine — does the actual work)
  ↕
DASHBOARD (Display — http://localhost:3111 — shows everything to the user)
```

## How It Works

### OpenClaw = Execution Layer
- OpenClaw is the execution engine. It runs tasks, checks mail, manages channels, handles scheduling.
- ALL execution flows through OpenClaw. Antigravity does NOT bypass OpenClaw with raw crontab entries, manual bash scripts, or direct system calls for recurring work.
- OpenClaw has: `tasks`, `agent`, `channels`, `system`, `webhooks` — use them.
- CLI: `openclaw agent --message "..."` sends work to the agent.
- Gateway: `ws://127.0.0.1:18789` (port 18789)

### Antigravity = Orchestrator
- Reads directives, makes decisions, routes commands to OpenClaw.
- Monitors OpenClaw's activity and displays it on the dashboard.
- Does NOT do execution work itself. No raw cron jobs. No parallel systems.
- Antigravity talks TO OpenClaw, OpenClaw does the work, results come back.

### Dashboard = The Display
- URL: http://localhost:3111
- Shows: Schedule, Inbox, Weather, Today's Focus, Activity Feed
- **OPENCLAW CONSOLE**: The bottom panel. Shows ALL OpenClaw activity in real-time:
  - Chat messages (→ user, ← assistant)
  - Task execution (mail checks, calendar refreshes, weather updates)
  - Connection events, model info, errors
  - Cron/scheduled task activity
  - ANY background work OpenClaw is doing
- **Feed Timers**: Each section (Schedule, Inbox) shows countdown timers to next refresh
- **Green Dot**: Top-right OPENCLAW indicator. Green = gateway connected. Only green if actually connected.
- **Persistence**: Feed data (email, calendar, weather) is cached server-side. Survives page refreshes.

## Console Rules
- The console is NOT just a log. It is a LIVE WINDOW into OpenClaw's execution.
- Everything OpenClaw does must be visible there.
- Every cron job, every task, every message, every background operation.
- The user watches this to understand what the system is doing.

## What NOT To Do
- ❌ Do NOT set up macOS crontab entries for recurring tasks
- ❌ Do NOT run bash scripts directly for things OpenClaw can do
- ❌ Do NOT bypass OpenClaw with manual execution
- ❌ Do NOT show a green OPENCLAW light unless the gateway is actually responding
- ❌ Do NOT lose feed data on page refresh (data must be cached server-side)

## Current State (2026-04-07)
- Dashboard server: `/Volumes/WORK 2TB/WORK 2026/SYSTEM/dashboard/server.js` (port 3111)
- OpenClaw gateway: port 18789, auth token in session files
- OpenClaw config: `~/.openclaw/`
- Agent config: `~/.openclaw/agents/main/agent/`
- Session files: `~/.openclaw/agents/main/sessions/*.jsonl` (tailed for live chat)
- Gateway log: `~/.openclaw/logs/gateway.log` (tailed for connection events)
- API key: stored in `~/.openclaw/agents/main/agent/auth-profiles.json` (gitignored)
- Model: gemini-2.5-flash via Google provider

## Migration TODO
- [ ] Learn OpenClaw's task/scheduling system (`openclaw tasks --help`)
- [ ] Migrate mail/calendar/weather checks from crontab into OpenClaw tasks
- [ ] Remove raw crontab entries once OpenClaw handles scheduling
- [ ] Ensure all OpenClaw task execution shows in dashboard console
