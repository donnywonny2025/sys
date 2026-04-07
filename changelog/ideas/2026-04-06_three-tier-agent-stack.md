# Idea: Antigravity → Gemini → OpenClaw (3-Tier Agent Stack)

**Date:** 2026-04-06  
**Status:** ACTIVE  
**Source:** Jeff's verbal description, Session 1

## The Concept

A 3-tier agent stack where each tier has a distinct role and Jeff only directly interfaces with Tier 1:

### Tier 1: Antigravity (IDE Chat) — "The Brain"
- Jeff's primary interface
- Reads SYSTEM manifests, makes decisions, writes code
- Controls the other two tiers
- Starts new conversations freely, SYSTEM repo maintains continuity

### Tier 2: Google AI Studio / Gemini Pro — "The Face"
- Persistent web UI panel (fixed size, never resizes)
- Displays: calendar, whiteboard, images, SVGs, design work
- Rendering possibly via Playwright for instant display
- Jeff is actively designing this in AI Studio right now
- Powered by Gemini 3 Pro via Google Ultra subscription

### Tier 3: OpenClaw (or custom scripts) — "The Hands"
- Background worker, headless (Jeff does NOT chat with it)
- Cron jobs, email scanning, file watching, autonomous tasks
- Receives directives from SYSTEM repo, writes results back
- Could use Gemini API via Google Ultra subscription for AI-powered tasks
- Decision pending: OpenClaw vs. custom Python + launchd

## Key Insight
The SYSTEM git repo is the **shared memory** between all three tiers. Antigravity writes manifests/directives → OpenClaw reads and executes → results written back → Gemini UI reads and displays. Git is the bus.

## Questions
- How do Tiers 2 and 3 communicate in real time? (WebSocket? File-watching? Shared state?)
- Does the Gemini web UI need its own local server? (Probably yes — `localhost:XXXX`)
- Should OpenClaw be containerized (Docker) for isolation?
