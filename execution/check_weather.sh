#!/bin/bash
# check_weather.sh — Get current weather and push to dashboard
# Uses wttr.in (no API key needed)
# Usage: ./execution/check_weather.sh [location]

LOCATION="${1:-New+York}"
DASH_URL="http://localhost:3111/api/push"

# Get compact weather from wttr.in
WEATHER=$(curl -s "wttr.in/${LOCATION}?format=%c+%t+%h+%w" 2>/dev/null | head -1)

if [ -z "$WEATHER" ]; then
  echo "ERROR: Could not fetch weather"
  exit 1
fi

# Get detailed info for top bar
SUMMARY=$(curl -s "wttr.in/${LOCATION}?format=%c+%t" 2>/dev/null | head -1)

# Push to dashboard
curl -s -X POST "$DASH_URL" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg s "$SUMMARY" --arg d "$WEATHER" '{type:"weather", data:{summary:$s, detail:$d}}')" > /dev/null

echo "Weather: $WEATHER"
