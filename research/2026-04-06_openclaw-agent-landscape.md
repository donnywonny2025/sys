# Research: OpenClaw & The Agent Landscape (April 2026)

**Date:** 2026-04-06  
**Purpose:** Evaluate OpenClaw and alternatives for use as the background automation layer of SYSTEM.  
**Context:** Jeff wants to use Antigravity (this IDE chat) as the primary interface for SYSTEM, with Google AI Studio / Gemini Pro for the web UI front-end, and potentially OpenClaw or similar for background cron jobs, computer-use tasks, and autonomous operations.

---

## What Is OpenClaw?

**Created by:** Peter Steinberger (@steipete)  
**Launched:** November 2025  
**Status:** Fastest-growing GitHub repo in history within weeks of launch  
**Acquired by:** OpenAI (February 15, 2026 — Sam Altman announced, Peter Steinberger joined OpenAI)  
**Note:** Meta did NOT acquire OpenClaw itself. Meta acquired **Moltbook** (a social network for AI agents that used the OpenClaw framework) in March 2026. The confusion is understandable.

### What It Does
OpenClaw is an open-source personal AI assistant that runs on your own machine (Mac, Windows, Linux). Key capabilities:

- **24/7 autonomous operation** — Runs in background with cron jobs, heartbeats, proactive tasks
- **Any chat interface** — WhatsApp, Telegram, Discord, Slack, Signal, iMessage
- **Full computer access** — File system, terminal, browser control, shell commands
- **Persistent memory** — Remembers everything across sessions, context never lost
- **Skills/plugins system** — Extensible with community or self-built skills
- **Multi-model** — Works with Claude, GPT, Gemini, local models via Ollama
- **Self-improving** — Can write its own skills and modify its own prompts

### How People Use It
- Daily briefings, calendar checks, traffic-aware reminders
- Email triage, automated responses, inbox management
- Code review, test running, PR opening via GitHub webhooks
- Health data monitoring (WHOOP, biomarkers)
- Financial tracking, insurance claims, flight check-ins
- Building websites and tools via phone while AFK

---

## The Post-Acquisition Landscape

Since OpenAI acquired OpenClaw in Feb 2026, the open-source community has fractured:

### The Original (Now OpenAI-affiliated)
- **openclaw.ai** — Still open source on GitHub, still installable via npm
- **Concern:** Community worried about OpenAI influence, data practices, and eventual lock-in
- **Sponsors include:** OpenAI, GitHub, NVIDIA, Vercel
- **Still works:** The open-source version is still functional and actively maintained

### Key Forks & Alternatives

| Name | Focus | Open Source? | Notes |
|------|-------|-------------|-------|
| **NanoClaw** | Security-first, minimal | Yes | Stripped-down version, radical simplicity |
| **ZeroClaw** | Privacy-hardened | Yes | For people who don't trust OpenAI ownership |
| **PicoClaw** | Runs on low-end hardware ($10 devices) | Yes | Raspberry Pi friendly |
| **IronClaw** | Enterprise security | Yes | Hardened for business use |
| **NullClaw** | Fully local, no cloud | Yes | Zero external API calls possible |
| **OpenCode** | Coding-focused agent | Yes | Free alternative to Claude Code |
| **Manus AI** | General purpose agent | No (commercial) | More polished but less hackable |
| **Claude Code** | Anthropic's coding agent | No (commercial) | Terminal-based, deep but not 24/7 |
| **n8n** | Workflow automation | Yes | Different paradigm — visual workflow builder |

### The open-claw.org Site
This appears to be a separate hosted service (not the original project's site, which is openclaw.ai). It offers subscription plans ($24-$54/month) with built-in API credits. This is a commercial wrapper around the OpenClaw framework — NOT the original project. The original is free and self-hosted.

---

## How OpenClaw Fits Jeff's Architecture

### Jeff's Vision (as described):
```
┌─────────────────────────────────────────────┐
│  ANTIGRAVITY (IDE Chat)                     │
│  "The brain" — Jeff talks to me here        │
│  Controls everything, makes decisions       │
├─────────────────────────────────────────────┤
│  GOOGLE AI STUDIO / GEMINI PRO             │
│  "The face" — Web UI that Jeff sees         │
│  Calendar, whiteboard, images, SVGs,        │
│  design work, persistent display panel      │
├─────────────────────────────────────────────┤
│  OPENCLAW (or similar)                      │
│  "The hands" — Background worker            │
│  Cron jobs, email scanning, file watching,  │
│  autonomous tasks, computer-use,            │
│  24/7 monitoring                            │
├─────────────────────────────────────────────┤
│  SYSTEM REPO (git)                          │
│  "The memory" — State, config, logs         │
│  Manifests, directives, changelogs          │
└─────────────────────────────────────────────┘
```

### My Assessment

**Should Jeff use OpenClaw?** Yes, but with caveats.

#### Pros for Jeff's use case:
1. **Cron jobs and background tasks** — This is exactly what OpenClaw is designed for. Heartbeats, scheduled checks, proactive monitoring.
2. **Skills system** — Aligns perfectly with the directives/execution architecture already in SYSTEM. OpenClaw skills ≈ SYSTEM execution scripts.
3. **Multi-model support** — Jeff's Google Ultra subscription means Gemini 3 Pro access. OpenClaw can route to Gemini for background tasks, keeping Claude for the IDE work.
4. **Self-hosted** — Runs on Jeff's machine, data stays local. Git controls the config.
5. **Community momentum** — Massive ecosystem of pre-built skills and integrations.

#### Cons / Risks:
1. **OpenAI acquisition uncertainty** — The project's direction could shift. OpenAI has financial incentives to nudge users toward their APIs.
2. **Overlap with Antigravity** — OpenClaw wants to be the "brain" too. In Jeff's architecture, it needs to be demoted to "hands only" — no decision-making, just execution. This requires careful configuration.
3. **Token costs** — Running 24/7 background tasks burns API credits. Need to be strategic about what runs autonomously vs. on-demand.
4. **Complexity** — Adding another AI system creates coordination overhead. Antigravity orchestrates → OpenClaw executes → but who resolves conflicts?

#### Recommendation: Use the open-source original, NOT a fork, NOT the commercial wrapper.

The original openclaw at `github.com/openclaw/openclaw` is still open source, still functional, and benefits from the largest community. The forks (NanoClaw, ZeroClaw, etc.) are interesting but have smaller communities and less testing. Use the original but:

1. **Pin to a specific version.** Don't auto-update. Review releases before upgrading.
2. **Use Gemini as the model backend.** Jeff already has Google Ultra. Route OpenClaw through Gemini API, not OpenAI.
3. **Restrict its role.** Configure it as a headless worker — no chat interface, no decision-making. It receives tasks from SYSTEM directives, executes them, writes results back to the SYSTEM repo.
4. **Use Playwright for the web UI instead** — For the persistent display panel Jeff described (calendar, whiteboard, images, SVGs), use a locally-served web app with Playwright for instant rendering. OpenClaw is overkill for the UI layer.

---

## Alternative Approach: Skip OpenClaw, Build Custom

There's a simpler path worth considering:

Instead of running OpenClaw as a third system, we could build the background automation directly into SYSTEM using:

- **Python + cron / launchd** — macOS native scheduling via `launchd` plist files
- **Watchdog** — Python library for filesystem monitoring
- **Google APIs** — Direct Calendar/Gmail/Sheets integration via Python scripts
- **Playwright** — For the web UI + any browser automation

**Advantages:**
- Fewer moving parts (no OpenClaw dependency)
- Full control over every line of code
- Already fits the `execution/` script architecture
- No token costs for background tasks that don't need AI reasoning

**Disadvantages:**
- More upfront work
- No community skills ecosystem
- Lose OpenClaw's sophisticated memory and context management

**My lean:** Start with the custom approach for v1. Add OpenClaw later if we need its unique capabilities (multi-chat-platform integration, proactive heartbeats, sophisticated tool chaining).

---

## Google AI Studio / Gemini Pro — What Jeff Is Using for UI

- **Google AI Studio** (aistudio.google.com) — Web-based environment for building with Gemini models
- **Gemini 3 Pro** — Latest model, good at coding, reasoning, multimodal
- **Google AI Pro / Ultra subscription** — Gives highest access tier with agentic capabilities
- **Key feature:** Natural language to fully functional app generation
- **Relevant for SYSTEM:** Jeff is designing the web UI experience through Gemini on AI Studio — the visual panel that displays calendar, whiteboard, images, etc.

This means the architecture is:
- **Gemini (via AI Studio)** = designs/generates the UI code
- **Antigravity** = controls the system, writes the backend, manages state
- **OpenClaw (or custom scripts)** = background worker execution

---

## Open Questions for Jeff

1. **Do you want OpenClaw running 24/7 or on-demand?** 24/7 burns tokens but catches things proactively. On-demand is cheaper but reactive.
2. **What chat platform for OpenClaw?** If you do use it, do you want Telegram, Discord, or just headless (no chat, pure cron)?
3. **Custom vs. OpenClaw for v1?** I'm leaning custom (Python + launchd + Playwright) for simplicity. OpenClaw can be layered in later. Your call.
4. **The web UI panel you described** — is this something you're building in AI Studio right now? If so, how far along is it? Should I be aware of its architecture?
