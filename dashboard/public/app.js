(function () {
  'use strict';

  // --- Clock & Date ---
  function updateClock() {
    var now = new Date();
    var h = now.getHours().toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    var s = now.getSeconds().toString().padStart(2, '0');
    document.getElementById('clock').textContent = h + ':' + m + ':' + s;
  }

  function updateDate() {
    var now = new Date();
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var full = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('top-date').textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();
    document.getElementById('focus-date').textContent = full[now.getDay()] + ', ' + fullMonths[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  }

  // --- Scene Switching ---
  function switchScene(name) {
    document.querySelectorAll('.scene').forEach(function (s) {
      s.classList.toggle('active', s.id === 'scene-' + name);
    });
    document.querySelectorAll('.rail-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.scene === name);
    });
  }

  document.querySelectorAll('.rail-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchScene(this.dataset.scene); });
  });

  // --- Focus / Whiteboard ---
  function renderFocus(items) {
    var el = document.getElementById('focus-items');
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="empty-state">No focus items. Tell me what you\'re working on.</div>';
      return;
    }
    items.forEach(function (item) {
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
  }

  // --- Email ---
  function renderEmail(emails, targetId) {
    var el = document.getElementById(targetId);
    el.innerHTML = '';
    if (!emails || emails.length === 0) {
      el.innerHTML = '<div class="empty-state">No emails.</div>';
      return;
    }
    emails.forEach(function (e) {
      var div = document.createElement('div');
      div.className = 'email-row';
      div.innerHTML =
        '<div class="email-subject ' + (e.unread ? 'unread' : '') + '">' + e.subject + '</div>' +
        '<div class="email-sender">' + e.sender + ' · <span class="email-date">' + e.date + '</span></div>';
      el.appendChild(div);
    });
  }

  // --- Calendar ---
  function renderCalendar(events, targetId) {
    var el = document.getElementById(targetId);
    el.innerHTML = '';
    if (!events || events.length === 0) {
      el.innerHTML = '<div class="empty-state">No events today.</div>';
      return;
    }
    events.forEach(function (ev) {
      var div = document.createElement('div');
      div.className = 'cal-row';
      div.innerHTML =
        '<span class="cal-name">' + ev.name + '</span>' +
        '<span class="cal-time">' + ev.time + '</span>';
      el.appendChild(div);
    });
  }

  // --- Weather ---
  function renderWeather(data) {
    if (data && data.summary) {
      document.getElementById('top-weather').textContent = data.summary;
    }
  }

  // --- Studio Pan/Zoom ---
  var zoomState = { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 };
  var viewport = document.getElementById('studio-viewport');
  var heroImg = document.getElementById('studio-hero-img');
  var heroWrap = document.getElementById('studio-hero-wrap');

  function updateTransform() {
    var cw = heroImg.clientWidth || 0;
    var ch = heroImg.clientHeight || 0;
    var boundX = (viewport.clientWidth / 2) + ((cw * zoomState.scale) / 2);
    var boundY = (viewport.clientHeight / 2) + ((ch * zoomState.scale) / 2);
    
    if (boundX > 100) zoomState.x = Math.max(-boundX + 100, Math.min(zoomState.x, boundX - 100));
    if (boundY > 100) zoomState.y = Math.max(-boundY + 100, Math.min(zoomState.y, boundY - 100));
    
    heroWrap.style.transform = 'translate(' + zoomState.x + 'px, ' + zoomState.y + 'px) scale(' + zoomState.scale + ')';
  }
  function resetZoom() {
    zoomState = { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 };
    heroWrap.style.transform = 'translate(0px, 0px) scale(1)';
  }

  viewport.addEventListener('wheel', function(e) {
    if (!currentStudioImage) return;
    e.preventDefault();
    var delta = e.deltaY * -0.005;
    zoomState.scale = Math.max(0.5, Math.min(zoomState.scale + delta, 15));
    updateTransform();
  });
  
  viewport.addEventListener('dblclick', function(e) {
    if (!currentStudioImage) return;
    viewport.classList.toggle('fullscreen');
    resetZoom(); // Reset pan/zoom on toggle to re-center
  });

  var spacePressed = false;
  window.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && currentStudioImage) {
      if(e.target.tagName === 'INPUT') return;
      e.preventDefault();
      spacePressed = true;
      viewport.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', function(e) {
    if (e.code === 'Space') {
      spacePressed = false;
      viewport.style.cursor = 'default';
      zoomState.isDragging = false;
    }
  });
  viewport.addEventListener('mousedown', function(e) {
    if (spacePressed && currentStudioImage) {
      e.preventDefault(); // Prevents native browser ghost-dragging
      zoomState.isDragging = true;
      viewport.style.cursor = 'grabbing';
      zoomState.startX = e.clientX - zoomState.x;
      zoomState.startY = e.clientY - zoomState.y;
    }
  });
  window.addEventListener('mousemove', function(e) {
    if (zoomState.isDragging) {
      zoomState.x = e.clientX - zoomState.startX;
      zoomState.y = e.clientY - zoomState.startY;
      updateTransform();
    }
  });
  window.addEventListener('mouseup', function() {
    if (zoomState.isDragging) {
      zoomState.isDragging = false;
      if (spacePressed) viewport.style.cursor = 'grab';
    }
  });

  // === Multi-Reference PIP System ===
  var refContainer = document.getElementById('studio-ref-container');
  var refTray = document.getElementById('studio-ref-tray');
  var activeRefs = {}; // id -> { el, trayEl, minimized }
  var refCounter = 0;
  var activeDragRef = null;
  var refDragOffset = { x: 0, y: 0 };

  function createRefPIP(src, title) {
    var id = 'ref-' + (++refCounter);
    var label = title || ('Reference ' + refCounter);
    // Position each new PIP offset from the last
    var offsetX = 20 + ((refCounter - 1) % 4) * 30;
    var offsetY = 20 + ((refCounter - 1) % 4) * 30;

    // Build PIP window
    var win = document.createElement('div');
    win.id = id;
    win.className = 'ref-pip-window';
    win.style.cssText = 'position:absolute; top:' + offsetY + 'px; left:' + offsetX + 'px; width:280px; height:auto; background:#111; border:1px solid #333; border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.8); cursor:grab; overflow:hidden; pointer-events:auto; transition:opacity 0.15s;';
    win.innerHTML = '<div style="background:#222; padding:5px 10px; font-family:var(--font-b); font-size:9px; color:var(--t1); display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; gap:6px; user-select:none;">'
      + '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="' + label.replace(/"/g, '&quot;') + '">' + label + '</span>'
      + '<div style="display:flex; gap:4px; flex-shrink:0;">'
      + '<button class="ref-min-btn" data-ref="' + id + '" style="background:transparent; border:none; color:var(--accent); cursor:pointer; font-size:11px; line-height:1;" title="Minimize">▁</button>'
      + '<button class="ref-close-btn" data-ref="' + id + '" style="background:transparent; border:none; color:var(--t2); cursor:pointer; font-size:11px; line-height:1;" title="Close">✕</button>'
      + '</div></div>'
      + '<img src="' + src + '" style="display:block; width:100%; height:auto; pointer-events:none; -webkit-user-drag:none;" />';
    refContainer.appendChild(win);

    // Build tray chip (minimized state)
    var chip = document.createElement('div');
    chip.className = 'ref-tray-chip';
    chip.dataset.ref = id;
    chip.style.cssText = 'display:none; background:#222; border:1px solid #444; border-radius:4px; padding:3px 8px; font-family:var(--font-b); font-size:9px; color:var(--accent); cursor:pointer; pointer-events:auto; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; user-select:none;';
    chip.textContent = '📌 ' + label;
    chip.title = 'Click to restore: ' + label;
    refTray.appendChild(chip);

    // Store state
    activeRefs[id] = { el: win, trayEl: chip, minimized: false, src: src, title: label };

    // Event: minimize
    win.querySelector('.ref-min-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      minimizeRef(id);
    });

    // Event: close
    win.querySelector('.ref-close-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      closeRef(id);
    });

    // Event: restore from tray
    chip.addEventListener('click', function() {
      restoreRef(id);
    });

    // Event: drag start
    win.addEventListener('mousedown', function(e) {
      if (e.target.tagName === 'BUTTON') return;
      activeDragRef = id;
      win.style.cursor = 'grabbing';
      var rect = win.getBoundingClientRect();
      refDragOffset.x = e.clientX - rect.left;
      refDragOffset.y = e.clientY - rect.top;
      // Bring to front
      Object.keys(activeRefs).forEach(function(k) { if(activeRefs[k].el) activeRefs[k].el.style.zIndex = '1'; });
      win.style.zIndex = '10';
    });

    return id;
  }

  function minimizeRef(id) {
    var ref = activeRefs[id];
    if (!ref) return;
    ref.el.style.display = 'none';
    ref.trayEl.style.display = 'block';
    ref.minimized = true;
  }

  function restoreRef(id) {
    var ref = activeRefs[id];
    if (!ref) return;
    ref.el.style.display = 'block';
    ref.trayEl.style.display = 'none';
    ref.minimized = false;
  }

  function closeRef(id) {
    var ref = activeRefs[id];
    if (!ref) return;
    if (ref.el) ref.el.remove();
    if (ref.trayEl) ref.trayEl.remove();
    delete activeRefs[id];
  }

  // Global drag handlers for all PIPs
  window.addEventListener('mousemove', function(e) {
    if (!activeDragRef) return;
    var ref = activeRefs[activeDragRef];
    if (!ref) return;
    var parentRect = viewport.getBoundingClientRect();
    var newX = e.clientX - parentRect.left - refDragOffset.x;
    var newY = e.clientY - parentRect.top - refDragOffset.y;
    ref.el.style.left = newX + 'px';
    ref.el.style.top = newY + 'px';
  });

  window.addEventListener('mouseup', function() {
    if (activeDragRef && activeRefs[activeDragRef]) {
      activeRefs[activeDragRef].el.style.cursor = 'grab';
    }
    activeDragRef = null;
  });

  // --- Studio Rendering ---
  var currentStudioImage = null; // Just the URL string
  var currentStudioData = null; // Full object

  function setHero(data) {
    currentStudioData = data;
    currentStudioImage = data.src;
    heroImg.src = data.src;
    heroWrap.style.display = 'inline-block';
    document.getElementById('studio-empty').style.display = 'none';
    
    // Toggle Upscaled Overlay
    var isUpscaled = (data.model && data.model.includes('[UPSCALED]')) || data.src.includes('_upscaled');
    document.getElementById('studio-upscale-badge').style.display = isUpscaled ? 'block' : 'none';
    
    resetZoom();
    
    // Set metadata
    var metaHtml = '<strong>Size:</strong> ' + (data.size || 'Unknown') + '<br>' +
                   '<strong>Aspect:</strong> ' + (data.aspect || '16:9') + '<br>' +
                   '<strong>Model:</strong> <span style="color:var(--t1)">' + (data.model || 'Unknown Defaults') + '</span><br>' +
                   '<br><strong>Prompt:</strong><br><span style="color:var(--t1)">' + (data.prompt || 'No description') + '</span>';
    document.getElementById('studio-metadata').innerHTML = metaHtml;
  }

  function renderStudio(msg) {
    if (msg.type === 'close_reference') {
      // Close all references
      Object.keys(activeRefs).forEach(function(id) { closeRef(id); });
      return;
    }

    if (msg.type === 'reference') {
      createRefPIP(msg.src, msg.title || null);
      return; 
    }

    if (msg.hero) {
      setHero(msg.hero);
      switchScene('studio');
    }
    if (msg.gallery) {
      var galleryEl = document.getElementById('studio-gallery');
      galleryEl.innerHTML = '';
      msg.gallery.forEach(function(item) {
        var wrap = document.createElement('div');
        wrap.className = 'thumb-wrap';
        wrap.innerHTML = '<img src="' + item.src + '" />';
        wrap.onclick = function() { setHero(item); };
        galleryEl.appendChild(wrap);
      });
    }
  }

  // Handle Export
  var exportDirectory = '';
  // Handle Upscale
  document.getElementById('studio-upscale-btn').addEventListener('click', function() {
    if (!currentStudioImage) return;
    var sourcePath = currentStudioImage.replace('/data/', '');
    document.getElementById('studio-status').textContent = 'Upscaling locally...';
    
    fetch('/api/studio/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourcePath })
    })
    .then(r => r.json())
    .then(data => {
        if (data.ok) {
           document.getElementById('studio-status').textContent = 'Upscale Complete!';
           
           // Synthesize new data object based on current + upscaled mods
           var newData = Object.assign({}, currentStudioData);
           newData.src = data.newSrc;
           newData.size = data.newSize;
           newData.model = (newData.model || 'Unknown') + ' [UPSCALED]';
           
           // Swap hero image immediately to the high-res one
           setHero(newData);
           
           // Append to front of gallery UI dynamically
           var galleryEl = document.getElementById('studio-gallery');
           var wrap = document.createElement('div');
           wrap.className = 'thumb-wrap';
           wrap.innerHTML = '<img src="' + newData.src + '" />';
           wrap.onclick = function() { setHero(newData); };
           galleryEl.insertBefore(wrap, galleryEl.firstChild);
           
           setTimeout(function() { document.getElementById('studio-status').textContent = ''; }, 3000);
        } else {
           document.getElementById('studio-status').textContent = 'Error: ' + data.error;
        }
    })
    .catch(e => {
        document.getElementById('studio-status').textContent = 'Error: ' + e.message;
    });
  });

  document.getElementById('studio-choose-dir-btn').addEventListener('click', function() {
    document.getElementById('studio-status').textContent = 'Opening dialog...';
    fetch('/api/studio/choose-dir')
      .then(r => r.json())
      .then(data => {
        if (data.path) {
          exportDirectory = data.path;
          document.getElementById('studio-export-path-display').textContent = exportDirectory;
          document.getElementById('studio-status').textContent = '';
        } else {
          document.getElementById('studio-status').textContent = 'Canceled.';
          setTimeout(function() { document.getElementById('studio-status').textContent = ''; }, 2000);
        }
      })
      .catch(e => {
        document.getElementById('studio-status').textContent = 'Error: ' + e.message;
      });
  });

  document.getElementById('studio-download-btn').addEventListener('click', function() {
    if (!exportDirectory) {
      // If none selected, trigger the choose dialog first.
      document.getElementById('studio-status').textContent = 'Please choose a directory first.';
      document.getElementById('studio-choose-dir-btn').click();
      return;
    }
    if (!currentStudioImage) {
      document.getElementById('studio-status').textContent = 'No image to save.';
      return;
    }
    
    var sourcePath = currentStudioImage.replace('/data/', '');
    document.getElementById('studio-status').textContent = 'Saving...';
    
    fetch('/api/studio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourcePath, destDir: exportDirectory })
    })
    .then(r => r.json())
    .then(data => {
        if (data.ok) {
           document.getElementById('studio-status').textContent = 'Saved!';
           setTimeout(function() { document.getElementById('studio-status').textContent = ''; }, 3000);
        } else {
           document.getElementById('studio-status').textContent = 'Error: ' + data.error;
        }
    })
    .catch(e => {
        document.getElementById('studio-status').textContent = 'Error: ' + e.message;
    });
  });

  // --- Feed ---
  function addFeedItem(text, type) {
    var feed = document.getElementById('feed-content');
    var item = document.createElement('div');
    item.className = 'feed-item type-' + (type || 'info');
    var now = new Date();
    var time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    item.innerHTML = '<span class="feed-time">' + time + '</span> <span class="feed-text">' + text + '</span>';
    feed.insertBefore(item, feed.firstChild);
    while (feed.children.length > 30) feed.removeChild(feed.lastChild);
  }

  // --- WebSocket ---
  var ws, reconnectTimer;
  function connectWS() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host);

    ws.onopen = function () {
      document.getElementById('status-dot').classList.add('live');
      document.getElementById('status-label').textContent = 'Live';
    };
    ws.onclose = function () {
      document.getElementById('status-dot').classList.remove('live');
      document.getElementById('status-label').textContent = 'Reconnecting';
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWS, 3000);
    };
    ws.onerror = function () { ws.close(); };

    ws.onmessage = function (e) {
      try {
        var msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'message':
            addFeedItem(msg.text, msg.style);
            break;
          case 'scene':
            switchScene(msg.scene);
            break;
          case 'focus':
            renderFocus(msg.items);
            break;
          case 'email':
            renderEmail(msg.emails, 'email-content');
            if (msg.emails.length > 5) renderEmail(msg.emails, 'mail-full-content');
            break;
          case 'calendar':
            renderCalendar(msg.events, 'calendar-content');
            renderCalendar(msg.events, 'calendar-full-content');
            break;
          case 'weather':
            renderWeather(msg.data);
            break;
          case 'mail-full':
            renderEmail(msg.emails, 'mail-full-content');
            break;
          case 'studio':
          case 'reference':
          case 'close_reference':
            renderStudio(msg);
            break;
        }
      } catch (err) {
        addFeedItem(e.data, 'info');
      }
    };
  }

  // --- Init ---
  updateClock();
  updateDate();
  setInterval(updateClock, 1000);
  connectWS();
  
  // FETCH ACTIVE PERSISTENT STATE ON BOOT
  fetch('/api/state')
    .then(r => r.json())
    .then(state => {
      if (state && state.type) {
        // Re-inject the main layout
        var dummyEvent = { data: JSON.stringify(state) };
        ws.onmessage(dummyEvent);

        // Restore references (supports both legacy single and new multi format)
        if (state.references && state.references.length) {
          state.references.forEach(function(ref) {
            var refEvent = { data: JSON.stringify({ type: 'reference', src: ref.src, title: ref.title }) };
            ws.onmessage(refEvent);
          });
        } else if (state.referenceActive && state.referenceSrc) {
           var refEvent = { data: JSON.stringify({ type: 'reference', src: state.referenceSrc }) };
           ws.onmessage(refEvent);
        }
      }
    })
    .catch(e => console.error("Could not fetch dashboard state:", e));

  addFeedItem('<strong>Session started.</strong> All systems online.', 'success');
})();
