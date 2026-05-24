// Bugator - Storage Layer
// chrome.storage.local with sessions, URL grouping, multi-format export

(() => {
  const BUGS_KEY = 'bugator_bugs';
  const SESSIONS_KEY = 'bugator_sessions';
  const ACTIVE_SESSION_KEY = 'bugator_active_session';

  async function get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  async function set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  // Simple mutex to prevent concurrent read-modify-write
  let saveLock = false;
  async function withLock(fn) {
    while (saveLock) await new Promise(r => setTimeout(r, 10));
    saveLock = true;
    try { return await fn(); } finally { saveLock = false; }
  }

  async function getBugs() { return (await get(BUGS_KEY)) || []; }
  async function setBugs(bugs) { await set(BUGS_KEY, bugs); }
  async function getSessions() { return (await get(SESSIONS_KEY)) || []; }
  async function setSessions(sessions) { await set(SESSIONS_KEY, sessions); }

  window.__bugatorDB = {
    // Session management
    async getOrCreateSession() {
      let sessionId = await get(ACTIVE_SESSION_KEY);
      if (sessionId) return sessionId;
      // Auto-create new session
      sessionId = 's_' + Date.now().toString(36);
      const session = {
        id: sessionId,
        startedAt: new Date().toISOString(),
        bugCount: 0
      };
      const sessions = await getSessions();
      sessions.push(session);
      await setSessions(sessions);
      await set(ACTIVE_SESSION_KEY, sessionId);
      return sessionId;
    },

    async endSession() {
      const sessionId = await get(ACTIVE_SESSION_KEY);
      if (!sessionId) return;
      const sessions = await getSessions();
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        session.endedAt = new Date().toISOString();
        await setSessions(sessions);
      }
      await set(ACTIVE_SESSION_KEY, null);
    },

    async getSessions() { return getSessions(); },

    // Bug CRUD
    async save(bug) {
      return withLock(async () => {
        const sessionId = await this.getOrCreateSession();
        bug.sessionId = sessionId;
        const bugs = await getBugs();
        bugs.push(bug);
        await setBugs(bugs);
        const sessions = await getSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) { session.bugCount = (session.bugCount || 0) + 1; await setSessions(sessions); }
        return bug;
      });
    },

    async getAll() {
      const bugs = await getBugs();
      return bugs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async getByUrl(url) {
      const bugs = await getBugs();
      return bugs.filter(b => b.url === url).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },

    async getGroupedByUrl() {
      const bugs = await this.getAll();
      const grouped = {};
      for (const bug of bugs) {
        const key = bug.url;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(bug);
      }
      return grouped;
    },

    async remove(id) {
      const bugs = await getBugs();
      await setBugs(bugs.filter(b => b.id !== id));
    },

    async clear() {
      await setBugs([]);
      await setSessions([]);
      await set(ACTIVE_SESSION_KEY, null);
    },

    // Export formats
    async exportJSON() {
      const bugs = await this.getAll();
      return JSON.stringify(bugs.map(b => { const { screenshot, ...rest } = b; return rest; }), null, 2);
    },

    async exportCSV() {
      const bugs = await this.getAll();
      const headers = ['id', 'url', 'selector', 'tagName', 'description', 'timestamp', 'sessionId'];
      const rows = bugs.map(b => headers.map(h => `"${(b[h] || '').toString().replace(/"/g, '""')}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    },

    async exportMarkdown() {
      const grouped = await this.getGroupedByUrl();
      let md = '# Bugator Report\n\n';
      md += `Generated: ${new Date().toISOString()}\n\n`;
      for (const [url, bugs] of Object.entries(grouped)) {
        md += `## ${url}\n\n`;
        for (const bug of bugs) {
          md += `### ${bug.description}\n`;
          md += `- **Element:** \`${bug.selector}\` (${bug.tagName})\n`;
          md += `- **Time:** ${bug.timestamp}\n`;
          md += `- **Session:** ${bug.sessionId || 'none'}\n\n`;
        }
      }
      return md;
    },

    // Legacy alias
    async exportAll() { return this.exportJSON(); }
  };
})();
