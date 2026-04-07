# Session Logging Directive

## Purpose
Every conversation that touches the SYSTEM folder MUST be logged. This is a non-negotiable operating rule. Ideas, decisions, abandoned paths, changes, research — everything gets written down and committed to git.

## Why
- LLM conversations are ephemeral. The SYSTEM repo is permanent.
- Abandoned ideas often become good ideas later. We never delete, we mark as `ABANDONED` with reasoning.
- Git history gives us time-travel. Every push is a checkpoint we can return to.

## What Gets Logged

### Session Log (`changelog/sessions/`)
One file per session, named by date and short topic: `YYYY-MM-DD_topic.md`

Every session log must include:
- **Date/Time** — When the session happened
- **Conversation ID** — The Antigravity conversation ID for traceability
- **Objective** — What we set out to do
- **Decisions Made** — What we decided and why
- **Changes Made** — What files were created/modified/deleted
- **Ideas Explored** — Even if we didn't act on them
- **Ideas Abandoned** — What we considered and rejected, with reasoning
- **Open Questions** — Unresolved items carried forward
- **Next Steps** — What to do next session

### Decision Log (`changelog/decisions/`)
When a significant architectural or strategic decision is made, it gets its own entry:
`YYYY-MM-DD_decision-short-name.md`

Each decision entry includes:
- **Decision** — What was decided
- **Context** — Why this came up
- **Options Considered** — What alternatives existed
- **Rationale** — Why this option was chosen
- **Consequences** — What this decision enables or constrains

### Ideas Vault (`changelog/ideas/`)
Quick-capture for ideas that come up mid-session but aren't acted on yet:
`YYYY-MM-DD_idea-short-name.md`

Status tags: `ACTIVE`, `PARKED`, `ABANDONED`, `IMPLEMENTED`

## Commit Protocol

At the end of every session (or at natural breakpoints during long sessions):
1. Write/update the session log
2. Stage all changes: `git add -A`
3. Commit with descriptive message: `git commit -m "session: YYYY-MM-DD — [brief summary]"`
4. Push to origin: `git push`

**Never leave uncommitted work.** If the session ends, everything goes up to GitHub.

## Template

Use the template at `changelog/TEMPLATE_session.md` for new session logs.
