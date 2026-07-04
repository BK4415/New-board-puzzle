/**
 * Board Puzzle — Popup System
 * Manages modal overlays: info pages (about/guide/policy), win screen,
 * pause screen, and generic alert dialogs.
 * Content pages are loaded via fetch and injected inline — no page navigation.
 */

const Popup = (() => {
  let overlayEl    = null;
  let contentEl    = null;
  let currentClose = null;

  /* ── Bootstrap: ensure overlay exists in DOM ─────────────────────────── */
  function ensureOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'popupOverlay';
    overlayEl.className = 'popup-overlay';
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');

    contentEl = document.createElement('div');
    contentEl.className = 'popup-content';
    overlayEl.appendChild(contentEl);

    document.body.appendChild(overlayEl);

    // Tap backdrop to close
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) close();
    });

    // Keyboard close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayEl.classList.contains('visible')) close();
    });
  }

  /* ── Open with raw HTML ─────────────────────────────────────────────── */
  async function openHTML(html, opts = {}) {
    ensureOverlay();
    contentEl.innerHTML = html;
    overlayEl.classList.add('visible');
    if (opts.wide) contentEl.classList.add('wide');
    else contentEl.classList.remove('wide');

    await Animation.popupIn(overlayEl);
    currentClose = opts.onClose || null;
  }

  /* ── Open an info page via fetch ────────────────────────────────────── */
  async function openPage(url, opts = {}) {
    ensureOverlay();

    // Loading state
    contentEl.innerHTML = `
      <div class="popup-loading">
        <div class="popup-spinner"></div>
        <p>Loading…</p>
      </div>
    `;
    overlayEl.classList.add('visible');
    contentEl.classList.add('wide');
    await Animation.popupIn(overlayEl);

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();

      // Parse and extract just <body> content
      const parser = new DOMParser();
      const doc    = parser.parseFromString(html, 'text/html');
      const body   = doc.querySelector('.page-content') || doc.body;

      contentEl.innerHTML = `
        <button class="popup-close-btn" id="popupClose" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="popup-page-body">${body.innerHTML}</div>
      `;

      document.getElementById('popupClose')?.addEventListener('click', close);

    } catch (err) {
      contentEl.innerHTML = `
        <button class="popup-close-btn" id="popupClose" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="popup-page-body">
          <h2>Could not load content</h2>
          <p>Please check your connection and try again.</p>
        </div>
      `;
      document.getElementById('popupClose')?.addEventListener('click', close);
    }

    currentClose = opts.onClose || null;
  }

  /* ── Win popup ──────────────────────────────────────────────────────── */
  async function openWin({ moves, time, size, mode, style, isRecord, onPlayAgain, onHome, onShare }) {
    const timeStr = Dashboard.formatTime(time);
    const modeLabel = { classic: 'Classic', snake: 'Snake', spiral: 'Spiral', 'upside-down': 'Upside Down' }[mode] || mode;

    await openHTML(`
      <div class="win-popup">
        <div class="win-trophy">
          <img src="assets/trophy.png" alt="Trophy" class="trophy-img" draggable="false"/>
        </div>

        <h2 class="win-title">Congratulations!</h2>
        ${isRecord ? '<div class="win-record-badge">🏆 NEW RECORD!</div>' : ''}

        <div class="win-stats">
          <div class="win-stat">
            <span class="ws-label">Moves</span>
            <span class="ws-value">${moves}</span>
          </div>
          <div class="win-stat">
            <span class="ws-label">Time</span>
            <span class="ws-value">${timeStr}</span>
          </div>
          <div class="win-stat">
            <span class="ws-label">Grid</span>
            <span class="ws-value">${size}×${size}</span>
          </div>
          <div class="win-stat">
            <span class="ws-label">Mode</span>
            <span class="ws-value">${style === 'photo' ? 'Photo' : modeLabel}</span>
          </div>
        </div>

        <div class="win-actions">
          <button class="win-btn primary" id="winPlayAgain">Play Again</button>
          <button class="win-btn secondary" id="winHome">Home</button>
          <button class="win-btn share" id="winShare">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
      </div>
    `);

    document.getElementById('winPlayAgain')?.addEventListener('click', () => { close(); onPlayAgain?.(); });
    document.getElementById('winHome')?.addEventListener('click', () => { close(); onHome?.(); });
    document.getElementById('winShare')?.addEventListener('click', () => { onShare?.(); });
  }

  /* ── Pause popup ────────────────────────────────────────────────────── */
  async function openPause({ moves, time, onResume, onHome, onRestart }) {
    const timeStr = Dashboard.formatTime(time);

    await openHTML(`
      <div class="pause-popup">
        <div class="pause-icon">⏸</div>
        <h2 class="pause-title">Paused</h2>
        <div class="pause-info">
          <span>${moves} moves</span> &bull; <span>${timeStr}</span>
        </div>
        <div class="pause-actions">
          <button class="win-btn primary" id="pauseResume">Resume</button>
          <button class="win-btn secondary" id="pauseRestart">Restart</button>
          <button class="win-btn secondary" id="pauseHome">Home</button>
        </div>
      </div>
    `);

    document.getElementById('pauseResume')?.addEventListener('click', () => { close(); onResume?.(); });
    document.getElementById('pauseRestart')?.addEventListener('click', () => { close(); onRestart?.(); });
    document.getElementById('pauseHome')?.addEventListener('click', () => { close(); onHome?.(); });
  }

  /* ── Generic confirm dialog ─────────────────────────────────────────── */
  async function confirm({ title, message, confirmText = 'OK', cancelText = 'Cancel' }) {
    return new Promise(async (resolve) => {
      await openHTML(`
        <div class="confirm-popup">
          <h3 class="confirm-title">${title}</h3>
          <p class="confirm-msg">${message}</p>
          <div class="confirm-actions">
            <button class="win-btn secondary" id="confirmCancel">${cancelText}</button>
            <button class="win-btn primary" id="confirmOK">${confirmText}</button>
          </div>
        </div>
      `);

      document.getElementById('confirmOK')?.addEventListener('click', () => { close(); resolve(true); });
      document.getElementById('confirmCancel')?.addEventListener('click', () => { close(); resolve(false); });
    });
  }

  /* ── Install PWA popup ──────────────────────────────────────────────── */
  async function openInstall() {
    const deferredPrompt = window._pwaInstallPrompt;
    if (deferredPrompt) {
      close();
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') window._pwaInstallPrompt = null;
    } else {
      await openHTML(`
        <div class="confirm-popup">
          <h3 class="confirm-title">Install Board Puzzle</h3>
          <p class="confirm-msg">
            To install:<br>
            <strong>iOS Safari:</strong> Tap Share → "Add to Home Screen"<br>
            <strong>Android:</strong> Tap the browser menu → "Install app"<br>
            <strong>Desktop:</strong> Click the install icon in your browser's address bar.
          </p>
          <div class="confirm-actions">
            <button class="win-btn primary" id="installOK">Got it</button>
          </div>
        </div>
      `);
      document.getElementById('installOK')?.addEventListener('click', close);
    }
  }

  /* ── Close ──────────────────────────────────────────────────────────── */
  async function close() {
    if (!overlayEl || !overlayEl.classList.contains('visible')) return;
    overlayEl.classList.remove('visible');
    contentEl.classList.remove('wide');
    contentEl.innerHTML = '';
    currentClose?.();
    currentClose = null;
  }

  return { openHTML, openPage, openWin, openPause, confirm, openInstall, close };
})();
