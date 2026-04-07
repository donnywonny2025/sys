#!/bin/bash
# openclaw.sh — Talk to OpenClaw Gateway and log to dashboard console
# Usage: ./execution/openclaw.sh "your prompt here"
# All requests and responses are logged to the dashboard console panel.

PROMPT="$1"
DASH_URL="http://localhost:3111/api/push"
TOKEN=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway',{}).get('auth',{}).get('token',''))" < ~/.openclaw/openclaw.json)
TS=$(date +%H:%M:%S)

# Escape prompt for JSON
PROMPT_ESCAPED=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1]))" "$PROMPT")
# Strip outer quotes for display
PROMPT_DISPLAY=$(echo "$PROMPT_ESCAPED" | sed 's/^"//;s/"$//')

# Log the outgoing request to the console
curl -s -X POST "$DASH_URL" -H "Content-Type: application/json" \
  -d "{\"type\":\"console\",\"entry\":\"→ ${PROMPT_DISPLAY:0:200}\",\"style\":\"out\",\"status\":\"PROCESSING\",\"ts\":\"$TS\"}" > /dev/null

# Send to OpenClaw
START=$(python3 -c "import time; print(time.time())")
RESPONSE=$(curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"openclaw/default\",
    \"messages\": [
      {\"role\":\"system\",\"content\":\"Be concise. Return direct answers.\"},
      {\"role\":\"user\",\"content\":${PROMPT_ESCAPED}}
    ]
  }" 2>&1)

ELAPSED=$(python3 -c "import time; print(round(time.time()-$START,1))")
TS2=$(date +%H:%M:%S)

# Extract and escape content properly with Python
CONTENT=$(echo "$RESPONSE" | python3 -c "
import sys,json,re
try:
    d=json.load(sys.stdin)
    c=d['choices'][0]['message']['content']
    # Strip think blocks
    c = re.sub(r'<think>.*?</think>', '', c, flags=re.DOTALL)
    # Strip OpenClaw token/status block
    c = re.sub(r'\u1f99e OpenClaw.*?(?:Queue:.*?\(depth \d+\)|$)', '', c, flags=re.DOTALL|re.IGNORECASE)
    c = re.sub(r'🦞 OpenClaw.*?(?:Queue:.*?\(depth \d+\)|$)', '', c, flags=re.DOTALL|re.IGNORECASE)
    c = re.sub(r'\`\`\`[\s\n]*\`\`\`', '', c, flags=re.DOTALL)
    
    # For console display: collapse newlines, truncate
    display=c.replace('\n',' ').replace('\r','').strip()[:500]
    # Escape for safe JSON embedding
    safe=json.dumps(display)[1:-1]  # strip outer quotes
    print(safe)
except Exception as e:
    pass
" 2>&1)

# Log the response to the console
curl -s -X POST "$DASH_URL" -H "Content-Type: application/json" \
  -d "{\"type\":\"console\",\"entry\":\"← Runtime finished (${ELAPSED}s)\",\"style\":\"sys\",\"status\":\"IDLE\",\"ts\":\"$TS2\"}" > /dev/null

# Output the raw content for piping (full, with newlines preserved)
echo "$RESPONSE" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d['choices'][0]['message']['content'])
except:
    print('Error parsing response')
"
