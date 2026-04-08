#!/bin/bash
# health.sh — Boot health check for SYSTEM
# Run this first thing in every new session to verify everything is alive.
# Usage: bash execution/health.sh

PROJ="/Volumes/WORK 2TB/WORK 2026/SYSTEM"
PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "OK" ]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  elif [ "$result" = "WARN" ]; then
    echo "  ⚠️  $label"
    WARN=$((WARN + 1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SYSTEM Health Check — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. OpenClaw Gateway
echo "▸ OpenClaw Gateway"
HEALTH=$(curl -s --max-time 3 http://127.0.0.1:18789/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok":true'; then
  check "Gateway alive on :18789" "OK"
else
  check "Gateway alive on :18789 — NOT RESPONDING" "FAIL"
fi

# 2. Dashboard Server
echo "▸ Dashboard Server"
DASH=$(curl -s --max-time 3 http://localhost:3111/ 2>/dev/null | head -c 500)
if echo "$DASH" | grep -q "SYSTEM"; then
  check "Dashboard alive on :3111" "OK"
else
  check "Dashboard alive on :3111 — NOT RESPONDING" "FAIL"
fi

# 3. Cron Jobs
echo "▸ Cron Jobs"
CRON=$(crontab -l 2>/dev/null)
if echo "$CRON" | grep -q "check_mail"; then
  check "Mail cron (every 5 min)" "OK"
else
  check "Mail cron MISSING" "FAIL"
fi
if echo "$CRON" | grep -q "check_calendar"; then
  check "Calendar cron (every 15 min)" "OK"
else
  check "Calendar cron MISSING" "FAIL"
fi
if echo "$CRON" | grep -q "check_weather"; then
  check "Weather cron (every 30 min)" "OK"
else
  check "Weather cron MISSING" "FAIL"
fi

# 4. Data Freshness
echo "▸ Data Freshness"
if [ -f "$PROJ/dashboard/data/history.json" ]; then
  AGE=$(( $(date +%s) - $(stat -f%m "$PROJ/dashboard/data/history.json") ))
  if [ $AGE -lt 1800 ]; then
    check "Console history (${AGE}s old)" "OK"
  else
    check "Console history is ${AGE}s old — may be stale" "WARN"
  fi
else
  check "Console history MISSING" "FAIL"
fi

# 5. Execution Scripts
echo "▸ Execution Scripts"
for script in check_mail_himalaya.py check_calendar.sh check_weather.py check_contacts.sh agent_cmd.sh openclaw.sh health.sh; do
  if [ -f "$PROJ/execution/$script" ]; then
    check "$script" "OK"
  else
    check "$script MISSING" "FAIL"
  fi
done

# 6. Key Config Files
echo "▸ Config Files"
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
  check "OpenClaw config" "OK"
else
  check "OpenClaw config MISSING" "FAIL"
fi
if [ -f "$HOME/.config/himalaya/config.toml" ]; then
  check "Himalaya email config" "OK"
else
  check "Himalaya email config MISSING" "WARN"
fi

# 7. Contacts Bridge
echo "▸ Contacts Bridge"
if [ -L "$HOME/.local/bin/check_contacts" ]; then
  check "Contacts symlink at ~/.local/bin/check_contacts" "OK"
else
  check "Contacts symlink MISSING — OpenClaw can't access contacts" "WARN"
fi

# 8. Calendar.app
echo "▸ Calendar.app"
if pgrep -q "Calendar"; then
  check "Calendar.app running" "OK"
else
  check "Calendar.app not running (will auto-launch on next cron)" "WARN"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: ✅ $PASS passed  ⚠️  $WARN warnings  ❌ $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo "  STATUS: 🔴 NEEDS ATTENTION"
elif [ $WARN -gt 0 ]; then
  echo "  STATUS: 🟡 MOSTLY GOOD"
else
  echo "  STATUS: 🟢 ALL SYSTEMS GO"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
