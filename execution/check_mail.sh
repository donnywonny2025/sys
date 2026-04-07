#!/bin/bash
# check_mail.sh — Pull emails via AppleScript and push to dashboard
# Uses Python for reliable JSON building (same pattern as check_calendar.sh)
# Usage: ./execution/check_mail.sh [count]

COUNT="${1:-15}"
DASH_URL="http://localhost:3111/api/push"

# Get emails directly from Mail.app via AppleScript (with snippet from body)
RAW=$(osascript -e "
set output to \"\"
tell application \"Mail\"
  set theMessages to messages 1 thru $COUNT of inbox
  repeat with msg in theMessages
    set subj to subject of msg
    set sndr to sender of msg
    set dt to date received of msg
    set isRead to (read status of msg)
    try
      set bodyText to content of msg
      -- Get first 2000 chars for preview pane
      if length of bodyText > 2000 then
        set bodyText to text 1 thru 2000 of bodyText
      end if
    on error
      set bodyText to \"\"
    end try
    set h to hours of dt
    set m to minutes of dt
    set mo to (month of dt as integer)
    set d to day of dt
    set timeStr to (text -2 thru -1 of (\"0\" & h)) & \":\" & (text -2 thru -1 of (\"0\" & m))
    set dateStr to (mo as text) & \"/\" & (d as text) & \" \" & timeStr
    if isRead then
      set rdStr to \"true\"
    else
      set rdStr to \"false\"
    end if
    set output to output & subj & \"<<>>\" & sndr & \"<<>>\" & dateStr & \"<<>>\" & rdStr & \"<<>>\" & bodyText & \"|||\"
  end repeat
end tell
return output
" 2>&1)

if [ -z "$RAW" ] || echo "$RAW" | grep -q "error"; then
  echo "No mail data returned: $RAW"
  exit 0
fi

# Build JSON with Python (reliable, handles escaping properly)
JSON=$(python3 -c "
import json, sys

raw = sys.stdin.read().strip()
emails = []
for entry in raw.split('|||'):
    entry = entry.strip()
    if not entry:
        continue
    parts = entry.split('<<>>')
    if len(parts) < 4:
        continue
    subject = parts[0].strip()
    sender = parts[1].strip()
    # Remove email angle brackets from sender display
    import re
    sender = re.sub(r'<[^>]*>', '', sender).strip()
    date_str = parts[2].strip()
    is_read = parts[3].strip().lower() == 'true'
    snippet = parts[4].strip() if len(parts) > 4 else ''
    # Clean body text: collapse whitespace, remove weird chars
    body = re.sub(r'[\r\n\t]+', ' ', snippet)
    body = re.sub(r'  +', ' ', body).strip()
    # Short snippet for list view (100 chars)
    list_snippet = body[:100] + '...' if len(body) > 100 else body
    if not subject:
        continue
    emails.append({
        'subject': subject,
        'sender': sender,
        'date': date_str,
        'unread': not is_read,
        'snippet': list_snippet,
        'body': body
    })

print(json.dumps({'type': 'email', 'emails': emails}))
" <<< "$RAW")

# Push to dashboard
curl -s -X POST "$DASH_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON" > /dev/null

echo "Pushed mail to dashboard"
