# Decision: Mandatory Session Logging

**Date:** 2026-04-06  
**Status:** ADOPTED

## Decision
Every conversation that touches the SYSTEM folder produces a session log entry in `changelog/sessions/` that gets committed and pushed to git.

## Context
Jeff is running 40+ simultaneous projects with an AI assistant across multiple conversations. Context gets lost between sessions. Ideas come up, get discussed, then vanish when the conversation ends. There's no institutional memory.

## Options Considered
1. **Rely on Antigravity's built-in conversation history** — Rejected. Conversation summaries are compressed and lose nuance. Can't search them well. Not in Jeff's control.
2. **Manual note-taking** — Rejected. Jeff won't do it consistently (nobody does). Needs to be automated.
3. **AI-maintained session logs in the repo** — Adopted. The AI writes the log as part of its workflow. It's version-controlled, searchable, and pushed to GitHub automatically.

## Rationale
- Zero burden on Jeff — the AI handles it
- Git provides full history and rollback capability  
- Logs live alongside the code/config they reference
- Searchable via grep, readable as plain markdown
- Forces the AI to think explicitly about what was decided and why

## Consequences
- Every session touching SYSTEM takes ~30 seconds longer for the AI to write the log
- The `changelog/` directory will grow over time — may need periodic summarization
- Creates a recoverable audit trail of every decision, including abandoned ones
