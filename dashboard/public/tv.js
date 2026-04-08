// tv.js — TV Scene: Live streams, YouTube, world cams
// Attaches to DASH namespace from core.js

(function() {
  'use strict';

  // ── Channel Data ──
  // Each entry: { id, title, channel, cat[], thumb, src (embed URL), live?, viewers? }
  var CHANNELS = [
    // ── LIVE ──
    { id: 'iss', title: 'ISS Live — Earth from Space', channel: 'NASA', cat: ['live','space'],
      thumb: 'https://img.youtube.com/vi/P9C25Un7xaM/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/P9C25Un7xaM?autoplay=1&mute=1', live: true },
    { id: 'lofi', title: 'lofi hip hop radio — beats to relax/study to', channel: 'Lofi Girl', cat: ['live','music'],
      thumb: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1', live: true },
    { id: 'jazz', title: '24/7 Coffee Jazz — Relaxing Jazz Piano', channel: 'Cafe Music BGM', cat: ['live','music'],
      thumb: 'https://img.youtube.com/vi/fEvM-OUbaKs/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/fEvM-OUbaKs?autoplay=1&mute=1', live: true },
    { id: 'nyc', title: 'New York City — Times Square LIVE', channel: 'EarthCam', cat: ['live','nature'],
      thumb: 'https://img.youtube.com/vi/1-iS7LArMPA/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/1-iS7LArMPA?autoplay=1&mute=1', live: true },
    { id: 'jackson', title: 'Jackson Hole Town Square — Wyoming', channel: 'EarthCam', cat: ['live','nature'],
      thumb: 'https://img.youtube.com/vi/psfFJR3vZ78/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/psfFJR3vZ78?autoplay=1&mute=1', live: true },
    { id: 'tokyo', title: 'LIVE Tokyo Shibuya Scramble Crossing', channel: 'SHIBUYA COMMUNITY NEWS', cat: ['live','nature'],
      thumb: 'https://img.youtube.com/vi/3n3Hq7XSBEg/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/3n3Hq7XSBEg?autoplay=1&mute=1', live: true },

    // ── NEWS ──
    { id: 'sky', title: 'Sky News Live', channel: 'Sky News', cat: ['live','news'],
      thumb: 'https://img.youtube.com/vi/9Auq9mYxFEE/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/9Auq9mYxFEE?autoplay=1&mute=1', live: true },
    { id: 'abc', title: 'ABC News Live', channel: 'ABC News', cat: ['live','news'],
      thumb: 'https://img.youtube.com/vi/gCNeDWCI0vo/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1', live: true },
    { id: 'france24', title: 'France 24 English — Live', channel: 'France 24', cat: ['live','news'],
      thumb: 'https://img.youtube.com/vi/h3MuIUNCCzI/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/h3MuIUNCCzI?autoplay=1&mute=1', live: true },
    { id: 'dw', title: 'DW News Livestream', channel: 'DW News', cat: ['live','news'],
      thumb: 'https://img.youtube.com/vi/GE_SfNVNyqk/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/GE_SfNVNyqk?autoplay=1&mute=1', live: true },

    // ── SPACE ──
    { id: 'nasa-tv', title: 'NASA Live — Official Stream', channel: 'NASA', cat: ['live','space'],
      thumb: 'https://img.youtube.com/vi/21X5lGlDOfg/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1&mute=1', live: true },
    { id: 'spacex', title: 'SpaceX Starbase Live', channel: 'NASASpaceflight', cat: ['live','space'],
      thumb: 'https://img.youtube.com/vi/mhJRzQsLZGg/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/mhJRzQsLZGg?autoplay=1&mute=1', live: true },

    // ── NATURE ──
    { id: 'aquarium', title: 'Monterey Bay Aquarium Live Cam', channel: 'Monterey Bay Aquarium', cat: ['live','nature'],
      thumb: 'https://img.youtube.com/vi/EjlEtOBwJLs/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/EjlEtOBwJLs?autoplay=1&mute=1', live: true },
    { id: 'birdfeeder', title: 'Live Bird Feeder Cam — Cornell Lab', channel: 'Cornell Lab', cat: ['live','nature'],
      thumb: 'https://img.youtube.com/vi/N609loYkFJo/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/N609loYkFJo?autoplay=1&mute=1', live: true },

    // ── MUSIC ──
    { id: 'synthwave', title: 'Synthwave Radio — Retrowave', channel: 'Synthwave', cat: ['live','music'],
      thumb: 'https://img.youtube.com/vi/4xDzrJKXOOY/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1&mute=1', live: true },
    { id: 'classical', title: 'Classical Music Radio — 24/7', channel: 'Halidon Music', cat: ['live','music'],
      thumb: 'https://img.youtube.com/vi/jgpJVI3tDbY/mqdefault.jpg',
      src: 'https://www.youtube.com/embed/jgpJVI3tDbY?autoplay=1&mute=1', live: true },
  ];

  var savedChannels = [];
  var currentCat = 'live';
  var currentPlaying = null;

  // ── DOM refs ──
  var grid = document.getElementById('tv-grid');
  var player = document.getElementById('tv-player');
  var nowTitle = document.getElementById('tv-now-title');
  var nowChannel = document.getElementById('tv-now-channel');
  var nowLabel = document.querySelector('.tv-now-label');
  var tabsWrap = document.getElementById('tv-channel-tabs');

  // ── Load saved channels from localStorage ──
  try {
    var saved = localStorage.getItem('tv-saved');
    if (saved) savedChannels = JSON.parse(saved);
  } catch(e) {}

  // ── Render Grid ──
  function renderGrid(cat) {
    if (!grid) return;
    grid.innerHTML = '';
    var items = cat === 'saved'
      ? CHANNELS.filter(function(c) { return savedChannels.indexOf(c.id) !== -1; })
      : CHANNELS.filter(function(c) { return c.cat.indexOf(cat) !== -1; });

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--t2);font-size:0.8rem;font-style:italic;">No channels in this category</div>';
      return;
    }

    items.forEach(function(ch, idx) {
      var card = document.createElement('div');
      card.className = 'tv-card' + (currentPlaying === ch.id ? ' active' : '');
      card.style.animationDelay = (idx * 40) + 'ms';
      card.style.animation = 'slideIn 0.3s cubic-bezier(0.16,1,0.3,1) both';
      card.style.animationDelay = (idx * 40) + 'ms';

      var isSaved = savedChannels.indexOf(ch.id) !== -1;

      card.innerHTML =
        '<div class="tv-thumb-wrap">' +
          '<img class="tv-thumb" src="' + ch.thumb + '" alt="" loading="lazy">' +
          (ch.live ? '<span class="tv-live-badge">LIVE</span>' : '') +
          (ch.viewers ? '<span class="tv-viewers">' + ch.viewers + ' watching</span>' : '') +
        '</div>' +
        '<div class="tv-card-info">' +
          '<div class="tv-card-title">' + ch.title + '</div>' +
          '<div class="tv-card-channel">' + ch.channel + '</div>' +
        '</div>';

      card.addEventListener('click', function() { playChannel(ch); });

      // Right-click to save/unsave
      card.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        toggleSaved(ch.id);
        renderGrid(currentCat);
      });

      grid.appendChild(card);
    });
  }

  // ── Play Channel ──
  function playChannel(ch) {
    if (!player) return;
    currentPlaying = ch.id;

    // Replace player content with iframe
    player.innerHTML = '<iframe src="' + ch.src + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';

    // Update info bar
    if (nowTitle) nowTitle.textContent = ch.title;
    if (nowChannel) nowChannel.textContent = ch.channel;
    if (nowLabel) nowLabel.classList.add('active');

    // Mark active card
    var cards = grid.querySelectorAll('.tv-card');
    cards.forEach(function(c, i) { c.classList.remove('active'); });
    // Find and mark
    var filtered = currentCat === 'saved'
      ? CHANNELS.filter(function(c) { return savedChannels.indexOf(c.id) !== -1; })
      : CHANNELS.filter(function(c) { return c.cat.indexOf(currentCat) !== -1; });
    filtered.forEach(function(item, idx) {
      if (item.id === ch.id && cards[idx]) cards[idx].classList.add('active');
    });
  }

  // ── Save/Unsave ──
  function toggleSaved(id) {
    var idx = savedChannels.indexOf(id);
    if (idx === -1) savedChannels.push(id);
    else savedChannels.splice(idx, 1);
    try { localStorage.setItem('tv-saved', JSON.stringify(savedChannels)); } catch(e) {}
  }

  // ── Tab Switching ──
  if (tabsWrap) {
    tabsWrap.addEventListener('click', function(e) {
      var btn = e.target.closest('.tv-tab');
      if (!btn) return;
      var cat = btn.getAttribute('data-cat');
      if (!cat) return;

      currentCat = cat;
      tabsWrap.querySelectorAll('.tv-tab').forEach(function(t) { t.classList.remove('active'); });
      btn.classList.add('active');
      renderGrid(cat);
    });
  }

  // ── Initial render ──
  renderGrid('live');

})();
