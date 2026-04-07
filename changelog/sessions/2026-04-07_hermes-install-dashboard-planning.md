# Session: Hermes Agent Install + Dashboard Planning
**Date:** 2026-04-07
**Participants:** Jeff (USER) + Antigravity (Claude Opus)

---

## Key Decisions

### 1. Two-Layer AI Architecture
- **Layer 1 (Smart/Expensive):** Antigravity (Claude Opus) — Jeff talks to this. Makes decisions, writes code, orchestrates everything.
- **Layer 2 (Cheap/Fast):** Hermes Agent running Gemini 3 Flash — background worker. Runs 24/7, handles cron jobs, routine tasks, email checking, monitoring.
- Jeff NEVER interacts with Hermes directly. He talks to Antigravity, Antigravity controls Hermes via CLI/API.

### 2. Hermes Agent Installation
- **Status:** ✅ Installed
- **Install location:** `~/.hermes/hermes-agent/`
- **Config:** `~/.hermes/config.yaml`
- **API keys:** `~/.hermes/.env`
- **Model:** `gemini-3-flash` (via direct Google API, not OpenRouter)
- **Provider:** `gemini`
- **API Key:** Stored in `~/.hermes/.env` as `GOOGLE_API_KEY` and `GEMINI_API_KEY`
- **Reference copy:** Also cloned to `/Volumes/WORK 2TB/WORK 2026/SYSTEM/hermes-agent/` for code reading

### 3. Web Dashboard Architecture
- **Purpose:** Visual display only — NO chat box, NO input. Jeff talks to Antigravity, dashboard just SHOWS things.
- **Content:** Calendar, images, project status, email summary, cron job results, quick action results
- **Real-time:** Uses WebSocket/SSE — updates appear instantly when Antigravity or Hermes writes new data
- **Data flow:** Antigravity/Hermes → write to shared state (JSON/files) → Web dashboard reads and displays

### 4. No Chat UI in Dashboard
- Explicitly decided: the web app has NO chat interface
- It is a DISPLAY/MONITOR — like a TV showing live data
- Jeff's only interaction point is Antigravity IDE (this chat)

---

## Workspace Layout

### Hardware
- **Mac:** Apple M2, 10-core GPU, Metal 4
- **Main Monitor (KB272 E):** 1920×1080 (1080p FHD) @ 100Hz — PRIMARY WORKSPACE
- **LG TV (SSCR2):** 3840×2160 (4K UHD) @ 60Hz — 75" screen for Premiere/editing

### Screen Layout (Main Monitor — 1920×1080)
```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│   Chrome Browser    │   Antigravity IDE   │
│   (Web Dashboard)   │   (Chat + Code)     │
│                     │                     │
│   ~960px wide       │   ~960px wide       │
│   1080px tall       │   1080px tall       │
│                     │                     │
└─────────────────────┴─────────────────────┘
```

### Dashboard Design Constraints
- **Width:** ~960px (half of 1920)
- **Height:** ~1080px (full monitor height minus browser chrome ≈ ~980px usable)
- **Always visible:** Sits next to Antigravity, always on screen
- **Glanceable:** Quick visual scan to see current state
- **Fast:** Updates appear in under 1 second
- **No interaction required:** Pure display, no forms, no chat, no input

---

## Communication Protocol
- Jeff talks to Antigravity (Claude) in the IDE
- Antigravity controls Hermes via `hermes` CLI commands in terminal
- Hermes runs background tasks with Gemini Flash
- Results are written to shared state files
- Web dashboard watches shared state and renders updates in real-time
- Everything is versioned in SYSTEM repo on GitHub

---

## Next Steps
1. [ ] Design the web dashboard (talk through design with Jeff first)
2. [ ] Build the web dashboard (Vite/vanilla, served locally)
3. [ ] Wire Hermes cron jobs
4. [ ] Set up first integrations (calendar, email)
5. [ ] Test the full loop: Jeff → Antigravity → Hermes → Dashboard
