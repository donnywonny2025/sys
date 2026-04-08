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

  // ── Reverse proxy: OpenClaw UI (strips iframe-blocking headers) ──
  if (req.url.startsWith('/openclaw/') || req.url === '/openclaw') {
    const targetPath = req.url.replace(/^\/openclaw\/?/, '/');
    const options = {
      hostname: '127.0.0.1',
      port: 18789,
      path: targetPath || '/',
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:18789' }
    };
    const proxyReq = http.request(options, (proxyRes) => {
      // Strip headers that block iframe embedding
      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
      delete headers['content-security-policy'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/html' });
      res.end('<div style="color:#888;font-family:monospace;padding:40px;">OpenClaw not reachable at port 18789</div>');
    });
    req.pipe(proxyReq);
    return;
  }
  // ── API: Cron Heartbeat ──
  if (req.method === 'GET' && req.url === '/api/cron-heartbeat') {
    const { execFile } = require('child_process');
    execFile('openclaw', ['cron', 'list', '--json'], { timeout: 8000 }, (err, stdout) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const jobs = (data.jobs || []).map(j => ({
          name: j.name,
          schedule: j.schedule?.expr,
          lastRunAt: j.state?.lastRunAtMs || null,
          nextRunAt: j.state?.nextRunAtMs || null,
          status: j.state?.lastRunStatus || 'unknown',
          durationMs: j.state?.lastDurationMs || 0,
          errors: j.state?.consecutiveErrors || 0,
          enabled: j.enabled
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ts: Date.now(), jobs }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'parse: ' + e.message }));
      }
    });
    return;
  }
  // ── API: Get/Set OpenClaw Model ──
  const OPENCLAW_CONFIG = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  if (req.url === '/api/model') {
    if (req.method === 'GET') {
      try {
        const cfg = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
        const model = cfg?.agents?.defaults?.model?.primary || 'unknown';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ model }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    if (req.method === 'POST') {
      try {
        const data = await parseBody(req);
        const newModel = data.model;
        if (!newModel) { res.writeHead(400); res.end('{"error":"no model"}'); return; }
        const cfg = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
        cfg.agents.defaults.model.primary = newModel;
        fs.writeFileSync(OPENCLAW_CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
        broadcast({ type: 'model-change', model: newModel });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, model: newModel }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }
  // ── API: Chat with OpenClaw ──
  // Uses the direct HTTP API to the gateway — fast, reliable, no stale sessions
  if (req.method === 'POST' && req.url === '/api/openclaw-chat') {
    try {
      const data = await parseBody(req);
      const message = data.message;
      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No message provided' }));
        return;
      }

      // Show user message immediately in chat + console
      pushToConsole(`→ ${message}`, 'prompt');
      broadcast({ type: 'telem', event: 'recv', ts: new Date().toISOString(), label: message.slice(0, 60) });
      broadcast({ type: 'console', entry: `⏳ Processing request...`, style: 'sys', status: 'PROCESSING', ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) });

      // Return immediately to frontend
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));

      // Fire the API call asynchronously
      const startTime = Date.now();
      let token = '';
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.openclaw', 'openclaw.json'), 'utf8'));
        token = cfg?.gateway?.auth?.token || '';
      } catch (e) {}

      const payload = JSON.stringify({
        model: 'openclaw/default',
        messages: [{ role: 'user', content: message }]
      });

      const apiReq = http.request({
        hostname: '127.0.0.1',
        port: 18789,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 60000
      }, (apiRes) => {
        let body = '';
        apiRes.on('data', d => body += d);
        apiRes.on('end', () => {
          const durMs = Date.now() - startTime;
          try {
            const result = JSON.parse(body);
            const reply = result?.choices?.[0]?.message?.content || '';
            // Strip thinking tags
            let clean = reply.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?final>/g, '').trim();
            if (clean) {
              const dur = `(${(durMs / 1000).toFixed(1)}s)`;
              pushToConsole(`← OpenClaw ${dur}: ${clean}`, 'response');
            } else {
              pushToConsole(`← OpenClaw: (empty response)`, 'response');
            }
          } catch (e) {
            pushToConsole(`✗ OpenClaw parse error: ${e.message}`, 'err');
          }
          broadcast({ type: 'console', entry: '✅ Done', style: 'sys', status: 'IDLE', ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) });
          broadcast({ type: 'telem', event: 'done', ts: new Date().toISOString(), durMs });
        });
      });

      apiReq.on('error', (e) => {
        const durMs = Date.now() - startTime;
        pushToConsole(`✗ OpenClaw error: ${e.message}`, 'err');
        broadcast({ type: 'console', entry: '✅ Done', style: 'sys', status: 'IDLE', ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) });
        broadcast({ type: 'telem', event: 'done', ts: new Date().toISOString(), durMs });
      });

      apiReq.on('timeout', () => {
        apiReq.destroy();
        pushToConsole(`✗ OpenClaw timeout (60s)`, 'err');
        broadcast({ type: 'console', entry: '✅ Done', style: 'sys', status: 'IDLE', ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) });
      });

      apiReq.write(payload);
      apiReq.end();

    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
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
    const sessDir = path.join(os.homedir(), '.openclaw/agents/main/sessions');
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

  // ── API: OpenClaw agent status ──
  if (req.method === 'GET' && (req.url === '/api/hermes-status' || req.url === '/api/openclaw-status')) {
    const http = require('http');
    const probe = http.get('http://127.0.0.1:18789/health', { timeout: 3000 }, (probeRes) => {
      let body = '';
      probeRes.on('data', d => body += d);
      probeRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ active: true, engine: 'openclaw', output: body.trim() }));
      });
    });
    probe.on('error', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: false, engine: 'openclaw', output: 'Gateway unreachable' }));
    });
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
  // OpenClaw Control UI → proxy to gateway
  if (req.url.startsWith('/openclaw')) {
    const targetPath = req.url.replace(/^\/openclaw\/?/, '/');
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: 18789,
      path: targetPath || '/',
      method: 'GET',
      headers: {
        ...req.headers,
        host: '127.0.0.1:18789'
      }
    });
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      let responseHead = `HTTP/1.1 101 Switching Protocols\r\n`;
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        responseHead += `${key}: ${value}\r\n`;
      }
      responseHead += '\r\n';
      socket.write(responseHead);
      if (proxyHead.length) socket.write(proxyHead);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      proxySocket.on('error', () => socket.destroy());
      socket.on('error', () => proxySocket.destroy());
    });
    proxyReq.on('error', (err) => {
      console.error('OpenClaw WS proxy error:', err.message);
      socket.destroy();
    });
    proxyReq.end();
    return;
  }

  // Dashboard WebSocket → handle with our WSS
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

server.listen(PORT, () => {
  console.log(`\n  SYSTEM Dashboard`);
  console.log(`  ────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  WebSocket on same port`);
  console.log(`  OpenClaw proxy on /openclaw/`);
  console.log(`  Ready.\n`);
});

// ── OpenClaw Session Watcher ──
// Watches the active session JSONL file for new chat messages and pushes them to the console

const SESSIONS_DIR = path.join(process.env.HOME || '/Users/jeffkerr', '.openclaw/agents/main/sessions');

const recentMessages = [];

function pushToConsole(text, style) {
  // Dedup: normalize away timing like "(4.6s)" so both API and JSONL paths match
  const now = Date.now();
  const dedupKey = text.replace(/← OpenClaw\s*\(\d+\.\d+s\)\s*:/g, '← OpenClaw:')
                       .replace(/← OpenClaw\s*:/g, '← OpenClaw:')
                       .substring(0, 120);
  const isDupe = recentMessages.some(m => m.key === dedupKey && (now - m.ts) < 5000);
  if (isDupe) return;
  recentMessages.push({ key: dedupKey, ts: now });
  while (recentMessages.length > 20) recentMessages.shift();
  const ts = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  broadcast({
    type: 'console',
    entry: text,
    style: style || 'sys',
    ts: ts,
    status: style === 'prompt' ? 'ACTIVE' : (style === 'response' ? 'IDLE' : undefined)
  });
  // Persist
  try {
    const histFile = path.join(DATA_DIR, 'history.json');
    let hist = [];
    if (fs.existsSync(histFile)) hist = JSON.parse(fs.readFileSync(histFile, 'utf8'));
    hist.push({ type: 'console', entry: text, style: style, ts: ts });
    if (hist.length > 200) hist = hist.slice(-200);
    fs.writeFileSync(histFile, JSON.stringify(hist, null, 2));
  } catch (e) { /* ignore */ }
}

// Watch the sessions directory for the most-recently-modified JSONL file
function startSessionWatcher() {
  let watchingFile = null;
  let tailProc = null;

  function findActiveSession() {
    try {
      const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      return files.length > 0 ? files[0].name : null;
    } catch (e) { return null; }
  }

  function tailSession(filename) {
    if (tailProc) { tailProc.kill(); tailProc = null; }
    watchingFile = filename;
    const filePath = path.join(SESSIONS_DIR, filename);
    console.log(`  Watching session: ${filename}`);

    tailProc = spawn('tail', ['-n', '0', '-f', filePath], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buffer = '';

    tailProc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'message' || !entry.message) continue;

          const role = entry.message.role;
          const content = entry.message.content;

          // Extract all visible content (text, tool calls, tool results)
          const ts = entry.message.timestamp || new Date().toISOString();
          const durMs = entry.message.durationMs || 0;

          if (typeof content === 'string' && content.trim()) {
            let text = content.replace(/<\/?final>/g, '').trim();
            if (role === 'user') {
              const userMatch = text.match(/\n\n(.+)$/s);
              const cleanText = userMatch ? userMatch[1].trim() : text.trim();
              if (cleanText) {
                pushToConsole(`→ ${cleanText}`, 'prompt');
                broadcast({ type: 'telem', event: 'recv', ts, label: cleanText.slice(0, 60) });
              }
            } else if (role === 'assistant' && text) {
              const dur = durMs ? `(${(durMs / 1000).toFixed(1)}s)` : '';
              let strippedText = text.replace(/<think>[\s\S]*?<\/think>/g, '');
              strippedText = strippedText.replace(/🦞 OpenClaw[\s\S]+?🪢 Queue:.*?\n/g, '');
              strippedText = strippedText.trim();
              if (strippedText) {
                pushToConsole(`← OpenClaw ${dur}: ${strippedText}`, 'response');
              }
              broadcast({ type: 'telem', event: 'reply', ts, durMs, label: text.slice(0, 60) });
            }
          } else if (Array.isArray(content)) {
            for (const part of content) {
              if (part.type === 'text' && part.text) {
                let text = part.text.replace(/<\/?final>/g, '').trim();
                if (!text) continue;
                if (role === 'user') {
                  const userMatch = text.match(/\n\n(.+)$/s);
                  const cleanText = userMatch ? userMatch[1].trim() : text.trim();
                  if (cleanText) {
                    pushToConsole(`→ ${cleanText}`, 'prompt');
                    broadcast({ type: 'telem', event: 'recv', ts, label: cleanText.slice(0, 60) });
                  }
                } else if (role === 'assistant') {
                  const dur = durMs ? `(${(durMs / 1000).toFixed(1)}s)` : '';
                  let strippedText = text.replace(/<think>[\s\S]*?<\/think>/g, '');
                  strippedText = strippedText.replace(/🦞 OpenClaw[\s\S]+?🪢 Queue:.*?\n/g, '');
                  strippedText = strippedText.replace(/```[\s\n]*```/g, '');
                  strippedText = strippedText.trim();
                  
                  if (strippedText) {
                    pushToConsole(`← OpenClaw ${dur}: ${strippedText}`, 'response');
                  }
                  broadcast({ type: 'telem', event: 'reply', ts, durMs, label: text.slice(0, 60) });
                } else if (role === 'toolResult') {
                  const short = text.length > 120 ? text.slice(0, 120) + '…' : text;
                  // DO NOT push toolResult to console. It goes to telemetry status strip.
                  broadcast({ type: 'telem', event: 'done', ts, durMs, label: short.slice(0, 60), dataBytes: text.length });
                }
              } else if (part.type === 'toolCall' && role === 'assistant') {
                const name = part.name || 'unknown';
                // DO NOT push toolCall to console. It goes to telemetry status strip.
                broadcast({ type: 'telem', event: 'tool', ts, label: name });
              } else if (part.type === 'thinking' && role === 'assistant') {
                broadcast({ type: 'telem', event: 'think', ts, durMs });
              }
            }
          }
        } catch (e) { /* skip bad lines */ }
      }
    });

    tailProc.on('close', () => {
      console.log('  Session tail closed, restarting in 3s...');
      setTimeout(() => startSessionWatcher(), 3000);
    });
  }

  const active = findActiveSession();
  if (active) {
    tailSession(active);
  } else {
    console.log('  No active session found, retrying in 10s...');
    setTimeout(startSessionWatcher, 10000);
  }

  // Watch directory for new JSONL files instantly
  fs.watch(SESSIONS_DIR, (eventType, filename) => {
    if (eventType === 'rename' && filename && filename.endsWith('.jsonl')) {
      const active = findActiveSession();
      if (active && active !== watchingFile) {
        console.log(`  New session detected: ${active}`);
        tailSession(active);
      }
    }
  });

  // Keep a fallback poll checking every 5 seconds instead of 15
  setInterval(() => {
    const latest = findActiveSession();
    if (latest && latest !== watchingFile) {
      console.log(`  Switching to newer session (fallback): ${latest}`);
      tailSession(latest);
    }
  }, 5000);
}

// Gateway log tailing for connection/status events
function startLogTail() {
  const gwLogPath = path.join(process.env.HOME || '/Users/jeffkerr', '.openclaw/logs/gateway.log');
  if (!fs.existsSync(gwLogPath)) return;

  const tail = spawn('tail', ['-n', '0', '-f', gwLogPath], { stdio: ['ignore', 'pipe', 'ignore'] });
  let buffer = '';

  tail.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const match = line.match(/^\S+T(\d{2}:\d{2}:\d{2})\.\S+\s+\[(\w+)\]\s+(.*)/);
      if (!match) continue;
      const msg = match[3];

      if (msg.includes('webchat connected')) {
        pushToConsole('🔗 OpenClaw Control UI connected', 'sys');
      } else if (msg.includes('webchat disconnected')) {
        pushToConsole('🔌 OpenClaw Control UI disconnected', 'warn');
      } else if (msg.includes('agent model:')) {
        pushToConsole(`🤖 ${msg}`, 'sys');
      }
    }
  });

  tail.on('close', () => setTimeout(startLogTail, 5000));
  console.log(`  Tailing gateway.log`);
}

// Start watchers after brief delay
setTimeout(() => {
  startSessionWatcher();
  startLogTail();
}, 2000);

