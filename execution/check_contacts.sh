#!/bin/bash
# Apple Contacts reader via AppleScript
# Usage:
#   ./check_contacts.sh                    → list all contacts (name, email, phone, org)
#   ./check_contacts.sh search "Dare"      → search by name
#   ./check_contacts.sh count              → total contact count

ACTION="${1:-list}"
QUERY="${2:-}"

if [ "$ACTION" = "count" ]; then
  osascript -e 'tell application "Contacts" to return count of every person'
  exit 0
fi

if [ "$ACTION" = "search" ] && [ -n "$QUERY" ]; then
  osascript -e "
    tell application \"Contacts\"
      set output to \"\"
      set matches to (every person whose name contains \"$QUERY\")
      repeat with p in matches
        set n to name of p
        set e to \"\"
        set ph to \"\"
        set org to \"\"
        try
          set e to value of first email of p
        end try
        try
          set ph to value of first phone of p
        end try
        try
          set org to organization of p
        end try
        set output to output & \"{\\\"name\\\":\\\"\" & n & \"\\\",\\\"email\\\":\\\"\" & e & \"\\\",\\\"phone\\\":\\\"\" & ph & \"\\\",\\\"org\\\":\\\"\" & org & \"\\\"}\" & linefeed
      end repeat
      return output
    end tell"
  exit 0
fi

# Default: list recent/all contacts (limited to 50)
osascript -e '
  tell application "Contacts"
    set output to ""
    set allPeople to every person
    set maxCount to 50
    if (count of allPeople) < maxCount then set maxCount to (count of allPeople)
    repeat with i from 1 to maxCount
      set p to item i of allPeople
      set n to name of p
      set e to ""
      set ph to ""
      set org to ""
      try
        set e to value of first email of p
      end try
      try
        set ph to value of first phone of p
      end try
      try
        set org to organization of p
      end try
      set output to output & "{\"name\":\"" & n & "\",\"email\":\"" & e & "\",\"phone\":\"" & ph & "\",\"org\":\"" & org & "\"}" & linefeed
    end repeat
    return output
  end tell'
