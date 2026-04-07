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

  // ── API: Hermes agent status ──
  if (req.method === 'GET' && req.url === '/api/hermes-status') {
    // Check if hermes binary exists and can report status
    const { exec } = require('child_process');
    exec('hermes status 2>&1 | head -5', { timeout: 3000 }, (err, stdout) => {
      const isUp = stdout && stdout.includes('Hermes Agent Status');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ active: isUp, output: (stdout || '').trim() }));
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
  let filePath = req.url === '/' ? '/index.html' : req.url;
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

// WebSocket server — piggybacks on HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} total)`);

  // Send welcome
  ws.send(JSON.stringify({
    type: 'system',
    content: 'Connected to SYSTEM',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (${clients.size} total)`);
  });
});

server.listen(PORT, () => {
  console.log(`\n  SYSTEM Dashboard`);
  console.log(`  ────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  WebSocket on same port`);
  console.log(`  Ready.\n`);
});
