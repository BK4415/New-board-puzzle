/**
 * Board Puzzle — Sound Module
 * Web Audio API engine with graceful fallback.
 * Supports mute toggle and preloaded WAV assets.
 */

const Sound = (() => {
  let audioCtx = null;
  let muted = false;
  const buffers = {};
  const SOUNDS = {
    move:  'assets/move.wav',
    click: 'assets/click.wav',
  };

  /**
   * Lazy-init AudioContext (required on first user gesture).
   */
  function getCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[Sound] AudioContext unavailable:', e);
      }
    }
    return audioCtx;
  }

  /**
   * Preload a single WAV file into an AudioBuffer.
   * @param {string} name  – key in SOUNDS map
   * @returns {Promise<void>}
   */
  async function preload(name) {
    const ctx = getCtx();
    if (!ctx || buffers[name]) return;
    try {
      const resp = await fetch(SOUNDS[name]);
      const arrayBuf = await resp.arrayBuffer();
      buffers[name] = await ctx.decodeAudioData(arrayBuf);
    } catch (e) {
      console.warn(`[Sound] Could not preload "${name}":`, e);
    }
  }

  /**
   * Preload all sounds. Call once at app start.
   */
  async function init() {
    await Promise.all(Object.keys(SOUNDS).map(preload));
  }

  /**
   * Play a preloaded sound by name.
   * @param {string} name   – 'move' | 'click'
   * @param {number} volume – 0 to 1 (default 1)
   */
  function play(name, volume = 1.0) {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx || !buffers[name]) return;

    try {
      // Resume context if suspended (browser policy)
      if (ctx.state === 'suspended') ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = buffers[name];

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1, volume));

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn(`[Sound] Play failed for "${name}":`, e);
    }
  }

  /** Toggle mute state. Returns new muted value. */
  function toggleMute() {
    muted = !muted;
    return muted;
  }

  /** Set mute explicitly. */
  function setMute(value) {
    muted = Boolean(value);
  }

  /** Check current mute state. */
  function isMuted() {
    return muted;
  }

  return { init, play, toggleMute, setMute, isMuted };
})();
