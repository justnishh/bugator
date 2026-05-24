<p align="center">
  <img src="icons/icon128.png" alt="Bugator Logo" width="80" />
</p>

<h1 align="center">🐊 Bugator</h1>

<p align="center">
  <strong>Pin bugs directly on any webpage. Click, annotate, and track issues — built for QA teams.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.2.0-22C55E?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/chrome-extension-yellow?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/license-MIT-gray?style=flat-square" alt="License" />
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Element Picker** | Hover to highlight, click to select any element on any page |
| 📝 **Annotation Widget** | Floating input to describe the bug right where you found it |
| 📸 **Auto Screenshot** | Full-page screenshot captured with every bug report |
| 🎥 **Video Recording** | Record up to 60s of tab activity to show the bug in action |
| 🤖 **AI Enhancement** | Transform rough notes into professional bug tickets (5 AI providers) |
| 📊 **Dashboard** | Side panel with search, filter, and highlight-on-page |
| 🌐 **Network Capture** | Auto-logs failed API requests (4xx/5xx) with timing |
| 🖥️ **Console Capture** | Catches errors, warnings, and unhandled rejections |
| 🔍 **Environment Info** | Browser, OS, viewport, DPR, timezone — all auto-detected |
| 📤 **Multi-Format Export** | Export bugs as JSON, CSV, or Markdown |

---

## 🚀 Installation (Manual / Developer Mode)

### Prerequisites

- Google Chrome (v116 or later)

### Steps

1. **Download or clone this repository**

   ```bash
   git clone https://github.com/justnishh/bugator.git
   ```

   Or download as ZIP and extract.

2. **Open Chrome Extensions page**

   Navigate to:
   ```
   chrome://extensions
   ```

3. **Enable Developer Mode**

   Toggle the **Developer mode** switch in the top-right corner.

4. **Load the extension**

   Click **"Load unpacked"** and select the `bugator` folder (the one containing `manifest.json`).

5. **Pin the extension**

   Click the puzzle icon 🧩 in Chrome's toolbar → Pin **Bugator**.

You're ready to go! 🐊

---

## 🎮 How to Use

### Reporting a Bug

1. **Activate the picker** — Click the Bugator icon in the toolbar, then click **"Start Picking"**
2. **Hover** — Elements highlight as you move your mouse, showing tag name + dimensions
3. **Click** — Select the buggy element. An annotation widget appears
4. **Describe** — Type what's wrong
5. **Enhance (optional)** — Click ✨ to let AI rewrite your note into a proper bug ticket
6. **Record (optional)** — Click 🔴 to capture a video of the bug in action (max 60s)
7. **Save** — Hit Save. Screenshot, console logs, network requests, and environment info are auto-attached

### Viewing & Managing Bugs

- **Popup** — Quick view of all bugs grouped by URL with counts
- **Dashboard** — Click "Open Dashboard" for the full side panel experience:
  - 🔍 Search by description, selector, or URL
  - 🏷️ Filter by URL or date range (today / week / month)
  - 🖱️ Click any bug → auto-scrolls and highlights the element on the page
  - ✨ Enhance existing bugs with AI after the fact
  - 📋 Copy bug text or 📥 download screenshots/videos

### Exporting

From the popup, use the export dropdown to download all bugs as:
- **JSON** — Full data with screenshots and metadata
- **CSV** — Spreadsheet-friendly format
- **Markdown** — Ready for GitHub issues or docs

---

## 🤖 AI Setup (Optional)

Bugator supports 5 AI providers to enhance bug descriptions:

| Provider | Model |
|----------|-------|
| OpenRouter | Claude 3.5 Sonnet |
| Claude | Claude Sonnet 4 |
| Gemini | Gemini 2.0 Flash |
| OpenAI | GPT-4o Mini |
| Nvidia | Llama 3.3 70B |

### Configure

1. Click the Bugator popup
2. Click the ⚙️ gear icon (inline settings)
3. Select your provider
4. Paste your API key
5. Done — the ✨ button is now active

---

## 📁 Project Structure

```
bugator/
├── manifest.json           # Extension config (Manifest V3)
├── background.js           # Service worker
├── content/
│   ├── content.js          # Element picker + annotation widget
│   ├── content.css         # Overlay & widget styles
│   ├── ai-service.js       # AI provider interface
│   ├── storage.js          # Storage wrapper + export
│   ├── console-capture.js  # Console log interceptor
│   └── network-capture.js  # Fetch/XHR interceptor
├── popup/                  # Toolbar popup UI
├── sidepanel/              # Dashboard (side panel)
├── settings/               # AI provider settings
└── icons/                  # Extension icons
```

---

## 🛡️ Permissions Explained

| Permission | Why |
|-----------|-----|
| `storage` | Save bugs locally in your browser |
| `activeTab` | Access the current tab for element picking |
| `scripting` | Inject content scripts on any page |
| `sidePanel` | Dashboard lives in Chrome's side panel |
| `tabs` | Navigate to bug locations across tabs |
| `tabCapture` | Record tab video for bug reproduction |
| `host_permissions: <all_urls>` | Work on any website |

> ⚠️ **No data leaves your browser** unless you use the AI enhance feature (sends bug text only to your chosen AI provider).

---

## 🧰 Tech Stack

- **Manifest V3** — Latest Chrome extension architecture
- **Vanilla JS** — Zero dependencies, fast and lightweight
- **chrome.storage.local** — Persistent, cross-context storage
- **CSS Custom Properties** — Motion design tokens for smooth animations

---

## 📄 License

MIT — use it, fork it, ship it.

---

<p align="center">
  <sub>Built with 🐊 by <a href="https://github.com/justnishh">justnishh</a></sub>
</p>
