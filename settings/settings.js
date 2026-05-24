const provider = document.getElementById('provider');
const apiKey = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const toggleKey = document.getElementById('toggleKey');
const status = document.getElementById('status');

// Load existing config
chrome.storage.local.get('bugator_ai_config', (result) => {
  const config = result.bugator_ai_config;
  if (config) {
    provider.value = config.provider || '';
    apiKey.value = config.apiKey || '';
  }
});

// Toggle key visibility
toggleKey.addEventListener('click', () => {
  apiKey.type = apiKey.type === 'password' ? 'text' : 'password';
});

// Save
saveBtn.addEventListener('click', async () => {
  const config = { provider: provider.value, apiKey: apiKey.value.trim() };

  if (!config.provider || !config.apiKey) {
    showStatus('Please select a provider and enter an API key.', 'error');
    return;
  }

  await chrome.storage.local.set({ bugator_ai_config: config });
  showStatus('Settings saved!', 'success');
});

function showStatus(msg, type) {
  status.textContent = msg;
  status.className = 'status ' + type;
  status.hidden = false;
  setTimeout(() => { status.hidden = true; }, 3000);
}
