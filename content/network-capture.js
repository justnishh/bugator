// Bugator - Network Capture (MAIN world)
// Monkey-patches fetch() and XMLHttpRequest to capture request metadata
// Wrapped in safety checks to never break page functionality

(() => {
  if (window.__bugatorNetworkCapture) return;
  window.__bugatorNetworkCapture = true;

  const post = (entry) => {
    try { window.postMessage({ __bugator: 'network', entry }, '*'); } catch {}
  };

  // Patch fetch - wrapped to never throw
  try {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const start = Date.now();
      const method = (init?.method || 'GET').toUpperCase();
      let url = '';
      try {
        url = (typeof input === 'string' ? input : input?.url || input?.href || '').slice(0, 200);
      } catch { url = ''; }

      return originalFetch.apply(this, arguments).then(response => {
        try {
          post({
            type: 'fetch', method, url,
            status: response.status,
            statusText: response.statusText || '',
            duration: Date.now() - start,
            size: parseInt(response.headers.get('content-length')) || null,
            timestamp: new Date().toISOString(),
            failed: response.status >= 400
          });
        } catch {}
        return response;
      }).catch(err => {
        try {
          post({
            type: 'fetch', method, url,
            status: null, statusText: 'Network Error',
            duration: Date.now() - start,
            size: null,
            timestamp: new Date().toISOString(),
            failed: true
          });
        } catch {}
        throw err;
      });
    };
  } catch {}

  // Patch XMLHttpRequest - wrapped to never throw
  try {
    const XHROpen = XMLHttpRequest.prototype.open;
    const XHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      try { this.__bugator = { method: (method || 'GET').toUpperCase(), url: String(url).slice(0, 200) }; } catch {}
      return XHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      if (this.__bugator) {
        this.__bugator.start = Date.now();
        try {
          this.addEventListener('loadend', () => {
            try {
              post({
                type: 'xhr',
                method: this.__bugator.method,
                url: this.__bugator.url,
                status: this.status || null,
                statusText: this.statusText || '',
                duration: Date.now() - this.__bugator.start,
                size: parseInt(this.getResponseHeader('content-length')) || null,
                timestamp: new Date().toISOString(),
                failed: !this.status || this.status >= 400
              });
            } catch {}
          });
        } catch {}
      }
      return XHRSend.apply(this, arguments);
    };
  } catch {}
})();
