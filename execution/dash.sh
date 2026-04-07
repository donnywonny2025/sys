#!/bin/bash
# SYSTEM Dashboard Control — execution/dash.sh
# Fast one-liners for all dashboard operations.
# Uses chrome-cli (brew install chrome-cli) + curl + screencapture.

DASHBOARD_URL="http://localhost:3111"

case "$1" in
  push)
    # Push text: ./dash.sh push "message" [info|success|error|headline]
    TYPE="${3:-info}"
    curl -s -X POST "$DASHBOARD_URL/api/push" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"$TYPE\",\"content\":\"$2\"}" > /dev/null
    ;;
  image)
    # Push image: ./dash.sh image "url" "caption"
    curl -s -X POST "$DASHBOARD_URL/api/push" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"image\",\"content\":\"$3\",\"image\":\"$2\"}" > /dev/null
    ;;
  read)
    # Read screen content
    osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "document.querySelector(\"#feed\").innerText"'
    ;;
  refresh)
    osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "location.reload()"'
    ;;
  clear)
    rm -f "$(dirname "$0")/../dashboard/data/history.json"
    osascript -e 'tell application "Google Chrome" to execute active tab of front window javascript "location.reload()"'
    ;;
  tabs)
    chrome-cli list tabs
    ;;
  close)
    # Close tab by ID: ./dash.sh close 1234567
    chrome-cli close -t "$2"
    ;;
  open)
    # Open URL: ./dash.sh open "https://example.com"
    chrome-cli open "$2"
    ;;
  snap)
    screencapture -x "${2:-/tmp/dashboard_check.png}"
    ;;
  status)
    curl -s "$DASHBOARD_URL/api/history" | python3 -c "import sys,json; h=json.load(sys.stdin); print(f'Online | {len(h)} messages')" 2>/dev/null || echo "Offline"
    ;;
  *)
    echo "dash.sh {push|image|read|refresh|clear|tabs|close|open|snap|status}"
    ;;
esac
