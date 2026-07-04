/**
 * Board Puzzle — Storage Module
 * Typed LocalStorage wrapper with safe JSON serialization.
 * All game state, preferences, and stats are persisted here.
 */

const Storage = (() => {
  const PREFIX = 'bp_'; // namespace prefix to avoid collisions

  /**
   * Read a value from LocalStorage.
   * @param {string} key
   * @param {*} defaultValue – returned if key missing or parse fails
   */
  function get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Storage] Failed to read "${key}":`, e);
      return defaultValue;
    }
  }

  /**
   * Write a value to LocalStorage as JSON.
   * @param {string} key
   * @param {*} value
   * @returns {boolean} success
   */
  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to write "${key}":`, e);
      return false;
    }
  }

  /**
   * Delete a key from LocalStorage.
   * @param {string} key
   */
  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  /**
   * Check if a key exists.
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    return localStorage.getItem(PREFIX + key) !== null;
  }

  /**
   * Clear ALL Board Puzzle data (used for reset).
   */
  function clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  /* ── Typed convenience helpers ─────────────────────────────────────────── */

  /** Retrieve the active game session (resume state). */
  function getGameSession() {
    return get('session', null);
  }

  /** Persist the active game session for resume. */
  function setGameSession(session) {
    return set('session', session);
  }

  /** Clear the active session (e.g. after win or new game). */
  function clearGameSession() {
    remove('session');
  }

  /** Get user preferences (theme, sound, etc.). */
  function getPrefs() {
    return get('prefs', {
      theme: 'auto',       // 'auto' | 'light' | 'dark'
      sound: true,
      lastStyle: 'number',
      lastGrid: 3,
      lastMode: 'classic',
      lastPreset: 1,
    });
  }

  /** Save user preferences. */
  function setPrefs(prefs) {
    return set('prefs', prefs);
  }

  /** Get dashboard / statistics. */
  function getStats() {
    return get('stats', {
      gamesPlayed: 0,
      wins: 0,
      bestTimes: {},       // key: "gridXmode" => seconds
      bestMoves: {},       // key: "gridXmode" => moves
      currentStreak: 0,
      longestStreak: 0,
      lastPlayDate: null,
      achievements: [],
      totalMoves: 0,
      totalTime: 0,
      noUndoWins: 0,
      fastSolves: 0,       // wins under 60s
      nightPlays: 0,       // games played between 22:00-05:00
    });
  }

  /** Save dashboard stats. */
  function setStats(stats) {
    return set('stats', stats);
  }

  return {
    get,
    set,
    remove,
    has,
    clearAll,
    getGameSession,
    setGameSession,
    clearGameSession,
    getPrefs,
    setPrefs,
    getStats,
    setStats,
  };
})();
