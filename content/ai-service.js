// Bugator - AI Service Layer
// Unified interface for OpenRouter, Claude, Gemini, OpenAI, Nvidia

(() => {
if (window.__bugatorAI) return;

const AI_PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'anthropic/claude-3.5-sonnet',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' })
  },
  claude: {
    name: 'Claude',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    headers: (key) => ({ 'x-api-key': key, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' })
  },
  gemini: {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    headers: (key) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': key })
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' })
  },
  nvidia: {
    name: 'Nvidia',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.3-70b-instruct',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' })
  }
};

const BUG_ENHANCE_SYSTEM = `You are a Senior QA Engineer writing bug tickets for a development team. You produce concise, technically precise, actionable bug reports. Rules:
- Use ONLY the provided data. Never invent steps, errors, or behaviors not evidenced in the input.
- If console errors or failed network requests are provided, incorporate them as root cause evidence.
- Severity is based on: Critical = app crash/data loss/security, High = feature broken/blocked, Medium = degraded UX/visual, Low = cosmetic/minor.
- Output plain text only. No markdown symbols, no asterisks, no hashtags.`;

function buildUserPrompt(bug) {
  let prompt = `RAW BUG CAPTURE:

User Notes: ${bug.description || 'No description'}
Page URL: ${bug.url || 'unknown'}
Element: ${bug.selector || 'unknown'} (${bug.tagName || 'unknown'})
Element HTML: ${(bug.elementHTML || '').slice(0, 500)}
Viewport: ${bug.viewport ? `${bug.viewport.width}x${bug.viewport.height}` : 'unknown'}`;

  if (bug.environment) {
    const env = bug.environment;
    prompt += `\n\nEnvironment:
Browser: ${env.browser || 'unknown'}
OS: ${env.os || 'unknown'}
Screen: ${env.screenResolution || 'unknown'} @ ${env.devicePixelRatio || 1}x DPR
Language: ${env.language || 'unknown'}
Timezone: ${env.timezone || 'unknown'}
Color Scheme: ${env.colorScheme || 'unknown'}
Connection: ${env.connection || 'unknown'}
Memory: ${env.memory || 'unknown'}
CPU Cores: ${env.cores || 'unknown'}`;
  }

  if (bug.consoleLogs && bug.consoleLogs.length > 0) {
    const logs = bug.consoleLogs.slice(-10).map(l => `[${l.level}] ${l.message}${l.stack ? ' | ' + l.stack.slice(0, 100) : ''}`).join('\n');
    prompt += `\n\nConsole Errors/Warnings (most recent):\n${logs}`;
  }

  if (bug.networkRequests && bug.networkRequests.length > 0) {
    const failed = bug.networkRequests.filter(r => r.failed || r.status >= 400).slice(-5);
    if (failed.length > 0) {
      const reqs = failed.map(r => `${r.method || 'GET'} ${r.url} → ${r.status || 'failed'} (${r.duration || '?'}ms)`).join('\n');
      prompt += `\n\nFailed Network Requests:\n${reqs}`;
    }
  }

  if (bug.video) prompt += `\n\nVideo Evidence: ${bug.video.duration || 0}s screen recording attached.`;
  if (bug.screenshot) prompt += `\nScreenshot: attached.`;

  prompt += `\n\nWrite the bug report in this EXACT format:

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

  return prompt;
}

async function getAIConfig() {
  const result = await chrome.storage.local.get('bugator_ai_config');
  return result.bugator_ai_config || null;
}

async function enhanceBug(bug) {
  const config = await getAIConfig();
  if (!config || !config.apiKey || !config.provider) {
    throw new Error('AI not configured. Open Bugator settings to add your API key.');
  }

  const provider = AI_PROVIDERS[config.provider];
  if (!provider) throw new Error('Unknown provider: ' + config.provider);

  const systemMsg = BUG_ENHANCE_SYSTEM;
  const userMsg = buildUserPrompt(bug);

  const response = await callProvider(config.provider, config.apiKey, systemMsg, userMsg, provider);
  return response;
}

async function callProvider(providerKey, apiKey, systemMsg, userMsg, provider) {
  let url = provider.url;
  let body, headers = provider.headers(apiKey);

  if (providerKey === 'claude') {
    body = JSON.stringify({
      model: provider.model,
      max_tokens: 1024,
      system: systemMsg,
      messages: [{ role: 'user', content: userMsg }]
    });
  } else if (providerKey === 'gemini') {
    body = JSON.stringify({
      contents: [{ parts: [{ text: systemMsg + '\n\n' + userMsg }] }]
    });
  } else {
    // OpenAI-compatible: openrouter, openai, nvidia
    body = JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg }
      ],
      max_tokens: 1024
    });
  }

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();

  // Extract text from response based on provider
  if (providerKey === 'claude') {
    return data.content?.[0]?.text || '';
  } else if (providerKey === 'gemini') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

// Export for use in content script and sidepanel
window.__bugatorAI = { enhanceBug, getAIConfig, AI_PROVIDERS };
})();
