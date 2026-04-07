# Session: Dashboard Telemetry & OpenClaw Streaming Fixes
**Date**: 2026-04-07

## Goal
The dashboard's connection with the OpenClaw CLI was behaving synchronously, masking the "thinking" feedback from the user. Furthermore, responses were randomly dropping, and system node limits were causing exceptions (`EAGAIN`). The objective was to restore a perfectly transparent, live telemetry feed where any interactions with OpenClaw instantly reflect in the dashboard.

## Work Completed

### 1. Re-architected API Stream Processing (`server.js`)
- Ripped out `execFile()` in `/api/openclaw-chat` which was bottling up the live terminal outputs. 
- Integrated `spawn()` to grab `stderr` directly from the OpenClaw execution hook.
- Wrapped processing payloads in strict `PROCESSING/IDLE` WebSocket status flags to lock the GUI visual spinner tightly to the OpenClaw system latency.

### 2. Node.js Process Leak Fixed
- Detected that `findActiveSession` tracking wasn't correctly killing `tail` watchers when sessions didn't jump, leaking processes until the system crashed out with an `EAGAIN` fork block limit.
- Killed the zombies (`killall tail`) and stabilized the OS.

### 3. OpenClaw Token/Stat Block Regex Fix (`server.js`)
- Debugged a major issue where the actual response from the AI was failing to show up visually (leaving `Runtime finished` with an empty chat bubble).
- Root cause was a greedy match (`[\s\S]*?$`) deleting the whole trailing string output when attempting to filter the background `🦞 OpenClaw` token dump logic that got appended to answers.

### 4. Added Live Command Interface (`execution/agent_cmd.sh`)
- Written and codified an `agent_cmd.sh` wrapper so the AI agent (Antigravity) can never run unauthorized blind scripts without the user seeing it.
- Executing `agent_cmd.sh [command]` automatically pipes exact real-time CLI logs (`stdout/stderr`) through `POST /api/push` to ensure full visibility back to the Chat/Console.
- Setup successful Telegram bot pairing flow tests through this API.

## Pending Tasks
- Investigate Telegram bot misconfiguration on background `cron` jobs (`check_mail` finding correct routing recipient).
