#!/bin/bash
# check_mail.sh — Pull emails and push structured data to dashboard
# Usage: ./execution/check_mail.sh [count] [account] [mailbox]

COUNT="${1:-20}"
ACCOUNT="${2:-iCloud}"
MAILBOX="${3:-INBOX}"
DASH_URL="http://localhost:3111/api/push"
SKILL_PATH="$HOME/.hermes/skills/apple-mail/scripts/get-emails.sh"

RAW=$(bash "$SKILL_PATH" "$ACCOUNT" "$MAILBOX" "$COUNT" false false 2>/dev/null)

if [ -z "$RAW" ]; then
  echo "ERROR: No emails returned"
  exit 1
fi

# Build JSON array of emails
JSON_EMAILS="["
FIRST=true

# Split by ||| delimiter
while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  
  # Split fields by <<>>  
  ID=$(echo "$entry" | awk -F'<<>>' '{print $1}')
  SUBJECT=$(echo "$entry" | awk -F'<<>>' '{print $2}')
  SENDER=$(echo "$entry" | awk -F'<<>>' '{print $3}' | sed 's/<[^>]*>//g;s/^ *//;s/ *$//')
  DATE=$(echo "$entry" | awk -F'<<>>' '{print $7}' | sed 's/^ *//;s/ *$//')
  READ=$(echo "$entry" | awk -F'<<>>' '{print $8}')
  
  [ -z "$SUBJECT" ] && continue
  
  UNREAD="true"
  [ "$READ" = "true" ] && UNREAD="false"
  
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    JSON_EMAILS+=","
  fi
  
  # Escape quotes in subject and sender
  SUBJECT_ESC=$(echo "$SUBJECT" | sed 's/"/\\"/g')
  SENDER_ESC=$(echo "$SENDER" | sed 's/"/\\"/g')
  DATE_ESC=$(echo "$DATE" | sed 's/"/\\"/g')
  
  JSON_EMAILS+="{\"subject\":\"$SUBJECT_ESC\",\"sender\":\"$SENDER_ESC\",\"date\":\"$DATE_ESC\",\"unread\":$UNREAD}"
  
done < <(echo "$RAW" | tr '|||' '\n' | sed '/^$/d')

JSON_EMAILS+="]"

# Push structured email data to dashboard
curl -s -X POST "$DASH_URL" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"email\",\"emails\":$JSON_EMAILS}" > /dev/null

echo "Pushed $COUNT emails to dashboard"
