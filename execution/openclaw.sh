#!/bin/bash
# openclaw.sh — Talk to OpenClaw Gateway and log to dashboard console
# Usage: ./execution/openclaw.sh "your prompt here"
# All requests and responses are logged to the dashboard console panel.

PROMPT="$1"
DASH_URL="http://localhost:3111/api/push"
TOKEN=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway',{}).get('auth',{}).get('token',''))" < ~/.openclaw/openclaw.json)
TS=$(date +%H:%M:%S)

# Log the outgoing request to the console
curl -s -X POST "$DASH_URL" -H "Content-Type: application/json" \
  -d "{\"type\":\"console\",\"entry\":\"→ ${PROMPT//\"/\\\"}\",\"style\":\"out\",\"status\":\"PROCESSING\",\"ts\":\"$TS\"}" > /dev/null

# Send to OpenClaw
START=$(python3 -c "import time; print(time.time())")
RESPONSE=$(curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"openclaw/default\",
    \"messages\": [
      {\"role\":\"system\",\"content\":\"Be concise. Return direct answers.\"},
      {\"role\":\"user\",\"content\":\"${PROMPT//\"/\\\"}\"}
    ]
  }" 2>&1)

ELAPSED=$(python3 -c "import time; print(round(time.time()-$START,1))")
TS2=$(date +%H:%M:%S)

# Extract content from response
CONTENT=$(echo "$RESPONSE" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  c=d['choices'][0]['message']['content']
  # Escape for JSON
  c=c.replace('\\\\','\\\\\\\\').replace('\"','\\\\\"').replace('\\n',' ')
  print(c[:500])
except:
  print('Error parsing response')
" 2>&1)

# Log the response to the console
curl -s -X POST "$DASH_URL" -H "Content-Type: application/json" \
  -d "{\"type\":\"console\",\"entry\":\"← OpenClaw (${ELAPSED}s): ${CONTENT}\",\"style\":\"in\",\"status\":\"IDLE\",\"ts\":\"$TS2\"}" > /dev/null

# Output the raw content for piping
echo "$CONTENT"
