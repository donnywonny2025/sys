#!/bin/bash
# Hermes Agent Bridge — execution/hermes.sh
# Direct terminal interface to Hermes. No browser, no UI.
# Results can be pushed to dashboard automatically.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASH="$SCRIPT_DIR/dash.sh"

case "$1" in

  ask)
    # Ask Hermes, return response only (no dashboard push)
    # Usage: ./hermes.sh ask "what time is it"
    hermes chat -q "$2" --quiet 2>&1 | grep -v "^  ┊\|^╭\|^╰\|^session_id:" | sed '/^$/d'
    ;;

  ask-push)
    # Ask Hermes and push response to dashboard
    # Usage: ./hermes.sh ask-push "summarize the news" [type]
    TYPE="${3:-info}"
    RESPONSE=$(hermes chat -q "$2" --quiet 2>&1 | grep -v "^  ┊\|^╭\|^╰\|^session_id:" | sed '/^$/d')
    if [ -n "$RESPONSE" ]; then
      "$DASH" push "$RESPONSE" "$TYPE"
    else
      "$DASH" push "Hermes returned no response." error
    fi
    ;;

  skill)
    # Ask Hermes with specific skill preloaded
    # Usage: ./hermes.sh skill "apple-calendar" "what's on my calendar today"
    hermes chat -q "$3" --quiet --skills "$2" 2>&1 | grep -v "^  ┊\|^╭\|^╰\|^session_id:" | sed '/^$/d'
    ;;

  status)
    hermes status 2>&1 | head -15
    ;;

  *)
    echo "hermes.sh {ask|ask-push|skill|status} [args]"
    echo ""
    echo "  ask      \"query\"              - Ask Hermes, return text"
    echo "  ask-push \"query\" [type]       - Ask + push to dashboard"
    echo "  skill    \"skill\" \"query\"      - Ask with specific skill"
    echo "  status                         - Check Hermes status"
    ;;
esac
