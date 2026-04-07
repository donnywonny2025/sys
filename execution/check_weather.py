#!/usr/bin/env python3
"""Check weather from Open-Meteo and push to dashboard. Zero tokens. ~200ms."""
import json, urllib.request

DASH = "http://localhost:3111/api/push"
LAT, LON = 42.9634, -85.6681

EMOJIS = {
    0: "☀️", 1: "⛅", 2: "⛅", 3: "⛅",
    45: "🌫️", 48: "🌫️",
    51: "🌧️", 53: "🌧️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
    71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "❄️",
    80: "⛈️", 81: "⛈️", 82: "⛈️", 85: "🌨️", 86: "🌨️",
    95: "🌩️", 96: "🌩️", 99: "🌩️"
}

try:
    url = f"https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&current_weather=true&temperature_unit=fahrenheit&timezone=America%2FDetroit"
    with urllib.request.urlopen(url, timeout=5) as r:
        data = json.loads(r.read())
    cw = data["current_weather"]
    emoji = EMOJIS.get(cw["weathercode"], "❓")
    summary = f"{emoji} {int(cw['temperature'])}°F"
    payload = json.dumps({"type": "weather", "data": {"summary": summary}}).encode()
    req = urllib.request.Request(DASH, data=payload, headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=3)
    print(f"OK: {summary}")
except Exception as e:
    print(f"ERR: {e}")
