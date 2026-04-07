#!/bin/bash
# check_calendar.sh — Pull today's calendar events via AppleScript and push to dashboard
# Usage: ./execution/check_calendar.sh

DASH_URL="http://localhost:3111/api/push"

# Get today's events from Apple Calendar via AppleScript
EVENTS=$(osascript << 'EOF'
set today to current date
set time of today to 0
set tomorrow to today + (1 * days)
set output to ""

tell application "Calendar"
    repeat with cal in calendars
        set calEvents to (every event of cal whose start date ≥ today and start date < tomorrow)
        repeat with ev in calEvents
            set evName to summary of ev
            set evStart to start date of ev
            set evEnd to end date of ev
            set h to hours of evStart
            set m to minutes of evStart
            set timeStr to (text -2 thru -1 of ("0" & h)) & ":" & (text -2 thru -1 of ("0" & m))
            set output to output & evName & "<<>>" & timeStr & "|||"
        end repeat
    end repeat
end tell

return output
EOF
)

# Build JSON
JSON_EVENTS="["
FIRST=true

IFS='|||' read -ra ITEMS <<< "$EVENTS"
for entry in "${ITEMS[@]}"; do
  [ -z "$entry" ] && continue
  
  NAME=$(echo "$entry" | awk -F'<<>>' '{print $1}' | sed 's/"/\\"/g;s/^ *//;s/ *$//')
  TIME=$(echo "$entry" | awk -F'<<>>' '{print $2}' | sed 's/^ *//;s/ *$//')
  
  [ -z "$NAME" ] && continue
  
  if [ "$FIRST" = true ]; then FIRST=false; else JSON_EVENTS+=","; fi
  JSON_EVENTS+="{\"name\":\"$NAME\",\"time\":\"$TIME\"}"
done
JSON_EVENTS+="]"

# Push to dashboard
curl -s -X POST "$DASH_URL" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"calendar\",\"events\":$JSON_EVENTS}" > /dev/null

echo "Calendar pushed to dashboard"
