#!/usr/bin/env python3
"""Lightweight mail check — himalaya → dashboard push.
No LLM tokens. Just CLI + JSON + HTTP POST.
Runs every 5 min via OpenClaw cron.
"""
import json, subprocess, urllib.request

DASH_URL = "http://localhost:3111/api/push"
LIMIT = 15

try:
    # himalaya envelope list — fast, lightweight, no auth tokens
    result = subprocess.run(
        ["himalaya", "envelope", "list", "-s", str(LIMIT), "-o", "json"],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        print(f"himalaya error: {result.stderr[:200]}")
        exit(1)

    envelopes = json.loads(result.stdout)
    emails = []
    for env in envelopes:
        emails.append({
            "from": env.get("from", {}).get("name", "") or env.get("from", {}).get("addr", "Unknown"),
            "subject": env.get("subject", "(no subject)"),
            "date": env.get("date", ""),
            "snippet": ""  # snippets require per-message fetch, skip for lightweight mode
        })

    # Push to dashboard
    payload = json.dumps({"type": "email", "emails": emails}).encode()
    req = urllib.request.Request(DASH_URL, payload, {"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=5)
    print(f"OK: {len(emails)} emails pushed")

except Exception as e:
    print(f"Error: {e}")
    exit(1)
