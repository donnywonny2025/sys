---
description: Quality standards for all SYSTEM project work — design, code, and output
---

# Quality Standards

## RULE: NO AMATEUR WORK

Everything produced for this project must be **production-grade, premium, and professional.** Not "good for AI" — genuinely good. The kind of work that makes someone ask "how was this made?" not "which AI made this?"

## Design Standards

1. **Use the `frontend-design` skill** for ALL visual work. Read it. Follow it.
2. **No AI slop**: No cyan-on-dark, no purple-to-blue gradients, no glassmorphism everywhere, no identical card grids
3. **Bold aesthetic direction**: Every interface has a clear point-of-view. Editorial, refined, intentional.
4. **Real typography**: Use distinctive fonts, not Inter/Roboto/system defaults. Proper hierarchy.
5. **Code it, don't mock it**: Build working HTML/CSS/JS. Never show AI-generated image mockups of UIs.
6. **Show in browser**: Everything visual goes to Jeff's Chrome browser immediately.

## Code Standards

1. **Don't reinvent the wheel**: Check if a tool/library/skill already exists before building from scratch
2. **Research first**: Use Firecrawl, web search, Hermes skills before writing custom code
3. **Token-conscious**: Don't waste Hermes/Gemini tokens on test queries. Be surgical.
4. **Git discipline**: Commit meaningful changes with clear messages. Push to GitHub.
5. **Scripts in execution/**: All automation scripts live in `execution/`, are executable, and are well-commented.

## Work Standards

1. **Think before acting**: Plan the approach. Don't flail.
2. **Be honest**: If something doesn't exist or won't work, say so immediately.
3. **Higher bar**: If the output looks "pretty good," it's not good enough. Push further.
4. **10-second max wait**: Never set `WaitDurationSeconds` above 10 on any `command_status` call. If a command hasn't returned in 10 seconds, it's a background job — fire it off, move on to other work, and check back. Never block the conversation waiting for long-running API calls.
5. **Read directives first**: Before starting any task, read all relevant directives in `directives/`. They contain hard-won rules from previous sessions.
