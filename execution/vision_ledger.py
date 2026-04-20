import sqlite3
import sys
import os
from datetime import datetime

DB_PATH = os.path.join(os.getcwd(), "knowledgebase", "vision_archives.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            file_path TEXT NOT NULL,
            context TEXT
        )
    ''')
    conn.commit()
    return conn

def log_snapshot(file_path, context=""):
    conn = init_db()
    c = conn.cursor()
    timestamp = datetime.now().isoformat()
    
    c.execute('INSERT INTO snapshots (timestamp, file_path, context) VALUES (?, ?, ?)', 
              (timestamp, file_path, context))
    conn.commit()
    version_id = c.lastrowid
    conn.close()
    
    print(f"SCREENSHOT LOGGED: [V-{version_id}] -> {file_path}")
    if context:
        print(f"CONTEXT: {context}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 vision_ledger.py <file_path> [context]")
        sys.exit(1)
        
    path = sys.argv[1]
    ctx = sys.argv[2] if len(sys.argv) > 2 else ""
    log_snapshot(path, ctx)
