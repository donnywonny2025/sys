# OpenClaw Google Provider Docs (Saved 2026-04-07)
Source: https://docs.openclaw.ai/providers/google

## Auth
- Provider: `google`
- Auth: `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- API: Google Gemini API
- Alternative provider: `google-gemini-cli` (OAuth)

## Quick Start — Set API Key
```bash
openclaw onboard --auth-choice gemini-api-key
```

## Non-Interactive Setup (Scripted)
```bash
openclaw onboard --non-interactive --accept-risk \
  --mode local \
  --auth-choice gemini-api-key \
  --gemini-api-key "$GEMINI_API_KEY"
```

## After Setting Key
```bash
openclaw gateway restart
```

## Environment Note
If the Gateway runs as a daemon (launchd/systemd), make sure `GEMINI_API_KEY`
is available to that process. Options:
- `~/.openclaw/.env`
- `env.shellEnv` in config

## Default Model Config
```jsonc
{
  agents: {
    defaults: {
      model: { primary: "google/gemini-3-flash-preview" },
    },
  },
}
```

## Capabilities
- Chat completions ✅
- Image generation ✅
- Music generation ✅
- Image understanding ✅
- Audio transcription ✅
- Video understanding ✅
- Web search (Grounding) ✅
- Thinking/reasoning ✅ (Gemini 3.1+)

## Key Rotation
Configure multiple keys via:
- `OPENCLAW_LIVE_<PROVIDER>_KEY` (single live key)
- Config-based rotation in model providers settings
