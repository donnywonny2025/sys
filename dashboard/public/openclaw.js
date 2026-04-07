// openclaw.js — OpenClaw heartbeat polling
// Attaches to DASH namespace from core.js

(function() {
  'use strict';

  DASH.checkOpenClaw = function() {
    fetch('/api/openclaw-status')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var dot = document.getElementById('hermes-dot');
        var label = document.getElementById('hermes-label');
        if (data.active) {
          dot.style.background = '#22c55e'; dot.style.boxShadow = '0 0 6px #22c55e';
          label.style.color = '#22c55e';
        } else {
          dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 6px #ef4444';
          label.style.color = '#ef4444';
        }
      })
      .catch(function() {
        document.getElementById('hermes-dot').style.background = '#555';
        document.getElementById('hermes-dot').style.boxShadow = 'none';
      });
  };

  DASH.checkOpenClaw();
  setInterval(DASH.checkOpenClaw, 15000);
})();
