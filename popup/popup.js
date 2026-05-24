// Bugator - Popup Script

const toggleBtn = document.getElementById('toggleBtn');
const recordBtn = document.getElementById('recordBtn');
const bugList = document.getElementById('bugList');
const bugCount = document.getElementById('bugCount');
const pageCount = document.getElementById('pageCount');
const exportBtn = document.getElementById('exportBtn');
const exportFormat = document.getElementById('exportFormat');
const clearBtn = document.getElementById('clearBtn');

let currentTabId = null;
let isActive = false;

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Record button - starts recording on the active tab
recordBtn.addEventListener('click', async () => {
  const tab = await getCurrentTab();
  if (!tab) return;
  // Inject content scripts first
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/ai-service.js', 'content/storage.js', 'content/content.js'] });
  } catch {}
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] });
  } catch {}
  // Tell content script to start recording (getDisplayMedia will prompt user)
  chrome.tabs.sendMessage(tab.id, { type: 'START_TAB_RECORDING' });
  window.close();
});

function updateToggleUI(active) {
  isActive = active;
  toggleBtn.classList.toggle('active', active);
  toggleBtn.querySelector('span').textContent = active ? 'Stop Picking' : 'Start Picking';
}

// Load and render bugs grouped by URL
async function loadBugs() {
  const result = await chrome.storage.local.get('bugator_bugs');
  const bugs = (result.bugator_bugs || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  renderBugs(bugs);
}

function renderBugs(bugs) {
  if (!bugs.length) {
    bugList.innerHTML = '<p class="empty-state">No bugs reported yet.<br>Click "Start Picking" to begin.</p>';
    bugCount.textContent = '0';
    pageCount.textContent = '0';
    return;
  }

  // Group by URL
  const grouped = {};
  for (const bug of bugs) {
    const key = bug.url;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(bug);
  }

  const urls = Object.keys(grouped);
  bugCount.textContent = bugs.length;
  pageCount.textContent = urls.length;

  let html = '';
  for (const url of urls) {
    const urlBugs = grouped[url];
    let pathname;
    try { pathname = new URL(url).hostname + new URL(url).pathname; } catch { pathname = url; }
    html += `<div class="url-group">`;
    html += `<div class="url-group-header" title="${escapeHtml(url)}">
      <span class="url-group-name">${escapeHtml(pathname.slice(0, 40))}</span>
      <span class="url-group-count">${urlBugs.length}</span>
    </div>`;
    for (const bug of urlBugs.slice(0, 5)) {
      html += `
        <div class="bug-item" data-id="${bug.id}">
          <div class="bug-item-header">
            <span class="bug-item-tag">${bug.tagName}</span>
            <time class="bug-item-time">${formatTime(bug.timestamp)}</time>
          </div>
          <p class="bug-item-desc">${escapeHtml(bug.description)}</p>
        </div>`;
    }
    if (urlBugs.length > 5) {
      html += `<span class="url-group-more">+${urlBugs.length - 5} more</span>`;
    }
    html += `</div>`;
  }
  bugList.innerHTML = html;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString();
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Toggle picker
toggleBtn.addEventListener('click', async () => {
  const tab = await getCurrentTab();
  if (!tab) return;
  currentTabId = tab.id;
  chrome.runtime.sendMessage({ type: 'TOGGLE_PICKER', tabId: tab.id }, (response) => {
    if (response) updateToggleUI(response.active);
  });
});

// Open side panel dashboard
document.getElementById('dashboardBtn').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  if (tab && chrome.sidePanel?.open) {
    chrome.sidePanel.open({ tabId: tab.id });
  } else {
    // Fallback: open dashboard in a new tab (Firefox/older browsers)
    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html') });
  }
});

// Open settings inline
document.getElementById('settingsBtn').addEventListener('click', () => {
  const popup = document.querySelector('.popup');
  const existing = document.getElementById('settingsView');
  if (existing) { existing.remove(); popup.style.display = ''; return; }

  popup.style.display = 'none';

  const view = document.createElement('div');
  view.id = 'settingsView';
  view.className = 'settings-inline';
  view.innerHTML = `
    <div class="settings-inline-header">
      <button id="settingsBack" class="btn-icon-sm" title="Back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h2>AI Settings</h2>
    </div>
    <div class="settings-inline-body">
      <div class="field">
        <label>Provider</label>
        <select id="inlineProvider">
          <option value="">Select provider...</option>
          <option value="openrouter">OpenRouter</option>
          <option value="claude">Claude (Anthropic)</option>
          <option value="gemini">Gemini (Google)</option>
          <option value="openai">OpenAI</option>
          <option value="nvidia">Nvidia NIM</option>
        </select>
      </div>
      <div class="field">
        <label>API Key</label>
        <input type="password" id="inlineApiKey" placeholder="sk-..." autocomplete="off">
      </div>
      <button id="inlineSave" class="btn-primary">Save</button>
      <div id="inlineStatus" class="inline-status" hidden></div>
    </div>
  `;
  document.body.appendChild(view);

  // Load existing
  chrome.storage.local.get('bugator_ai_config', (result) => {
    const config = result.bugator_ai_config;
    if (config) {
      document.getElementById('inlineProvider').value = config.provider || '';
      document.getElementById('inlineApiKey').value = config.apiKey || '';
    }
  });

  // Back button
  document.getElementById('settingsBack').addEventListener('click', () => {
    view.remove();
    popup.style.display = '';
  });

  // Save
  document.getElementById('inlineSave').addEventListener('click', async () => {
    const provider = document.getElementById('inlineProvider').value;
    const apiKey = document.getElementById('inlineApiKey').value.trim();
    if (!provider || !apiKey) {
      showInlineStatus('Select provider and enter key.', 'error');
      return;
    }
    await chrome.storage.local.set({ bugator_ai_config: { provider, apiKey } });
    showInlineStatus('Saved!', 'success');
  });

  function showInlineStatus(msg, type) {
    const s = document.getElementById('inlineStatus');
    s.textContent = msg;
    s.className = 'inline-status ' + type;
    s.hidden = false;
    setTimeout(() => { s.hidden = true; }, 2000);
  }
});

// Multi-format export
exportBtn.addEventListener('click', async () => {
  const result = await chrome.storage.local.get('bugator_bugs');
  const bugs = result.bugator_bugs || [];
  if (!bugs.length) return;

  const format = exportFormat.value;
  let content, mime, ext;

  if (format === 'csv') {
    const headers = ['id', 'url', 'selector', 'tagName', 'description', 'timestamp', 'sessionId'];
    const rows = bugs.map(b => headers.map(h => `"${(b[h] || '').toString().replace(/"/g, '""')}"`).join(','));
    content = [headers.join(','), ...rows].join('\n');
    mime = 'text/csv';
    ext = 'csv';
  } else if (format === 'md') {
    const grouped = {};
    for (const bug of bugs) { if (!grouped[bug.url]) grouped[bug.url] = []; grouped[bug.url].push(bug); }
    let md = '# Bugator Report\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;
    for (const [url, urlBugs] of Object.entries(grouped)) {
      md += `## ${url}\n\n`;
      for (const bug of urlBugs) {
        md += `### ${bug.description}\n`;
        md += `- **Element:** \`${bug.selector}\` (${bug.tagName})\n`;
        md += `- **Time:** ${bug.timestamp}\n\n`;
      }
    }
    content = md;
    mime = 'text/markdown';
    ext = 'md';
  } else {
    content = JSON.stringify(bugs.map(b => { const { screenshot, ...rest } = b; return rest; }), null, 2);
    mime = 'application/json';
    ext = 'json';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bugator-export-${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
});

// Custom confirm modal
function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('modalMessage').textContent = message;
    modal.hidden = false;
    document.getElementById('modalConfirm').onclick = () => { modal.hidden = true; resolve(true); };
    document.getElementById('modalCancel').onclick = () => { modal.hidden = true; resolve(false); };
  });
}

// Clear all bugs
clearBtn.addEventListener('click', async () => {
  const confirmed = await showConfirm('Clear all bug reports? This cannot be undone.');
  if (!confirmed) return;
  await chrome.storage.local.set({ bugator_bugs: [], bugator_sessions: [], bugator_active_session: null });
  loadBugs();
});

// Init
(async () => {
  const tab = await getCurrentTab();
  if (!tab) return;
  currentTabId = tab.id;
  chrome.runtime.sendMessage({ type: 'GET_STATE', tabId: tab.id }, (response) => {
    if (response) updateToggleUI(response.active);
  });
  loadBugs();
})();
