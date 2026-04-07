// studio.js — Image studio: pan/zoom, PIP references, hero image, tools
// Attaches to DASH namespace from core.js

(function() {
  'use strict';

  // --- Pan/Zoom State ---
  var zoomState = { scale: 1, x: 0, y: 0, isDragging: false, startX: 0, startY: 0 };
  var viewport = document.getElementById('studio-viewport');
  var heroImg = document.getElementById('studio-hero-img');
  var heroWrap = document.getElementById('studio-hero-wrap');
  var currentStudioImage = null;
  var currentStudioData = null;
  var spacePressed = false;
  var exportDirectory = '';

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

  // Wheel zoom
  viewport.addEventListener('wheel', function(e) {
    if (!currentStudioImage) return;
    e.preventDefault();
    zoomState.scale = Math.max(0.5, Math.min(zoomState.scale + e.deltaY * -0.005, 15));
    updateTransform();
  });

  // Double-click fullscreen
  viewport.addEventListener('dblclick', function() {
    if (!currentStudioImage) return;
    viewport.classList.toggle('fullscreen');
    resetZoom();
  });

  // Space+drag panning
  window.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && currentStudioImage) {
      if (e.target.tagName === 'INPUT') return;
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
      e.preventDefault();
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
  var activeRefs = {};
  var refCounter = 0;
  var activeDragRef = null;
  var refDragOffset = { x: 0, y: 0 };

  function createRefPIP(src, title) {
    var id = 'ref-' + (++refCounter);
    var label = title || ('Reference ' + refCounter);
    var offsetX = 20 + ((refCounter - 1) % 4) * 30;
    var offsetY = 20 + ((refCounter - 1) % 4) * 30;

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

    var chip = document.createElement('div');
    chip.className = 'ref-tray-chip';
    chip.dataset.ref = id;
    chip.style.cssText = 'display:none; background:#222; border:1px solid #444; border-radius:4px; padding:3px 8px; font-family:var(--font-b); font-size:9px; color:var(--accent); cursor:pointer; pointer-events:auto; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; user-select:none;';
    chip.textContent = '📌 ' + label;
    chip.title = 'Click to restore: ' + label;
    refTray.appendChild(chip);

    activeRefs[id] = { el: win, trayEl: chip, minimized: false, src: src, title: label };

    win.querySelector('.ref-min-btn').addEventListener('click', function(e) { e.stopPropagation(); minimizeRef(id); });
    win.querySelector('.ref-close-btn').addEventListener('click', function(e) { e.stopPropagation(); closeRef(id); });
    chip.addEventListener('click', function() { restoreRef(id); });
    win.addEventListener('mousedown', function(e) {
      if (e.target.tagName === 'BUTTON') return;
      activeDragRef = id;
      win.style.cursor = 'grabbing';
      var rect = win.getBoundingClientRect();
      refDragOffset.x = e.clientX - rect.left;
      refDragOffset.y = e.clientY - rect.top;
      Object.keys(activeRefs).forEach(function(k) { if (activeRefs[k].el) activeRefs[k].el.style.zIndex = '1'; });
      win.style.zIndex = '10';
    });
    return id;
  }

  function minimizeRef(id) { var r = activeRefs[id]; if (!r) return; r.el.style.display = 'none'; r.trayEl.style.display = 'block'; r.minimized = true; }
  function restoreRef(id) { var r = activeRefs[id]; if (!r) return; r.el.style.display = 'block'; r.trayEl.style.display = 'none'; r.minimized = false; }
  function closeRef(id) { var r = activeRefs[id]; if (!r) return; if (r.el) r.el.remove(); if (r.trayEl) r.trayEl.remove(); delete activeRefs[id]; }

  // Global PIP drag
  window.addEventListener('mousemove', function(e) {
    if (!activeDragRef) return;
    var ref = activeRefs[activeDragRef];
    if (!ref) return;
    var parentRect = viewport.getBoundingClientRect();
    ref.el.style.left = (e.clientX - parentRect.left - refDragOffset.x) + 'px';
    ref.el.style.top = (e.clientY - parentRect.top - refDragOffset.y) + 'px';
  });
  window.addEventListener('mouseup', function() {
    if (activeDragRef && activeRefs[activeDragRef]) activeRefs[activeDragRef].el.style.cursor = 'grab';
    activeDragRef = null;
  });

  // --- Hero & Rendering ---
  function setHero(data) {
    currentStudioData = data;
    currentStudioImage = data.src;
    heroImg.src = data.src;
    heroWrap.style.display = 'inline-block';
    document.getElementById('studio-empty').style.display = 'none';
    var isUpscaled = (data.model && data.model.includes('[UPSCALED]')) || data.src.includes('_upscaled');
    document.getElementById('studio-upscale-badge').style.display = isUpscaled ? 'block' : 'none';
    resetZoom();
    document.getElementById('studio-metadata').innerHTML =
      '<strong>Size:</strong> ' + (data.size || 'Unknown') + '<br>' +
      '<strong>Aspect:</strong> ' + (data.aspect || '16:9') + '<br>' +
      '<strong>Model:</strong> <span style="color:var(--t1)">' + (data.model || 'Unknown Defaults') + '</span><br>' +
      '<br><strong>Prompt:</strong><br><span style="color:var(--t1)">' + (data.prompt || 'No description') + '</span>';
  }

  DASH.renderStudio = function(msg) {
    if (msg.type === 'close_reference') { Object.keys(activeRefs).forEach(function(id) { closeRef(id); }); return; }
    if (msg.type === 'reference') { createRefPIP(msg.src, msg.title || null); return; }
    if (msg.hero) { setHero(msg.hero); DASH.switchScene('studio'); }
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
  };

  // --- Tool Buttons ---
  document.getElementById('studio-upscale-btn').addEventListener('click', function() {
    if (!currentStudioImage) return;
    var sourcePath = currentStudioImage.replace('/data/', '');
    document.getElementById('studio-status').textContent = 'Upscaling locally...';
    fetch('/api/studio/upscale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: sourcePath }) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          document.getElementById('studio-status').textContent = 'Upscale Complete!';
          var newData = Object.assign({}, currentStudioData);
          newData.src = data.newSrc; newData.size = data.newSize;
          newData.model = (newData.model || 'Unknown') + ' [UPSCALED]';
          setHero(newData);
          var galleryEl = document.getElementById('studio-gallery');
          var wrap = document.createElement('div'); wrap.className = 'thumb-wrap';
          wrap.innerHTML = '<img src="' + newData.src + '" />'; wrap.onclick = function() { setHero(newData); };
          galleryEl.insertBefore(wrap, galleryEl.firstChild);
          setTimeout(function() { document.getElementById('studio-status').textContent = ''; }, 3000);
        } else { document.getElementById('studio-status').textContent = 'Error: ' + data.error; }
      })
      .catch(function(e) { document.getElementById('studio-status').textContent = 'Error: ' + e.message; });
  });

  document.getElementById('studio-choose-dir-btn').addEventListener('click', function() {
    document.getElementById('studio-status').textContent = 'Opening dialog...';
    fetch('/api/studio/choose-dir').then(function(r) { return r.json(); }).then(function(data) {
      if (data.path) {
        exportDirectory = data.path;
        document.getElementById('studio-export-path-display').textContent = exportDirectory;
        document.getElementById('studio-status').textContent = '';
      } else {
        document.getElementById('studio-status').textContent = 'Canceled.';
        setTimeout(function() { document.getElementById('studio-status').textContent = ''; }, 2000);
      }
    }).catch(function(e) { document.getElementById('studio-status').textContent = 'Error: ' + e.message; });
  });

  document.getElementById('studio-download-btn').addEventListener('click', function() {
    if (!exportDirectory) { document.getElementById('studio-status').textContent = 'Please choose a directory first.'; document.getElementById('studio-choose-dir-btn').click(); return; }
    if (!currentStudioImage) { document.getElementById('studio-status').textContent = 'No image to save.'; return; }
    var sourcePath = currentStudioImage.replace('/data/', '');
    document.getElementById('studio-status').textContent = 'Saving...';
    fetch('/api/studio/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: sourcePath, destDir: exportDirectory }) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) { document.getElementById('studio-status').textContent = 'Saved!'; setTimeout(function() { document.getElementById('studio-status').textContent = ''; }, 3000); }
        else { document.getElementById('studio-status').textContent = 'Error: ' + data.error; }
      })
      .catch(function(e) { document.getElementById('studio-status').textContent = 'Error: ' + e.message; });
  });

  // Expose for state restore
  DASH._studioSetHero = setHero;
  DASH._studioCreateRefPIP = createRefPIP;
})();
