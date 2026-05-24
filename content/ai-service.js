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

const BUG_ENHANCE_PROMPT = `You are an expert Senior QA Automation Engineer and Technical Writer. Your task is to take raw, informal bug notes captured from a browser and rewrite them into a flawless, professional bug ticket suitable for Jira, GitHub, or Azure DevOps.

Follow these strict rules to ensure high quality:
1. Strip out all conversational language, personal pronouns, and filler words.
2. Use precise technical terminology (e.g., "DOM rendering," "UI latency," "viewport," "element state," "layout shift") based on what the notes describe.
3. Fix all grammar, spelling, and phrasing to make it sound highly professional.
4. Do not invent facts. Use ONLY the information provided below.

RAW BUG DATA (captured by Bugator extension):
- User Notes: {description}
- Page URL: {url}
- Target Element: {selector} ({tagName})
- Element HTML: {elementHTML}
- Viewport: {viewport}

Structure your output EXACTLY using this format (plain text, no markdown symbols):

Bug Report: [Clear, concise, action-oriented title, max 80 chars]

Bug Summary:
[2-3 sentence overview of what is failing, where, and the core issue.]

Environment:
URL: {url}
Element: {selector}
Viewport: {viewport}

Steps to Reproduce:
1. Navigate to {url}
2. Locate the {tagName} element ({selector})
3. [Infer minimal steps from context]
4. Observe: [What the user sees at the point of failure]

Expected Result:
[What the system should do under correct operating conditions.]

Actual Result:
[What the system is doing wrong, highlighting the technical failure.]

Severity: [Critical | High | Medium | Low] - [1-sentence explanation of impact on user experience or system stability.]

Component: {selector}`;

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

  const prompt = BUG_ENHANCE_PROMPT
    .replace(/{description}/g, bug.description)
    .replace(/{url}/g, bug.url)
    .replace(/{selector}/g, bug.selector)
    .replace(/{tagName}/g, bug.tagName)
    .replace(/{elementHTML}/g, (bug.elementHTML || '').slice(0, 300))
    .replace(/{viewport}/g, bug.viewport ? `${bug.viewport.width}x${bug.viewport.height}` : 'unknown');

  const response = await callProvider(config.provider, config.apiKey, prompt, provider);
  return response;
}

async function callProvider(providerKey, apiKey, prompt, provider) {
  let url = provider.url;
  let body, headers = provider.headers(apiKey);

  if (providerKey === 'claude') {
    body = JSON.stringify({
      model: provider.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
  } else if (providerKey === 'gemini') {
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    });
  } else {
    // OpenAI-compatible: openrouter, openai, nvidia
    body = JSON.stringify({
      model: provider.model,
      messages: [{ role: 'user', content: prompt }],
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
