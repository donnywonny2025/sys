// core.js — Clock, date, scene switching, shared namespace
// Everything here runs first. Other modules attach to window.DASH.

(function() {
  'use strict';
  window.DASH = {};

  // --- Feed Timer Tracking (shared state) ---
  DASH.feedTimestamps = { email: null, calendar: null, weather: null };
  DASH.feedIntervals = { email: 5, calendar: 15, weather: 30 };

  DASH.updateFeedTimers = function() {
    var now = Date.now();
    ['email', 'calendar', 'weather'].forEach(function(type) {
      var el = document.getElementById(type === 'email' ? 'email-timer' : (type === 'calendar' ? 'calendar-timer' : null));
      if (!el) return;
      var ts = DASH.feedTimestamps[type];
      if (!ts) { el.textContent = 'waiting…'; return; }
      var agoSec = Math.floor((now - ts) / 1000);
      var agoStr = agoSec < 60 ? agoSec + 's ago' : Math.floor(agoSec / 60) + 'm ago';
      var nextSec = (DASH.feedIntervals[type] * 60) - agoSec;
      var nextStr = nextSec <= 0 ? 'any moment' : (nextSec < 60 ? nextSec + 's' : Math.ceil(nextSec / 60) + 'm');
      el.textContent = agoStr + ' · next ' + nextStr;
    });

  };

  // --- Clock & Date ---
  DASH.updateClock = function() {
    var now = new Date();
    var h = now.getHours().toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    var s = now.getSeconds().toString().padStart(2, '0');
    document.getElementById('clock').textContent = h + ':' + m + ':' + s;
  };

  DASH.updateDate = function() {
    var now = new Date();
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('top-date').textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
    document.getElementById('focus-date').textContent = full[now.getDay()] + ', ' + fullMonths[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  };

  // --- Scene Switching ---
  DASH.switchScene = function(name) {
    document.querySelectorAll('.scene').forEach(function(s) {
      s.classList.toggle('active', s.id === 'scene-' + name);
    });
    document.querySelectorAll('.rail-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.scene === name);
    });
    if (name === 'chat') {
      setTimeout(function() {
        var cm = document.getElementById('chat-messages');
        if (cm) cm.scrollTop = cm.scrollHeight;
      }, 50);
    }
  };

  document.querySelectorAll('.rail-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { DASH.switchScene(this.dataset.scene); });
  });

  // --- Feed Item (generic) ---
  DASH.addFeedItem = function(text, type) {
    var feed = document.getElementById('feed-content');
    var item = document.createElement('div');
    item.className = 'feed-item type-' + (type || 'info');
    var now = new Date();
    var time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    item.innerHTML = '<span class="feed-time">' + time + '</span> <span class="feed-text">' + text + '</span>';
    feed.insertBefore(item, feed.firstChild);
    while (feed.children.length > 30) feed.removeChild(feed.lastChild);
  };
})();
