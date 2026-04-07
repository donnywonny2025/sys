// SYSTEM Dashboard — Client
// Connects via WebSocket and renders pushed content in real-time.

(function () {
  const feed = document.getElementById('feed');
  const empty = document.getElementById('empty');
  const clock = document.getElementById('clock');
  const statusDot = document.querySelector('.status-dot');
  const statusLabel = document.querySelector('.status-label');

  let ws;
  let reconnectTimer;

  // ── Clock ──
  function updateClock() {
    const now = new Date();
    const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    const date = now.toLocaleDateString('en-US', opts).toUpperCase();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    clock.textContent = `${date}  ·  ${time}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── WebSocket ──
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onopen = () => {
      statusDot.classList.add('status-dot--active');
      statusDot.classList.remove('status-dot--pending');
      statusLabel.textContent = 'Live';
    };

    ws.onclose = () => {
      statusDot.classList.remove('status-dot--active');
      statusDot.classList.add('status-dot--pending');
      statusLabel.textContent = 'Reconnecting';
      reconnectTimer = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderMessage(data);
      } catch (e) {
        console.error('Parse error:', e);
      }
    };
  }

  // ── Render ──
  function renderMessage(data) {
    // Hide empty state on first message
    if (empty) {
      empty.style.display = 'none';
    }

    const type = data.type || 'info';
    const el = document.createElement('div');
    el.className = `message message--${type}`;

    // Timestamp
    const timeEl = document.createElement('div');
    timeEl.className = 'message__time';
    const ts = data.timestamp ? new Date(data.timestamp) : new Date();
    timeEl.textContent = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    el.appendChild(timeEl);

    // Content
    if (data.content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'message__content';
      // Support basic markdown-style bold with **text**
      contentEl.innerHTML = escapeHtml(data.content).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      el.appendChild(contentEl);
    }

    // Image
    if (data.image) {
      const img = document.createElement('img');
      img.className = 'message__image';
      img.src = data.image;
      img.alt = data.content || 'Generated image';
      img.loading = 'lazy';
      el.appendChild(img);
    }

    feed.appendChild(el);

    // Auto-scroll to latest
    requestAnimationFrame(() => {
      feed.scrollTop = feed.scrollHeight;
    });
  }

  // ── Util ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Load history on page load ──
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      const history = await res.json();
      // Show last 20 entries
      const recent = history.slice(-20);
      for (const item of recent) {
        renderMessage(item);
      }
    } catch (e) {
      console.log('No history yet');
    }
  }

  // ── Init ──
  loadHistory().then(() => {
    connect();
  });
})();
