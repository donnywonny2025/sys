# Dashboard Architecture

> **This file is the source of truth for where things live.**  
> Read this before editing any dashboard code.

## File Map

### Frontend (`public/`)

| File | Owns | Depends On |
|------|------|-----------|
| `index.html` | DOM structure, script loading order | — |
| `style.css` | All layout, colors, animations | — |
| `board.css` | Whiteboard-specific styles | — |
| `core.js` | Clock, date, scene switching, `DASH` namespace | — |
| `feeds.js` | Email, calendar, weather, focus rendering | `DASH` |
| `studio.js` | Image studio, pan/zoom, PIP, hero, tools | `DASH` |
| `board.js` | Whiteboard rendering, drawing | `DASH` |
| `chat.js` | Console panel, chat live feed, bubbles | `DASH` |
| `telemetry.js` | Telem strip, sparklines, CPU/MEM, model, activity chain | `DASH` |
| `openclaw.js` | OpenClaw status polling, heartbeat dot | `DASH` |
| `websocket.js` | WS connection, reconnect, message dispatch | `DASH` |
| `contacts.js` | Contacts page rendering | `DASH` |

### Backend (`server.js` + `routes/` + `watchers/`)

| File | Owns |
|------|------|
| `server.js` | HTTP server, WebSocket setup, static files, route loading |
| `routes/api.js` | `/api/push`, `/api/model`, `/api/state`, `/api/telemetry`, `/api/board`, `/api/history`, `/api/refresh` |
| `routes/chat.js` | `/api/openclaw-chat`, `/api/scene` |
| `routes/proxy.js` | `/openclaw/*` reverse proxy |
| `routes/studio.js` | `/api/studio/*`, `/api/whiteboard/*` |
| `watchers/session.js` | JSONL session file tailing → console push |
| `watchers/logs.js` | System log tailing |

## Conventions

### 1. The `DASH` Namespace
All frontend modules register on `window.DASH`. Example:

```js
// In feeds.js
window.DASH = window.DASH || {};
DASH.renderEmail = function(emails, targetId) { ... };
DASH.renderCalendar = function(events, targetId) { ... };
```

This means any module can call any other module's functions. No import/export, no build step.

### 2. Script Load Order
Scripts load in this order in `index.html` (order matters):
1. `core.js` — creates `DASH`, sets up clock/scenes
2. `feeds.js` — feed renderers
3. `studio.js` — studio features
4. `board.js` — whiteboard
5. `chat.js` — console + chat
6. `telemetry.js` — telem strip
7. `openclaw.js` — status polling
8. `contacts.js` — contacts page
9. `websocket.js` — **LAST** — connects WS and routes messages to everything above

### 3. Adding a New Feature
1. Create `public/newfeature.js`
2. Register functions on `DASH`: `DASH.myFeature = function() { ... }`
3. Add a `<script>` tag in `index.html` BEFORE `websocket.js`
4. If it needs WS messages, add a case in `websocket.js`'s dispatch
5. If it needs an API, add a handler in the appropriate `routes/*.js`
6. Update this file

### 4. Backend Route Pattern
Each route file exports a single function:

```js
// routes/api.js
module.exports = function(req, res, ctx) {
  // ctx has: { broadcast, feedCache, saveFeedCache, clients, activeState }
  // return true if handled, false to pass to next route
};
```

### 5. WebSocket Message Types
All WS messages have `{ type: '...', ...data }`. Current types:

| Type | Direction | Handler |
|------|-----------|---------|
| `feed` | server → browser | `feeds.js` |
| `content` | server → browser | `studio.js` |
| `scene` | server → browser | `core.js` |
| `chat` | server → browser | `chat.js` |
| `console` | server → browser | `chat.js` |
| `refresh` | server → browser | `core.js` |
| `model-change` | server → browser | `telemetry.js` |
| `state-sync` | server → browser | `core.js` |
| `board-sync` | server → browser | `board.js` |

### 6. File Size Guidelines
- No single file should exceed ~300 lines
- If it does, it's a sign it needs splitting
- Exception: `studio.js` may be larger due to PIP/canvas complexity
