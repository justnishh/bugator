# Bugator - Project Status

## Overview
Chrome Extension (Manifest V3) for QA teams to pin bugs directly on any webpage. Click any element, annotate the issue, and all reports are stored persistently. AI-powered bug enhancement transforms rough notes into professional bug tickets.

## Version: 1.2.0

## Tech Stack
- Chrome Extension Manifest V3
- Vanilla JS (no framework)
- chrome.storage.local for persistence
- CSS with motion design tokens
- AI: OpenRouter, Claude, Gemini, OpenAI, Nvidia (meta/llama-3.3-70b-instruct)

## Design System (from UI/UX Pro Max skill)
- Background: #0F172A
- Surface: #1E293B
- Border: #334155
- Accent: #22C55E
- Text: #F8FAFC
- Font: Inter
- Motion: ease-out-quart (180ms) for enter/exit, ease (150ms) for hover

## File Structure
```
Bugator/
├── manifest.json              # MV3 manifest (permissions: storage, activeTab, scripting, sidePanel, tabs + host_permissions: <all_urls>)
├── background.js              # Service worker - state mgmt, messaging, programmatic injection, screenshot
├── icons/                     # 16/48/128px PNG icons (alligator + bug)
├── content/
│   ├── ai-service.js          # Unified AI provider interface (5 providers) with IIFE guard
│   ├── storage.js             # chrome.storage.local wrapper with sessions + multi-format export
│   ├── content.js             # Element picker + annotation widget + hover label + AI enhance
│   └── content.css            # Overlay, highlight, widget styles with motion tokens
├── popup/
│   ├── popup.html             # Popup shell with inline settings + confirm modal
│   ├── popup.css              # Dark theme popup styles + inline settings + modal
│   └── popup.js               # Toggle picker, bug list, export, clear, dashboard, inline settings
├── sidepanel/
│   ├── sidepanel.html         # Dashboard shell
│   ├── sidepanel.css          # Full dashboard styles
│   └── sidepanel.js           # Search, filter, highlight, delete, AI enhance, copy, download, auto-refresh
├── settings/
│   ├── settings.html          # AI settings page (also accessible as options_ui)
│   ├── settings.css           # Settings styles
│   └── settings.js            # Provider + API key management
└── .kiro/steering/            # AI skills (UI/UX Pro Max, Motion Design, Chrome Extension)
```

## Key Architecture Decisions
1. **chrome.storage.local** (not IndexedDB) — works across all extension contexts without cross-world issues
2. **Programmatic injection** via chrome.scripting.executeScript — ensures content scripts work on tabs opened before extension install
3. **Capture-phase event listeners** for click/mousemove — intercepts before page handlers
4. **Widget click passthrough** — onClick handler checks `e.target.closest('.bugator-widget')` BEFORE calling preventDefault
5. **host_permissions: <all_urls>** — required for side panel to inject highlight scripts on navigated pages
6. **IIFE guards** on all content scripts — prevents duplicate execution errors
7. **Full PNG screenshots** — no compression, stored as-is from captureVisibleTab
8. **Inline settings** — settings open inside popup, not Chrome's extension page
9. **AI service with 5 providers** — unified interface, prompt instructs plain text output (no markdown)

## Bugs Fixed (all sessions)
- Storage not persisting: switched from IndexedDB to chrome.storage.local
- Save button not working: click capture handler was blocking widget clicks
- Not working on Gmail/Asana: added programmatic script injection
- background.js:0 error: wrapped async handlers in IIFE, proper return true/false
- sidepanel.html:0 error: added try/catch to all async functions
- Highlight wrong element: wait 400ms after scrollIntoView before measuring rect
- Highlight not working on navigation: use polling + 1500ms DOM settle wait + host_permissions
- ai-service.js duplicate injection: added IIFE with window.__bugatorAI guard
- Screenshot showing widget: hide widget (visibility:hidden) before capture
- Popup layout overflow: fixed height 520px, flex-shrink:0 on stats/footer, min-height:0 on list
- Native confirm() dialogs: replaced with custom dark-themed modal
- Settings opening Chrome page: replaced with inline settings view in popup

## Phases

### ✅ Phase 1 — Extension Skeleton (COMPLETE)
- [x] Manifest V3 with minimal permissions
- [x] Background service worker (state + messaging)
- [x] Content script (element picker, hover highlight, click-to-select)
- [x] Annotation widget (floating text input at click position)
- [x] Persistent storage (chrome.storage.local)
- [x] Popup UI (toggle, bug list, stats, export, clear)
- [x] CSS with motion design tokens + prefers-reduced-motion
- [x] Programmatic injection for already-open tabs

### ✅ Phase 2 — Element Picker & Annotation Enhancements (COMPLETE)
- [x] Hover label showing tag name + dimensions (monospace pill above highlight)
- [x] Screenshot capture of full visible page (widget hidden, highlight visible)
- [x] Multiple bugs per session without restarting picker
- [x] Better selector generation (data-testid > id > aria-label > data-cy > data-test > path)

### ✅ Phase 3 — Persistent Storage Enhancements (COMPLETE)
- [x] Session concept (auto-create on first bug, end on deactivate)
- [x] Bugs tagged with sessionId, sessions stored separately
- [x] Export as JSON / CSV / Markdown (dropdown selector in popup)
- [x] Popup shows bugs grouped by URL with count badges
- [x] Clear resets bugs + sessions

### ✅ Phase 4 — Bug Dashboard (Side Panel) (COMPLETE)
- [x] Side panel UI (persists unlike popup)
- [x] All bugs grouped by URL with count badges
- [x] Filter by URL dropdown, date (today/week/month)
- [x] Search bug descriptions, selectors, tags, URLs
- [x] Click bug → highlight element on page (pulse animation, auto-navigate if different URL)
- [x] Delete individual bugs (fade-out animation)
- [x] Auto-refresh via chrome.storage.onChanged
- [x] Screenshot thumbnails with download button (top-right, appears on hover)
- [x] Copy bug text button
- [x] "Open Dashboard" button in popup

### ✅ Phase 5 — AI Integration (COMPLETE)
- [x] Inline settings in popup (provider selection + API key)
- [x] AI service layer (OpenRouter, Claude, Gemini, OpenAI, Nvidia)
- [x] ✨ Enhance button in annotation widget (enhance before save)
- [x] ✨ Enhance button in dashboard bug cards (enhance existing, updates in-place)
- [x] AI prompt generates plain text: Title, Description, Steps to Reproduce, Expected, Actual, Severity (P0-P3), Component
- [x] Formatted rendering in dashboard (bold labels, line breaks, step numbers)
- [x] No image compression — full PNG stored
- [x] Copy text + Download image buttons on bug cards

### ✅ Phase 6 — Advanced Bug Context (COMPLETE)

#### 6a: Environment Metadata
- [x] Auto-capture browser name + version, OS, screen resolution, viewport, DPR
- [x] Capture language, timezone, color scheme preference, connection type
- [x] Attach as `bugReport.environment` on every save
- [x] Render as compact pill row in dashboard
- [x] Include in copy text output

#### 6b: Console Logs Capture
- [x] New `content/console-capture.js` in MAIN world (document_start)
- [x] Monkey-patch console.log/warn/error/info/debug
- [x] Capture window.onerror + unhandledrejection
- [x] Circular buffer (max 50 entries) bridged via postMessage
- [x] Attach `bugReport.consoleLogs` on save
- [x] Render as collapsible color-coded section in dashboard

#### 6c: Network Request Capture
- [x] New `content/network-capture.js` in MAIN world (document_start)
- [x] Monkey-patch fetch() and XMLHttpRequest
- [x] Capture method, URL, status, duration, size (NOT bodies)
- [x] Circular buffer (max 30 requests) bridged via postMessage
- [x] Attach `bugReport.networkRequests` on save, highlight failed (4xx/5xx)
- [x] Render as collapsible section in dashboard with failed requests in red

#### 6d: Video Recording
- [x] Add `tabCapture` + `unlimitedStorage` permissions
- [x] MediaRecorder management in content.js
- [x] Background handler: START_RECORDING → tabCapture.getMediaStreamId()
- [x] 🔴 Record button in annotation widget
- [x] Red pulsing indicator during recording, 60s max auto-stop
- [x] Save as WebM dataURL, attach as `bugReport.video`
- [x] Inline video player + download in dashboard

---

## AI Provider Config
| Provider | Model | Endpoint |
|----------|-------|----------|
| OpenRouter | anthropic/claude-3.5-sonnet | openrouter.ai/api/v1/chat/completions |
| Claude | claude-sonnet-4-20250514 | api.anthropic.com/v1/messages |
| Gemini | gemini-2.0-flash | generativelanguage.googleapis.com/v1beta |
| OpenAI | gpt-4o-mini | api.openai.com/v1/chat/completions |
| Nvidia | meta/llama-3.3-70b-instruct | integrate.api.nvidia.com/v1/chat/completions |

## Session Notes
- **2026-05-22**: Phase 1 complete. All core functionality working. Extension tested on Gmail, Asana, regular websites.
- **2026-05-22**: Phase 2 complete. Hover labels, screenshot capture, improved selectors. Picker stays active for multi-bug sessions.
- **2026-05-22**: Phase 3 complete. Sessions auto-created, bugs grouped by URL in popup, export as JSON/CSV/Markdown.
- **2026-05-22**: Phase 4 complete. Side panel dashboard with search, filter, highlight-on-page, delete, screenshot thumbnails.
- **2026-05-22**: v1.1.0 fixes — screenshot hides widget, custom confirm modal, popup layout fix, new alligator+bug icon.
- **2026-05-22**: Phase 5 complete. AI bug enhancement with 5 providers, inline settings, ✨ buttons in widget + dashboard.
- **2026-05-22**: Final fixes — no image compression, copy text button, download image button, ✨ emoji for AI, inline settings in popup, Nvidia model set to meta/llama-3.3-70b-instruct.
- **2026-05-22**: CODE FREEZE. All 5 phases complete and working.
- **2026-05-24**: Phase 6 planned — Console Logs, Environment Metadata, Network Requests, Video Recording. See PHASE6_PLAN.md for details.
- **2026-05-24**: Phase 6 COMPLETE. All 4 features implemented: environment metadata (auto-captured), console logs (MAIN world monkey-patch), network requests (fetch/XHR intercept), video recording (tabCapture + MediaRecorder). Version bumped to 1.2.0.
