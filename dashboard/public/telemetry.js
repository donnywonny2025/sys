// telemetry.js — Status bar: sparklines, CPU/MEM, model indicator, activity chain, feed ages
// Attaches to DASH namespace from core.js

(function() {
  'use strict';

  var SPARK_CHARS = '▁▂▃▄▅▆▇█';
  var cpuHistory = [];
  var latencyHistory = [];
  var dataIn = 0;
  var dataOut = 0;

  function spark(values, len) {
    len = len || 10;
    while (values.length > len) values.shift();
    while (values.length < len) values.unshift(0);
    var max = Math.max.apply(null, values) || 1;
    return values.map(function(v) {
      var idx = Math.round((v / max) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    }).join('');
  }

  function fmtUptime(ms) {
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600).toString().padStart(2, '0');
    var m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    var sec = (s % 60).toString().padStart(2, '0');
    return h + ':' + m + ':' + sec;
  }

  function buildMemBar(pct) {
    var el = document.getElementById('telem-mem-bar');
    if (!el) return;
    var segs = 10;
    var filled = Math.round(pct / 100 * segs);
    el.innerHTML = '';
    for (var i = 0; i < segs; i++) {
      var seg = document.createElement('span');
      seg.className = 'telem-bar-seg' + (i < filled ? ' filled' : '');
      el.appendChild(seg);
    }
  }

  function fmtBytes(b) {
    if (!b || b < 1) return '';
    if (b < 1024) return b + 'B';
    if (b < 1048576) return (b / 1024).toFixed(1) + 'KB';
    return (b / 1048576).toFixed(1) + 'MB';
  }

  // --- Polling ---
  function pollTelemetry() {
    fetch('/api/telemetry').then(function(r) { return r.json(); }).then(function(d) {
      var up = document.getElementById('telem-uptime'); if (up) up.textContent = fmtUptime(d.uptime);
      var sess = document.getElementById('telem-session'); if (sess) sess.textContent = d.session;
      var turns = document.getElementById('telem-turns'); if (turns) turns.textContent = d.turns;
      cpuHistory.push(d.cpu);
      var cpuEl = document.getElementById('telem-cpu'); if (cpuEl) cpuEl.textContent = spark(cpuHistory, 10);
      var cpuPct = document.getElementById('telem-cpu-pct'); if (cpuPct) cpuPct.textContent = d.cpu + '%';
      buildMemBar(d.mem);
      var memPct = document.getElementById('telem-mem-pct'); if (memPct) memPct.textContent = d.mem + '%';
    }).catch(function() {});
  }

  // --- Model Indicator ---
  var MODEL_OPTIONS = [
    'google/gemini-3-flash-preview',
    'google/gemini-2.5-flash',
    'google/gemini-3.1-flash-lite-preview',
    'google/gemini-2.5-flash-lite'
  ];

  function shortModelName(m) { return (m || '').replace('google/', '').replace('-preview', ''); }

  function fetchModel() {
    fetch('/api/model').then(function(r) { return r.json(); }).then(function(d) {
      var el = document.getElementById('telem-model');
      if (el) el.textContent = shortModelName(d.model);
    }).catch(function() {});
  }

  var modelEl = document.getElementById('telem-model');
  if (modelEl) {
    modelEl.addEventListener('click', function() {
      fetch('/api/model').then(function(r) { return r.json(); }).then(function(d) {
        var idx = MODEL_OPTIONS.indexOf(d.model);
        var next = MODEL_OPTIONS[(idx + 1) % MODEL_OPTIONS.length];
        fetch('/api/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: next }) })
          .then(function(r) { return r.json(); }).then(function(r) {
            var el2 = document.getElementById('telem-model');
            if (el2) { el2.textContent = shortModelName(r.model); el2.style.color = '#ff6b6b'; setTimeout(function() { el2.style.color = '#4ecdc4'; }, 2000); }
          });
      });
    });
  }

  // --- Activity Chain ---
  var activityFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  var activityFrameIdx = 0;
  var activityInterval = null;

  function addChainEvent(icon, label, cssClass, durStr, dataSize) {
    var chain = document.getElementById('telem-chain');
    if (!chain) return;
    if (activityInterval) { clearInterval(activityInterval); activityInterval = null; }
    var isSpinning = (cssClass === 'think' || cssClass === 'recv');

    function renderStatus(frameIcon) {
      var text = frameIcon + ' ' + label;
      if (durStr) text += ' [' + durStr + ']';
      if (dataSize) text += ' ' + dataSize;
      chain.textContent = text;
      if (cssClass === 'think' || cssClass === 'recv') chain.style.color = 'var(--purple)';
      else if (cssClass === 'done' || cssClass === 'reply') chain.style.color = 'var(--green)';
      else if (cssClass === 'boot') chain.style.color = 'var(--cyan)';
      else chain.style.color = 'var(--t1)';
    }
    if (isSpinning) {
      activityInterval = setInterval(function() { activityFrameIdx = (activityFrameIdx + 1) % activityFrames.length; renderStatus(activityFrames[activityFrameIdx]); }, 80);
    } else { renderStatus(icon); }
  }

  // --- Telem Event Handler (used by websocket.js) ---
  DASH.handleTelemEvent = function(msg) {
    var durStr = '';
    if (msg.durMs) durStr = msg.durMs > 1000 ? (msg.durMs / 1000).toFixed(1) + 's' : msg.durMs + 'ms';

    if (msg.durMs && (msg.event === 'reply' || msg.event === 'done')) {
      latencyHistory.push(msg.durMs);
      var latEl = document.getElementById('telem-latency'); if (latEl) latEl.textContent = spark(latencyHistory, 10);
      var avgEl = document.getElementById('telem-latency-avg');
      if (avgEl && latencyHistory.length) {
        var sum = latencyHistory.slice(-10).reduce(function(a, b) { return a + b; }, 0);
        avgEl.textContent = (sum / Math.min(latencyHistory.length, 10) / 1000).toFixed(1) + 's';
      }
    }
    if (msg.dataBytes && msg.event === 'done') {
      dataIn += msg.dataBytes;
      var inEl = document.getElementById('telem-data-in-val');
      if (inEl) { inEl.textContent = fmtBytes(dataIn); inEl.classList.remove('telem-data-pulse'); inEl.offsetHeight; inEl.classList.add('telem-data-pulse'); }
    }
    if (msg.event === 'recv' && msg.label) {
      dataOut += msg.label.length;
      var outEl = document.getElementById('telem-data-out-val');
      if (outEl) { outEl.textContent = fmtBytes(dataOut); outEl.classList.remove('telem-data-pulse'); outEl.offsetHeight; outEl.classList.add('telem-data-pulse'); }
    }

    var dataSize = msg.dataBytes ? fmtBytes(msg.dataBytes) : '';
    switch (msg.event) {
      case 'recv': addChainEvent('→', 'IN', 'recv'); break;
      case 'think': addChainEvent('◎', 'THINK', 'think', durStr); break;
      case 'tool': addChainEvent('▶', (msg.label || '—'), 'tool'); break;
      case 'done': addChainEvent('✓', durStr || 'OK', 'done', '', dataSize); break;
      case 'reply': addChainEvent('◀', 'OUT', 'reply', durStr); break;
    }

    var lastEl = document.getElementById('telem-last-action');
    if (lastEl) {
      var actionMap = { recv: '→ prompt', think: '◎ thinking', tool: '▶ ' + (msg.label || 'tool'), done: '✓ done', reply: '◀ reply' };
      lastEl.textContent = actionMap[msg.event] || msg.event;
    }
  };

  // --- Feed Age Display (uses cron heartbeat) ---
  function formatAge(ms) {
    if (!ms) return '—';
    var sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + 's ago';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    return Math.floor(min / 60) + 'h ago';
  }

  // Map cron job names to telem element IDs
  var cronMap = {
    'Check Mail': 'telem-mail-age',
    'Check Calendar': 'telem-cal-age',
    'Check Weather': 'telem-wx-age'
  };

  function pollCronHeartbeat() {
    fetch('/api/cron-heartbeat').then(function(r) { return r.json(); }).then(function(d) {
      if (!d.ok || !d.jobs) return;
      var now = Date.now();
      d.jobs.forEach(function(job) {
        var elId = cronMap[job.name];
        if (!elId) return;
        var el = document.getElementById(elId);
        if (!el) return;
        el.textContent = job.lastRunAt ? formatAge(now - job.lastRunAt) : '—';
        // Color: green if ok, red if errors, dim if never ran
        if (job.status === 'ok' && job.errors === 0) {
          el.style.color = 'var(--green)';
        } else if (job.errors > 0) {
          el.style.color = 'var(--red, #ff6b6b)';
        } else {
          el.style.color = '';
        }
        // Also update feedTimestamps for backwards compat
        if (job.name === 'Check Mail') DASH.feedTimestamps.email = job.lastRunAt;
        if (job.name === 'Check Calendar') DASH.feedTimestamps.calendar = job.lastRunAt;
        if (job.name === 'Check Weather') DASH.feedTimestamps.weather = job.lastRunAt;
      });
    }).catch(function() {});
  }

  // Start polling
  pollTelemetry();
  setInterval(pollTelemetry, 4000);
  pollCronHeartbeat();
  setInterval(pollCronHeartbeat, 30000);
  fetchModel();
  setInterval(fetchModel, 30000);

  // Boot animation
  setTimeout(function() { addChainEvent('⚡', 'BOOT', 'boot'); }, 200);
  setTimeout(function() { addChainEvent('◉', 'FEEDS', 'recv'); }, 1200);
  setTimeout(function() { addChainEvent('◎', 'SYSTEM', 'think'); }, 2200);
  setTimeout(function() { addChainEvent('✓', 'READY', 'done'); }, 3200);
})();
