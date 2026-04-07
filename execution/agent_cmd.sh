#!/bin/bash
# Wrapper for Antigravity to run CLI commands and sync output to the dashboard.
# This ensures that any background work Antigravity does is visually mirrored in the UI.
# Usage: ./execution/agent_cmd.sh openclaw pairing approve telegram 12345

DASHBOARD_URL="http://localhost:3111/api/push"

COMMAND_STR="$*"

# Start processing
curl -s -X POST "$DASHBOARD_URL" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"console\",\"entry\":\"🚀 Antigravity executing: $COMMAND_STR\",\"style\":\"sys\",\"status\":\"PROCESSING\"}" > /dev/null

# Execute command and pipe lines one by one to dashboard
"$@" 2>&1 | while IFS= read -r line; do
  if [[ -z "$line" ]]; then continue; fi
  # Remove ANSI codes
  CLEAN_LINE=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g' | jq -sRr @json | sed 's/^"//;s/"$//')
  curl -s -X POST "$DASHBOARD_URL" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"console\",\"entry\":\"⚙️ $CLEAN_LINE\",\"style\":\"sys\"}" > /dev/null
done

# End processing
curl -s -X POST "$DASHBOARD_URL" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"console\",\"entry\":\"✅ Execution finished\",\"style\":\"sys\",\"status\":\"IDLE\"}" > /dev/null
