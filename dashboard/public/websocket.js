// websocket.js — WebSocket connection, reconnect, message dispatch
// LOADS LAST — routes incoming messages to all other DASH modules
// Also handles init: clock start, state restore, feed timers

(function() {
  'use strict';

  var ws, reconnectTimer;

  function connectWS() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host);

    ws.onopen = function() {
      document.getElementById('status-dot').classList.add('live');
      document.getElementById('status-label').textContent = 'Live';
    };
    ws.onclose = function() {
      document.getElementById('status-dot').classList.remove('live');
      document.getElementById('status-label').textContent = 'Reconnecting';
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWS, 3000);
    };
    ws.onerror = function() { ws.close(); };

    ws.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'message':    DASH.addFeedItem(msg.text, msg.style); break;
          case 'scene':      DASH.switchScene(msg.scene); break;
          case 'focus':      DASH.renderFocus(msg.items); break;
          case 'email':
            DASH.feedTimestamps.email = msg._cachedAt || Date.now();
            DASH.renderEmail(msg.emails, 'email-content');
            if (msg.emails.length > 5) DASH.renderEmail(msg.emails, 'mail-full-content');
            break;
          case 'calendar':
            DASH.feedTimestamps.calendar = msg._cachedAt || Date.now();
            DASH.renderCalendar(msg.events, 'calendar-content');
            DASH.renderCalendar(msg.events, 'calendar-full-content');
            DASH.autoFocusFromCalendar(msg.events);
            break;
          case 'weather':
            DASH.feedTimestamps.weather = msg._cachedAt || Date.now();
            DASH.renderWeather(msg.data);
            break;
          case 'mail-full':
            DASH.renderEmail(msg.emails, 'mail-full-content');
            break;
          case 'studio':
          case 'reference':
          case 'close_reference':
            DASH.renderStudio(msg);
            break;
          case 'console':
            DASH.addConsoleLine(msg.entry, msg.style || 'sys', msg.ts);
            DASH.addChatFeedBubble(msg.entry, msg.style, msg.ts);
            if (msg.status) {
              var statusEl = document.getElementById('console-status');
              if (statusEl) {
                statusEl.textContent = msg.status;
                statusEl.className = 'console-status' + (msg.status !== 'IDLE' ? ' active' : '');
              }
              if (msg.status === 'PROCESSING') DASH.handleTelemEvent({ event: 'think', durMs: 0 });
              else if (msg.status === 'IDLE') DASH.handleTelemEvent({ event: 'done', durMs: 0 });
            }
            break;
          case 'telem':
            DASH.handleTelemEvent(msg);
            break;
          case 'refresh':
            window.location.reload();
            break;
        }
      } catch (err) {
        DASH.addFeedItem(e.data, 'info');
      }
    };
  }

  // --- Init sequence ---
  DASH.updateClock();
  DASH.updateDate();
  setInterval(DASH.updateClock, 1000);
  setInterval(DASH.updateFeedTimers, 1000);
  connectWS();

  // Restore persistent state on boot
  fetch('/api/state')
    .then(function(r) { return r.json(); })
    .then(function(state) {
      if (state && state.type) {
        var dummyEvent = { data: JSON.stringify(state) };
        ws.onmessage(dummyEvent);
        if (state.references && state.references.length) {
          state.references.forEach(function(ref) {
            ws.onmessage({ data: JSON.stringify({ type: 'reference', src: ref.src, title: ref.title }) });
          });
        } else if (state.referenceActive && state.referenceSrc) {
          ws.onmessage({ data: JSON.stringify({ type: 'reference', src: state.referenceSrc }) });
        }
      }
    })
    .catch(function(e) { console.error("Could not fetch dashboard state:", e); });

  DASH.addFeedItem('<strong>Session started.</strong> All systems online.', 'success');
})();
