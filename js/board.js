/**
 * Board Puzzle — Board Logic Module
 * Pure data model with NO DOM dependencies.
 *
 * Handles:
 *  • Solved-state generation for all 4 number modes
 *  • Solvable random shuffle (via random valid moves)
 *  • Single-tile and multi-tile (row/column) moves
 *  • Full undo / redo history
 *  • Win detection
 *  • JSON serialization for localStorage persistence
 */

class BoardState {
  /**
   * @param {number} size   – grid dimension (3, 4, or 5)
   * @param {string} mode   – 'classic' | 'snake' | 'spiral' | 'upside-down' | 'photo'
   */
  constructor(size, mode) {
    this.size    = size;
    this.mode    = mode;
    this.tiles   = BoardState.createSolvedTiles(size, mode);
    this.solved  = [...this.tiles]; // reference solved state
    this.history = [];              // array of tile-array snapshots
    this.histIdx = -1;              // current position in history
  }

  /* ══════════════════════════════════════════════════════════════════════
     STATIC FACTORY HELPERS
  ══════════════════════════════════════════════════════════════════════ */

  /**
   * Build the goal/solved tile arrangement for the given mode.
   * Returns a 1-D array, row-major. Empty tile = 0.
   */
  static createSolvedTiles(size, mode) {
    const n = size * size;
    const tiles = new Array(n).fill(0);

    switch (mode) {
      /* ── Classic: 1 2 3 / 4 5 6 / 7 8 _ ──────────────────────────── */
      case 'classic':
      case 'photo': {
        for (let i = 0; i < n - 1; i++) tiles[i] = i + 1;
        tiles[n - 1] = 0;
        break;
      }

      /* ── Upside-Down: _ 8 7 / 6 5 4 / 3 2 1 ─────────────────────── */
      case 'upside-down': {
        tiles[0] = 0;
        for (let i = 1; i < n; i++) tiles[i] = n - i;
        break;
      }

      /* ── Snake: even rows L→R, odd rows R→L ──────────────────────── */
      case 'snake': {
        let num = 1;
        for (let r = 0; r < size; r++) {
          const leftToRight = r % 2 === 0;
          for (let c = 0; c < size; c++) {
            const col = leftToRight ? c : size - 1 - c;
            tiles[r * size + col] = num === n ? 0 : num++;
          }
        }
        break;
      }

      /* ── Spiral: clockwise from top-left ─────────────────────────── */
      case 'spiral': {
        const order = BoardState.createSpiralOrder(size);
        for (let i = 0; i < order.length - 1; i++) {
          tiles[order[i]] = i + 1;
        }
        tiles[order[order.length - 1]] = 0; // empty at spiral end (center)
        break;
      }

      default: {
        // Fallback to classic
        for (let i = 0; i < n - 1; i++) tiles[i] = i + 1;
        tiles[n - 1] = 0;
      }
    }

    return tiles;
  }

  /**
   * Returns grid indices in clockwise-spiral order starting top-left.
   * Used for both building the solved state and for display hints.
   * @param {number} size
   * @returns {number[]} – array of indices length size*size
   */
  static createSpiralOrder(size) {
    const visited = Array.from({ length: size }, () => new Array(size).fill(false));
    const order = [];
    // Directions: right, down, left, up
    const dr = [0, 1, 0, -1];
    const dc = [1, 0, -1, 0];
    let r = 0, c = 0, dir = 0;

    for (let i = 0; i < size * size; i++) {
      order.push(r * size + c);
      visited[r][c] = true;

      const nr = r + dr[dir];
      const nc = c + dc[dir];

      if (nr < 0 || nr >= size || nc < 0 || nc >= size || visited[nr][nc]) {
        dir = (dir + 1) % 4; // turn
      }
      r += dr[dir];
      c += dc[dir];
    }

    return order;
  }

  /* ══════════════════════════════════════════════════════════════════════
     BOARD QUERIES
  ══════════════════════════════════════════════════════════════════════ */

  /** Index of the empty (0) tile. */
  findEmpty() {
    return this.tiles.indexOf(0);
  }

  /** Row of an index. */
  rowOf(idx) { return Math.floor(idx / this.size); }

  /** Column of an index. */
  colOf(idx) { return idx % this.size; }

  /**
   * Can the tile at `index` slide into the empty space?
   * (Adjacent in same row or column, exactly 1 step away.)
   */
  canMoveSingle(index) {
    const emptyIdx  = this.findEmpty();
    const tileRow   = this.rowOf(index);
    const tileCol   = this.colOf(index);
    const emptyRow  = this.rowOf(emptyIdx);
    const emptyCol  = this.colOf(emptyIdx);

    return (
      (tileRow === emptyRow && Math.abs(tileCol - emptyCol) === 1) ||
      (tileCol === emptyCol && Math.abs(tileRow - emptyRow) === 1)
    );
  }

  /**
   * Returns all tiles that could participate in a directional swipe.
   * These are the tiles on the OPPOSITE side of the swipe direction from empty —
   * they move TOWARD empty.
   *
   * Swipe LEFT  → tiles to the RIGHT of empty in same row slide left.
   * Swipe RIGHT → tiles to the LEFT  of empty in same row slide right.
   * Swipe UP    → tiles BELOW empty in same column slide up.
   * Swipe DOWN  → tiles ABOVE empty in same column slide down.
   *
   * @param {'left'|'right'|'up'|'down'} direction
   * @returns {number[]} indices in move order (nearest-to-empty first)
   */
  getTilesForSwipe(direction) {
    const emptyIdx = this.findEmpty();
    const eRow = this.rowOf(emptyIdx);
    const eCol = this.colOf(emptyIdx);
    const result = [];

    switch (direction) {
      case 'left':
        for (let c = eCol + 1; c < this.size; c++)
          result.push(eRow * this.size + c);
        break;
      case 'right':
        for (let c = eCol - 1; c >= 0; c--)
          result.push(eRow * this.size + c);
        break;
      case 'up':
        for (let r = eRow + 1; r < this.size; r++)
          result.push(r * this.size + eCol);
        break;
      case 'down':
        for (let r = eRow - 1; r >= 0; r--)
          result.push(r * this.size + eCol);
        break;
    }

    return result;
  }

  /** All indices that can move with a single click. */
  getMovableTiles() {
    const emptyIdx = this.findEmpty();
    const eRow = this.rowOf(emptyIdx);
    const eCol = this.colOf(emptyIdx);
    const result = [];

    const neighbors = [
      emptyIdx - this.size, // up
      emptyIdx + this.size, // down
      eCol > 0 ? emptyIdx - 1 : -1, // left
      eCol < this.size - 1 ? emptyIdx + 1 : -1, // right
    ];

    neighbors.forEach((idx) => {
      if (idx >= 0 && idx < this.size * this.size) result.push(idx);
    });

    return result;
  }

  /** Is the board in its solved arrangement? */
  isSolved() {
    return this.tiles.every((v, i) => v === this.solved[i]);
  }

  /* ══════════════════════════════════════════════════════════════════════
     MOVE OPERATIONS
  ══════════════════════════════════════════════════════════════════════ */

  /** Push current tile state onto the undo history. */
  _pushHistory() {
    // Truncate any future states if we moved after an undo
    this.history = this.history.slice(0, this.histIdx + 1);
    this.history.push([...this.tiles]);
    this.histIdx = this.history.length - 1;
  }

  /**
   * Move the single tile at `index` into the empty space.
   * @returns {boolean} true if the move was valid and executed
   */
  moveSingle(index) {
    if (this.tiles[index] === 0) return false;
    if (!this.canMoveSingle(index)) return false;

    this._pushHistory();
    const emptyIdx = this.findEmpty();
    this.tiles[emptyIdx] = this.tiles[index];
    this.tiles[index] = 0;
    return true;
  }

  /**
   * Slide an entire row/column in the given direction (multi-tile swipe).
   * @param {'left'|'right'|'up'|'down'} direction
   * @returns {number} number of tiles that moved (0 if no valid move)
   */
  moveSwipe(direction) {
    const toMove = this.getTilesForSwipe(direction);
    if (toMove.length === 0) return 0;

    this._pushHistory();

    // Chain-shift: empty ← toMove[0] ← toMove[1] ← … ← 0
    let prevIdx = this.findEmpty();
    for (const idx of toMove) {
      this.tiles[prevIdx] = this.tiles[idx];
      prevIdx = idx;
    }
    this.tiles[prevIdx] = 0;

    return toMove.length;
  }

  /* ══════════════════════════════════════════════════════════════════════
     UNDO / REDO
  ══════════════════════════════════════════════════════════════════════ */

  /** Undo the last move. @returns {boolean} */
  undo() {
    if (this.histIdx < 0) return false;
    this.tiles = [...this.history[this.histIdx]];
    this.histIdx--;
    return true;
  }

  /** Redo the previously undone move. @returns {boolean} */
  redo() {
    if (this.histIdx >= this.history.length - 1) return false;
    this.histIdx++;
    this.tiles = [...this.history[this.histIdx]];
    return true;
  }

  get canUndo() { return this.histIdx >= 0; }
  get canRedo() { return this.histIdx < this.history.length - 1; }

  /* ══════════════════════════════════════════════════════════════════════
     SHUFFLE
  ══════════════════════════════════════════════════════════════════════ */

  /**
   * Produce a random, guaranteed-solvable shuffle by applying
   * `numMoves` random valid single-tile moves starting from the solved state.
   * Avoids undoing the immediately preceding move (prevents trivial back-tracks).
   * @param {number} numMoves
   */
  shuffle(numMoves = 120) {
    // Reset to solved state first
    this.tiles   = [...this.solved];
    this.history = [];
    this.histIdx = -1;

    let lastMoved = -1;

    for (let i = 0; i < numMoves; i++) {
      const movable = this.getMovableTiles().filter((idx) => idx !== lastMoved);
      const pick    = movable[Math.floor(Math.random() * movable.length)];
      const empty   = this.findEmpty();

      this.tiles[empty] = this.tiles[pick];
      this.tiles[pick]  = 0;
      lastMoved = empty; // the old empty is now filled — avoid reversing
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     SERIALIZATION
  ══════════════════════════════════════════════════════════════════════ */

  toJSON() {
    return {
      size:    this.size,
      mode:    this.mode,
      tiles:   this.tiles,
      solved:  this.solved,
      history: this.history,
      histIdx: this.histIdx,
    };
  }

  static fromJSON(obj) {
    const b      = new BoardState(obj.size, obj.mode);
    b.tiles      = obj.tiles;
    b.solved     = obj.solved;
    b.history    = obj.history || [];
    b.histIdx    = typeof obj.histIdx === 'number' ? obj.histIdx : -1;
    return b;
  }
}
