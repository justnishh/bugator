// Bugator - Content Script
// Element picker + annotation widget injected into web pages

(() => {
  if (window.__bugatorLoaded) return;
  window.__bugatorLoaded = true;

  let pickerActive = false;
  let hoveredEl = null;
  let overlay = null;
  let highlightBox = null;

  // --- Phase 6: Buffers for console logs and network requests ---
  let consoleBuffer = [];
  let networkBuffer = [];
  const MAX_CONSOLE = 50;
  const MAX_NETWORK = 30;

  // Listen for messages from MAIN world scripts (console-capture, network-capture)
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== window.location.origin) return;
    if (e.data?.__bugator === 'console') {
      consoleBuffer.push(e.data.entry);
      if (consoleBuffer.length > MAX_CONSOLE) consoleBuffer.shift();
    }
    if (e.data?.__bugator === 'network') {
      networkBuffer.push(e.data.entry);
      if (networkBuffer.length > MAX_NETWORK) networkBuffer.shift();
    }
  });

  // Get environment metadata
  function getEnvironment() {
    const ua = navigator.userAgent;
    let browser = 'Unknown', os = 'Unknown';
    // Parse browser
    if (ua.includes('Edg/')) browser = 'Edge ' + ua.match(/Edg\/([\d.]+)/)?.[1];
    else if (ua.includes('Chrome/')) browser = 'Chrome ' + ua.match(/Chrome\/([\d.]+)/)?.[1];
    else if (ua.includes('Firefox/')) browser = 'Firefox ' + ua.match(/Firefox\/([\d.]+)/)?.[1];
    else if (ua.includes('Safari/')) browser = 'Safari ' + ua.match(/Version\/([\d.]+)/)?.[1];
    // Parse OS
    if (ua.includes('Windows NT 10')) os = ua.includes('Windows NT 10.0; Win64') ? 'Windows 11' : 'Windows 10';
    else if (ua.includes('Windows NT')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '');
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return {
      browser,
      os,
      screenResolution: `${screen.width}×${screen.height}`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      connection: navigator.connection?.effectiveType || null,
      memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null,
      cores: navigator.hardwareConcurrency || null
    };
  }

  // --- Video Recording (Independent of picker) ---
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingStartTime = null;
  let recordingTimer = null;
  let recordingInterval = null;
  let lastRecording = null; // { dataUrl, duration, size }

  // Click ripple during recording
  function onRecordingClick(e) {
    const ripple = document.createElement('div');
    ripple.className = 'bugator-click-ripple ' + (e.button === 2 ? 'bugator-click-ripple--right' : 'bugator-click-ripple--left');
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  async function startRecording(streamId) {
    try {
      let stream;
      if (streamId) {
        // Try tabCapture streamId approach
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
          });
        } catch {
          // Fallback to getDisplayMedia
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },
            audio: false,
            preferCurrentTab: true
          });
        }
      } else {
        // Direct getDisplayMedia (user picks the tab)
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: false,
          preferCurrentTab: true
        });
      }

      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 1000000 });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const duration = Math.round((Date.now() - recordingStartTime) / 1000);
        // Store as blob URL (not dataURL) to avoid memory/storage issues
        lastRecording = { blobUrl: URL.createObjectURL(blob), duration, size: blob.size, blob };
        showRecordingBar('done');
      };

      mediaRecorder.start(1000);
      recordingStartTime = Date.now();
      showRecordingBar('recording');
      document.addEventListener('mousedown', onRecordingClick, true);

      // Auto-stop at 30s

    } catch (err) {
      console.error('[Bugator] Recording failed:', err);
    }
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      showRecordingBar('paused');
    }
  }

  function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      showRecordingBar('recording');
    }
  }

  function stopRecording() {
    if (recordingTimer) { clearTimeout(recordingTimer); recordingTimer = null; }
    if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
    document.removeEventListener('mousedown', onRecordingClick, true);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  function cancelRecording() {
    if (recordingTimer) { clearTimeout(recordingTimer); recordingTimer = null; }
    if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
    document.removeEventListener('mousedown', onRecordingClick, true);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
    }
    recordedChunks = [];
    lastRecording = null;
    removeRecordingBar();
  }

  function showRecordingBar(state) {
    let bar = document.getElementById('bugator-rec-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bugator-rec-bar';
      document.body.appendChild(bar);
    }

    if (state === 'recording') {
      bar.innerHTML = `
        <span class="bugator-rec-dot"></span>
        <span class="bugator-rec-timer">00:00</span>
        <button class="bugator-bar-btn bugator-bar-pause" title="Pause">⏸</button>
        <button class="bugator-bar-btn bugator-bar-stop" title="Stop">⏹</button>
        <button class="bugator-bar-btn bugator-bar-cancel" title="Cancel">✕</button>
      `;
      bar.querySelector('.bugator-bar-pause').onclick = pauseRecording;
      bar.querySelector('.bugator-bar-stop').onclick = stopRecording;
      bar.querySelector('.bugator-bar-cancel').onclick = cancelRecording;
      // Start timer interval
      if (recordingInterval) clearInterval(recordingInterval);
      recordingInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - recordingStartTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        const t = bar.querySelector('.bugator-rec-timer');
        if (t) t.textContent = `${m}:${s}`;
      }, 1000);
    } else if (state === 'paused') {
      bar.innerHTML = `
        <span class="bugator-rec-dot bugator-rec-paused"></span>
        <span class="bugator-rec-timer">PAUSED</span>
        <button class="bugator-bar-btn bugator-bar-resume" title="Resume">▶</button>
        <button class="bugator-bar-btn bugator-bar-stop" title="Stop">⏹</button>
        <button class="bugator-bar-btn bugator-bar-cancel" title="Cancel">✕</button>
      `;
      bar.querySelector('.bugator-bar-resume').onclick = resumeRecording;
      bar.querySelector('.bugator-bar-stop').onclick = stopRecording;
      bar.querySelector('.bugator-bar-cancel').onclick = cancelRecording;
      if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
    } else if (state === 'done') {
      if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
      bar.innerHTML = `
        <span class="bugator-rec-done">✓ Recorded ${lastRecording.duration}s</span>
        <button class="bugator-bar-btn-report">🐛 Report Bug</button>
        <button class="bugator-bar-btn bugator-bar-dismiss" title="Dismiss">✕</button>
      `;
      bar.querySelector('.bugator-bar-btn-report').onclick = () => {
        removeRecordingBar();
        showRecordingBugWidget();
      };
      bar.querySelector('.bugator-bar-dismiss').onclick = removeRecordingBar;
    }
  }

  // Show bug widget directly after recording (no element picking needed)
  function showRecordingBugWidget() {
    document.querySelector('.bugator-widget')?.remove();

    const widget = document.createElement('div');
    widget.className = 'bugator-widget';
    widget.style.top = '50%';
    widget.style.left = '50%';
    widget.style.transform = 'translate(-50%, -50%)';
    widget.style.position = 'fixed';

    widget.innerHTML = `
      <div class="bugator-widget-header">
        <span class="bugator-widget-tag">🎬 Bug from Recording</span>
        <button class="bugator-widget-close" aria-label="Close">×</button>
      </div>
      <textarea class="bugator-widget-input" placeholder="Describe what went wrong in the recording..." rows="4" autofocus></textarea>
      <div class="bugator-widget-actions">
        <span class="bugator-widget-video-badge">🎬 ${lastRecording?.duration || 0}s recorded</span>
        <button class="bugator-widget-ai" title="Enhance with AI">✨ Enhance</button>
        <button class="bugator-widget-submit">Save Bug</button>
      </div>
    `;

    document.body.appendChild(widget);
    requestAnimationFrame(() => {
      widget.querySelector('.bugator-widget-input').focus();
      widget.classList.add('bugator-widget-visible');
    });

    widget.querySelector('.bugator-widget-close').addEventListener('click', () => {
      widget.classList.remove('bugator-widget-visible');
      setTimeout(() => widget.remove(), 180);
    });

    // AI Enhance
    widget.querySelector('.bugator-widget-ai').addEventListener('click', async () => {
      const textarea = widget.querySelector('.bugator-widget-input');
      const description = textarea.value.trim();
      if (!description) return;
      const aiBtn = widget.querySelector('.bugator-widget-ai');
      aiBtn.textContent = '⏳ Enhancing...';
      aiBtn.disabled = true;
      try {
        if (!window.__bugatorAI) throw new Error('AI service not loaded. Reload the page.');
        const bugData = { description, url: window.location.href, selector: 'page', tagName: 'page', elementHTML: '', viewport: { width: window.innerWidth, height: window.innerHeight }, environment: getEnvironment(), consoleLogs: [...consoleBuffer], networkRequests: [...networkBuffer], video: lastRecording ? { duration: lastRecording.duration } : null };
        const enhanced = await window.__bugatorAI.enhanceBug(bugData);
        textarea.value = enhanced.replace(/\*\*/g, '').replace(/###/g, '').replace(/##/g, '').replace(/\*/g, '');
        textarea.style.minHeight = '140px';
        aiBtn.textContent = '✨ Enhanced!';
      } catch (err) {
        aiBtn.textContent = '✨ Enhance';
        aiBtn.disabled = false;
      }
    });

    // Save
    widget.querySelector('.bugator-widget-submit').addEventListener('click', async () => {
      const description = widget.querySelector('.bugator-widget-input').value.trim();
      if (!description) return;
      const submitBtn = widget.querySelector('.bugator-widget-submit');
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      const screenshot = await captureFullPage();

      const bugReport = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        url: window.location.href,
        selector: 'page (video recording)',
        elementHTML: '',
        tagName: 'page',
        description,
        screenshot,
        timestamp: new Date().toISOString(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        position: null,
        environment: getEnvironment(),
        consoleLogs: [...consoleBuffer],
        networkRequests: [...networkBuffer],
        video: lastRecording ? { duration: lastRecording.duration, size: lastRecording.size, blobUrl: lastRecording.blobUrl } : null
      };

      lastRecording = null;

      if (!window.__bugatorDB) { console.error('[Bugator] Storage not loaded'); return; }
      window.__bugatorDB.save(bugReport).then(() => {
        widget.classList.add('bugator-widget-saved');
        setTimeout(() => { widget.classList.remove('bugator-widget-visible'); setTimeout(() => widget.remove(), 180); }, 600);
      }).catch(() => {});
    });

    // Ctrl+Enter to submit
    widget.querySelector('.bugator-widget-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) widget.querySelector('.bugator-widget-submit').click();
    });
  }

  function removeRecordingBar() {
    if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null; }
    document.getElementById('bugator-rec-bar')?.remove();
  }

  // Escape HTML to prevent XSS
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Generate unique CSS selector for an element (prioritizes stable attributes)
  function getSelector(el) {
    // Priority 1: data-testid
    if (el.dataset?.testid) return `[data-testid="${el.dataset.testid}"]`;
    // Priority 2: id
    if (el.id) return `#${el.id}`;
    // Priority 3: aria-label
    if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
    // Priority 4: data-cy / data-test
    if (el.dataset?.cy) return `[data-cy="${el.dataset.cy}"]`;
    if (el.dataset?.test) return `[data-test="${el.dataset.test}"]`;
    // Priority 5: build path
    const parts = [];
    let current = el;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) { parts.unshift(`#${current.id}`); break; }
      if (current.className && typeof current.className === 'string') {
        const cls = current.className.trim().split(/\s+/).filter(c => !c.startsWith('bugator')).slice(0, 2).join('.');
        if (cls) selector += '.' + cls;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          selector += `:nth-child(${[...parent.children].indexOf(current) + 1})`;
        }
      }
      parts.unshift(selector);
      current = parent;
    }
    return parts.join(' > ');
  }

  // Create the overlay container
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'bugator-overlay';
    overlay.classList.add('bugator-active');
    document.body.appendChild(overlay);

    highlightBox = document.createElement('div');
    highlightBox.id = 'bugator-highlight';
    highlightBox.innerHTML = '<span id="bugator-label"></span>';
    document.body.appendChild(highlightBox);
  }

  function removeOverlay() {
    overlay?.remove();
    highlightBox?.remove();
    overlay = null;
    highlightBox = null;
  }

  // Highlight element on hover
  function onMouseMove(e) {
    if (!pickerActive) return;
    // Stop highlighting when annotation widget is open
    if (document.querySelector('.bugator-widget-visible')) return;
    // Hide highlight when over the widget
    if (e.target.closest('.bugator-widget')) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('#bugator-overlay, #bugator-highlight, .bugator-widget') || el.id === 'bugator-highlight') return;
    hoveredEl = el;
    const rect = el.getBoundingClientRect();
    highlightBox.style.top = rect.top + window.scrollY + 'px';
    highlightBox.style.left = rect.left + window.scrollX + 'px';
    highlightBox.style.width = rect.width + 'px';
    highlightBox.style.height = rect.height + 'px';
    highlightBox.classList.add('bugator-visible');

    // Update label
    const label = highlightBox.querySelector('#bugator-label');
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    label.textContent = `${tag}${id} · ${w}×${h}`;
  }

  // Capture full page screenshot (hides widget, keeps highlight)
  function captureFullPage() {
    return new Promise((resolve) => {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) { resolve(null); return; }

      const widget = document.querySelector('.bugator-widget');
      if (widget) widget.style.visibility = 'hidden';

      // Timeout after 5s
      const timeout = setTimeout(() => { if (widget) widget.style.visibility = ''; resolve(null); }, 5000);

      requestAnimationFrame(() => {
        try {
          chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
            clearTimeout(timeout);
            if (widget) widget.style.visibility = '';
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(response?.dataUrl || null);
          });
        } catch {
          clearTimeout(timeout);
          if (widget) widget.style.visibility = '';
          resolve(null);
        }
      });
    });
  }

  // Handle click - show annotation widget
  function onClick(e) {
    if (!pickerActive) return;
    // Don't intercept clicks on the widget itself
    if (e.target.closest('.bugator-widget')) return;

    e.preventDefault();
    e.stopPropagation();

    const el = hoveredEl;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    showAnnotationWidget(el, rect, e.clientX, e.clientY);
  }

  // Show the annotation input widget near the clicked element
  function showAnnotationWidget(el, rect, clickX, clickY) {
    // Remove existing widget
    document.querySelector('.bugator-widget')?.remove();

    const widget = document.createElement('div');
    widget.className = 'bugator-widget';

    // Position near click point
    const top = clickY + window.scrollY + 12;
    const left = Math.min(clickX + window.scrollX, window.innerWidth - 320);
    widget.style.top = top + 'px';
    widget.style.left = left + 'px';

    widget.innerHTML = `
      <div class="bugator-widget-header">
        <span class="bugator-widget-tag">🐛 Report Bug</span>
        <button class="bugator-widget-close" aria-label="Close">×</button>
      </div>
      <textarea class="bugator-widget-input" placeholder="Describe the issue..." rows="3" autofocus></textarea>
      <div class="bugator-widget-meta">
        <span class="bugator-widget-selector" title="${esc(getSelector(el))}">${esc(getSelector(el).slice(0, 40))}</span>
      </div>
      <div class="bugator-widget-actions">
        ${lastRecording ? '<span class="bugator-widget-video-badge">🎬 ' + lastRecording.duration + 's recorded</span>' : ''}
        <button class="bugator-widget-ai" title="Enhance with AI">✨ Enhance</button>
        <button class="bugator-widget-submit">Save Bug</button>
      </div>
    `;

    document.body.appendChild(widget);

    // Focus textarea
    requestAnimationFrame(() => {
      widget.querySelector('.bugator-widget-input').focus();
      widget.classList.add('bugator-widget-visible');
    });

    // Close button
    widget.querySelector('.bugator-widget-close').addEventListener('click', () => {
      widget.classList.remove('bugator-widget-visible');
      setTimeout(() => widget.remove(), 180);
    });

    // AI Enhance button
    widget.querySelector('.bugator-widget-ai').addEventListener('click', async () => {
      const textarea = widget.querySelector('.bugator-widget-input');
      const description = textarea.value.trim();
      if (!description) return;

      const aiBtn = widget.querySelector('.bugator-widget-ai');
      aiBtn.textContent = '⏳ Enhancing...';
      aiBtn.disabled = true;

      try {
        if (!window.__bugatorAI) throw new Error('AI service not loaded. Reload the page.');
        const bugData = {
          description,
          url: window.location.href,
          selector: getSelector(el),
          tagName: el.tagName.toLowerCase(),
          elementHTML: el.outerHTML.slice(0, 500),
          viewport: { width: window.innerWidth, height: window.innerHeight },
          environment: getEnvironment(),
          consoleLogs: [...consoleBuffer],
          networkRequests: [...networkBuffer]
        };
        const enhanced = await window.__bugatorAI.enhanceBug(bugData);
        textarea.value = enhanced.replace(/\*\*/g, '').replace(/###/g, '').replace(/##/g, '').replace(/\*/g, '');
        textarea.style.minHeight = '140px';
        aiBtn.textContent = '✨ Enhanced!';
      } catch (err) {
        aiBtn.textContent = '✨ Enhance';
        aiBtn.disabled = false;
        alert(err.message);
      }
    });

    // Submit
    widget.querySelector('.bugator-widget-submit').addEventListener('click', async () => {
      const description = widget.querySelector('.bugator-widget-input').value.trim();
      if (!description) return;

      const submitBtn = widget.querySelector('.bugator-widget-submit');
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      const screenshot = await captureFullPage();

      const bugReport = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        url: window.location.href,
        selector: getSelector(el),
        elementHTML: el.outerHTML.slice(0, 500),
        tagName: el.tagName.toLowerCase(),
        description,
        screenshot,
        timestamp: new Date().toISOString(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        environment: getEnvironment(),
        consoleLogs: [...consoleBuffer],
        networkRequests: [...networkBuffer],
        video: lastRecording ? { duration: lastRecording.duration, size: lastRecording.size, blobUrl: lastRecording.blobUrl } : null
      };

      // Clear recording after attaching
      lastRecording = null;

      // Save to storage
      if (!window.__bugatorDB) { console.error('[Bugator] Storage not loaded'); return; }
      window.__bugatorDB.save(bugReport).then(() => {
        widget.classList.add('bugator-widget-saved');
        setTimeout(() => {
          widget.classList.remove('bugator-widget-visible');
          setTimeout(() => widget.remove(), 180);
        }, 600);
      }).catch((err) => {
        console.error('[Bugator] Save failed:', err);
      });
    });

    // Submit on Ctrl+Enter
    widget.querySelector('.bugator-widget-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        widget.querySelector('.bugator-widget-submit').click();
      }
    });
  }

  // Activate/deactivate picker
  function activate() {
    pickerActive = true;
    createOverlay();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
  }

  function deactivate() {
    pickerActive = false;
    removeOverlay();
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.querySelector('.bugator-widget')?.remove();
    highlightBox?.classList.remove('bugator-visible');
    consoleBuffer = [];
    networkBuffer = [];
    if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'PICKER_DEACTIVATED' });
  }

  // Cleanup recording on page unload
  window.addEventListener('beforeunload', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SET_PICKER') {
      if (message.active) activate();
      else deactivate();
    }
    if (message.type === 'START_TAB_RECORDING') startRecording();
    if (message.type === 'STOP_TAB_RECORDING') stopRecording();
  });

  // ESC to deactivate
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pickerActive) deactivate();
  });
})();
