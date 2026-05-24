# Phase 6 — Advanced Bug Context

## Goal
Automatically capture technical context (console logs, environment info, network requests) with every bug report, and add video recording capability. This brings Bugator on par with Jam.dev, Marker.io, and Ybug.

---

## Feature 1: Console Logs Capture

### Backend (Data Capture)

**New file:** `content/console-capture.js` (MAIN world, document_start)

**How it works:**
- Monkey-patch `console.log/warn/error/info/debug` in the page's MAIN world
- Listen for `window.onerror` and `unhandledrejection` events
- Store entries in a circular buffer (max 50 entries)
- Bridge data to isolated world via `window.postMessage`
- Content script (`content.js`) listens and stores buffer in memory

**Data Model — Console Entry:**
```js
{
  type: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'uncaught' | 'unhandledrejection',
  message: string,       // first 500 chars
  stack: string | null,  // for errors, first 300 chars
  timestamp: string      // ISO
}
```

**Bug Report Addition:**
```js
bugReport.consoleLogs = [...last50entries]  // attached automatically on save
```

### Frontend (UI Changes)

#### Annotation Widget (`content.js`)
- No visible change — console logs are captured silently in background
- A small indicator badge `📋 12 logs` shown below the textarea (read-only, informational)

#### Side Panel Dashboard (`sidepanel.js` + `sidepanel.css`)

**New section per bug card — "Console" collapsible:**
```html
<div class="bug-card-console" data-expanded="false">
  <button class="console-toggle">
    <svg>▶</svg> Console <span class="console-count">12</span>
    <span class="console-errors">3 errors</span>
  </button>
  <div class="console-entries">
    <div class="console-entry console-error">
      <span class="console-type">ERR</span>
      <span class="console-msg">TypeError: Cannot read property 'map' of undefined</span>
      <span class="console-time">13:24:01</span>
    </div>
    <div class="console-entry console-warn">
      <span class="console-type">WRN</span>
      <span class="console-msg">Deprecation warning: componentWillMount...</span>
      <span class="console-time">13:24:00</span>
    </div>
    <div class="console-entry console-log">
      <span class="console-type">LOG</span>
      <span class="console-msg">User clicked submit button</span>
      <span class="console-time">13:23:58</span>
    </div>
  </div>
</div>
```

**Styling:**
```css
.bug-card-console {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.console-toggle {
  /* Clickable row: icon + "Console" + count badge + error count */
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 0;
}

.console-toggle:hover { color: var(--text); }

.console-count {
  background: var(--bg);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 9px;
}

.console-errors {
  color: var(--danger);
  font-size: 9px;
  margin-left: auto;
}

.console-entries {
  display: none;  /* shown when expanded */
  max-height: 200px;
  overflow-y: auto;
  margin-top: 6px;
  background: var(--bg);
  border-radius: 4px;
  padding: 6px;
}

.console-entry {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 10px;
  border-bottom: 1px solid var(--border);
}

.console-type {
  flex-shrink: 0;
  width: 28px;
  font-weight: 700;
  font-size: 9px;
}

.console-error .console-type { color: #EF4444; }
.console-warn .console-type { color: #F59E0B; }
.console-log .console-type { color: #6B7280; }
.console-entry.console-uncaught .console-type { color: #EF4444; }

.console-msg {
  flex: 1;
  color: var(--text);
  word-break: break-all;
  max-height: 40px;
  overflow: hidden;
}

.console-time {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 9px;
}
```

**Behavior:**
- Collapsed by default (shows count + error count)
- Click toggle → expand with slide-down animation (180ms ease-out-quart)
- Errors/uncaught shown first, then chronological
- Click on a truncated entry → expand to full text
- If no console logs → section hidden entirely

#### Popup (`popup.html` / `popup.js`)
- No change — popup shows summary only, console logs visible in dashboard

#### Copy Text Button
- When copying bug text, append console errors at the bottom:
  ```
  --- Console Errors ---
  [ERR] TypeError: Cannot read property 'map' of undefined
  [WRN] Deprecation warning: componentWillMount...
  ```

---

## Feature 2: Environment Metadata

### Backend (Data Capture)

**No new file** — add `getEnvironment()` function in `content/content.js`

**Data Model:**
```js
{
  browser: 'Chrome 125.0.6422.60',
  os: 'Windows 11',
  screenResolution: '1920×1080',
  viewport: '1440×900',
  devicePixelRatio: 1.5,
  language: 'en-US',
  timezone: 'Asia/Kolkata',
  colorScheme: 'dark' | 'light',
  connection: '4g' | 'wifi' | null,
  memory: '8 GB',          // navigator.deviceMemory
  cores: 8                 // navigator.hardwareConcurrency
}
```

**Bug Report Addition:**
```js
bugReport.environment = getEnvironment()  // called during save
```

### Frontend (UI Changes)

#### Annotation Widget (`content.js`)
- No visible change — environment captured silently

#### Side Panel Dashboard (`sidepanel.js` + `sidepanel.css`)

**New section per bug card — environment pills row (always visible, not collapsible):**
```html
<div class="bug-card-env">
  <span class="env-pill">
    <svg><!-- browser icon --></svg> Chrome 125
  </span>
  <span class="env-pill">
    <svg><!-- os icon --></svg> Windows 11
  </span>
  <span class="env-pill">
    <svg><!-- screen icon --></svg> 1440×900
  </span>
  <span class="env-pill">
    <svg><!-- theme icon --></svg> Dark
  </span>
  <span class="env-pill">
    <svg><!-- wifi icon --></svg> 4g
  </span>
</div>
```

**Styling:**
```css
.bug-card-env {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.env-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: var(--text-muted);
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

.env-pill svg {
  width: 10px;
  height: 10px;
  opacity: 0.7;
}
```

**Behavior:**
- Always visible (compact, doesn't take much space)
- Shows top 4-5 most useful: browser, OS, viewport, color scheme, connection
- Hover on pill → tooltip with full value (e.g., "Chrome 125.0.6422.60")

#### Popup (`popup.html` / `popup.js`)
- No change — environment visible in dashboard only

#### Copy Text Button
- Append environment line when copying:
  ```
  --- Environment ---
  Chrome 125 · Windows 11 · 1440×900 · Dark · 4g
  ```

#### Export Formats
- **JSON**: `environment` object included as-is
- **CSV**: Add columns: `browser`, `os`, `viewport`, `colorScheme`
- **Markdown**: Add "Environment" line under each bug

---

## Feature 3: Network Request Capture

### Backend (Data Capture)

**New file:** `content/network-capture.js` (MAIN world, document_start)

**How it works:**
- Monkey-patch `window.fetch()` — wrap with timing, capture metadata
- Monkey-patch `XMLHttpRequest.prototype.open/send` — hook lifecycle events
- Store in circular buffer (max 30 requests)
- Only capture metadata (URL, method, status, duration) — NOT request/response bodies
- Bridge to content script via `window.postMessage`

**Data Model — Network Entry:**
```js
{
  type: 'fetch' | 'xhr',
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,           // first 200 chars
  status: number | null, // null if pending/network error
  statusText: string,
  duration: number,      // ms
  size: number | null,   // Content-Length bytes
  timestamp: string,
  failed: boolean        // true if status >= 400 or network error
}
```

**Bug Report Addition:**
```js
bugReport.networkRequests = [...last30requests]
```

### Frontend (UI Changes)

#### Annotation Widget (`content.js`)
- Small indicator below textarea: `🌐 2 failed` (only shown if there are failed requests, red text)
- If no failures: `🌐 8 requests` (muted text)

#### Side Panel Dashboard (`sidepanel.js` + `sidepanel.css`)

**New section per bug card — "Network" collapsible (similar to Console):**
```html
<div class="bug-card-network" data-expanded="false">
  <button class="network-toggle">
    <svg>▶</svg> Network <span class="network-count">8</span>
    <span class="network-failed">2 failed</span>
  </button>
  <div class="network-entries">
    <!-- Failed requests first (highlighted) -->
    <div class="network-entry network-fail">
      <span class="network-method">POST</span>
      <span class="network-url">/api/users/create</span>
      <span class="network-status status-500">500</span>
      <span class="network-duration">234ms</span>
    </div>
    <div class="network-entry network-fail">
      <span class="network-method">GET</span>
      <span class="network-url">/api/settings</span>
      <span class="network-status status-404">404</span>
      <span class="network-duration">89ms</span>
    </div>
    <!-- Then successful requests -->
    <div class="network-entry">
      <span class="network-method">GET</span>
      <span class="network-url">/api/dashboard/stats</span>
      <span class="network-status status-200">200</span>
      <span class="network-duration">156ms</span>
    </div>
  </div>
</div>
```

**Styling:**
```css
.bug-card-network {
  margin-top: 6px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.network-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 0;
}

.network-toggle:hover { color: var(--text); }

.network-count {
  background: var(--bg);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 9px;
}

.network-failed {
  color: var(--danger);
  font-size: 9px;
  margin-left: auto;
}

.network-entries {
  display: none;
  max-height: 180px;
  overflow-y: auto;
  margin-top: 6px;
  background: var(--bg);
  border-radius: 4px;
  padding: 6px;
}

.network-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 10px;
  border-bottom: 1px solid var(--border);
}

.network-method {
  flex-shrink: 0;
  width: 36px;
  font-weight: 700;
  color: var(--text-muted);
  font-size: 9px;
}

.network-url {
  flex: 1;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-status {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
}

.status-200, .status-201, .status-204 { color: var(--accent); }
.status-301, .status-302, .status-304 { color: #F59E0B; }
.status-400, .status-401, .status-403, .status-404 { color: #F97316; background: rgba(249,115,22,0.1); }
.status-500, .status-502, .status-503 { color: #EF4444; background: rgba(239,68,68,0.1); }

.network-duration {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 9px;
  width: 40px;
  text-align: right;
}

.network-fail {
  background: rgba(239, 68, 68, 0.05);
  border-radius: 3px;
  padding: 4px 4px;
}
```

**Behavior:**
- Collapsed by default (shows total count + failed count in red)
- Click toggle → expand with slide-down animation
- Failed requests (4xx/5xx) shown first with red highlight
- Successful requests below in chronological order
- Hover on URL → tooltip with full URL
- If no network requests → section hidden entirely
- If only failed requests exist → auto-expand on render

#### Popup (`popup.html` / `popup.js`)
- No change

#### Copy Text Button
- Append failed requests when copying:
  ```
  --- Failed Requests ---
  POST /api/users/create → 500 (234ms)
  GET /api/settings → 404 (89ms)
  ```

---

## Feature 4: Video Recording

### Backend (Data Capture)

**New file:** `content/video-capture.js` (isolated world)
**Manifest changes:** Add `tabCapture`, `unlimitedStorage` permissions

**How it works:**
1. User clicks Record → message to background.js
2. Background calls `chrome.tabCapture.getMediaStreamId()` → returns streamId
3. Content script gets stream via `navigator.mediaDevices.getUserMedia()` with streamId
4. `MediaRecorder` records WebM chunks
5. User clicks Stop (or 60s auto-stop) → assemble blob → convert to dataURL
6. Attached to next bug report

**Data Model:**
```js
bugReport.video = {
  dataUrl: string,    // WebM base64
  duration: number,   // seconds
  size: number        // bytes
}
```

### Frontend (UI Changes)

#### Popup (`popup.html` + `popup.js` + `popup.css`)

**New Record button — next to "Start Picking":**
```html
<div class="popup-actions">
  <button id="toggleBtn" class="btn-primary">
    <svg>...</svg>
    <span>Start Picking</span>
  </button>
  <button id="recordBtn" class="btn-record">
    <span class="record-dot"></span>
    <span>Record</span>
  </button>
  <button id="dashboardBtn" class="btn-secondary">...</button>
</div>
```

**Record button states:**
```css
.btn-record {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.btn-record:hover { border-color: #EF4444; }

.record-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #EF4444;
}

/* Recording state */
.btn-record.recording {
  border-color: #EF4444;
  background: rgba(239, 68, 68, 0.1);
}

.btn-record.recording .record-dot {
  animation: pulse-record 1s ease-in-out infinite;
}

.btn-record.recording span:last-child::after {
  content: ' (00:12)';  /* countdown timer via JS */
  color: var(--text-muted);
}

@keyframes pulse-record {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

**Behavior:**
- Click "Record" → button changes to "⏹ Stop (00:00)" with pulsing red dot
- Timer counts up (00:01, 00:02...)
- Auto-stops at 60s
- After stop: button shows "✓ Recorded (12s)" for 2 seconds, then resets
- Recording is held in memory until next bug save

#### Annotation Widget (`content.js`)

**Recording indicator + attach button:**
```html
<!-- When recording is active, show indicator above widget -->
<div class="bugator-recording-indicator">
  <span class="recording-pulse"></span>
  <span>Recording... 00:12</span>
  <button class="recording-stop">⏹ Stop</button>
</div>

<!-- In widget actions row, if a recording exists: -->
<div class="bugator-widget-actions">
  <span class="widget-video-badge">🎬 12s recorded</span>
  <button class="bugator-widget-ai">✨ Enhance</button>
  <button class="bugator-widget-submit">Save Bug</button>
</div>
```

**Recording indicator styling (floating top-right of page):**
```css
.bugator-recording-indicator {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1E293B;
  border: 1px solid #EF4444;
  border-radius: 20px;
  padding: 6px 12px;
  font-family: Inter, sans-serif;
  font-size: 12px;
  color: #F8FAFC;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.recording-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #EF4444;
  animation: pulse-record 1s ease-in-out infinite;
}

.recording-stop {
  background: rgba(239,68,68,0.2);
  border: 1px solid #EF4444;
  color: #EF4444;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.widget-video-badge {
  font-size: 10px;
  color: #60A5FA;
  background: rgba(96,165,250,0.1);
  padding: 2px 6px;
  border-radius: 4px;
}
```

#### Side Panel Dashboard (`sidepanel.js` + `sidepanel.css`)

**Video player section per bug card (if video exists):**
```html
<div class="bug-card-video">
  <button class="video-play-btn" data-action="play-video">
    <svg>▶</svg>
    <span>Play Recording</span>
    <span class="video-duration">12s</span>
  </button>
  <!-- Expanded: inline video player -->
  <div class="video-player" hidden>
    <video controls src="blob:..."></video>
    <button class="video-download" data-action="download-video">
      <svg>↓</svg> Download
    </button>
  </div>
</div>
```

**Styling:**
```css
.bug-card-video {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.video-play-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 6px;
  color: #60A5FA;
  font-size: 11px;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.video-play-btn:hover {
  background: rgba(96, 165, 250, 0.15);
  border-color: #60A5FA;
}

.video-play-btn svg {
  width: 14px;
  height: 14px;
}

.video-duration {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 10px;
}

.video-player {
  margin-top: 8px;
}

.video-player video {
  width: 100%;
  border-radius: 4px;
  border: 1px solid var(--border);
  max-height: 200px;
}

.video-download {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 4px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 10px;
  cursor: pointer;
}

.video-download:hover { color: var(--text); border-color: var(--text-muted); }
```

**Behavior:**
- If bug has video → show "▶ Play Recording (12s)" button
- Click → expand inline `<video>` player with controls
- Download button below video
- Video auto-pauses when card scrolls out of view
- If no video → section hidden entirely

---

## Complete File Changes Summary

| File | Backend Changes | Frontend Changes |
|------|----------------|-----------------|
| `manifest.json` | Add `tabCapture`, `unlimitedStorage`, MAIN world scripts | — |
| `content/console-capture.js` | **NEW** — monkey-patch console, postMessage bridge | — |
| `content/network-capture.js` | **NEW** — monkey-patch fetch/XHR, postMessage bridge | — |
| `content/video-capture.js` | **NEW** — MediaRecorder lifecycle | — |
| `content/content.js` | Message listeners for buffers, `getEnvironment()`, attach data on save | Log count badge, network fail badge, recording indicator, video badge in widget |
| `content/content.css` | — | Recording indicator styles, video badge styles, log/network badges |
| `background.js` | `START_RECORDING`/`STOP_RECORDING` handlers | — |
| `sidepanel/sidepanel.js` | — | Render console section, env pills, network section, video player |
| `sidepanel/sidepanel.css` | — | Console entries, env pills, network entries, video player styles |
| `popup/popup.html` | — | Record button markup |
| `popup/popup.js` | — | Record button logic, timer, state management |
| `popup/popup.css` | — | Record button styles, recording state, pulse animation |

---

## Implementation Order

```
Phase 6a: Environment Metadata        → Backend: 15 min | Frontend: 20 min
Phase 6b: Console Logs Capture         → Backend: 30 min | Frontend: 40 min
Phase 6c: Network Request Capture      → Backend: 30 min | Frontend: 40 min
Phase 6d: Video Recording              → Backend: 45 min | Frontend: 45 min
```

---

## Manifest Changes (Final)

```json
{
  "permissions": ["storage", "activeTab", "scripting", "sidePanel", "tabs", "tabCapture", "unlimitedStorage"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/console-capture.js", "content/network-capture.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["<all_urls>"],
      "css": ["content/content.css"],
      "js": ["content/ai-service.js", "content/storage.js", "content/video-capture.js", "content/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

---

## Visual Summary — Bug Card (After Phase 6)

```
┌─────────────────────────────────────────────────┐
│ [DIV]                    [✨] [📋] [🎯] [✕]    │  ← header (existing)
├─────────────────────────────────────────────────┤
│ Title: Login button not responding              │  ← description (existing)
│ Description: When clicking the login button...  │
├─────────────────────────────────────────────────┤
│ [Chrome 125] [Win 11] [1440×900] [Dark] [4g]   │  ← NEW: env pills
├─────────────────────────────────────────────────┤
│ ▶ Console (12)                      3 errors    │  ← NEW: collapsible
│   ERR  TypeError: Cannot read 'map'   13:24:01  │
│   WRN  Deprecation warning...          13:24:00  │
│   LOG  User clicked submit             13:23:58  │
├─────────────────────────────────────────────────┤
│ ▶ Network (8)                       2 failed    │  ← NEW: collapsible
│   POST /api/users/create    500      234ms      │
│   GET  /api/settings        404       89ms      │
│   GET  /api/dashboard       200      156ms      │
├─────────────────────────────────────────────────┤
│ [▶ Play Recording (12s)                    ]    │  ← NEW: video
├─────────────────────────────────────────────────┤
│ [screenshot thumbnail]                     ↓    │  ← existing
├─────────────────────────────────────────────────┤
│ div.login-form > button    ·    2 min ago       │  ← meta (existing)
└─────────────────────────────────────────────────┘
```

---

## On Hold (Future Phases)

- Screenshot annotation (draw arrows/rectangles)
- Keyboard shortcuts
- Shareable links
- Jira/Linear/GitHub integration
- User event timeline
- Instant Replay (background buffer)
