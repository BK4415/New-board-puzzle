/**
 * Board Puzzle — App Controller (Home Screen)
 * Manages mode/grid/preset selection, live preview rendering,
 * resume card, info/dashboard drawers, theme, and PWA install prompt.
 */

/* ══════════════════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════════════════ */
const AppState = {
  style:     'number',   // 'number' | 'photo'
  grid:       3,
  mode:      'classic',  // number sub-modes
  preset:     1,         // photo preset 1-5
  imageURL:   null,      // user-uploaded blob URL
  theme:     'auto',
  sound:      true,
};

/* ══════════════════════════════════════════════════════════════════════════
   PREVIEW RENDERER
══════════════════════════════════════════════════════════════════════════ */
const Preview = (() => {
  let previewCanvas = null;
  let previewCtx    = null;
  let currentImgURL = null;
  let imgCache      = {};

  function getCanvas() {
    if (!previewCanvas) {
      previewCanvas = document.getElementById('previewCanvas');
      if (previewCanvas) previewCtx = previewCanvas.getContext('2d');
    }
    return previewCanvas;
  }

  /**
   * Render the solved board state in the preview canvas.
   * For number mode: draw wood tiles with numbers.
   * For photo mode: draw image tiles.
   */
  async function render() {
    const canvas = getCanvas();
    if (!canvas || !previewCtx) return;

    const { style, grid, mode, preset, imageURL } = AppState;
    const size   = grid;
    const n      = size * size;
    const gap    = size <= 3 ? 8 : size <= 4 ? 7 : 5;
    const pad    = 8;
    const total  = canvas.width - pad * 2;
    const ts     = Math.floor((total - gap * (size - 1)) / size);

    // Build solved tiles for preview display
    const tiles = BoardState.createSolvedTiles(size, style === 'photo' ? 'classic' : mode);

    // Background
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    previewCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Board background
    const boardColor = isDark ? '#1C1008' : '#6B3A1F';
    roundRect(previewCtx, 0, 0, canvas.width, canvas.height, 16, boardColor);

    // Load photo image if needed
    let photoImg = null;
    if (style === 'photo') {
      const url = imageURL || `assets/preset-${preset}.jpg`;
      try {
        if (!imgCache[url]) {
          imgCache[url] = await ImageProcessor.loadImage(url);
        }
        photoImg = imgCache[url];
      } catch (e) { photoImg = null; }
    }

    // Draw each tile
    for (let idx = 0; idx < n; idx++) {
      const val = tiles[idx];
      const row = Math.floor(idx / size);
      const col = idx % size;
      const x   = pad + col * (ts + gap);
      const y   = pad + row * (ts + gap);

      if (val === 0) continue; // empty space — skip

      if (style === 'photo' && photoImg) {
        // Crop photo region for this tile
        const srcSize = Math.min(photoImg.naturalWidth, photoImg.naturalHeight);
        const srcX    = (photoImg.naturalWidth  - srcSize) / 2;
        const srcY    = (photoImg.naturalHeight - srcSize) / 2;
        const cellSrc = srcSize / size;
        const tileRow = Math.floor((val - 1) / size);
        const tileCol = (val - 1) % size;

        // Clip rounded rect then draw image
        previewCtx.save();
        roundRectClip(previewCtx, x, y, ts, ts, 6);
        previewCtx.drawImage(
          photoImg,
          srcX + tileCol * cellSrc, srcY + tileRow * cellSrc, cellSrc, cellSrc,
          x, y, ts, ts
        );
        previewCtx.restore();

        // Thin border
        roundRect(previewCtx, x, y, ts, ts, 6, null, isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)', 1.5);
      } else {
        // Wood-style number tile
        const grad = previewCtx.createLinearGradient(x, y, x + ts, y + ts);
        if (isDark) {
          grad.addColorStop(0, '#3A2810');
          grad.addColorStop(0.5, '#2D1E0C');
          grad.addColorStop(1, '#1A1008');
        } else {
          grad.addColorStop(0, '#D4A56A');
          grad.addColorStop(0.4, '#C08040');
          grad.addColorStop(1, '#8B5020');
        }

        // Shadow
        previewCtx.save();
        previewCtx.globalAlpha = 0.35;
        roundRect(previewCtx, x + 3, y + 3, ts, ts, 6, isDark ? '#000' : '#5A2E10');
        previewCtx.restore();

        // Tile face
        roundRect(previewCtx, x, y, ts, ts, 6, grad);

        // Top shine
        previewCtx.save();
        roundRectClip(previewCtx, x, y, ts, Math.floor(ts * 0.35), 6);
        previewCtx.fillStyle = 'rgba(255,255,255,0.12)';
        previewCtx.fillRect(x, y, ts, Math.floor(ts * 0.35));
        previewCtx.restore();

        // Border
        roundRect(previewCtx, x, y, ts, ts, 6, null, isDark ? 'rgba(200,150,50,0.3)' : 'rgba(180,120,40,0.6)', 1.5);

        // Number
        const fontSize = Math.max(10, Math.floor(ts * 0.38));
        previewCtx.fillStyle = isDark ? '#E8D5A3' : '#2C1508';
        previewCtx.font = `bold ${fontSize}px system-ui, sans-serif`;
        previewCtx.textAlign = 'center';
        previewCtx.textBaseline = 'middle';
        previewCtx.shadowColor = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.3)';
        previewCtx.shadowBlur = 2;
        previewCtx.fillText(val, x + ts / 2, y + ts / 2);
        previewCtx.shadowBlur = 0;
      }
    }
  }

  /* Helpers */
  function roundRect(ctx, x, y, w, h, r, fill, stroke, sw) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : fallbackRoundRect(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 1; ctx.stroke(); }
  }

  function roundRectClip(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : fallbackRoundRect(ctx, x, y, w, h, r);
    ctx.clip();
  }

  function fallbackRoundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  return { render };
})();

/* ══════════════════════════════════════════════════════════════════════════
   THEME MANAGEMENT
══════════════════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  const isDark = theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  AppState.theme = theme;

  // Update toggle button in info drawer if visible
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RESUME CARD
══════════════════════════════════════════════════════════════════════════ */
function updateResumeCard() {
  const session = Storage.getGameSession();
  const card    = document.getElementById('resumeCard');
  if (!card) return;

  if (!session) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  const cfg = session.config;
  const modeLabel = { classic: 'Classic', snake: 'Snake', spiral: 'Spiral', 'upside-down': 'Upside Down' };
  const styleStr  = cfg.style === 'photo' ? 'Photo' : (modeLabel[cfg.mode] || cfg.mode);

  card.querySelector('.resume-grid').textContent  = `${cfg.size}×${cfg.size}`;
  card.querySelector('.resume-mode').textContent  = styleStr;
  card.querySelector('.resume-moves').textContent = `${session.moves} moves`;
  card.querySelector('.resume-time').textContent  = Dashboard.formatTime(session.time || 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   SELECTOR UI HELPERS
══════════════════════════════════════════════════════════════════════════ */
function selectBtn(groupSelector, activeValue, dataAttr = 'value') {
  document.querySelectorAll(groupSelector).forEach((btn) => {
    const match = btn.dataset[dataAttr] === String(activeValue);
    btn.classList.toggle('active', match);
    btn.setAttribute('aria-pressed', match);
  });
}

function updateModeSection() {
  const numSection   = document.getElementById('numModeSection');
  const photoSection = document.getElementById('photoModeSection');
  const gridBtns     = document.querySelectorAll('.grid-btn');

  if (AppState.style === 'photo') {
    numSection?.classList.add('hidden');
    photoSection?.classList.remove('hidden');
    // Disable 4×4 and 5×5 in photo mode
    gridBtns.forEach((btn) => {
      const g = parseInt(btn.dataset.grid);
      btn.disabled = g !== 3;
      btn.classList.toggle('disabled', g !== 3);
    });
    AppState.grid = 3;
    selectBtn('.grid-btn', 3, 'grid');
  } else {
    numSection?.classList.remove('hidden');
    photoSection?.classList.add('hidden');
    gridBtns.forEach((btn) => { btn.disabled = false; btn.classList.remove('disabled'); });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   INFO DRAWER
══════════════════════════════════════════════════════════════════════════ */
function buildInfoDrawer() {
  const drawer = document.getElementById('infoDrawer');
  if (!drawer) return;

  drawer.innerHTML = `
    <div class="drawer-header">
      <button class="drawer-close" id="infoClose" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <h2 class="drawer-title">Information</h2>
    </div>

    <nav class="info-nav">
      <button class="info-nav-btn" data-page="about.html">
        <span class="inb-icon">ℹ️</span>
        <span class="inb-label">About</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="info-nav-btn" data-page="guide.html">
        <span class="inb-icon">📖</span>
        <span class="inb-label">How to Play</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="info-nav-btn" data-page="policy.html">
        <span class="inb-icon">🔒</span>
        <span class="inb-label">Privacy Policy</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="info-nav-btn" id="installAppBtn">
        <span class="inb-icon">📲</span>
        <span class="inb-label">Install App</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="info-nav-btn" id="shareAppBtn">
        <span class="inb-icon">🔗</span>
        <span class="inb-label">Share App</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="info-nav-btn" id="themeToggleBtn">
        <span class="inb-icon">🌙</span>
        <span class="inb-label" id="themeLabel">Dark Mode</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="info-nav-btn" id="soundToggleBtn">
        <span class="inb-icon" id="soundIcon">🔊</span>
        <span class="inb-label" id="soundLabel">Sound On</span>
        <svg class="inb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </nav>

    <div class="info-footer">
      <p>Made with ❤️ for puzzle lovers</p>
      <p class="info-version">Board Puzzle v1.0</p>
    </div>
  `;

  // Wire close
  drawer.querySelector('#infoClose').addEventListener('click', () => closeInfoDrawer());

  // Page links
  drawer.querySelectorAll('.info-nav-btn[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Sound.play('click');
      Popup.openPage(btn.dataset.page);
    });
  });

  // Install
  drawer.querySelector('#installAppBtn').addEventListener('click', () => {
    Sound.play('click');
    Popup.openInstall();
  });

  // Share
  drawer.querySelector('#shareAppBtn').addEventListener('click', () => {
    Sound.play('click');
    const text = 'Play Board Puzzle — a premium sliding puzzle game! 🧩\n[ADD LINK HERE]';
    if (navigator.share) {
      navigator.share({ title: 'Board Puzzle', text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(() => alert('Link copied!')).catch(() => {});
    }
  });

  // Theme toggle
  drawer.querySelector('#themeToggleBtn').addEventListener('click', () => {
    Sound.play('click');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next   = isDark ? 'light' : 'dark';
    applyTheme(next);
    const prefs  = Storage.getPrefs();
    prefs.theme  = next;
    Storage.setPrefs(prefs);
    Preview.render();

    const icon  = drawer.querySelector('.inb-icon');
    const label = drawer.querySelector('#themeLabel');
    if (icon)  icon.textContent  = isDark ? '🌙' : '☀️';
    if (label) label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
  });

  // Sound toggle
  drawer.querySelector('#soundToggleBtn').addEventListener('click', () => {
    const muted = Sound.toggleMute();
    AppState.sound = !muted;
    const prefs = Storage.getPrefs(); prefs.sound = !muted; Storage.setPrefs(prefs);
    const icon  = drawer.querySelector('#soundIcon');
    const label = drawer.querySelector('#soundLabel');
    if (icon)  icon.textContent  = muted ? '🔇' : '🔊';
    if (label) label.textContent = muted ? 'Sound Off' : 'Sound On';
    if (!muted) Sound.play('click');
  });

  // Set initial sound state
  const muted = !AppState.sound;
  const soundIcon  = drawer.querySelector('#soundIcon');
  const soundLabel = drawer.querySelector('#soundLabel');
  if (soundIcon)  soundIcon.textContent  = muted ? '🔇' : '🔊';
  if (soundLabel) soundLabel.textContent = muted ? 'Sound Off' : 'Sound On';
}

function openInfoDrawer() {
  const drawer = document.getElementById('infoDrawer');
  if (!drawer) return;
  drawer.classList.add('open');
  Sound.play('click');
}

function closeInfoDrawer() {
  const drawer = document.getElementById('infoDrawer');
  drawer?.classList.remove('open');
}

function openDashDrawer() {
  const drawer = document.getElementById('dashDrawer');
  if (!drawer) return;
  const inner = drawer.querySelector('.dash-inner');
  if (inner) Dashboard.renderDashboard(inner);
  drawer.classList.add('open');
  Sound.play('click');
}

function closeDashDrawer() {
  const drawer = document.getElementById('dashDrawer');
  drawer?.classList.remove('open');
}

/* ══════════════════════════════════════════════════════════════════════════
   SWIPE TO OPEN DRAWERS
══════════════════════════════════════════════════════════════════════════ */
function bindDrawerSwipes() {
  let startX = 0;
  const THRESHOLD = 60;
  const EDGE = 40; // px from screen edge

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const dx   = endX - startX;

    if (Math.abs(dx) < THRESHOLD) return;

    // Only trigger if no drawer is open
    const dashOpen = document.getElementById('dashDrawer')?.classList.contains('open');
    const infoOpen = document.getElementById('infoDrawer')?.classList.contains('open');
    const popupOpen = document.getElementById('popupOverlay')?.classList.contains('visible');
    if (popupOpen) return;

    if (dx > 0 && startX < EDGE && !dashOpen) {
      openDashDrawer(); // swipe right from left edge → dashboard
    } else if (dx < 0 && startX > window.innerWidth - EDGE && !infoOpen) {
      openInfoDrawer(); // swipe left from right edge → info
    }
  }, { passive: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   START GAME
══════════════════════════════════════════════════════════════════════════ */
function startGame() {
  Sound.play('click');
  const config = {
    size:     AppState.grid,
    mode:     AppState.style === 'photo' ? 'classic' : AppState.mode,
    style:    AppState.style,
    preset:   AppState.preset,
    imageURL: AppState.imageURL || null,
  };

  // Save to sessionStorage for game.html to read
  sessionStorage.setItem('bp_gameConfig', JSON.stringify(config));

  // Save prefs
  const prefs      = Storage.getPrefs();
  prefs.lastStyle  = AppState.style;
  prefs.lastGrid   = AppState.grid;
  prefs.lastMode   = AppState.mode;
  prefs.lastPreset = AppState.preset;
  Storage.setPrefs(prefs);

  // Clear existing session so game starts fresh
  Storage.clearGameSession();

  window.location.href = 'game.html';
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN INIT
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  /* ── Restore prefs ────────────────────────────────────────────────── */
  const prefs = Storage.getPrefs();
  AppState.style   = prefs.lastStyle  || 'number';
  AppState.grid    = prefs.lastGrid   || 3;
  AppState.mode    = prefs.lastMode   || 'classic';
  AppState.preset  = prefs.lastPreset || 1;
  AppState.sound   = prefs.sound !== false;
  AppState.theme   = prefs.theme || 'auto';

  /* ── Apply theme ──────────────────────────────────────────────────── */
  applyTheme(AppState.theme);

  /* ── PWA install prompt capture ─────────────────────────────────── */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._pwaInstallPrompt = e;
  });

  /* ── Sound init ───────────────────────────────────────────────────── */
  Sound.setMute(!AppState.sound);
  await Sound.init();

  /* ── Service Worker ───────────────────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  /* ── Style toggle (Number / Photo) ───────────────────────────────── */
  document.querySelectorAll('.style-btn').forEach((btn) => {
    if (btn.dataset.style === AppState.style) btn.classList.add('active');
    btn.addEventListener('click', () => {
      Sound.play('click');
      Animation.ripple(event, btn);
      AppState.style = btn.dataset.style;
      selectBtn('.style-btn', AppState.style, 'style');
      updateModeSection();
      Preview.render();
    });
  });

  /* ── Grid selector ────────────────────────────────────────────────── */
  document.querySelectorAll('.grid-btn').forEach((btn) => {
    if (parseInt(btn.dataset.grid) === AppState.grid) btn.classList.add('active');
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      Sound.play('click');
      Animation.ripple(event, btn);
      AppState.grid = parseInt(btn.dataset.grid);
      selectBtn('.grid-btn', AppState.grid, 'grid');
      Preview.render();
    });
  });

  /* ── Number mode selector ─────────────────────────────────────────── */
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    if (btn.dataset.mode === AppState.mode) btn.classList.add('active');
    btn.addEventListener('click', () => {
      Sound.play('click');
      Animation.ripple(event, btn);
      AppState.mode = btn.dataset.mode;
      selectBtn('.mode-btn', AppState.mode, 'mode');
      Preview.render();
    });
  });

  /* ── Photo preset selector ────────────────────────────────────────── */
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    if (parseInt(btn.dataset.preset) === AppState.preset) btn.classList.add('active');
    btn.addEventListener('click', () => {
      Sound.play('click');
      Animation.ripple(event, btn);
      AppState.preset   = parseInt(btn.dataset.preset);
      AppState.imageURL = null; // clear upload
      selectBtn('.preset-btn', AppState.preset, 'preset');
      Preview.render();
    });
  });

  /* ── Photo upload ─────────────────────────────────────────────────── */
  const uploadInput = document.getElementById('photoUpload');
  const uploadBtn   = document.getElementById('uploadBtn');

  uploadBtn?.addEventListener('click', () => {
    Sound.play('click');
    uploadInput?.click();
  });

  uploadInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await ImageProcessor.fileToURL(file);
      AppState.imageURL = url;
      selectBtn('.preset-btn', -1, 'preset'); // deselect all presets
      Preview.render();
    } catch (err) {
      console.warn('[App] Image upload failed:', err);
    }
  });

  /* ── Info / Dashboard buttons ─────────────────────────────────────── */
  document.getElementById('infoBtn')?.addEventListener('click', () => {
    Sound.play('click');
    openInfoDrawer();
  });
  document.getElementById('dashBtn')?.addEventListener('click', () => {
    Sound.play('click');
    openDashDrawer();
  });

  /* ── Drawer backdrop click to close ──────────────────────────────── */
  document.getElementById('infoDrawer')?.addEventListener('click', (e) => {
    if (e.target.id === 'infoDrawer') closeInfoDrawer();
  });
  document.getElementById('dashDrawer')?.addEventListener('click', (e) => {
    if (e.target.id === 'dashDrawer') closeDashDrawer();
  });

  /* ── Start button ─────────────────────────────────────────────────── */
  document.getElementById('startBtn')?.addEventListener('click', startGame);

  /* ── Resume button ────────────────────────────────────────────────── */
  document.getElementById('resumeBtn')?.addEventListener('click', () => {
    Sound.play('click');
    const session = Storage.getGameSession();
    if (!session) return;
    sessionStorage.setItem('bp_gameConfig', JSON.stringify(session.config));
    window.location.href = 'game.html';
  });

  /* ── Build drawers ────────────────────────────────────────────────── */
  buildInfoDrawer();

  /* ── Swipe gestures for drawers ───────────────────────────────────── */
  bindDrawerSwipes();

  /* ── Initial UI state ─────────────────────────────────────────────── */
  updateModeSection();
  selectBtn('.style-btn', AppState.style, 'style');
  selectBtn('.grid-btn', AppState.grid, 'grid');
  selectBtn('.mode-btn', AppState.mode, 'mode');
  selectBtn('.preset-btn', AppState.preset, 'preset');
  updateResumeCard();

  /* ── Resize → re-render preview ───────────────────────────────────── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => Preview.render(), 150);
  });

  /* ── Initial preview render ───────────────────────────────────────── */
  await Preview.render();

  /* ── System theme change ──────────────────────────────────────────── */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (AppState.theme === 'auto') {
      applyTheme('auto');
      Preview.render();
    }
  });
});
