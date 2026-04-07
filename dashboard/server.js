// SYSTEM Dashboard Server
// Serves the dashboard page and handles real-time updates via WebSocket.
// Antigravity and Hermes push content here via HTTP POST → WebSocket → browser.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { execFile } = require('child_process');

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
  // ── API: Chat with OpenClaw ──
  if (req.method === 'POST' && req.url === '/api/openclaw-chat') {
    try {
      const data = await parseBody(req);
      const message = data.message;
      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No message provided' }));
        return;
      }
      // Fire-and-forget: the session watcher picks up both the prompt and
      // response from the JSONL files and pushes them to the console/chat feed.
      const { execFile } = require('child_process');
      execFile('openclaw', ['agent', '--agent', 'main', '--message', message], {
        timeout: 60000,
        env: { ...process.env, PATH: process.env.PATH + ':/Users/jeffkerr/Library/pnpm' }
      }, (err, stdout, stderr) => {
        if (err) {
          const errMsg = stderr || err.message;
          pushToConsole(`✗ OpenClaw error: ${errMsg.substring(0, 150)}`, 'err');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errMsg }));
          return;
        }
        // CLI returns "completed" — actual reply comes via session watcher
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
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

  // ── API: Get active state ──
  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(activeState || { type: 'home' }));
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
const { spawn } = require('child_process');

const SESSIONS_DIR = path.join(process.env.HOME || '/Users/jeffkerr', '.openclaw/agents/main/sessions');

const recentMessages = [];

function pushToConsole(text, style) {
  // Dedup: skip if same text appeared in last 5 seconds
  const now = Date.now();
  const isDupe = recentMessages.some(m => m.text === text && (now - m.ts) < 5000);
  if (isDupe) return;
  recentMessages.push({ text, ts: now });
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
          if (!Array.isArray(content)) continue;

          const textPart = content.find(c => c.type === 'text');
          if (!textPart || !textPart.text) continue;

          let text = textPart.text;

          if (role === 'user') {
            // Strip the "Sender (untrusted metadata)" wrapper if present
            const userMatch = text.match(/\n\n(.+)$/s);
            const cleanText = userMatch ? userMatch[1].trim() : text.trim();
            if (cleanText) pushToConsole(`→ ${cleanText}`, 'prompt');
          } else if (role === 'assistant') {
            // Strip <final> tags
            text = text.replace(/<\/?final>/g, '').trim();
            if (text) {
              const dur = entry.message.durationMs
                ? `(${(entry.message.durationMs / 1000).toFixed(1)}s)`
                : '';
              pushToConsole(`← OpenClaw ${dur}: ${text}`, 'response');
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

  // Also check periodically if a newer session started
  setInterval(() => {
    const latest = findActiveSession();
    if (latest && latest !== watchingFile) {
      console.log(`  Switching to newer session: ${latest}`);
      tailSession(latest);
    }
  }, 15000);
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

