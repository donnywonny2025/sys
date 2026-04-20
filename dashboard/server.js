// SYSTEM Dashboard Server
// Serves the dashboard page and handles real-time updates via WebSocket.
// Antigravity and Hermes push content here via HTTP POST → WebSocket → browser.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { execFile, spawn } = require('child_process');
const os = require('os');

const SERVER_START = Date.now();
const PORT = 3111;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// MIME types for static files
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// Connected WebSocket clients
const clients = new Set();
// Persistent UI State Cache
let activeState = null;
// Cache latest feed data — persisted to disk so restarts don't lose feeds
const FEED_CACHE_FILE = path.join(DATA_DIR, 'feed-cache.json');
let feedCache = {};
try {
  if (fs.existsSync(FEED_CACHE_FILE)) feedCache = JSON.parse(fs.readFileSync(FEED_CACHE_FILE, 'utf8'));
} catch (e) { feedCache = {}; }
function saveFeedCache() {
  try { fs.writeFileSync(FEED_CACHE_FILE, JSON.stringify(feedCache), 'utf8'); } catch (e) {}
}

// Broadcast to all connected browsers
function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function pushToConsole(entry, style = 'sys') {
  broadcast({
    type: 'console',
    entry,
    style,
    ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  });
}

// Server-side dedup for console chat entries
const _consoleDedupMap = {};
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const k in _consoleDedupMap) { if (_consoleDedupMap[k] < cutoff) delete _consoleDedupMap[k]; }
}, 30000);

// Parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
  });
}

// HTTP server — serves static files + API endpoints
const server = http.createServer(async (req, res) => {


  // ── API: TV Control (System can POST here) ──
  if (req.method === 'POST' && req.url === '/api/tv') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        // Broadcast TV command to all connected clients
        data.type = 'tv';
        broadcast(JSON.stringify(data));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  // ── API: Cron Heartbeat ──
  if (req.method === 'GET' && req.url === '/api/cron-heartbeat') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, cpu: '0%', mem: '0%', cron: [] }));
    return;
  }


  // ── API: Switch scene (Antigravity backend control) ──
  if (req.method === 'POST' && req.url === '/api/scene') {
    try {
      const data = await parseBody(req);
      const scene = data.scene; // e.g. "home", "chat", "contacts", "studio", "mail", "calendar", "board"
      if (!scene) { res.writeHead(400); res.end(JSON.stringify({error:'missing scene'})); return; }
      broadcast({ type: 'scene', scene });
      pushToConsole(`🎯 Scene switched to: ${scene}`, 'sys');
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, scene }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── API: Force browser refresh ──
  if (req.method === 'POST' && req.url === '/api/refresh') {
    broadcast(JSON.stringify({ type: 'refresh' }));
    pushToConsole('🔄 Dashboard refresh triggered', 'sys');
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ── API: Push content to dashboard ──
  if (req.method === 'POST' && req.url === '/api/push') {
    try {
      const data = await parseBody(req);
      
      // Cache the UI state so that hard refreshes don't drop the active payload
      if (data.type === 'studio' || data.type === 'reference' || data.type === 'close_reference' || data.type === 'clear') {
        if (!activeState) activeState = { type: 'home' };
        if (data.type === 'studio' || data.type === 'clear') {
          activeState = data; // replace base state
          if (!activeState.references) activeState.references = [];
        } else if (data.type === 'reference') {
          if (!activeState.references) activeState.references = [];
          activeState.references.push({ src: data.src, title: data.title || null });
          activeState.referenceActive = true;
          activeState.referenceSrc = data.src; // legacy compat
        } else if (data.type === 'close_reference') {
          activeState.references = [];
          activeState.referenceActive = false;
        }
      }

      // Cache feed data (email, calendar, weather) so refreshes don't lose them
      if (['email', 'calendar', 'weather'].includes(data.type)) {
        data._cachedAt = Date.now();
        feedCache[data.type] = data;
        saveFeedCache();
        // Log feed arrival to console
        const icons = { email: '📬', calendar: '📅', weather: '🌤' };
        const labels = { email: 'Inbox', calendar: 'Schedule', weather: 'Weather' };
        const count = data.type === 'email' ? ` (${(data.emails || []).length} items)` :
                      data.type === 'calendar' ? ` (${(data.events || []).length} events)` : '';
        pushToConsole(`${icons[data.type]} ${labels[data.type]} refreshed${count}`, 'sys');
      }

      // Log any other push types to console
      if (data.type === 'studio') {
        pushToConsole(`🎨 Image Studio: new image loaded`, 'sys');
      } else if (data.type === 'scene') {
        pushToConsole(`📺 Scene: ${data.scene}`, 'sys');
      }

      // ── Server-side dedup for console chat entries ──
      if (data.type === 'console' && data.entry && (data.entry.startsWith('→') || data.entry.startsWith('←'))) {
        const dedupKey = data.entry.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[^\w\s.,!?'-]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().substring(0, 120);
        const now = Date.now();
        if (_consoleDedupMap[dedupKey] && (now - _consoleDedupMap[dedupKey]) < 30000) {
          return res.writeHead(200, { 'Content-Type': 'application/json' }), res.end('{"ok":true,"deduped":true}');
        }
        _consoleDedupMap[dedupKey] = now;
      }

      broadcast(data);
      // Log to data/history.json
      const historyPath = path.join(DATA_DIR, 'history.json');
      let history = [];
      if (fs.existsSync(historyPath)) {
        try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch {}
      }
      history.push({ ...data, timestamp: new Date().toISOString() });
      // Keep last 100 entries
      if (history.length > 100) history = history.slice(-100);
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── API: Get history ──
  if (req.method === 'GET' && req.url === '/api/history') {
    const historyPath = path.join(DATA_DIR, 'history.json');
    if (fs.existsSync(historyPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(historyPath, 'utf8'));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // ── API: Board State ──
  if (req.url === '/api/board') {
    const boardFile = path.join(DATA_DIR, 'board.json');
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (fs.existsSync(boardFile)) {
        res.end(fs.readFileSync(boardFile, 'utf8'));
      } else {
        res.end('{}');
      }
      return;
    }
    if (req.method === 'POST') {
      try {
        const data = await parseBody(req);
        fs.writeFileSync(boardFile, JSON.stringify(data, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // ── API: Get active state ──
  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(activeState || { type: 'home' }));
    return;
  }

  // ── API: Telemetry — free OS-level stats ──
  if (req.method === 'GET' && req.url === '/api/telemetry') {
    const cpus = os.cpus();
    const cpuPct = cpus.map(c => {
      const total = Object.values(c.times).reduce((a, b) => a + b, 0);
      return Math.round(100 - (c.times.idle / total * 100));
    });
    const avgCpu = Math.round(cpuPct.reduce((a, b) => a + b, 0) / cpuPct.length);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPct = Math.round((1 - freeMem / totalMem) * 100);
    const uptimeMs = Date.now() - SERVER_START;

    // Session info
    const sessDir = path.join(os.homedir(), '.system/agents/main/sessions');
    let sessionId = '—', sessionSize = 0, turns = 0;
    try {
      const files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
      if (files.length) {
        const sorted = files.map(f => ({ f, t: fs.statSync(path.join(sessDir, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t);
        sessionId = sorted[0].f.replace('.jsonl', '').slice(0, 8);
        const full = path.join(sessDir, sorted[0].f);
        sessionSize = fs.statSync(full).size;
        const content = fs.readFileSync(full, 'utf8');
        turns = (content.match(/"role":"user"/g) || []).length;
      }
    } catch (e) {}

    // History count
    let historyCount = 0;
    try {
      const h = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'history.json'), 'utf8'));
      historyCount = h.length;
    } catch (e) {}

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      cpu: avgCpu, cpuCores: cpuPct,
      mem: memPct, uptime: uptimeMs,
      session: sessionId, sessionSize, turns,
      historyCount, clients: clients.size
    }));
    return;
  }


  // ── API: Save Whiteboard Image ──
  if (req.method === 'POST' && req.url === '/api/whiteboard/save') {
    try {
      const data = await parseBody(req);
      if (data.image) {
        // Strip the data:image/png;base64, prefix
        const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(path.join(DATA_DIR, 'whiteboard.png'), base64Data, 'base64');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'Saved successfully' }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No image data provided' }));
      }
    } catch (e) {
      console.error("Whiteboard save error:", e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── API: Export Image to OS Folder ──
  if (req.method === 'POST' && req.url === '/api/studio/export') {
    try {
      const data = await parseBody(req);
      if (data.source && data.destDir) {
        // Source is assumed to be something like 'gallery/black_cat.webp'
        const sourcePath = path.join(DATA_DIR, data.source);
        if (!fs.existsSync(sourcePath)) {
          throw new Error("Source image not found in dashboard data.");
        }
        
        // Ensure dest dir exists
        if (!fs.existsSync(data.destDir)) {
          fs.mkdirSync(data.destDir, { recursive: true });
        }
        
        const fileName = path.basename(sourcePath);
        const destPath = path.join(data.destDir, fileName);
        
        fs.copyFileSync(sourcePath, destPath);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: `Saved to ${destPath}` }));
      } else {
        throw new Error("Missing source or destDir");
      }
    } catch (e) {
      console.error("Export error:", e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── API: Local Upscale ──
  if (req.method === 'POST' && req.url === '/api/studio/upscale') {
    try {
      const data = await parseBody(req);
      if (data.source) {
        const sourcePath = path.join(DATA_DIR, data.source.replace('/data/', ''));
        if (!fs.existsSync(sourcePath)) {
          throw new Error("Source image not found: " + sourcePath);
        }

        const scriptPath = path.join(path.dirname(__dirname), 'execution', 'upscale_local.sh');
        
        // Execute the upscaler
        execFile(scriptPath, [sourcePath], (error, stdout, stderr) => {
          if (error) {
            console.error("Upscale shell error:", error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: error.message }));
          }

          const outStr = stdout.trim();
          if (outStr.startsWith("SUCCESS|")) {
            const parts = outStr.split("|");
            // e.g. SUCCESS|/Volumes/.../gallery/firecat_nano_upscaled.png|3168x1344
            const newAbsolute = parts[1];
            const newSize = parts[2];
            const newFileName = path.basename(newAbsolute);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              ok: true, 
              newSrc: "/data/gallery/" + newFileName, 
              newSize: newSize 
            }));
          } else {
            console.error("Upscale failed:", outStr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Failed to upscale image internally" }));
          }
        });
      } else {
        throw new Error("Missing source file");
      }
    } catch (e) {
      console.error("Upscale error:", e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── API: Choose Directory Native Dialog ──
  if (req.method === 'GET' && req.url === '/api/studio/choose-dir') {
    const { exec } = require('child_process');
    exec('osascript -e \'POSIX path of (choose folder with prompt "Select Export Directory:")\'', (err, stdout) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ canceled: true }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: stdout.trim() }));
    });
    return;
  }

  // ── API: Serve images from data directory ──
  if (req.method === 'GET' && req.url.startsWith('/data/')) {
    const filePath = path.join(DATA_DIR, req.url.replace('/data/', ''));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // ── Static files ──
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(PUBLIC_DIR, filePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server — noServer mode for manual upgrade routing
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} total)`);

  // Send welcome
  ws.send(JSON.stringify({
    type: 'system',
    content: 'Connected to SYSTEM',
    timestamp: new Date().toISOString()
  }));

  // Replay cached feed data so refreshes don't lose email/calendar/weather
  for (const feedType of ['email', 'calendar', 'weather']) {
    if (feedCache[feedType]) {
      ws.send(JSON.stringify(feedCache[feedType]));
    }
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (${clients.size} total)`);
  });
});

// ── Manual upgrade routing ──
server.on('upgrade', (req, socket, head) => {

  // Dashboard WebSocket → handle with our WSS
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// ══════════════════════════════════════════════════════════════
// ██  HEARTBEAT ENGINE — Deterministic data refresh loop
// ══════════════════════════════════════════════════════════════
// Zero AI tokens. Pure timers + child_process.spawn.
// Email: 1 min  |  Calendar: 10 min  |  Weather: 30 min
// On boot: all three fire immediately so the dashboard is never empty.

const EXEC_DIR = path.join(__dirname, '..', 'execution');

const HEARTBEAT_JOBS = [
  { name: 'Mail',     cmd: 'python3', args: [path.join(EXEC_DIR, 'check_mail_himalaya.py')], intervalMs: 1  * 60 * 1000 },
  { name: 'Calendar', cmd: 'bash',    args: [path.join(EXEC_DIR, 'check_calendar.sh')],      intervalMs: 10 * 60 * 1000 },
  { name: 'Weather',  cmd: 'python3', args: [path.join(EXEC_DIR, 'check_weather.py')],       intervalMs: 30 * 60 * 1000 },
];

function runHeartbeatJob(job) {
  const startTime = Date.now();
  const child = spawn(job.cmd, job.args, {
    cwd: path.join(__dirname, '..'),
    timeout: 30000,
    env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` }
  });

  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });

  child.on('close', (code) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (code === 0) {
      const msg = stdout.trim().split('\n').pop() || 'OK';
      pushToConsole(`💓 ${job.name}: ${msg} (${elapsed}s)`, 'sys');
    } else {
      const err = (stderr || stdout).trim().split('\n').pop() || `exit ${code}`;
      pushToConsole(`⚠️ ${job.name} failed: ${err}`, 'sys');
    }
  });

  child.on('error', (err) => {
    pushToConsole(`⚠️ ${job.name} error: ${err.message}`, 'sys');
  });
}

// Start all heartbeat timers
function startHeartbeat() {
  pushToConsole('💓 Heartbeat engine starting...', 'sys');
  console.log('  Heartbeat engine active.');

  // Boot sync — stagger by 2 seconds each to avoid collision
  HEARTBEAT_JOBS.forEach((job, i) => {
    setTimeout(() => runHeartbeatJob(job), i * 2000);
  });

  // Ongoing intervals
  HEARTBEAT_JOBS.forEach(job => {
    setInterval(() => runHeartbeatJob(job), job.intervalMs);
    console.log(`    ↳ ${job.name} every ${job.intervalMs / 60000} min`);
  });
}

server.listen(PORT, () => {
  console.log(`\n  SYSTEM Dashboard`);
  console.log(`  ────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  WebSocket on same port`);
  console.log(`  Backend initialized.`);
  console.log(`  Ready.\n`);

  // Start heartbeat after server is listening
  startHeartbeat();
});
