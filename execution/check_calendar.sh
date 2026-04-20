#!/bin/bash
# check_calendar.sh — Pull upcoming calendar events via AppleScript and push to dashboard
# Looks 30 days ahead, not just today
# Usage: ./execution/check_calendar.sh

DASH_URL="http://localhost:3111/api/push"

# Ensure Calendar.app is running (open it if not, wait for iCloud sync)
if ! pgrep -q "Calendar"; then
  open -a Calendar
  sleep 10
fi

# Get next 30 days of events from Apple Calendar via AppleScript
EVENTS=$(osascript -e '
set output to ""
tell application "Calendar"
  set today to current date
  set time of today to 0
  set futureDate to today + (30 * days)
  
  repeat with cal in calendars
    set calEvents to (every event of cal whose start date ≥ today and start date < futureDate)
    repeat with ev in calEvents
      set evName to summary of ev
      set evStart to start date of ev
      set h to hours of evStart
      set m to minutes of evStart
      set mo to (month of evStart as integer)
      set d to day of evStart
      set timeStr to (text -2 thru -1 of ("0" & h)) & ":" & (text -2 thru -1 of ("0" & m))
      set dateStr to (mo as text) & "/" & (d as text)
      set output to output & evName & "<<>>" & dateStr & " " & timeStr & "|||"
    end repeat
  end repeat
end tell
return output' 2>/dev/null)

# Build JSON from ||| delimited output using python for reliable parsing
# Converts 24h time to 12h AM/PM, marks 00:00 as "All Day"
JSON_EVENTS=$(python3 -c "
import json, sys
raw = '''$EVENTS'''
items = [x.strip() for x in raw.split('|||') if x.strip()]
events = []
for item in items:
    parts = item.split('<<>>')
    if len(parts) == 2:
        name = parts[0].strip()
        raw_time = parts[1].strip()
        # Parse date and time
        dt_parts = raw_time.split(' ')
        date_str = dt_parts[0] if dt_parts else ''
        time_str = dt_parts[1] if len(dt_parts) > 1 else '00:00'
        # Convert to 12h
        h, m = int(time_str.split(':')[0]), int(time_str.split(':')[1])
        if h == 0 and m == 0:
            display_time = date_str + ' · All Day'
        else:
            period = 'AM' if h < 12 else 'PM'
            h12 = h if 1 <= h <= 12 else (h - 12 if h > 12 else 12)
            display_time = date_str + ' · ' + str(h12) + (':' + str(m).zfill(2) if m else '') + ' ' + period
        events.append({'name': name, 'time': display_time})
print(json.dumps(events))
")

# Push to dashboard
curl -s -X POST "$DASH_URL" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"calendar\",\"events\":$JSON_EVENTS}" > /dev/null

echo "Calendar pushed to dashboard (30-day lookahead)"
