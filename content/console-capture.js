// Bugator - Error Capture (MAIN world)
// Captures JS errors and unhandled rejections WITHOUT monkey-patching console
// Zero conflicts with Sentry, React DevTools, or any other tooling

(() => {
  if (window.__bugatorConsoleCapture) return;
  window.__bugatorConsoleCapture = true;

  const post = (entry) => {
    try { window.postMessage({ __bugator: 'console', entry }, '*'); } catch {}
  };

  // Capture uncaught JS errors
  window.addEventListener('error', (e) => {
    post({
      type: 'error',
      message: (e.message || 'Unknown error').slice(0, 500),
      stack: e.error?.stack?.slice(0, 300) || `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`,
      timestamp: new Date().toISOString()
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
    post({
      type: 'error',
      message: msg.slice(0, 500),
      stack: reason?.stack?.slice(0, 300) || null,
      timestamp: new Date().toISOString()
    });
  });
})();
