// tv.js — TV Scene: Multi-page live stream viewer
// Features: YouTube IFrame API mute/unmute, fullscreen, click-to-audio, LIVE badge
// API-driven so System can control it via POST /api/tv
(function() {
  'use strict';

  // ─── CHANNEL PRESETS ───
  var PAGES = {
    featured: {
      label: 'Featured',
      layout: 'featured',
      streams: [
        { id: 'jfKfPfyJRdk', label: 'Lofi Girl', region: 'MUSIC' },
        { id: 'gCNeDWCI0vo', label: 'Al Jazeera English', region: 'QATAR' },
        { id: 'Ap-UM1O9RBU', label: 'France 24', region: 'FR' },
        { id: 'aTd8pZMunbY', label: 'Deep Ocean 24/7', region: 'NATURE' },
      ]
    },
    news: {
      label: 'News',
      layout: 'grid',
      streams: [
        { id: 'gCNeDWCI0vo', label: 'Al Jazeera', region: 'QATAR' },
        { id: 'YDvsBbKfLPA', label: 'Sky News', region: 'UK' },
        { id: 'Ap-UM1O9RBU', label: 'France 24', region: 'FR' },
        { id: 'LuKwFajn37U', label: 'DW News', region: 'DE' },
        { id: 'BOy2xDU1LC8', label: 'CGTN', region: 'CHINA' },
        { id: 'f0lYkdA-Gtw', label: 'NHK World', region: 'JAPAN' },
        { id: 'vOTiJkg1voo', label: 'ABC News', region: 'AUS' },
        { id: '1VUhRQpz_9o', label: 'TRT World', region: 'TR' },
        { id: 'GzIGQs7dkos', label: 'WION', region: 'INDIA' },
      ]
    },
    entertainment: {
      label: 'Music',
      layout: 'featured',
      streams: [
        { id: 'jfKfPfyJRdk', label: 'Lofi Hip Hop', region: 'BEATS' },
        { id: 'HuFYqnbVbzY', label: 'Jazz Lofi', region: 'JAZZ' },
        { id: 'Dx5qFachd3A', label: 'Jazz Piano Radio', region: 'PIANO' },
        { id: '5yx6BWlEVcY', label: 'Chillhop Radio', region: 'CHILL' },
      ]
    },
    movies: {
      label: 'Movies',
      layout: 'featured',
      streams: [
        { id: '4wihbYopspQ', label: 'Pursued (2025)', region: 'THRILLER' },
        { id: '2ae1CRBeFQw', label: 'Dirty Money', region: 'ACTION' },
        { id: 'y9dedKC3DqQ', label: 'Last Warning', region: 'ACTION' },
        { id: '_OI41jga4dg', label: 'One Last Job', region: 'THRILLER' },
      ]
    },
    livecams: {
      label: 'Live Cams',
      layout: 'grid',
      streams: [
        { id: '1-iS7LArMPA', label: 'Times Square', region: 'NYC' },
        { id: 'psfFJR3vZ78', label: 'Jackson Hole', region: 'WY' },
        { id: '3n3Hq7XSBEg', label: 'Shibuya Crossing', region: 'TOKYO' },
        { id: 'EjlEtOBwJLs', label: 'Monterey Aquarium', region: 'CA' },
        { id: 'DHUnz4dyb54', label: 'Tropical Reef Cam', region: 'OCEAN' },
        { id: 'aTd8pZMunbY', label: 'Deep Ocean 24/7', region: 'OCEAN' },
        { id: '4NoTsBpE68k', label: 'ISS Earth View', region: 'NASA' },
        { id: 'tZzkTRoct40', label: 'ISS Real-Time', region: 'NASA' },
        { id: 'N609loYkFJo', label: 'Bird Feeder', region: 'CORNELL' },
      ]
    },
    space: {
      label: 'Space',
      layout: 'featured',
      streams: [
        { id: '4NoTsBpE68k', label: 'ISS HD Earth', region: 'NASA' },
        { id: 'tZzkTRoct40', label: 'ISS Real-Time', region: 'NASA' },
        { id: 'vytmBNhc9ig', label: 'ISS 24/7', region: 'NASA' },
        { id: 'mhJRzQsLZGg', label: 'SpaceX Starbase', region: 'TX' },
      ]
    }
  };

  var currentPage = 'featured';
  var activeIndex = -1;
  var players = [];
  var playersReady = [];
  var ytApiReady = false;
  var pendingRender = null;

  // ─── DOM ───
  var container = document.querySelector('#scene-tv .tv-stream-area');
  var tabsWrap = document.querySelector('#scene-tv .tv-page-tabs');
  var nowTitle = document.getElementById('tv-now-title');
  var nowDot = document.getElementById('tv-now-dot');
  var nowPage = document.getElementById('tv-now-page');

  // ─── UTILS ───
  function updateBadge(i, live) {
    var b = document.getElementById('tv-badge-' + i);
    if (!b) return;
    if (live) {
      b.innerHTML = '🔊 LIVE';
      b.classList.add('tv-badge-live');
      b.classList.remove('tv-badge-muted');
    } else {
      b.innerHTML = '🔇 MUTED';
      b.classList.remove('tv-badge-live');
      b.classList.add('tv-badge-muted');
    }
  }

  function destroyPlayers() {
    for (var i = 0; i < players.length; i++) {
      if (players[i] && typeof players[i].destroy === 'function') {
        try { players[i].destroy(); } catch (e) {}
      }
    }
    players = [];
    playersReady = [];
    activeIndex = -1;
  }

  // ─── SELECT CELL (mute/unmute toggle) ───
  function selectCell(index) {
    var page = PAGES[currentPage];
    if (!page || !page.streams[index]) return;

    // If clicking the already-active cell → mute it
    if (activeIndex === index) {
      if (players[index] && playersReady[index]) {
        try { players[index].mute(); } catch (e) {}
      }
      var cell = document.getElementById('tv-cell-' + index);
      if (cell) cell.classList.remove('tv-cell-active');
      updateBadge(index, false);
      activeIndex = -1;
      if (nowTitle) nowTitle.textContent = '—';
      if (nowDot) nowDot.classList.add('off');
      return;
    }

    // Mute all first
    muteAll();

    // Unmute selected
    activeIndex = index;
    if (players[index] && playersReady[index]) {
      try { players[index].unMute(); players[index].setVolume(100); } catch (e) {}
    }
    var selCell = document.getElementById('tv-cell-' + index);
    if (selCell) selCell.classList.add('tv-cell-active');
    updateBadge(index, true);

    if (nowTitle) nowTitle.textContent = page.streams[index].label || 'Stream ' + index;
    if (nowDot) nowDot.classList.remove('off');
  }

  function muteAll() {
    var page = PAGES[currentPage];
    if (!page) return;
    for (var i = 0; i < page.streams.length; i++) {
      if (players[i] && playersReady[i]) {
        try { players[i].mute(); } catch (e) {}
      }
      var c = document.getElementById('tv-cell-' + i);
      if (c) c.classList.remove('tv-cell-active');
      updateBadge(i, false);
    }
    activeIndex = -1;
  }

  // ─── FULLSCREEN ───
  function fullscreenCell(index) {
    var cell = document.getElementById('tv-cell-' + index);
    if (!cell) return;
    if (document.fullscreenElement === cell) {
      document.exitFullscreen();
      return;
    }
    var fn = cell.requestFullscreen || cell.webkitRequestFullscreen;
    if (fn) fn.call(cell);
  }

  // ─── SWAP TO FEATURED (click small → make big) ───
  function promoteToFeatured(index) {
    var page = PAGES[currentPage];
    if (!page || page.layout !== 'featured' || index === 0) return;
    var tmp = page.streams[0];
    page.streams[0] = page.streams[index];
    page.streams[index] = tmp;
    renderPage(currentPage);
  }

  // ─── BUILD CELL ───
  function makeCell(stream, idx) {
    var cell = document.createElement('div');
    cell.className = 'tv-cell';
    cell.id = 'tv-cell-' + idx;

    var ytId = stream.id && /^[\w-]{11}$/.test(stream.id) ? stream.id : null;
    if (!ytId) {
      cell.innerHTML = '<div class="tv-empty"><div class="tv-empty-icon">📡</div></div>';
      return cell;
    }

    // Region badge
    var regionTag = stream.region
      ? '<span class="tv-cell-region">' + stream.region + '</span>'
      : '';

    // Player container (YT API will inject here)
    var playerDiv = '<div id="tv-player-' + idx + '" class="tv-player-mount"></div>';

    // Click overlay — intercepts clicks on the iframe
    var clickOverlay = '<div class="tv-click-overlay" data-idx="' + idx + '"></div>';

    // Label
    var label = '<span class="tv-cell-label">' + (stream.label || '') + '</span>';

    // LIVE badge (green pulsing dot)
    var liveBadge = '<span class="tv-live-badge"><span class="tv-live-dot-green"></span>LIVE</span>';

    // Audio badge (muted/live state)
    var audioBadge = '<span class="tv-audio-badge tv-badge-muted" id="tv-badge-' + idx + '">🔇 MUTED</span>';

    // Cell controls (hover to reveal)
    var controls = '<div class="tv-cell-controls">' +
      '<button class="tv-ctrl-btn" data-action="fullscreen" data-idx="' + idx + '" title="Fullscreen">⛶ Full</button>' +
      '</div>';

    cell.innerHTML = regionTag + playerDiv + clickOverlay + label + liveBadge + audioBadge + controls;

    return cell;
  }

  // ─── INIT YT PLAYER FOR CELL ───
  function initPlayer(idx, ytId) {
    if (!ytApiReady || !document.getElementById('tv-player-' + idx)) return;

    playersReady[idx] = false;
    players[idx] = new YT.Player('tv-player-' + idx, {
      videoId: ytId,
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1
      },
      events: {
        onReady: function() { playersReady[idx] = true; },
        onError: function() { playersReady[idx] = false; }
      }
    });
  }

  // ─── RENDER PAGE ───
  function renderPage(pageName) {
    var page = PAGES[pageName];
    if (!page || !container) return;

    destroyPlayers();
    currentPage = pageName;
    container.innerHTML = '';

    if (!page.streams || page.streams.length === 0) {
      container.innerHTML = '<div class="tv-empty"><div class="tv-empty-icon">📡</div><div class="tv-empty-text">No streams configured</div></div>';
      return;
    }

    if (page.layout === 'featured') {
      var wrap = document.createElement('div');
      wrap.className = 'tv-layout-featured';

      var main = makeCell(page.streams[0], 0);
      main.classList.add('tv-main-stream');
      wrap.appendChild(main);

      var side = document.createElement('div');
      side.className = 'tv-side-streams';
      for (var i = 1; i < Math.min(page.streams.length, 4); i++) {
        side.appendChild(makeCell(page.streams[i], i));
      }
      wrap.appendChild(side);
      container.appendChild(wrap);

      if (nowTitle) nowTitle.textContent = page.streams[0].label || '—';
      if (nowDot) nowDot.classList.add('off');
    } else {
      var grid = document.createElement('div');
      grid.className = 'tv-layout-grid';
      page.streams.forEach(function(s, i) {
        grid.appendChild(makeCell(s, i));
      });
      container.appendChild(grid);

      if (nowTitle) nowTitle.textContent = page.label + ' — ' + page.streams.length + ' streams';
      if (nowDot) nowDot.classList.add('off');
    }

    if (nowPage) nowPage.textContent = page.label;

    // Update tab active state
    if (tabsWrap) {
      tabsWrap.querySelectorAll('.tv-page-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.page === pageName);
      });
    }

    // Init YT players
    if (ytApiReady) {
      page.streams.forEach(function(stream, i) {
        if (stream.id && /^[\w-]{11}$/.test(stream.id)) {
          initPlayer(i, stream.id);
        }
      });
    } else {
      // YT API not ready yet — fall back to iframe embeds
      page.streams.forEach(function(stream, i) {
        var mount = document.getElementById('tv-player-' + i);
        if (mount && stream.id && /^[\w-]{11}$/.test(stream.id)) {
          mount.innerHTML = '<iframe src="https://www.youtube.com/embed/' + stream.id +
            '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1" ' +
            'allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>';
        }
      });
    }
  }

  // ─── EVENT DELEGATION ───
  if (container) {
    // Click overlay → toggle audio
    container.addEventListener('click', function(e) {
      var overlay = e.target.closest('.tv-click-overlay');
      if (overlay) {
        var idx = parseInt(overlay.dataset.idx, 10);
        if (!isNaN(idx)) selectCell(idx);
        return;
      }

      // Fullscreen button
      var ctrl = e.target.closest('.tv-ctrl-btn');
      if (ctrl) {
        e.stopPropagation();
        var action = ctrl.dataset.action;
        var ci = parseInt(ctrl.dataset.idx, 10);
        if (action === 'fullscreen' && !isNaN(ci)) fullscreenCell(ci);
        return;
      }
    });

    // Double-click overlay → promote to featured (swap big/small)
    container.addEventListener('dblclick', function(e) {
      var overlay = e.target.closest('.tv-click-overlay');
      if (overlay) {
        var idx = parseInt(overlay.dataset.idx, 10);
        if (!isNaN(idx)) promoteToFeatured(idx);
      }
    });
  }

  // ─── TAB CLICKS ───
  if (tabsWrap) {
    tabsWrap.addEventListener('click', function(e) {
      var btn = e.target.closest('.tv-page-tab');
      if (!btn) return;
      var page = btn.dataset.page;
      if (page && PAGES[page]) renderPage(page);
    });
  }

  // ─── YOUTUBE IFRAME API CALLBACK ───
  // Load the API
  var ytScript = document.createElement('script');
  ytScript.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(ytScript);

  // Global callback
  var origCallback = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function() {
    ytApiReady = true;
    if (origCallback) origCallback();
    // Re-render current page with proper YT.Player instances
    if (pendingRender) {
      renderPage(pendingRender);
      pendingRender = null;
    } else {
      renderPage(currentPage);
    }
  };

  // ─── API HANDLER (System controls via POST /api/tv) ───
  window.DASH = window.DASH || {};
  window.DASH.tvCommand = function(data) {
    if (!data || !data.action) return;
    switch (data.action) {
      case 'page':
        if (PAGES[data.page]) renderPage(data.page);
        break;
      case 'add':
        if (data.page && PAGES[data.page] && data.stream) {
          PAGES[data.page].streams.push(data.stream);
          if (currentPage === data.page) renderPage(currentPage);
        }
        break;
      case 'remove':
        if (data.page && PAGES[data.page] && data.id) {
          PAGES[data.page].streams = PAGES[data.page].streams.filter(function(s) { return s.id !== data.id; });
          if (currentPage === data.page) renderPage(currentPage);
        }
        break;
      case 'replace':
        if (data.page && PAGES[data.page] && data.streams) {
          PAGES[data.page].streams = data.streams;
          if (currentPage === data.page) renderPage(currentPage);
        }
        break;
      case 'mute':
        muteAll();
        break;
      case 'unmute':
        if (typeof data.index === 'number') selectCell(data.index);
        break;
      case 'fullscreen':
        if (typeof data.index === 'number') fullscreenCell(data.index);
        break;
    }
  };

  // ─── INIT ───
  // Show iframe fallback immediately, YT API will upgrade when ready
  pendingRender = 'featured';
  renderPage('featured');

})();
