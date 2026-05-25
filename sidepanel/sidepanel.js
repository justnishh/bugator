// Bugator - Side Panel Dashboard

const searchInput = document.getElementById('searchInput');
const filterUrl = document.getElementById('filterUrl');
const filterDate = document.getElementById('filterDate');
const bugList = document.getElementById('bugList');
const totalCount = document.getElementById('totalCount');

let allBugs = [];

// Load bugs
async function loadBugs() {
  try {
    const result = await chrome.storage.local.get('bugator_bugs');
    allBugs = (result.bugator_bugs || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    populateUrlFilter();
    applyFilters();
  } catch (e) {
    allBugs = [];
    applyFilters();
  }
}

// Populate URL filter dropdown
function populateUrlFilter() {
  const urls = [...new Set(allBugs.map(b => b.url))];
  filterUrl.innerHTML = '<option value="">All Pages</option>';
  for (const url of urls) {
    let label;
    try { label = new URL(url).hostname + new URL(url).pathname; } catch { label = url; }
    filterUrl.innerHTML += `<option value="${escapeHtml(url)}">${escapeHtml(label.slice(0, 50))}</option>`;
  }
}

// Apply search + filters
function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  const urlFilter = filterUrl.value;
  const dateFilter = filterDate.value;
  const now = new Date();

  let filtered = allBugs;

  if (urlFilter) filtered = filtered.filter(b => b.url === urlFilter);

  if (dateFilter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    filtered = filtered.filter(b => b.timestamp >= start);
  } else if (dateFilter === 'week') {
    const start = new Date(now - 7 * 86400000).toISOString();
    filtered = filtered.filter(b => b.timestamp >= start);
  } else if (dateFilter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    filtered = filtered.filter(b => b.timestamp >= start);
  }

  if (query) {
    filtered = filtered.filter(b =>
      b.description.toLowerCase().includes(query) ||
      b.selector.toLowerCase().includes(query) ||
      b.tagName.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query)
    );
  }

  renderBugs(filtered);
}

// Render helpers for Phase 6 sections
function renderEnvPills(env) {
  if (!env) return '';
  const pills = [env.browser, env.os, env.viewport, env.colorScheme, env.connection].filter(Boolean);
  if (!pills.length) return '';
  return `<div class="bug-card-env">${pills.map(p => `<span class="env-pill">${escapeHtml(p)}</span>`).join('')}</div>`;
}

function renderConsoleLogs(logs) {
  if (!logs || !logs.length) return '';
  const errors = logs.filter(l => l.type === 'error' || l.type === 'uncaught' || l.type === 'unhandledrejection').length;
  const typeClass = { error: 'console-error', warn: 'console-warn', uncaught: 'console-error', unhandledrejection: 'console-error' };
  const typeLabel = { error: 'ERR', warn: 'WRN', log: 'LOG', info: 'INF', debug: 'DBG', uncaught: 'ERR', unhandledrejection: 'ERR' };
  let entries = logs.slice(-20).reverse().map(l => {
    const cls = typeClass[l.type] || 'console-log';
    const lbl = typeLabel[l.type] || 'LOG';
    const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    return `<div class="console-entry ${cls}"><span class="console-type">${lbl}</span><span class="console-msg">${escapeHtml((l.message || '').slice(0, 200))}</span><span class="console-time">${time}</span></div>`;
  }).join('');
  return `<div class="bug-card-console"><button class="console-toggle" data-action="toggle-console"><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M2 1l4 3-4 3z"/></svg> Console <span class="console-count">${logs.length}</span>${errors ? `<span class="console-errors">${errors} error${errors > 1 ? 's' : ''}</span>` : ''}</button><div class="console-entries">${entries}</div></div>`;
}

function renderNetworkRequests(reqs) {
  if (!reqs || !reqs.length) return '';
  const failed = reqs.filter(r => r.failed).length;
  const sorted = [...reqs.filter(r => r.failed), ...reqs.filter(r => !r.failed)].slice(0, 20);
  let entries = sorted.map(r => {
    const statusCls = r.status >= 500 ? 'status-500' : r.status >= 400 ? 'status-400' : r.status >= 300 ? 'status-300' : 'status-200';
    const urlShort = r.url ? (r.url.length > 40 ? '...' + r.url.slice(-37) : r.url) : '';
    return `<div class="network-entry${r.failed ? ' network-fail' : ''}"><span class="network-method">${r.method || 'GET'}</span><span class="network-url" title="${escapeHtml(r.url || '')}">${escapeHtml(urlShort)}</span><span class="network-status ${statusCls}">${r.status || '—'}</span><span class="network-duration">${r.duration ? r.duration + 'ms' : ''}</span></div>`;
  }).join('');
  return `<div class="bug-card-network"><button class="network-toggle" data-action="toggle-network"><svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M2 1l4 3-4 3z"/></svg> Network <span class="network-count">${reqs.length}</span>${failed ? `<span class="network-failed">${failed} failed</span>` : ''}</button><div class="network-entries">${entries}</div></div>`;
}

function renderVideo(bug) {
  if (!bug.video) return '';
  const src = bug.video.dataUrl || bug.video.blobUrl || '';
  if (!src) return `<div class="bug-card-video"><div class="video-actions-row"><span class="video-play-btn" style="opacity:0.5;cursor:default"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Recording (${bug.video.duration || 0}s) — reload page to play</span></span></div></div>`;
  return `<div class="bug-card-video"><div class="video-actions-row"><button class="video-play-btn" data-action="play-video"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Play Recording</span><span class="video-duration">${bug.video.duration || 0}s</span></button><button class="video-dl-btn" data-action="download-video" title="Download recording"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button></div><div class="video-player" hidden><video controls src="${src}"></video></div></div>`;
}

// Render
function renderBugs(bugs) {
  totalCount.textContent = `${bugs.length} bug${bugs.length !== 1 ? 's' : ''}`;

  if (!bugs.length) {
    bugList.innerHTML = '<p class="empty-state">No bugs match your filters.</p>';
    return;
  }

  // Group by URL
  const grouped = {};
  for (const bug of bugs) {
    if (!grouped[bug.url]) grouped[bug.url] = [];
    grouped[bug.url].push(bug);
  }

  let html = '';
  for (const [url, urlBugs] of Object.entries(grouped)) {
    let label;
    try { label = new URL(url).hostname + new URL(url).pathname; } catch { label = url; }
    html += `<div class="url-divider">
      <span>${escapeHtml(label.slice(0, 45))}</span>
      <span class="url-divider-count">${urlBugs.length}</span>
    </div>`;

    for (const bug of urlBugs) {
      html += `
        <div class="bug-card" data-id="${bug.id}" data-url="${escapeHtml(bug.url)}" data-selector="${escapeHtml(bug.selector)}">
          <div class="bug-card-header">
            <span class="bug-card-tag">${bug.tagName}</span>
            <div class="bug-card-actions">
              <button class="bug-card-btn btn-ai" title="Enhance with AI" data-action="enhance">✨</button>
              <button class="bug-card-btn btn-edit" title="Edit description" data-action="edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="bug-card-btn btn-copy" title="Copy bug text" data-action="copy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
              <button class="bug-card-btn btn-highlight" title="Highlight on page" data-action="highlight">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/>
                </svg>
              </button>
              <button class="bug-card-btn btn-delete" title="Delete bug" data-action="delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <p class="bug-card-desc">${formatDescription(bug.description, bug.enhanced)}</p>
          ${renderEnvPills(bug.environment)}
          <div class="bug-card-meta">
            <span class="bug-card-selector" title="${escapeHtml(bug.selector)}">${escapeHtml(bug.selector.slice(0, 35))}</span>
            <span class="bug-card-time">${formatTime(bug.timestamp)}</span>
          </div>
          ${renderConsoleLogs(bug.consoleLogs)}
          ${renderNetworkRequests(bug.networkRequests)}
          ${bug.video ? renderVideo(bug) : ''}
          ${bug.screenshot ? `<div class="bug-card-screenshot"><button class="screenshot-download" data-action="download" title="Download screenshot">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              </button><img src="${bug.screenshot}" alt="Screenshot"></div>` : ''}
        </div>`;
    }
  }

  bugList.innerHTML = html;
}

// Event delegation for highlight and delete
bugList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const card = btn.closest('.bug-card');
  const id = card.dataset.id;
  const action = btn.dataset.action;

  if (action === 'toggle-console') {
    const entries = btn.closest('.bug-card-console').querySelector('.console-entries');
    const expanded = entries.style.display === 'block';
    entries.style.display = expanded ? 'none' : 'block';
    btn.querySelector('svg').style.transform = expanded ? '' : 'rotate(90deg)';
    return;
  }

  if (action === 'toggle-network') {
    const entries = btn.closest('.bug-card-network').querySelector('.network-entries');
    const expanded = entries.style.display === 'block';
    entries.style.display = expanded ? 'none' : 'block';
    btn.querySelector('svg').style.transform = expanded ? '' : 'rotate(90deg)';
    return;
  }

  if (action === 'play-video') {
    const videoSection = btn.closest('.bug-card-video');
    const video = videoSection.querySelector('.video-player video');
    if (!video || !video.src) return;
    const modal = document.createElement('div');
    modal.className = 'bugator-video-modal';
    modal.innerHTML = `<video controls autoplay src="${video.src}"></video><button class="bugator-video-modal-close">&times;</button>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    const close = () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 180); };
    modal.querySelector('.bugator-video-modal-close').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    return;
  }

  if (action === 'download-video') {
    const bug = allBugs.find(b => b.id === id);
    if (bug?.video?.dataUrl) {
      const a = document.createElement('a');
      a.href = bug.video.dataUrl;
      a.download = `bugator-${bug.id}.webm`;
      a.click();
    }
    return;
  }

  if (action === 'edit') {
    const descEl = card.querySelector('.bug-card-desc');
    if (descEl.querySelector('.edit-area')) return;
    const bug = allBugs.find(b => b.id === id);
    if (!bug) return;
    const original = bug.description;
    descEl.innerHTML = `<textarea class="edit-area">${escapeHtml(original)}</textarea><div class="edit-btns"><button class="edit-save" data-action="edit-save">Save</button><button class="edit-cancel" data-action="edit-cancel">Cancel</button></div>`;
    descEl.querySelector('.edit-area').focus();
    return;
  }

  if (action === 'edit-save') {
    const descEl = card.querySelector('.bug-card-desc');
    const newText = descEl.querySelector('.edit-area').value.trim();
    if (!newText) return;
    const result = await chrome.storage.local.get('bugator_bugs');
    const bugs = result.bugator_bugs || [];
    const idx = bugs.findIndex(b => b.id === id);
    if (idx !== -1) { bugs[idx].description = newText; bugs[idx].enhanced = false; await chrome.storage.local.set({ bugator_bugs: bugs }); }
    loadBugs();
    return;
  }

  if (action === 'edit-cancel') {
    loadBugs();
    return;
  }

  if (action === 'delete') {
    await deleteBug(id);
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    card.style.transition = 'opacity 180ms, transform 180ms';
    setTimeout(() => { card.remove(); loadBugs(); }, 180);
  }

  if (action === 'copy') {
    const bug = allBugs.find(b => b.id === id);
    if (bug) {
      let text = bug.description.replace(/\*\*/g, '').replace(/##/g, '').replace(/\*/g, '');
      if (bug.environment) {
        text += `\n\n--- Environment ---\n${bug.environment.browser} · ${bug.environment.os} · ${bug.environment.viewport} · ${bug.environment.colorScheme}`;
      }
      const errors = (bug.consoleLogs || []).filter(l => l.type === 'error' || l.type === 'uncaught');
      if (errors.length) {
        text += `\n\n--- Console Errors ---\n` + errors.slice(0, 5).map(e => `[ERR] ${e.message}`).join('\n');
      }
      const failedReqs = (bug.networkRequests || []).filter(r => r.failed);
      if (failedReqs.length) {
        text += `\n\n--- Failed Requests ---\n` + failedReqs.slice(0, 5).map(r => `${r.method} ${r.url} → ${r.status} (${r.duration}ms)`).join('\n');
      }
      await navigator.clipboard.writeText(text);
      btn.innerHTML = '✓';
      setTimeout(() => { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'; }, 1500);
    }
  }

  if (action === 'download') {
    const bug = allBugs.find(b => b.id === id);
    if (bug?.screenshot) {
      const a = document.createElement('a');
      a.href = bug.screenshot;
      a.download = `bugator-${bug.id}.png`;
      a.click();
    }
  }

  if (action === 'enhance') {
    await enhanceBugCard(id, card, btn);
  }

  if (action === 'highlight') {
    const selector = card.dataset.selector;
    const url = card.dataset.url;
    await highlightElement(selector, url);
  }
});

// Delete a bug
async function deleteBug(id) {
  try {
    const result = await chrome.storage.local.get('bugator_bugs');
    const bugs = (result.bugator_bugs || []).filter(b => b.id !== id);
    await chrome.storage.local.set({ bugator_bugs: bugs });
  } catch (e) {}
}

// Highlight element on the page
async function highlightElement(selector, url) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tab = tabs.find(t => t.url && !t.url.startsWith('chrome'));
    if (!tab && tabs.length) tab = tabs[0];
    if (!tab) return;
    const tabId = tab.id;

    // If not on the same URL, navigate and wait
    if (!tab.url || tab.url !== url) {
      await chrome.tabs.update(tabId, { url, active: true });
      // Wait for page to fully load
      await new Promise(resolve => {
        const check = setInterval(async () => {
          try {
            const t = await chrome.tabs.get(tabId);
            if (t.status === 'complete') {
              clearInterval(check);
              resolve();
            }
          } catch { clearInterval(check); resolve(); }
        }, 300);
        setTimeout(() => { clearInterval(check); resolve(); }, 10000);
      });
      // Wait for DOM to be ready
      await new Promise(r => setTimeout(r, 1500));
    }

    // Inject highlight
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        document.querySelectorAll('.bugator-pulse-highlight').forEach(el => el.remove());
        const target = document.querySelector(sel);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const rect = target.getBoundingClientRect();
          const highlight = document.createElement('div');
          highlight.className = 'bugator-pulse-highlight';
          highlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 2px solid #22C55E;
            border-radius: 4px;
            background: rgba(34, 197, 94, 0.1);
            z-index: 2147483645;
            pointer-events: none;
            animation: bugator-pulse 1.5s ease-in-out 3;
          `;
          const style = document.createElement('style');
          style.textContent = `@keyframes bugator-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`;
          document.body.appendChild(style);
          document.body.appendChild(highlight);
          setTimeout(() => { highlight.remove(); style.remove(); }, 4500);
        }, 400);
      },
      args: [selector]
    });
  } catch (e) {}
}

// Enhance bug with AI
async function enhanceBugCard(id, card, btn) {
  const bug = allBugs.find(b => b.id === id);
  if (!bug) return;

  btn.innerHTML = '⏳';
  btn.disabled = true;

  try {
    const config = await chrome.storage.local.get('bugator_ai_config');
    const aiConfig = config.bugator_ai_config;
    if (!aiConfig || !aiConfig.apiKey) throw new Error('AI not configured. Open Bugator settings.');

    const enhanced = await callAI(aiConfig, bug);

    // Update bug in storage
    const result = await chrome.storage.local.get('bugator_bugs');
    const bugs = result.bugator_bugs || [];
    const idx = bugs.findIndex(b => b.id === id);
    if (idx !== -1) {
      bugs[idx].description = enhanced;
      bugs[idx].enhanced = true;
      await chrome.storage.local.set({ bugator_bugs: bugs });
    }
    loadBugs();
  } catch (err) {
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.4 5.7 21l2.3-7L2 9.4h7.6z"/></svg>';
    btn.disabled = false;
    showToast(err.message, 'error');
  }
}

// AI call from sidepanel
async function callAI(config, bug) {
  const providers = {
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'anthropic/claude-3.5-sonnet' },
    claude: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514' },
    gemini: { url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` },
    openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.3-70b-instruct' }
  };

  const p = providers[config.provider];

  const systemMsg = `You are a Senior QA Engineer writing bug tickets for a development team. You produce concise, technically precise, actionable bug reports. Rules:
- Use ONLY the provided data. Never invent steps, errors, or behaviors not evidenced in the input.
- If console errors or failed network requests are provided, incorporate them as root cause evidence.
- Severity is based on: Critical = app crash/data loss/security, High = feature broken/blocked, Medium = degraded UX/visual, Low = cosmetic/minor.
- Output plain text only. No markdown symbols, no asterisks, no hashtags.`;

  let userMsg = `RAW BUG CAPTURE:

User Notes: ${bug.description || 'No description'}
Page URL: ${bug.url || 'unknown'}
Element: ${bug.selector || 'unknown'} (${bug.tagName || 'unknown'})
Element HTML: ${(bug.elementHTML || '').slice(0, 500)}
Viewport: ${bug.viewport ? `${bug.viewport.width}x${bug.viewport.height}` : 'unknown'}`;

  if (bug.environment) {
    const env = bug.environment;
    userMsg += `\n\nEnvironment:\nBrowser: ${env.browser || 'unknown'}\nOS: ${env.os || 'unknown'}\nScreen: ${env.screenResolution || 'unknown'} @ ${env.devicePixelRatio || 1}x DPR\nColor Scheme: ${env.colorScheme || 'unknown'}\nConnection: ${env.connection || 'unknown'}`;
  }

  if (bug.consoleLogs && bug.consoleLogs.length > 0) {
    const logs = bug.consoleLogs.slice(-10).map(l => `[${l.level}] ${l.message}${l.stack ? ' | ' + l.stack.slice(0, 100) : ''}`).join('\n');
    userMsg += `\n\nConsole Errors/Warnings:\n${logs}`;
  }

  if (bug.networkRequests && bug.networkRequests.length > 0) {
    const failed = bug.networkRequests.filter(r => r.failed || r.status >= 400).slice(-5);
    if (failed.length > 0) {
      const reqs = failed.map(r => `${r.method || 'GET'} ${r.url} → ${r.status || 'failed'} (${r.duration || '?'}ms)`).join('\n');
      userMsg += `\n\nFailed Network Requests:\n${reqs}`;
    }
  }

  if (bug.video) userMsg += `\n\nVideo Evidence: ${bug.video.duration || 0}s screen recording attached.`;
  if (bug.screenshot) userMsg += `\nScreenshot: attached.`;

  userMsg += `\n\nWrite the bug report in this EXACT format:

Bug Report: [action-oriented title, max 80 chars]

Bug Summary:
[2-3 sentences: what fails, where, impact]

Environment:
[Browser, OS, viewport, relevant device info]

Steps to Reproduce:
1. [Step based on URL and element]
2. [Step based on context]
3. Observe: [what user sees]

Expected Result:
[Correct behavior]

Actual Result:
[Broken behavior, cite console errors or network failures if present]

Severity: [Critical | High | Medium | Low] - [why]

Component: [element or page area]`;

  let url, headers, body;

  if (config.provider === 'claude') {
    url = p.url;
    headers = { 'x-api-key': config.apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
    body = JSON.stringify({ model: p.model, max_tokens: 1024, system: systemMsg, messages: [{ role: 'user', content: userMsg }] });
  } else if (config.provider === 'gemini') {
    url = p.url(config.apiKey);
    headers = { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey };
    body = JSON.stringify({ contents: [{ parts: [{ text: systemMsg + '\n\n' + userMsg }] }] });
  } else {
    url = p.url;
    headers = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
    body = JSON.stringify({ model: p.model, messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }], max_tokens: 1024 });
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`AI error (${res.status})`);
  const data = await res.json();

  if (config.provider === 'claude') return data.content?.[0]?.text || '';
  if (config.provider === 'gemini') return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return data.choices?.[0]?.message?.content || '';
}

// Format bug description - enhanced bugs get structured rendering
function formatDescription(text, isEnhanced) {
  if (!isEnhanced) return escapeHtml(text);
  let clean = text.replace(/\*\*/g, '').replace(/##/g, '').replace(/###/g, '').replace(/\*/g, '');
  clean = escapeHtml(clean);
  clean = clean.replace(/^(Bug Report|Bug Summary|Environment|Steps to Reproduce|Expected Result|Actual Result|Severity|Component|URL|Element|Viewport|Observe):/gm, '<strong>$1:</strong>');
  clean = clean.replace(/^(\d+\.\s)/gm, '<span class="step-num">$1</span>');
  clean = clean.replace(/\n/g, '<br>');
  return clean;
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

// Toast notification
function showToast(msg, type = 'info') {
  const existing = document.querySelector('.bugator-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `bugator-toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-visible'); }, 10);
  setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 200); }, 3000);
}

// Debounce utility
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// Event listeners
searchInput.addEventListener('input', debounce(applyFilters, 150));
filterUrl.addEventListener('change', applyFilters);
filterDate.addEventListener('change', applyFilters);

// Listen for storage changes to auto-refresh
chrome.storage.onChanged.addListener((changes) => {
  if (changes.bugator_bugs) loadBugs();
});

// Init
loadBugs();
