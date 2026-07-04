/**
 * Board Puzzle — Game Controller
 * Manages game state, DOM rendering, input handling (click/swipe/keyboard),
 * timer, undo/redo, photo tile rendering, win detection, and autosave.
 */

class Game {
  /**
   * @param {object} config
   * @param {number} config.size      – 3 | 4 | 5
   * @param {string} config.mode      – 'classic'|'snake'|'spiral'|'upside-down'
   * @param {string} config.style     – 'number' | 'photo'
   * @param {number} config.preset    – 1-5 (photo mode)
   * @param {string} [config.imageURL] – blob URL for user-uploaded image
   */
  constructor(config) {
    this.config      = { size: 3, mode: 'classic', style: 'number', preset: 1, ...config };
    this.board       = new BoardState(this.config.size, this.config.style === 'photo' ? 'classic' : this.config.mode);
    this.moves       = 0;
    this.time        = 0;           // seconds elapsed
    this.timerHandle = null;
    this.paused      = false;
    this.started     = false;       // becomes true after first move or shuffle
    this.usedUndo    = false;
    this.showNumbers = true;        // photo mode eye toggle
    this.tileDOMMap  = new Map();   // value → <div class="tile">
    this.imageURL    = config.imageURL || null;
    this.photoTiles  = [];          // array of canvas elements (1-indexed, [0] unused)
    this.isAnimating = false;

    // Touch / pointer tracking for swipe detection
    this._ptrStart = null;

    // Tile pixel sizing (computed in buildBoard)
    this.tileSize = 0;
    this.gap      = 0;
    this.boardPx  = 0;
  }

  /* ══════════════════════════════════════════════════════════════════════
     INITIALISATION
  ══════════════════════════════════════════════════════════════════════ */

  async init() {
    // Load saved session if one exists and matches config
    const session = Storage.getGameSession();
    if (session && session.config.size    === this.config.size &&
                    session.config.mode   === this.config.mode &&
                    session.config.style  === this.config.style &&
                    session.config.preset === this.config.preset) {
      this._loadSession(session);
    } else {
      this.board.shuffle(140 + this.config.size * 20);
      this.moves = 0; this.time = 0;
    }

    // For photo mode, pre-process the image into tile canvases
    if (this.config.style === 'photo') {
      await this._loadPhotoTiles();
    }

    this._computeTileSize();
    this._buildBoardDOM();
    this._renderTiles(true); // instant placement
    this._bindInputs();
    this._updateUI();
    this._startTimer();
    this.started = true;
  }

  /* ── Photo image loading ─────────────────────────────────────────────── */
  async _loadPhotoTiles() {
    const url = this.imageURL || `assets/preset-${this.config.preset}.jpg`;
    try {
      const { tiles } = await ImageProcessor.processImage(url, this.config.size, 720);
      // photoTiles[i] = canvas for solved position i (0-indexed, row-major)
      // tile value 1 → photoTiles[0], value 2 → photoTiles[1], etc.
      this.photoTiles = tiles; // 0-indexed, length = size²
    } catch (e) {
      console.warn('[Game] Photo load failed, falling back to gradient tiles', e);
      this.photoTiles = [];
    }
  }

  /* ── Tile size calculation ───────────────────────────────────────────── */
  _computeTileSize() {
    const boardEl   = document.getElementById('boardContainer');
    const available = Math.min(
      boardEl ? boardEl.clientWidth - 16 : window.innerWidth - 48,
      window.innerHeight - 280,
      420,
    );
    this.gap      = this.config.size <= 3 ? 8 : this.config.size <= 4 ? 7 : 5;
    this.tileSize = Math.floor((available - this.gap * (this.config.size - 1) - 8) / this.config.size);
    this.boardPx  = this.tileSize * this.config.size + this.gap * (this.config.size - 1) + 8;
  }

  /* ── DOM board build ─────────────────────────────────────────────────── */
  _buildBoardDOM() {
    const boardEl = document.getElementById('boardContainer');
    if (!boardEl) return;

    boardEl.innerHTML = '';
    boardEl.style.width  = `${this.boardPx}px`;
    boardEl.style.height = `${this.boardPx}px`;
    boardEl.style.position = 'relative';

    // Create one DOM element per non-empty tile value
    const n = this.config.size * this.config.size;
    for (let val = 0; val <= n - 1; val++) {
      const el = document.createElement('div');
      el.className = val === 0 ? 'tile empty' : `tile`;
      el.dataset.value = val;
      el.style.width   = `${this.tileSize}px`;
      el.style.height  = `${this.tileSize}px`;
      el.style.position = 'absolute';
      el.style.transition = ''; // transitions handled by animation.js

      if (val !== 0) {
        // Number label
        const numLabel = document.createElement('span');
        numLabel.className = 'tile-num';
        numLabel.textContent = val;
        el.appendChild(numLabel);

        // Photo background (photo mode)
        if (this.config.style === 'photo' && this.photoTiles.length > 0) {
          const tileCanvas = this.photoTiles[val - 1]; // val 1 → index 0
          if (tileCanvas) {
            el.style.backgroundImage  = `url(${tileCanvas.toDataURL('image/jpeg', 0.92)})`;
            el.style.backgroundSize   = 'cover';
            el.style.backgroundRepeat = 'no-repeat';
            el.classList.add('photo-tile');
          }
        }
      }

      this.tileDOMMap.set(val, el);
      boardEl.appendChild(el);
    }

    // Update sub-header labels
    const modeLabel = { classic: 'Classic', snake: 'Snake', spiral: 'Spiral', 'upside-down': 'Upside Down' };
    const styleStr  = this.config.style === 'photo' ? 'Photo' : (modeLabel[this.config.mode] || this.config.mode);

    const gameMode = document.getElementById('gameMode');
    const gameGrid = document.getElementById('gameGrid');
    if (gameMode) gameMode.textContent = styleStr;
    if (gameGrid) gameGrid.textContent = `${this.config.size}×${this.config.size}`;

    // Show/hide eye button (photo mode only)
    const eyeBtn = document.getElementById('eyeBtn');
    if (eyeBtn) eyeBtn.style.display = this.config.style === 'photo' ? 'flex' : 'none';
  }

  /* ── Render tiles at their logical positions ────────────────────────── */
  _renderTiles(instant = false) {
    const { size, tileSize, gap } = this;

    this.board.tiles.forEach((val, idx) => {
      const el  = this.tileDOMMap.get(val);
      if (!el) return;
      const row = Math.floor(idx / size);
      const col = idx % size;
      const x   = col * (tileSize + gap) + 4;
      const y   = row * (tileSize + gap) + 4;

      if (instant) {
        el.style.left = `${x}px`;
        el.style.top  = `${y}px`;
      }
      // Animated positioning is handled in _doMove() / _doSwipe()
      el._targetX = x;
      el._targetY = y;
    });

    // Photo mode: toggle number visibility
    if (this.config.style === 'photo') {
      const numEls = document.querySelectorAll('.tile-num');
      numEls.forEach((n) => {
        n.style.display = this.showNumbers ? '' : 'none';
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     INPUT BINDING
  ══════════════════════════════════════════════════════════════════════ */

  _bindInputs() {
    const boardEl = document.getElementById('boardContainer');
    if (!boardEl) return;

    /* ── Pointer / touch for click and swipe ──────────────────────────── */
    boardEl.addEventListener('pointerdown', (e) => {
      this._ptrStart = { x: e.clientX, y: e.clientY, target: e.target };
    }, { passive: true });

    boardEl.addEventListener('pointerup', (e) => {
      if (!this._ptrStart || this.paused || this.isAnimating) return;
      const dx = e.clientX - this._ptrStart.x;
      const dy = e.clientY - this._ptrStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 12) {
        // Click: find tile element
        let target = e.target;
        while (target && target !== boardEl && !target.classList.contains('tile')) {
          target = target.parentElement;
        }
        if (target && target.classList.contains('tile') && !target.classList.contains('empty')) {
          this._handleTileClick(parseInt(target.dataset.value));
        }
      } else if (dist > 25) {
        // Swipe
        if (Math.abs(dx) > Math.abs(dy)) {
          this._handleSwipe(dx > 0 ? 'right' : 'left');
        } else {
          this._handleSwipe(dy > 0 ? 'down' : 'up');
        }
      }

      this._ptrStart = null;
    }, { passive: true });

    /* ── Keyboard ─────────────────────────────────────────────────────── */
    document.addEventListener('keydown', (e) => {
      if (this.paused) return;
      const keyMap = {
        ArrowLeft: 'left', ArrowRight: 'right',
        ArrowUp: 'up',     ArrowDown: 'down',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        this._handleSwipe(keyMap[e.key]);
      }
    });

    /* ── Control buttons ─────────────────────────────────────────────── */
    document.getElementById('shuffleBtn')?.addEventListener('click', () => this.shuffle());
    document.getElementById('undoBtn')?.addEventListener('click',    () => this.undo());
    document.getElementById('redoBtn')?.addEventListener('click',    () => this.redo());
    document.getElementById('pauseBtn')?.addEventListener('click',   () => this.pause());
    document.getElementById('exitBtn')?.addEventListener('click',    () => this._confirmExit());
    document.getElementById('eyeBtn')?.addEventListener('click',     () => this._toggleEye());

    // Sound toggle in game header (if present)
    document.getElementById('soundBtn')?.addEventListener('click', () => {
      const muted = Sound.toggleMute();
      this._updateSoundBtn(muted);
      Sound.play('click');
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     MOVE HANDLERS
  ══════════════════════════════════════════════════════════════════════ */

  _handleTileClick(val) {
    const idx = this.board.tiles.indexOf(val);
    if (!this.board.canMoveSingle(idx)) {
      // Shake the board subtly
      const boardEl = document.getElementById('boardContainer');
      if (boardEl) Animation.shake(boardEl);
      return;
    }
    this._doMove(idx);
  }

  _handleSwipe(direction) {
    const count = this.board.getTilesForSwipe(direction).length;
    if (count === 0) return;
    this._doSwipe(direction);
  }

  async _doMove(index) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const emptyEl = this.tileDOMMap.get(0);
    const tileEl  = this.tileDOMMap.get(this.board.tiles[index]);
    const emptyIdx = this.board.findEmpty();

    // Determine target positions for animation
    const emptyRow = Math.floor(emptyIdx / this.config.size);
    const emptyCol = emptyIdx % this.config.size;
    const ex = emptyCol * (this.tileSize + this.gap) + 4;
    const ey = emptyRow * (this.tileSize + this.gap) + 4;

    const tileRow = Math.floor(index / this.config.size);
    const tileCol = index % this.config.size;
    const tx = tileCol * (this.tileSize + this.gap) + 4;
    const ty = tileRow * (this.tileSize + this.gap) + 4;

    // Apply board logic
    this.board.moveSingle(index);
    this.moves++;
    Sound.play('move');

    // Animate: tile → empty position, empty → tile's old position
    await Animation.slideMultipleTiles([
      { el: tileEl, toLeft: ex, toTop: ey },
    ]);

    this.isAnimating = false;
    this._updateUI();
    this._checkWin();
    this.save();
  }

  async _doSwipe(direction) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const toMove  = this.board.getTilesForSwipe(direction);
    const targets = [];

    // Pre-compute new positions BEFORE applying board logic
    const emptyIdx = this.board.findEmpty();
    let prevIdx = emptyIdx;

    for (const srcIdx of toMove) {
      const val = this.board.tiles[srcIdx];
      const el  = this.tileDOMMap.get(val);

      const prevRow = Math.floor(prevIdx / this.config.size);
      const prevCol = prevIdx % this.config.size;
      targets.push({
        el,
        toLeft: prevCol * (this.tileSize + this.gap) + 4,
        toTop:  prevRow * (this.tileSize + this.gap) + 4,
      });
      prevIdx = srcIdx;
    }

    // Apply logic
    this.board.moveSwipe(direction);
    this.moves++;
    Sound.play('move');

    // Animate all tiles simultaneously
    await Animation.slideMultipleTiles(targets);

    this.isAnimating = false;
    this._updateUI();
    this._checkWin();
    this.save();
  }

  /* ══════════════════════════════════════════════════════════════════════
     GAME CONTROLS
  ══════════════════════════════════════════════════════════════════════ */

  shuffle() {
    if (this.isAnimating) return;
    Sound.play('click');
    this.board.shuffle(140 + this.config.size * 20);
    this.moves = 0;
    this.time  = 0;
    this.usedUndo = false;
    this._renderTiles(true);
    this._updateUI();
    this.save();
  }

  undo() {
    if (!this.board.canUndo || this.isAnimating || this.paused) return;
    Sound.play('click');
    this.board.undo();
    this.usedUndo = true;
    this.moves = Math.max(0, this.moves - 1);
    this._renderTiles(true);
    this._updateUI();
    this.save();
  }

  redo() {
    if (!this.board.canRedo || this.isAnimating || this.paused) return;
    Sound.play('click');
    this.board.redo();
    this.moves++;
    this._renderTiles(true);
    this._updateUI();
    this.save();
  }

  async pause() {
    if (!this.started) return;
    Sound.play('click');
    this._stopTimer();
    this.paused = true;

    await Popup.openPause({
      moves: this.moves,
      time: this.time,
      onResume: () => this._resume(),
      onHome: () => { Storage.clearGameSession(); window.location.href = 'index.html'; },
      onRestart: () => this.shuffle(),
    });
  }

  _resume() {
    this.paused = false;
    this._startTimer();
  }

  async _confirmExit() {
    Sound.play('click');
    this._stopTimer();
    const yes = await Popup.confirm({
      title: 'Exit Game?',
      message: 'Your progress is saved. You can resume from the home screen.',
      confirmText: 'Exit',
      cancelText: 'Stay',
    });
    if (yes) {
      window.location.href = 'index.html';
    } else {
      if (!this.paused) this._startTimer();
    }
  }

  _toggleEye() {
    this.showNumbers = !this.showNumbers;
    const eyeBtn = document.getElementById('eyeBtn');
    if (eyeBtn) {
      eyeBtn.classList.toggle('eye-off', !this.showNumbers);
      eyeBtn.title = this.showNumbers ? 'Hide numbers' : 'Show numbers';
    }
    this._renderTiles();
    Sound.play('click');
  }

  _updateSoundBtn(muted) {
    const btn = document.getElementById('soundBtn');
    if (!btn) return;
    btn.classList.toggle('muted', muted);
    btn.title = muted ? 'Unmute' : 'Mute';
  }

  /* ══════════════════════════════════════════════════════════════════════
     WIN DETECTION
  ══════════════════════════════════════════════════════════════════════ */

  _checkWin() {
    if (!this.board.isSolved()) return;

    this._stopTimer();
    this.started = false;

    // Check for best record
    const key = `${this.config.size}x${this.board.mode}`;
    const stats = Storage.getStats();
    const prevBestTime  = stats.bestTimes[key]  || Infinity;
    const prevBestMoves = stats.bestMoves[key]   || Infinity;
    const isRecord = this.time < prevBestTime || this.moves < prevBestMoves;

    // Record stats
    const newlyUnlocked = Dashboard.recordGame({
      size: this.config.size,
      mode: this.board.mode,
      style: this.config.style,
      time: this.time,
      moves: this.moves,
      usedUndo: this.usedUndo,
      won: true,
    });

    // Clear session
    Storage.clearGameSession();

    // Celebration
    const boardEl = document.getElementById('boardContainer');
    if (boardEl) Animation.winBounce(boardEl);

    setTimeout(() => {
      Popup.openWin({
        moves: this.moves,
        time: this.time,
        size: this.config.size,
        mode: this.board.mode,
        style: this.config.style,
        isRecord,
        onPlayAgain: () => {
          this.shuffle();
          this._startTimer();
          this.started = true;
        },
        onHome: () => { window.location.href = 'index.html'; },
        onShare: () => this._shareResult(),
      });
    }, 400);
  }

  _shareResult() {
    const text = `I solved Board Puzzle (${this.config.size}×${this.config.size} ${this.board.mode}) in ${this.moves} moves and ${Dashboard.formatTime(this.time)}! 🧩\n\n[ADD LINK HERE]`;
    if (navigator.share) {
      navigator.share({ title: 'Board Puzzle', text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(() => {
        alert('Result copied to clipboard!');
      }).catch(() => {
        prompt('Copy this text:', text);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     TIMER
  ══════════════════════════════════════════════════════════════════════ */

  _startTimer() {
    if (this.timerHandle) return;
    this.timerHandle = setInterval(() => {
      if (!this.paused) {
        this.time++;
        this._updateTimerDisplay();
      }
    }, 1000);
  }

  _stopTimer() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  _updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (el) el.textContent = Dashboard.formatTime(this.time);
  }

  /* ══════════════════════════════════════════════════════════════════════
     UI UPDATES
  ══════════════════════════════════════════════════════════════════════ */

  _updateUI() {
    // Moves counter
    const movesEl = document.getElementById('movesDisplay');
    if (movesEl) movesEl.textContent = this.moves;

    // Undo/redo button states
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = !this.board.canUndo;
    if (redoBtn) redoBtn.disabled = !this.board.canRedo;

    this._updateTimerDisplay();
  }

  /* ══════════════════════════════════════════════════════════════════════
     PERSISTENCE
  ══════════════════════════════════════════════════════════════════════ */

  save() {
    Storage.setGameSession({
      config:   this.config,
      board:    this.board.toJSON(),
      moves:    this.moves,
      time:     this.time,
      usedUndo: this.usedUndo,
    });
  }

  _loadSession(session) {
    this.board    = BoardState.fromJSON(session.board);
    this.moves    = session.moves    || 0;
    this.time     = session.time     || 0;
    this.usedUndo = session.usedUndo || false;
  }
}

/* ── Bootstrap on DOMContentLoaded ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Read config from sessionStorage (set by app.js on Start)
  const raw = sessionStorage.getItem('bp_gameConfig');
  if (!raw) {
    window.location.href = 'index.html';
    return;
  }

  const config = JSON.parse(raw);

  // Apply theme
  const prefs = Storage.getPrefs();
  const theme = prefs.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : prefs.theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // Init sound
  const muted = !prefs.sound;
  Sound.setMute(muted);
  await Sound.init();

  // Create and init game
  const game = new Game(config);
  await game.init();

  // Update sound button icon state
  const soundBtn = document.getElementById('soundBtn');
  if (soundBtn) {
    soundBtn.classList.toggle('muted', muted);
  }
});
