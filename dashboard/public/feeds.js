// feeds.js — Email, calendar, weather, focus rendering
// Attaches to DASH namespace from core.js

(function() {
  'use strict';

  // --- Focus ---
  DASH.renderFocus = function(items) {
    var el = document.getElementById('focus-items');
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="empty-state">Nothing scheduled for today. You\'re free to build.</div>';
      return;
    }
    items.forEach(function(item) {
      var div = document.createElement('div');
      div.className = 'focus-item';
      var status = item.done ? 'done' : (item.urgent ? 'urgent' : '');
      div.innerHTML =
        '<div class="focus-bullet ' + status + '"></div>' +
        '<div>' +
          '<div class="focus-text ' + (item.done ? 'done' : '') + '">' + item.text + '</div>' +
          (item.meta ? '<div class="focus-meta">' + item.meta + '</div>' : '') +
        '</div>';
      el.appendChild(div);
    });
  };

  DASH.autoFocusFromCalendar = function(events) {
    if (!events || events.length === 0) { DASH.renderFocus([]); return; }
    var now = new Date();
    var todayStr = (now.getMonth() + 1) + '/' + now.getDate();
    var todayEvents = events.filter(function(ev) {
      return ev.time && ev.time.indexOf(todayStr) === 0;
    });
    if (todayEvents.length === 0) { DASH.renderFocus([]); return; }
    var focusItems = todayEvents.map(function(ev) {
      var timeOnly = ev.time.replace(todayStr, '').trim();
      var isAllDay = !timeOnly || timeOnly === '00:00';
      return { text: ev.name, meta: isAllDay ? 'All day' : timeOnly };
    });
    DASH.renderFocus(focusItems);
  };

  // --- Email ---
  DASH.cachedEmails = [];

  DASH.showMailPreview = function(email, rowEl) {
    document.querySelectorAll('#mail-full-content .email-row').forEach(function(r) { r.classList.remove('active'); });
    if (rowEl) rowEl.classList.add('active');
    var preview = document.getElementById('mail-preview');
    if (!preview) return;
    preview.innerHTML =
      '<div class="mail-preview-header">' +
        '<div class="mail-preview-subject">' + (email.subject || '(no subject)') + '</div>' +
        '<div class="mail-preview-meta">' +
          '<strong>From:</strong> ' + (email.sender || 'Unknown') + '<br>' +
          '<strong>Date:</strong> ' + (email.date || '') +
        '</div>' +
      '</div>' +
      '<div class="mail-preview-body">' + (email.body || email.snippet || email.subject || 'No preview available.') + '</div>';
  };

  DASH.renderEmail = function(emails, targetId) {
    var el = document.getElementById(targetId);
    el.innerHTML = '';
    if (!emails || emails.length === 0) {
      el.innerHTML = '<div class="empty-state">No emails.</div>';
      return;
    }
    if (targetId === 'mail-full-content') DASH.cachedEmails = emails;
    emails.forEach(function(e) {
      var div = document.createElement('div');
      div.className = 'email-row';
      var dot = e.unread ? '<span class="email-unread-dot"></span>' : '';
      div.innerHTML =
        '<div class="email-subject ' + (e.unread ? 'unread' : '') + '">' + dot + e.subject + '</div>' +
        (e.snippet ? '<div class="email-snippet">' + e.snippet + '</div>' : '') +
        '<div class="email-sender">' + e.sender + ' · <span class="email-date">' + e.date + '</span></div>';
      div.addEventListener('click', function() { DASH.showMailPreview(e, div); });
      el.appendChild(div);
    });
  };

  // --- Calendar ---
  function parseCalDate(timeStr) {
    if (!timeStr) return 99999;
    var parts = timeStr.trim().split(' ');
    var dateParts = parts[0].split('/');
    var month = parseInt(dateParts[0]) || 0;
    var day = parseInt(dateParts[1]) || 0;
    var timeParts = (parts[1] || '00:00').split(':');
    var hour = parseInt(timeParts[0]) || 0;
    var min = parseInt(timeParts[1]) || 0;
    return month * 100000 + day * 1000 + hour * 60 + min;
  }

  var calendarColors = {
    'Home': '#3478f6', 'Family': '#34c759', 'Work': '#ff9500', 'Freelance': '#ff9500',
    'US Holidays': '#8e8e93', 'Birthdays': '#af52de', 'Scheduled Reminders': '#ff3b30', 'Siri Suggestions': '#5ac8fa'
  };

  function getCalColor(calName) {
    return calName ? (calendarColors[calName] || '#555') : '#555';
  }

  DASH.renderCalendar = function(events, targetId) {
    var el = document.getElementById(targetId);
    el.innerHTML = '';
    if (!events || events.length === 0) {
      el.innerHTML = '<div class="empty-state">No upcoming events.</div>';
      return;
    }
    var sorted = events.slice().sort(function(a, b) { return parseCalDate(a.time) - parseCalDate(b.time); });
    sorted.forEach(function(ev) {
      var div = document.createElement('div');
      div.className = 'cal-row';
      var dotColor = getCalColor(ev.calendar);
      div.innerHTML =
        '<span class="cal-dot" style="background:' + dotColor + ';" title="' + (ev.calendar || '') + '"></span>' +
        '<span class="cal-name">' + ev.name + '</span>' +
        '<span class="cal-time">' + ev.time + '</span>';
      el.appendChild(div);
    });
  };

  // --- Weather ---
  DASH.renderWeather = function(data) {
    if (data && data.summary) {
      var el = document.getElementById('top-weather');
      el._baseText = data.summary;
      el.textContent = data.summary;
    }
  };
})();
