/**
 * Board Puzzle — Dashboard Module
 * Tracks game statistics, streaks, and achievements in LocalStorage.
 * Renders the stats drawer on the home screen.
 */

const Dashboard = (() => {

  /* ── Achievement definitions ────────────────────────────────────────── */
  const ACHIEVEMENTS = [
    {
      id: 'first_win',
      icon: '🏆',
      title: 'First Win',
      desc: 'Complete your first puzzle',
      check: (s) => s.wins >= 1,
    },
    {
      id: 'ten_wins',
      icon: '🎖️',
      title: 'Seasoned Solver',
      desc: 'Win 10 puzzles',
      check: (s) => s.wins >= 10,
    },
    {
      id: 'hundred_wins',
      icon: '💯',
      title: '100 Wins',
      desc: 'Win 100 puzzles',
      check: (s) => s.wins >= 100,
    },
    {
      id: 'fast_solver',
      icon: '⚡',
      title: 'Fast Solver',
      desc: 'Solve a puzzle in under 60 seconds',
      check: (s) => s.fastSolves >= 1,
    },
    {
      id: 'lightning',
      icon: '🌩️',
      title: 'Lightning',
      desc: 'Solve in under 30 seconds',
      check: (s) => s.lightningWins >= 1,
    },
    {
      id: 'no_undo',
      icon: '🎯',
      title: 'No Undo',
      desc: 'Win without using Undo',
      check: (s) => s.noUndoWins >= 1,
    },
    {
      id: 'perfect_five',
      icon: '⭐',
      title: 'Perfect Five',
      desc: 'Win 5 games without Undo',
      check: (s) => s.noUndoWins >= 5,
    },
    {
      id: 'streak_3',
      icon: '🔥',
      title: 'On Fire',
      desc: 'Win 3 games in a row',
      check: (s) => s.longestStreak >= 3,
    },
    {
      id: 'streak_7',
      icon: '🌟',
      title: 'Week Warrior',
      desc: 'Win 7 days in a row',
      check: (s) => s.longestStreak >= 7,
    },
    {
      id: 'night_owl',
      icon: '🦉',
      title: 'Night Owl',
      desc: 'Play 5 games between 10 PM – 5 AM',
      check: (s) => s.nightPlays >= 5,
    },
    {
      id: 'big_grid',
      icon: '🧩',
      title: 'Grand Master',
      desc: 'Win a 5×5 puzzle',
      check: (s) => s.wins5x5 >= 1,
    },
    {
      id: 'spiral_master',
      icon: '🌀',
      title: 'Spiral Master',
      desc: 'Win a Spiral mode puzzle',
      check: (s) => s.spiralWins >= 1,
    },
    {
      id: 'photo_pro',
      icon: '📸',
      title: 'Photo Pro',
      desc: 'Win a Photo mode puzzle',
      check: (s) => s.photoWins >= 1,
    },
    {
      id: 'century_moves',
      icon: '🚶',
      title: 'Marathon',
      desc: 'Make 1000 total moves',
      check: (s) => s.totalMoves >= 1000,
    },
    {
      id: 'dedicated',
      icon: '🏅',
      title: 'Dedicated',
      desc: 'Play 50 games',
      check: (s) => s.gamesPlayed >= 50,
    },
  ];

  /* ── Core stats operations ──────────────────────────────────────────── */

  /**
   * Record a completed game and update all statistics.
   * @param {{ size, mode, style, time, moves, usedUndo, won }} result
   */
  function recordGame(result) {
    const stats = Storage.getStats();

    const hour = new Date().getHours();
    const today = new Date().toDateString();

    stats.gamesPlayed++;
    stats.totalMoves += result.moves;
    stats.totalTime  += result.time;

    // Night play tracking (22:00 – 05:00)
    if (hour >= 22 || hour < 5) stats.nightPlays = (stats.nightPlays || 0) + 1;

    if (!result.won) {
      Storage.setStats(stats);
      return;
    }

    /* ── Win stats ────────────────────────────────────────────────────── */
    stats.wins++;

    // Streak logic
    const last = stats.lastPlayDate;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (last === yesterday.toDateString()) {
      stats.currentStreak++;
    } else if (last === today) {
      // Already played today — keep streak
    } else {
      stats.currentStreak = 1;
    }
    stats.lastPlayDate   = today;
    stats.longestStreak  = Math.max(stats.longestStreak, stats.currentStreak);

    // Best time / moves per puzzle type
    const key = `${result.size}x${result.mode}`;
    if (!stats.bestTimes[key] || result.time < stats.bestTimes[key]) {
      stats.bestTimes[key] = result.time;
    }
    if (!stats.bestMoves[key] || result.moves < stats.bestMoves[key]) {
      stats.bestMoves[key] = result.moves;
    }

    // Special win conditions
    if (!result.usedUndo) stats.noUndoWins = (stats.noUndoWins || 0) + 1;
    if (result.time < 60)  stats.fastSolves = (stats.fastSolves || 0) + 1;
    if (result.time < 30)  stats.lightningWins = (stats.lightningWins || 0) + 1;
    if (result.size === 5) stats.wins5x5  = (stats.wins5x5 || 0) + 1;
    if (result.mode === 'spiral') stats.spiralWins = (stats.spiralWins || 0) + 1;
    if (result.style === 'photo') stats.photoWins  = (stats.photoWins || 0) + 1;

    // Check and unlock achievements
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach((ach) => {
      if (!stats.achievements.includes(ach.id) && ach.check(stats)) {
        stats.achievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    });

    Storage.setStats(stats);
    return newlyUnlocked;
  }

  /**
   * Increment gamesPlayed counter at start (not just on win).
   */
  function recordGameStart() {
    const stats = Storage.getStats();
    // gamesPlayed is incremented on recordGame, not here — this is just for
    // checking night play and other start-time stats if needed in future.
  }

  /* ── Render helpers ─────────────────────────────────────────────────── */

  /**
   * Format seconds into MM:SS display.
   * @param {number} seconds
   */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Render the entire dashboard drawer into the given container element.
   * @param {HTMLElement} container
   */
  function renderDashboard(container) {
    const stats = Storage.getStats();

    // Find best time/moves across all puzzle types
    const bestTimeVal   = Object.values(stats.bestTimes).length
      ? Math.min(...Object.values(stats.bestTimes)) : null;
    const bestMovesVal  = Object.values(stats.bestMoves).length
      ? Math.min(...Object.values(stats.bestMoves)) : null;

    // Build achievement HTML
    const achHTML = ACHIEVEMENTS.map((ach) => {
      const unlocked = stats.achievements.includes(ach.id);
      return `
        <div class="ach-item ${unlocked ? 'unlocked' : 'locked'}">
          <span class="ach-icon">${unlocked ? ach.icon : '🔒'}</span>
          <div class="ach-info">
            <div class="ach-title">${ach.title}</div>
            <div class="ach-desc">${ach.desc}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="dash-header">
        <button class="dash-close-btn" id="dashClose" aria-label="Close dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <h2 class="dash-title">Dashboard</h2>
      </div>

      <div class="dash-stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.gamesPlayed}</div>
          <div class="stat-label">Games Played</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">${stats.wins}</div>
          <div class="stat-label">Total Wins</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${bestTimeVal !== null ? formatTime(bestTimeVal) : '—'}</div>
          <div class="stat-label">Best Time</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${bestMovesVal !== null ? bestMovesVal : '—'}</div>
          <div class="stat-label">Best Moves</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.currentStreak}</div>
          <div class="stat-label">Current Streak</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.longestStreak}</div>
          <div class="stat-label">Longest Streak</div>
        </div>
      </div>

      <div class="dash-section-title">Achievements
        <span class="ach-count">${stats.achievements.length}/${ACHIEVEMENTS.length}</span>
      </div>

      <div class="ach-list">
        ${achHTML}
      </div>
    `;

    // Wire close button
    container.querySelector('#dashClose').addEventListener('click', () => {
      document.getElementById('dashDrawer')?.classList.remove('open');
    });
  }

  return { recordGame, recordGameStart, renderDashboard, formatTime, ACHIEVEMENTS };
})();
