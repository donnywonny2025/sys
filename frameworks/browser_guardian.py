#!/usr/bin/env python3
"""
Browser Guardian v2 — Health check, auto-recovery, CDP fallback for Antigravity subagent.

Problem:  The built-in browser_subagent's Playwright browser crashes silently.
          Subsequent dispatches hang forever or throw "Agent terminated due to error."

Solution: A pre-flight + fallback system:
  1. PRE-FLIGHT: Check if browser is alive before dispatching
  2. CDP CHROME: Maintain our own Chrome with CDP as a reliable fallback
  3. WATCHDOG:   Monitor health and auto-recover
  4. SCREENSHOT: CDP-based screenshots when subagent is down

Usage:
    python3 browser_guardian.py check              # Full health report
    python3 browser_guardian.py ensure [url]        # Ensure Chrome is running
    python3 browser_guardian.py tabs                # List open tabs via CDP
    python3 browser_guardian.py open <url>          # Open URL in tab
    python3 browser_guardian.py screenshot [url]    # CDP screenshot of page
    python3 browser_guardian.py navigate <url>      # Navigate active tab
    python3 browser_guardian.py kill                # Kill managed browser
    python3 browser_guardian.py watchdog            # Run continuous health monitor

Architecture:
    ┌──────────────────┐
    │   Claude Opus     │ ← runs `check` before every dispatch
    │   (dispatcher)    │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │ browser_guardian   │ ← THIS SCRIPT
    │  - health check   │
    │  - auto-start     │
    │  - CDP screenshot │
    │  - tab management │
    └────────┬─────────┘
             │
    ┌────────▼─────────┐     ┌─────────────────┐
    │  Chrome (CDP)     │     │ browser_subagent │
    │  :9222 (ours)     │     │ (Antigravity)    │
    │  ALWAYS available │     │ may be dead/alive│
    └──────────────────┘     └─────────────────┘
"""

import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
import base64

# ── Config ──────────────────────────────────────────────────────────
CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PID_FILE = os.path.join(SCRIPT_DIR, ".browser_guardian.pid")
STATUS_FILE = os.path.join(SCRIPT_DIR, ".browser_status.json")
SCREENSHOT_DIR = os.path.join(SCRIPT_DIR, ".screenshots")
HEALTH_LOG = os.path.join(SCRIPT_DIR, ".browser_health.log")

# Chrome paths (macOS)
CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
]

CHROME_ARGS = [
    f"--remote-debugging-port={CDP_PORT}",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-popup-blocking",
    "--disable-translate",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-device-discovery-notifications",
    "--user-data-dir=/tmp/browser-guardian-profile",
    "--remote-allow-origins=*",
]


# ── Logging ────────────────────────────────────────────────────────
def log(msg):
    """Append to health log with timestamp."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line, file=sys.stderr)
    try:
        with open(HEALTH_LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ── CDP Communication ──────────────────────────────────────────────
def cdp_get(path, timeout=3):
    """GET a CDP endpoint. Returns parsed JSON or None."""
    try:
        req = urllib.request.Request(f"{CDP_URL}{path}", method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


def cdp_put(path, timeout=5):
    """PUT to a CDP endpoint. Returns parsed JSON or None."""
    try:
        req = urllib.request.Request(f"{CDP_URL}{path}", method="PUT")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


def cdp_check():
    """Check if CDP is responding. Returns (alive, version_data)."""
    data = cdp_get("/json/version")
    return (True, data) if data else (False, {})


def cdp_list_tabs():
    """Get all open page tabs via CDP."""
    tabs = cdp_get("/json") or []
    return [t for t in tabs if t.get("type") == "page"]


def cdp_open_tab(url):
    """Open a new tab via CDP."""
    encoded = urllib.parse.quote(url, safe="")
    return cdp_put(f"/json/new?{encoded}")


def cdp_activate_tab(tab_id):
    """Activate (focus) a tab by ID."""
    return cdp_get(f"/json/activate/{tab_id}")


def cdp_close_tab(tab_id):
    """Close a tab by ID."""
    return cdp_get(f"/json/close/{tab_id}")


def cdp_navigate(tab_ws_url, url):
    """Navigate a tab to a URL using WebSocket CDP protocol."""
    try:
        import websocket
        ws = websocket.create_connection(tab_ws_url, timeout=5)
        ws.send(json.dumps({
            "id": 1,
            "method": "Page.navigate",
            "params": {"url": url}
        }))
        result = json.loads(ws.recv())
        ws.close()
        return result
    except ImportError:
        # Fallback: close and reopen
        log("websocket module not available, using close+reopen for navigation")
        return None
    except Exception as e:
        log(f"CDP navigate error: {e}")
        return None


def cdp_screenshot(tab_ws_url, output_path):
    """Take a screenshot of a tab via CDP WebSocket protocol."""
    try:
        import websocket
        ws = websocket.create_connection(tab_ws_url, timeout=10)

        # Take screenshot
        ws.send(json.dumps({
            "id": 1,
            "method": "Page.captureScreenshot",
            "params": {"format": "png"}
        }))
        result = json.loads(ws.recv())
        ws.close()

        if "result" in result and "data" in result["result"]:
            img_data = base64.b64decode(result["result"]["data"])
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(img_data)
            return output_path
        return None
    except ImportError:
        log("websocket module not available. Install with: pip install websocket-client")
        # Fallback to screencapture
        return screencapture_fallback(output_path)
    except Exception as e:
        log(f"CDP screenshot error: {e}")
        return screencapture_fallback(output_path)


def screencapture_fallback(output_path):
    """macOS screencapture as last resort."""
    try:
        subprocess.run(["screencapture", "-x", output_path], capture_output=True, timeout=5)
        if os.path.exists(output_path):
            return output_path
    except Exception:
        pass
    return None


# ── Chrome Process Management ──────────────────────────────────────
def find_chrome():
    """Find the first available Chrome binary."""
    for path in CHROME_PATHS:
        if os.path.exists(path):
            return path
    return None


def read_pid():
    """Read stored PID, return None if stale or missing."""
    if not os.path.exists(PID_FILE):
        return None
    try:
        with open(PID_FILE) as f:
            pid = int(f.read().strip())
        os.kill(pid, 0)
        return pid
    except (OSError, ValueError):
        try:
            os.remove(PID_FILE)
        except OSError:
            pass
        return None


def write_pid(pid):
    os.makedirs(os.path.dirname(PID_FILE) or ".", exist_ok=True)
    with open(PID_FILE, "w") as f:
        f.write(str(pid))


def launch_chrome(url=None):
    """Launch Chrome with CDP enabled. Returns PID or None."""
    chrome_path = find_chrome()
    if not chrome_path:
        log("ERROR: No Chrome installation found")
        return None

    cmd = [chrome_path] + CHROME_ARGS
    if url:
        cmd.append(url)

    log(f"Launching Chrome: {chrome_path}")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    write_pid(proc.pid)

    # Wait for CDP to come up
    for attempt in range(20):
        time.sleep(0.5)
        alive, _ = cdp_check()
        if alive:
            log(f"Chrome ready (PID {proc.pid}, attempt {attempt + 1})")
            return proc.pid

    log(f"Chrome launched (PID {proc.pid}) but CDP not responding after 10s")
    return proc.pid


def kill_chrome():
    """Kill managed Chrome and any process on CDP port."""
    pid = read_pid()
    if pid:
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.5)
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
        except OSError:
            pass

    try:
        os.remove(PID_FILE)
    except OSError:
        pass

    # Kill anything on our CDP port
    try:
        result = subprocess.run(["lsof", "-ti", f":{CDP_PORT}"],
                                capture_output=True, text=True)
        for pid_str in result.stdout.strip().split("\n"):
            if pid_str.strip():
                try:
                    os.kill(int(pid_str), signal.SIGTERM)
                except (OSError, ValueError):
                    pass
    except Exception:
        pass


# ── Status Management ──────────────────────────────────────────────
def build_status():
    """Build comprehensive health status."""
    alive, version = cdp_check()
    tabs = cdp_list_tabs() if alive else []
    pid = read_pid()

    status = {
        "ok": True,
        "cdp_alive": alive,
        "cdp_port": CDP_PORT,
        "chrome_pid": pid,
        "browser_version": version.get("Browser", "unknown") if alive else "not running",
        "tabs_count": len(tabs),
        "tabs": [
            {"id": t.get("id", ""), "title": t.get("title", ""), "url": t.get("url", "")}
            for t in tabs
        ],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        # Subagent status is inferred from the Antigravity metadata
        # We can't directly check it, but we track when it last worked
        "recommendation": "use_subagent" if alive else "start_chrome_first",
    }

    write_status(status)
    return status


def write_status(status):
    os.makedirs(os.path.dirname(STATUS_FILE) or ".", exist_ok=True)
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2)


# ── Commands ───────────────────────────────────────────────────────
def cmd_check():
    """Full health check with recommendations."""
    status = build_status()

    # Add recommendation based on state
    if not status["cdp_alive"]:
        status["recommendation"] = "run: python3 browser_guardian.py ensure"
        status["subagent_likely_dead"] = True
    elif status["tabs_count"] == 0:
        status["recommendation"] = "chrome alive but no tabs. Open a URL."
    else:
        status["recommendation"] = "healthy. Dispatch subagent with tab context."
        # Generate brief context for subagent dispatch
        status["subagent_context"] = _build_subagent_context(status["tabs"])

    print(json.dumps(status, indent=2))
    return status


def cmd_ensure(url=None):
    """Ensure Chrome is running. Start if dead."""
    alive, _ = cdp_check()

    if alive:
        status = build_status()
        status["action"] = "already_running"

        # If URL provided and not already open, open it
        if url:
            existing = [t for t in status["tabs"] if url in t.get("url", "")]
            if not existing:
                cdp_open_tab(url)
                time.sleep(1)
                status = build_status()
                status["action"] = "opened_url"

        print(json.dumps(status, indent=2))
        return status

    log("Chrome not detected. Launching...")
    pid = launch_chrome(url or "about:blank")

    if pid:
        time.sleep(1)
        status = build_status()
        status["action"] = "started"
        status["new_pid"] = pid
        print(json.dumps(status, indent=2))
        return status
    else:
        error = {"ok": False, "action": "start_failed"}
        print(json.dumps(error, indent=2))
        return error


def cmd_tabs():
    """List open tabs with context info."""
    tabs = cdp_list_tabs()
    result = {
        "ok": True,
        "tabs_count": len(tabs),
        "tabs": [
            {
                "id": t.get("id", ""),
                "title": t.get("title", ""),
                "url": t.get("url", ""),
                "ws_url": t.get("webSocketDebuggerUrl", ""),
            }
            for t in tabs
        ],
    }
    print(json.dumps(result, indent=2))
    return result


def cmd_open(url):
    """Open URL — reuse existing tab if URL matches, else new tab."""
    alive, _ = cdp_check()
    if not alive:
        cmd_ensure(url)
        return

    # Check if already open
    tabs = cdp_list_tabs()
    for tab in tabs:
        if url in tab.get("url", ""):
            cdp_activate_tab(tab["id"])
            print(json.dumps({"ok": True, "action": "focused_existing", "url": url, "tab_id": tab["id"]}))
            return

    # Open new
    result = cdp_open_tab(url)
    print(json.dumps({"ok": True, "action": "opened_new", "url": url, "result": result}))


def cmd_navigate(url):
    """Navigate the active tab to a new URL."""
    tabs = cdp_list_tabs()
    if not tabs:
        cmd_ensure(url)
        return

    # Navigate first tab
    tab = tabs[0]
    ws_url = tab.get("webSocketDebuggerUrl", "")
    if ws_url:
        result = cdp_navigate(ws_url, url)
        if result:
            print(json.dumps({"ok": True, "action": "navigated", "url": url}))
            return

    # Fallback: close and reopen
    cdp_close_tab(tab["id"])
    time.sleep(0.3)
    cdp_open_tab(url)
    print(json.dumps({"ok": True, "action": "navigated_via_reopen", "url": url}))


def cmd_screenshot(url=None):
    """Take a CDP screenshot of the active page (or a specific URL)."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(SCREENSHOT_DIR, f"screenshot_{timestamp}.png")

    tabs = cdp_list_tabs()
    if not tabs:
        if url:
            cmd_ensure(url)
            time.sleep(2)
            tabs = cdp_list_tabs()
        if not tabs:
            print(json.dumps({"ok": False, "error": "No tabs available"}))
            return

    # Find the right tab
    target_tab = tabs[0]  # default to first
    if url:
        for tab in tabs:
            if url in tab.get("url", ""):
                target_tab = tab
                break

    ws_url = target_tab.get("webSocketDebuggerUrl", "")
    if not ws_url:
        # Fallback to screencapture
        path = screencapture_fallback(output_path)
        print(json.dumps({"ok": path is not None, "path": path, "method": "screencapture"}))
        return

    path = cdp_screenshot(ws_url, output_path)
    print(json.dumps({
        "ok": path is not None,
        "path": path,
        "method": "cdp",
        "tab_url": target_tab.get("url", ""),
        "tab_title": target_tab.get("title", ""),
    }))


def cmd_kill():
    """Kill managed Chrome."""
    kill_chrome()
    log("Chrome killed")
    print(json.dumps({"ok": True, "action": "killed"}))


def cmd_watchdog():
    """Run continuous health monitor. Restarts Chrome if it dies."""
    log("Watchdog started")
    check_interval = 10  # seconds
    consecutive_failures = 0
    max_failures_before_restart = 3

    while True:
        try:
            alive, _ = cdp_check()

            if alive:
                if consecutive_failures > 0:
                    log(f"Chrome recovered after {consecutive_failures} failures")
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                log(f"Chrome not responding ({consecutive_failures}/{max_failures_before_restart})")

                if consecutive_failures >= max_failures_before_restart:
                    log("Max failures reached. Restarting Chrome...")
                    kill_chrome()
                    time.sleep(1)
                    launch_chrome("about:blank")
                    consecutive_failures = 0

            # Update status file
            build_status()

            time.sleep(check_interval)

        except KeyboardInterrupt:
            log("Watchdog stopped")
            break
        except Exception as e:
            log(f"Watchdog error: {e}")
            time.sleep(check_interval)


# ── Subagent Context Builder ───────────────────────────────────────
def _build_subagent_context(tabs):
    """Build a context string that should be prepended to subagent dispatch instructions."""
    if not tabs:
        return "No browser tabs are open. You will need to navigate to a URL."

    lines = ["Current browser state:"]
    for i, tab in enumerate(tabs):
        active = " [ACTIVE]" if i == 0 else ""
        lines.append(f"  Tab {i + 1}: \"{tab.get('title', 'untitled')}\" at {tab.get('url', 'unknown')}{active}")

    lines.append("")
    lines.append("RULES: Do NOT open new tabs. Use existing tabs. If your target URL is already open, do NOT navigate.")
    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────
USAGE = """Browser Guardian v2 — Pre-flight + fallback for Antigravity subagent

Commands:
  check              Full health report with recommendations
  ensure [url]       Ensure Chrome is running (start if dead)
  tabs               List open tabs via CDP
  open <url>         Open/focus URL in tab
  navigate <url>     Navigate active tab to URL
  screenshot [url]   CDP screenshot (falls back to screencapture)
  kill               Kill managed Chrome
  watchdog           Run continuous health monitor (auto-restart)
"""

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(USAGE)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "check":
        cmd_check()
    elif command == "ensure":
        cmd_ensure(sys.argv[2] if len(sys.argv) > 2 else None)
    elif command == "tabs":
        cmd_tabs()
    elif command == "open" and len(sys.argv) > 2:
        cmd_open(sys.argv[2])
    elif command == "navigate" and len(sys.argv) > 2:
        cmd_navigate(sys.argv[2])
    elif command == "screenshot":
        cmd_screenshot(sys.argv[2] if len(sys.argv) > 2 else None)
    elif command == "kill":
        cmd_kill()
    elif command == "watchdog":
        cmd_watchdog()
    else:
        print(USAGE)
        sys.exit(1)
