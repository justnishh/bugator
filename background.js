// Bugator - Background Service Worker
// Manages extension state and messaging between popup and content scripts

const STATE_KEY = 'bugator_active_tabs';

// Cross-browser: fallback to storage.local if session not available
const sessionStore = chrome.storage.session || chrome.storage.local;

async function getActiveTabs() {
  try {
    const result = await sessionStore.get(STATE_KEY);
    return result[STATE_KEY] || {};
  } catch {
    return {};
  }
}

async function setTabActive(tabId, active) {
  try {
    const tabs = await getActiveTabs();
    if (active) tabs[tabId] = true;
    else delete tabs[tabId];
    await sessionStore.set({ [STATE_KEY]: tabs });
  } catch {}
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, tabId } = message;

  if (type === 'GET_STATE') {
    getActiveTabs().then(tabs => {
      sendResponse({ active: !!tabs[tabId] });
    }).catch(() => sendResponse({ active: false }));
    return true;
  }

  if (type === 'TOGGLE_PICKER') {
    const targetTabId = tabId || sender.tab?.id;
    if (!targetTabId) { sendResponse({ active: false, error: 'No tab ID' }); return true; }

    (async () => {
      try {
        const tabs = await getActiveTabs();
        const nowActive = !tabs[targetTabId];
        await setTabActive(targetTabId, nowActive);

        // Inject scripts and wait for completion
        try {
          await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            files: ['content/ai-service.js', 'content/storage.js', 'content/content.js']
          });
        } catch {}
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: targetTabId },
            files: ['content/content.css']
          });
        } catch {}

        // Small delay to ensure content script initializes
        await new Promise(r => setTimeout(r, 100));

        try {
          await chrome.tabs.sendMessage(targetTabId, { type: 'SET_PICKER', active: nowActive });
        } catch {}

        sendResponse({ active: nowActive });
      } catch (err) {
        sendResponse({ active: false, error: err.message });
      }
    })();
    return true;
  }

  if (type === 'CAPTURE_SCREENSHOT') {
    try {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ dataUrl: null, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl: dataUrl || null });
        }
      });
    } catch {
      sendResponse({ dataUrl: null });
    }
    return true;
  }

  if (type === 'PICKER_DEACTIVATED') {
    const targetTabId = sender.tab?.id;
    if (targetTabId) setTabActive(targetTabId, false);
    return false;
  }

  return false;
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  setTabActive(tabId, false);
});
