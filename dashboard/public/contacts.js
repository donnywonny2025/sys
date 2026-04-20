/* ==========================================================================
   Contacts Page — Logic
   ========================================================================== */
(function() {
  'use strict';

  const CONTACTS_DATA = [
    {
      name: "Dare'l McMillian",
      email: "darelm@m2mcmillianmedia.com",
      phone: "+1 (248) 778-6468",
      org: "M2 McMillian Media",
      avatar: null,
      project: "The Sandbox Collective podcast — logos, branding, creative direction",
      priority: 1
    },
    {
      name: "Callie Bea",
      email: "",
      phone: "",
      org: "",
      avatar: null,
      project: "",
      priority: 2
    },
    {
      name: "J. Kerr",
      email: "colour8k@mac.com",
      phone: "",
      org: "SYSTEM",
      avatar: null,
      project: "System owner — dashboard, system orchestration",
      priority: 3
    },
    {
      name: "Court",
      email: "",
      phone: "",
      org: "",
      avatar: null,
      project: "",
      priority: 4
    },
    {
      name: "Mike Steems",
      email: "",
      phone: "",
      org: "",
      avatar: null,
      project: "Pending outreach",
      priority: 5
    }
  ];

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  function mailIcon() {
    return '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>';
  }

  function phoneIcon() {
    return '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>';
  }

  function renderCard(c) {
    const avatarContent = c.avatar
      ? `<img src="${c.avatar}" alt="${c.name}" />`
      : `<span class="avatar-initials">${getInitials(c.name)}</span>`;

    const emailRow = c.email
      ? `<div class="contact-meta-row">${mailIcon()}<span class="contact-meta-value">${c.email}</span></div>`
      : '';

    const phoneRow = c.phone
      ? `<div class="contact-meta-row">${phoneIcon()}<span class="contact-meta-value">${c.phone}</span></div>`
      : '';

    const projectBlock = c.project
      ? `<div class="contact-project"><div class="contact-project-label">Project</div>${c.project}</div>`
      : '';

    return `
      <div class="contact-card" data-priority="${c.priority}">
        <span class="contact-priority">#${c.priority}</span>
        <div class="contact-avatar">${avatarContent}</div>
        <div class="contact-name">${c.name}</div>
        <div class="contact-org">${c.org || ''}</div>
        <div class="contact-meta">
          ${emailRow}
          ${phoneRow}
        </div>
        ${projectBlock}
      </div>
    `;
  }

  function renderContacts() {
    const grid = document.getElementById('contacts-grid');
    const counter = document.getElementById('contacts-count');
    if (!grid) return;

    const sorted = [...CONTACTS_DATA].sort((a, b) => a.priority - b.priority);

    if (sorted.length === 0) {
      grid.innerHTML = '<div class="contacts-empty">No contacts yet. Ask the system to add someone.</div>';
      if (counter) counter.textContent = '0 people';
      return;
    }

    grid.innerHTML = sorted.map(renderCard).join('');
    if (counter) counter.textContent = `${sorted.length} ${sorted.length === 1 ? 'person' : 'people'}`;
  }

  // Re-render whenever the contacts scene becomes visible
  const observer = new MutationObserver(() => {
    const scene = document.getElementById('scene-contacts');
    if (scene && scene.classList.contains('active')) {
      renderContacts();
    }
  });

  const sceneEl = document.getElementById('scene-contacts');
  if (sceneEl) {
    observer.observe(sceneEl, { attributes: true, attributeFilter: ['class'] });
  }

  // Initial render
  document.addEventListener('DOMContentLoaded', renderContacts);
  // Also render immediately if DOM is already loaded
  if (document.readyState !== 'loading') renderContacts();

})();
