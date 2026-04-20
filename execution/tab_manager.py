#!/usr/bin/env python3
"""Tab Manager — Enforces ONE TAB rule for the SYSTEM dashboard.
Keeps a single localhost:3111 tab, closes everything else.
Uses AppleScript for direct Chrome tab control (CDP port is 
bound to Ask Gemini sidebar, not main browser tabs).
"""
import subprocess
import sys

PROTECTED_URL = "localhost:3111"

def sweep():
    """Close all Chrome tabs except one dashboard tab."""
    script = f'''
    tell application "Google Chrome"
        set report to ""
        set kept to false
        repeat with w in windows
            set indicesToClose to {{}}
            repeat with i from 1 to count of tabs of w
                set u to URL of tab i of w
                if u contains "{PROTECTED_URL}" and kept is false then
                    set kept to true
                    set report to report & "✅ PROTECTED: " & u & linefeed
                else
                    set end of indicesToClose to i
                    set report to report & "🚫 CLOSING: " & u & linefeed
                end if
            end repeat
            repeat with j from (count of indicesToClose) to 1 by -1
                set idx to item j of indicesToClose
                if (count of tabs of w) > 1 then
                    close tab idx of w
                end if
            end repeat
        end repeat
        if kept is false then
            set report to report & "⚠️  No dashboard tab found. Opening one now..." & linefeed
            open location "http://{PROTECTED_URL}"
        end if
        return report
    end tell
    '''
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if result.returncode == 0:
        print(result.stdout.strip())
    else:
        print(f"Error: {result.stderr.strip()}")
    print("\nSweep Complete.")

if __name__ == "__main__":
    sweep()
