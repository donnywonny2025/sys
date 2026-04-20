#!/bin/bash
# Master V1 Look Function
# Captures the main monitor (LG TV / Right Screen) silently
# Now powered by Sovereign Vision Ledger (SQLite)

DIR="/Volumes/WORK 2TB/WORK 2026/SYSTEM/.tmp/screenshots"
mkdir -p "$DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RAW_FILENAME="$DIR/master_vision_$TIMESTAMP.jpg"

# Optional Context Parameter (e.g. ./look.sh "Checking UFO progress")
CONTEXT="$1"

# Take a silent (-x) screenshot of the main monitor (-m) in JPEG format
screencapture -x -m -t jpg "$RAW_FILENAME"

# Hook into the deterministic Python Database Ledger
python3 "execution/vision_ledger.py" "$RAW_FILENAME" "$CONTEXT"
