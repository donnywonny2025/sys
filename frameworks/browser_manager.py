import sys
import subprocess
import json

def run_applescript(script):
    try:
        result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error executing AppleScript: {e.stderr}", file=sys.stderr)
        return None

def list_tabs():
    script = """
    on run
        set outText to ""
        if application "Google Chrome" is running then
            tell application "Google Chrome"
                repeat with w in windows
                    repeat with t in tabs of w
                        set outText to outText & "{\"url\":\"" & (URL of t as string) & "\",\"title\":\"" & (title of t as string) & "\"}\\n"
                    end repeat
                end repeat
            end tell
        end if
        return outText
    end run
    """
    res = run_applescript(script)
    if res:
        # Convert newline separated pseudo-json to actual JSON array
        lines = [l for l in res.split('\\n') if l.strip()]
        try:
            return json.loads("[" + ",".join(lines) + "]")
        except json.JSONDecodeError:
            return []
    return []

def clean_tabs():
    script = """
    if application "Google Chrome" is running then
        tell application "Google Chrome"
            repeat with w in windows
                close (every tab of w whose URL is "about:blank" or URL is "chrome://newtab/")
            end repeat
        end tell
    end if
    """
    run_applescript(script)
    print("Cleaned all blank tabs.")

def close_tabs_by_url(url_fragment):
    script = f"""
    if application "Google Chrome" is running then
        tell application "Google Chrome"
            repeat with w in windows
                close (every tab of w whose URL contains "{url_fragment}")
            end repeat
        end tell
    end if
    """
    run_applescript(script)
    print(f"Closed tabs matching URL: {url_fragment}")

def open_or_focus(target_url):
    script = f"""
    if application "Google Chrome" is running then
        tell application "Google Chrome"
            set foundTab to false
            repeat with w in windows
                repeat with t in tabs of w
                    if URL of t is "{target_url}" then
                        set active tab index of w to (index of t)
                        set index of w to 1
                        set foundTab to true
                        exit repeat
                    end if
                end repeat
                if foundTab then exit repeat
            end repeat
            
            if not foundTab then
                if (count of windows) > 0 then
                    tell window 1 to make new tab with properties {{URL:"{target_url}"}}
                else
                    make new window
                    set URL of active tab of window 1 to "{target_url}"
                end if
            end if
            activate
        end tell
    else
        tell application "Google Chrome"
            activate
            open location "{target_url}"
        end tell
    end if
    """
    run_applescript(script)
    print(f"Ensured URL is open and focused: {target_url}")

def refresh_tab(url_fragment):
    script = f"""
    if application "Google Chrome" is running then
        tell application "Google Chrome"
            repeat with w in windows
                repeat with t in tabs of w
                    if URL of t contains "{url_fragment}" then
                        reload t
                    end if
                end repeat
            end repeat
        end tell
    end if
    """
    run_applescript(script)
    print(f"Refreshed tabs matching URL: {url_fragment}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python browser_manager.py [list|clean|close <url>|open <url>|refresh <url>]")
        sys.exit(1)

    command = sys.argv[1]
    
    if command == "list":
        tabs = list_tabs()
        print(json.dumps(tabs, indent=2))
    elif command == "clean":
        clean_tabs()
    elif command == "close" and len(sys.argv) == 3:
        close_tabs_by_url(sys.argv[2])
    elif command == "open" and len(sys.argv) == 3:
        open_or_focus(sys.argv[2])
    elif command == "refresh" and len(sys.argv) == 3:
        refresh_tab(sys.argv[2])
    else:
        print("Invalid command.")
