#!/bin/bash
# ─── OpenClaw Gateway Communication Script ───
# This is the execution layer interface for Antigravity → OpenClaw.
# Gateway: ws://127.0.0.1:18789 | HTTP: http://127.0.0.1:18789
# Config:  ~/.openclaw/openclaw.json
# Logs:    /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log

export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Read auth token from config
TOKEN=$(cat ~/.openclaw/openclaw.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway',{}).get('auth',{}).get('token',''))")

API="http://127.0.0.1:18789"

usage() {
  echo "Usage: openclaw.sh <command> [args]"
  echo ""
  echo "Commands:"
  echo "  health        - Check gateway health"
  echo "  status        - Full gateway status"
  echo "  models        - List available models"
  echo "  ask <message> - Send a message to the agent"
  echo "  skills        - List installed skills"
  echo "  restart       - Restart the gateway"
  echo "  logs          - Tail gateway logs"
  exit 1
}

case "${1:-}" in
  health)
    curl -s "$API/health"
    ;;
  status)
    openclaw gateway status
    ;;
  models)
    curl -s "$API/v1/models" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/json"
    ;;
  ask)
    shift
    MESSAGE="$*"
    if [ -z "$MESSAGE" ]; then
      echo "Error: provide a message after 'ask'"
      exit 1
    fi
    curl -s "$API/v1/chat/completions" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"openclaw/default\",\"messages\":[{\"role\":\"user\",\"content\":\"$MESSAGE\"}]}" \
      | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])"
    ;;
  skills)
    curl -s "$API/v1/chat/completions" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"model":"openclaw/default","messages":[{"role":"user","content":"List only your skill names, comma separated, nothing else"}]}' \
      | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])"
    ;;
  restart)
    openclaw gateway restart
    ;;
  logs)
    tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
    ;;
  *)
    usage
    ;;
esac
