/* ==========================================================================
   BOARD Component — Tasks + Dry-Erase Canvas
   Self-contained module. Exposes window.Board for external use.
   ========================================================================== */

(function() {
  'use strict';

  var cards = [];
  var canvasData = null;
  var saveTimer = null;

  // --- Canvas State ---
  var canvas, ctx;
  var drawing = false;
  var tool = 'pen'; // 'pen' or 'eraser'
  var brushSize = 2;
  var brushColor = '#ffffff';
  var lastX = 0, lastY = 0;

  // ===================== INIT =====================
  function init() {
    canvas = document.getElementById('board-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Size canvas to container
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Canvas events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    // Touch support
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDraw);

    // Toolbar
    var penBtn = document.getElementById('board-pen');
    var eraserBtn = document.getElementById('board-eraser');
    var brushInput = document.getElementById('board-brush');
    var colorInput = document.getElementById('board-color');
    var clearBtn = document.getElementById('board-clear');

    if (penBtn) penBtn.addEventListener('click', function() {
      tool = 'pen';
      penBtn.classList.add('active');
      eraserBtn.classList.remove('active');
      canvas.style.cursor = 'crosshair';
    });
    if (eraserBtn) eraserBtn.addEventListener('click', function() {
      tool = 'eraser';
      eraserBtn.classList.add('active');
      penBtn.classList.remove('active');
      canvas.style.cursor = 'cell';
    });
    if (brushInput) brushInput.addEventListener('input', function() {
      brushSize = parseInt(this.value);
    });
    if (colorInput) colorInput.addEventListener('input', function() {
      brushColor = this.value;
    });
    if (clearBtn) clearBtn.addEventListener('click', function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      scheduleSave();
    });
    var clearAllBtn = document.getElementById('board-clear-all');
    if (clearAllBtn) clearAllBtn.addEventListener('click', function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      scheduleSave();
    });

    // Load saved state
    loadBoard();

    // Add card button + input
    var addBtn = document.getElementById('board-add-btn');
    var addInput = document.getElementById('board-add-input');
    if (addBtn && addInput) {
      addBtn.addEventListener('click', function() {
        addInput.classList.toggle('visible');
        if (addInput.classList.contains('visible')) {
          addInput.focus();
        }
      });
      addInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && addInput.value.trim()) {
          addCard(addInput.value.trim(), 'idea');
          addInput.value = '';
          addInput.classList.remove('visible');
        } else if (e.key === 'Escape') {
          addInput.value = '';
          addInput.classList.remove('visible');
        }
      });
      // Click outside to dismiss
      addInput.addEventListener('blur', function() {
        setTimeout(function() {
          if (!addInput.value.trim()) addInput.classList.remove('visible');
        }, 200);
      });
    }
  }

  // ===================== CANVAS DRAWING =====================
  function resizeCanvas() {
    if (!canvas) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = Math.floor(rect.width);
    var h = Math.floor(rect.height);
    if (w < 10 || h < 10) return;
    // Save current image
    var img = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { img = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch(e) {}
    }
    canvas.width = w;
    canvas.height = h;
    // Restore if we had data
    if (img) {
      ctx.putImageData(img, 0, 0);
    } else if (canvasData) {
      restoreCanvasFromData(canvasData);
    }
  }

  function startDraw(e) {
    drawing = true;
    var rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  }

  function draw(e) {
    if (!drawing) return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }

    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  function stopDraw() {
    if (drawing) {
      drawing = false;
      scheduleSave();
    }
  }

  function handleTouch(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var mouseEvent = new MouseEvent(
      e.type === 'touchstart' ? 'mousedown' :
      e.type === 'touchmove' ? 'mousemove' : 'mouseup',
      { clientX: touch.clientX, clientY: touch.clientY }
    );
    canvas.dispatchEvent(mouseEvent);
  }

  function restoreCanvasFromData(dataUrl) {
    if (!dataUrl || !ctx) return;
    var img = new Image();
    img.onload = function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  // ===================== CARD MANAGEMENT =====================
  function renderCards() {
    var container = document.getElementById('board-cards');
    var countEl = document.getElementById('board-count');
    var emptyEl = document.getElementById('board-empty');
    if (!container) return;

    // Clear existing cards (keep empty state)
    var existing = container.querySelectorAll('.board-card');
    existing.forEach(function(el) { el.remove(); });

    if (emptyEl) emptyEl.style.display = cards.length ? 'none' : 'block';
    if (countEl) countEl.textContent = cards.length;

    cards.forEach(function(card, i) {
      var div = document.createElement('div');
      div.className = 'board-card' + (card.done ? ' done' : '');
      div.style.borderLeftColor = getTagColor(card.status);
      // Drag to reorder
      div.draggable = true;
      div.dataset.index = i;
      div.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', i);
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', function() {
        div.classList.remove('dragging');
      });
      div.addEventListener('dragover', function(e) {
        e.preventDefault();
        div.classList.add('drag-over');
      });
      div.addEventListener('dragleave', function() {
        div.classList.remove('drag-over');
      });
      div.addEventListener('drop', function(e) {
        e.preventDefault();
        div.classList.remove('drag-over');
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        var toIdx = i;
        if (fromIdx !== toIdx) {
          var moved = cards.splice(fromIdx, 1)[0];
          cards.splice(toIdx, 0, moved);
          renderCards();
          scheduleSave();
        }
      });

      var check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'board-check';
      check.checked = !!card.done;
      check.addEventListener('change', function() {
        cards[i].done = this.checked;
        if (this.checked) cards[i].status = 'done';
        renderCards();
        scheduleSave();
      });

      var tag = document.createElement('span');
      tag.className = 'board-tag ' + (card.status || 'idea');
      tag.textContent = card.status || 'idea';
      tag.style.cursor = 'pointer';
      tag.title = 'Click to change status';
      tag.addEventListener('click', function() {
        var statuses = ['idea', 'planning', 'working', 'blocked', 'done'];
        var cur = statuses.indexOf(card.status || 'idea');
        var next = (cur + 1) % statuses.length;
        cards[i].status = statuses[next];
        if (statuses[next] === 'done') cards[i].done = true;
        renderCards();
        scheduleSave();
      });

      var text = document.createElement('span');
      text.className = 'board-text';
      text.textContent = card.text;
      text.title = card.text;

      var del = document.createElement('button');
      del.className = 'board-del';
      del.textContent = '×';
      del.title = 'Remove';
      del.addEventListener('click', function() {
        removeCard(i);
      });

      div.appendChild(check);
      div.appendChild(tag);
      div.appendChild(text);
      div.appendChild(del);
      container.appendChild(div);
    });
  }

  function getTagColor(status) {
    var colors = {
      planning: '#c084fc', working: '#f59e0b',
      idea: '#5bc4be', blocked: '#ef4444', done: '#34d399'
    };
    return colors[status] || '#5bc4be';
  }

  function addCard(text, status) {
    cards.push({ text: text, status: status || 'idea', done: false, ts: Date.now() });
    renderCards();
    saveBoardImmediate();
  }

  function removeCard(index) {
    cards.splice(index, 1);
    renderCards();
    saveBoardImmediate();
  }

  function updateCard(index, updates) {
    if (cards[index]) {
      Object.assign(cards[index], updates);
      renderCards();
      saveBoardImmediate();
    }
  }

  // ===================== PERSISTENCE =====================
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveBoard, 1000);
  }

  // Immediate save — for card operations that must never be lost
  function saveBoardImmediate() {
    clearTimeout(saveTimer);
    saveBoard();
  }

  function saveBoard() {
    var data = {
      cards: cards,
      canvas: null
    };
    // Save canvas as data URL
    try {
      if (canvas && canvas.width > 0) {
        data.canvas = canvas.toDataURL('image/png');
      }
    } catch(e) {}

    fetch('/api/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(function(e) { console.warn('Board save failed:', e); });
  }

  function loadBoard() {
    fetch('/api/board')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.cards) {
          cards = data.cards;
          renderCards();
        }
        if (data.canvas) {
          canvasData = data.canvas;
          restoreCanvasFromData(canvasData);
        }
      })
      .catch(function(e) { console.warn('Board load failed:', e); });
  }

  // ===================== PUBLIC API =====================
  window.Board = {
    init: init,
    addCard: addCard,
    removeCard: removeCard,
    updateCard: updateCard,
    getCards: function() { return cards; },
    reload: loadBoard
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
