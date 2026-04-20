// chat.js — Console panel + chat live feed bubbles
// Attaches to DASH namespace from core.js

(function() {
  'use strict';

  var consoleBody = document.getElementById('console-body');
  var consoleToggle = document.getElementById('console-toggle');
  var consolePanel = document.getElementById('system-console');
  var chatMessages = document.getElementById('chat-messages');

  consoleToggle.addEventListener('click', function() { consolePanel.classList.toggle('collapsed'); });

  DASH.addConsoleLine = function(text, style, ts) {
    var line = document.createElement('div');
    line.className = 'console-line ' + (style || 'sys');
    var time = ts || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    line.innerHTML = '<span class="ts">[' + time + ']</span> ' + text;
    consoleBody.appendChild(line);
    while (consoleBody.children.length > 80) consoleBody.removeChild(consoleBody.firstChild);
    consoleBody.scrollTop = consoleBody.scrollHeight;
  };

  // --- Chat Bubbles ---
  var _lastChatTexts = {};

  function formatTimeStr(ts) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var h = d.getHours(); var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function dedupNormalize(s) {
    // Strip emoji, collapse whitespace, lowercase, trim — keeps only alphanumeric + basic punct
    return s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[^\w\s.,!?'-]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().substring(0, 120);
  }

  // Periodically clean old dedup entries (prevent memory leak)
  setInterval(function() {
    var cutoff = Date.now() - 60000;
    for (var k in _lastChatTexts) { if (_lastChatTexts[k] < cutoff) delete _lastChatTexts[k]; }
  }, 30000);

  DASH.addChatFeedBubble = function(text, style, ts) {
    if (!chatMessages) return;
    var isOut = text.indexOf('→') === 0;
    var isIn = text.indexOf('←') === 0;
    if (!isOut && !isIn) return;

    // Robust dedup: normalize text, use 120-char key, 30s window
    var dedupKey = dedupNormalize(text);
    var now = Date.now();
    if (_lastChatTexts[dedupKey] && (now - _lastChatTexts[dedupKey]) < 30000) return;
    _lastChatTexts[dedupKey] = now;

    var welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    var bubble = document.createElement('div');
    var timeStr = formatTimeStr(ts);
    var cleanText;

    if (isOut) {
      cleanText = text.replace(/^→\s*/, '').replace(/^\[.*?\]\s*/, '');
      bubble.className = 'chat-bubble user';
      var body = document.createElement('span'); body.textContent = cleanText; bubble.appendChild(body);
      var time = document.createElement('div'); time.className = 'chat-time'; time.textContent = timeStr; bubble.appendChild(time);
    } else {
      cleanText = text.replace(/^←\s*(System(?:\s*\([\d.]+s\))?\s*:\s*)?/i, '');
      bubble.className = 'chat-bubble assistant';
      var sender = document.createElement('div'); sender.className = 'chat-sender'; sender.textContent = 'SYSTEM'; bubble.appendChild(sender);
      var body2 = document.createElement('span'); body2.textContent = cleanText; bubble.appendChild(body2);
      var time2 = document.createElement('div'); time2.className = 'chat-time'; time2.textContent = timeStr; bubble.appendChild(time2);
    }

    chatMessages.appendChild(bubble);
    setTimeout(function() { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
  };

  // Load console history on boot
  fetch('/api/history')
    .then(function(r) { return r.json(); })
    .then(function(history) {
      var consoleItems = history.filter(function(h) { return h.type === 'console'; });
      consoleItems.forEach(function(item) {
        DASH.addConsoleLine(item.entry, item.style || 'sys', item.ts);
        DASH.addChatFeedBubble(item.entry, item.style || 'sys', item.timestamp || item.ts);
      });
      if (consoleItems.length === 0) DASH.addConsoleLine('Console initialized. Waiting for system activity...', 'sys');
      setTimeout(function() {
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        var consoleEl = document.getElementById('console-lines');
        if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
      }, 100);
    })
    .catch(function() { DASH.addConsoleLine('Console initialized. Waiting for system activity...', 'sys'); });
})();
