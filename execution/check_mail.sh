#!/bin/bash
# check_mail.sh — Pull emails via AppleScript and push to dashboard
# No external dependencies. Reads directly from Apple Mail.
# Usage: ./execution/check_mail.sh [count]

COUNT="${1:-15}"
DASH_URL="http://localhost:3111/api/push"

# Get emails directly from Mail.app via AppleScript
RAW=$(osascript <<EOF
set output to ""
tell application "Mail"
  set theMessages to messages 1 thru $COUNT of inbox
  repeat with msg in theMessages
    set subj to subject of msg
    set sndr to sender of msg
    set dt to date received of msg
    set rd to read status of msg
    set h to hours of dt
    set m to minutes of dt
    set mo to (month of dt as integer)
    set d to day of dt
    set timeStr to (text -2 thru -1 of ("0" & h)) & ":" & (text -2 thru -1 of ("0" & m))
    set dateStr to (mo as text) & "/" & (d as text) & " " & timeStr
    set rdStr to "false"
    if rd then set rdStr to "true"
    set output to output & subj & "<<>>" & sndr & "<<>>" & dateStr & "<<>>" & rdStr & "|||"
  end repeat
end tell
return output
EOF
)

if [ -z "$RAW" ]; then
  echo "No mail data returned"
  exit 0
fi

# Build JSON
JSON_EMAILS="["
FIRST=true

IFS='|||' read -ra ITEMS <<< "$RAW"
for entry in "${ITEMS[@]}"; do
  [ -z "$entry" ] && continue
  
  SUBJECT=$(echo "$entry" | awk -F'<<>>' '{print $1}' | sed 's/"/\\"/g;s/^ *//;s/ *$//')
  SENDER=$(echo "$entry" | awk -F'<<>>' '{print $2}' | sed 's/<[^>]*>//g;s/"/\\"/g;s/^ *//;s/ *$//')
  DATE=$(echo "$entry" | awk -F'<<>>' '{print $3}' | sed 's/^ *//;s/ *$//')
  READ=$(echo "$entry" | awk -F'<<>>' '{print $4}' | sed 's/^ *//;s/ *$//')
  
  [ -z "$SUBJECT" ] && continue
  
  UNREAD="true"
  [ "$READ" = "true" ] && UNREAD="false"
  
  if [ "$FIRST" = true ]; then FIRST=false; else JSON_EMAILS+=","; fi
  JSON_EMAILS+="{\"subject\":\"$SUBJECT\",\"sender\":\"$SENDER\",\"date\":\"$DATE\",\"unread\":$UNREAD}"
done
JSON_EMAILS+="]"

# Push to dashboard
curl -s -X POST "$DASH_URL" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"email\",\"emails\":$JSON_EMAILS}" > /dev/null

echo "Pushed $COUNT emails to dashboard"
