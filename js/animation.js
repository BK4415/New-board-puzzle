/**
 * Board Puzzle — Animation Module
 * Handles tile movement easing, page transitions, ripple effects, and
 * popup scale-in/out animations.
 *
 * All animations use CSS transitions or the Web Animations API so the
 * browser's compositor handles the transforms — no layout thrash.
 */

const Animation = (() => {

  /* ── Easing curves ────────────────────────────────────────────────────── */
  const EASE_SLIDE  = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // smooth decelerate
  const EASE_BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';    // slight overshoot
  const EASE_POP    = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // spring pop
  const EASE_SHARP  = 'cubic-bezier(0.4, 0, 0.2, 1)';           // material standard

  const TILE_DURATION  = 160; // ms
  const POPUP_DURATION = 260; // ms
  const PAGE_DURATION  = 220; // ms

  /* ── Tile Movement ────────────────────────────────────────────────────── */

  /**
   * Animate a DOM tile element from its current visual position to a new
   * grid position. The tile's `transform` is updated after the transition.
   *
   * @param {HTMLElement} el         – the tile element
   * @param {number} toLeft          – target CSS `left` in px
   * @param {number} toTop           – target CSS `top` in px
   * @param {number} [duration]      – override default ms
   * @returns {Promise<void>}
   */
  function slideTile(el, toLeft, toTop, duration = TILE_DURATION) {
    return new Promise((resolve) => {
      // Apply transition directly on the element
      el.style.transition = `left ${duration}ms ${EASE_SLIDE}, top ${duration}ms ${EASE_SLIDE}`;
      el.style.left = `${toLeft}px`;
      el.style.top  = `${toTop}px`;

      const onEnd = () => {
        el.removeEventListener('transitionend', onEnd);
        el.style.transition = '';
        resolve();
      };
      el.addEventListener('transitionend', onEnd, { once: true });

      // Safety timeout in case transitionend never fires
      setTimeout(resolve, duration + 50);
    });
  }

  /**
   * Animate multiple tiles simultaneously (multi-tile swipe).
   * Resolves when all animations finish.
   *
   * @param {Array<{el: HTMLElement, toLeft: number, toTop: number}>} targets
   * @param {number} [duration]
   * @returns {Promise<void>}
   */
  function slideMultipleTiles(targets, duration = TILE_DURATION) {
    return Promise.all(targets.map(({ el, toLeft, toTop }) =>
      slideTile(el, toLeft, toTop, duration)
    ));
  }

  /**
   * Quick shake animation on an element (for invalid moves).
   * @param {HTMLElement} el
   */
  function shake(el) {
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 280, easing: EASE_SHARP }
    );
  }

  /**
   * Scale-in a popup/modal element.
   * @param {HTMLElement} el
   * @returns {Promise<void>}
   */
  function popupIn(el) {
    el.style.display = 'flex';
    return el.animate(
      [
        { opacity: 0, transform: 'scale(0.85)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: POPUP_DURATION, easing: EASE_POP, fill: 'forwards' }
    ).finished;
  }

  /**
   * Scale-out a popup/modal element, then hide it.
   * @param {HTMLElement} el
   * @returns {Promise<void>}
   */
  async function popupOut(el) {
    await el.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.85)' },
      ],
      { duration: POPUP_DURATION, easing: EASE_SHARP, fill: 'forwards' }
    ).finished;
    el.style.display = 'none';
  }

  /**
   * Animate a drawer sliding in from the given side.
   * @param {HTMLElement} drawer
   * @param {'left'|'right'} side
   * @returns {Promise<void>}
   */
  function drawerIn(drawer, side) {
    const from = side === 'right' ? 'translateX(100%)' : 'translateX(-100%)';
    return drawer.animate(
      [
        { transform: from, opacity: 0.7 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: PAGE_DURATION, easing: EASE_SLIDE, fill: 'forwards' }
    ).finished;
  }

  /**
   * Animate a drawer sliding out.
   * @param {HTMLElement} drawer
   * @param {'left'|'right'} side
   * @returns {Promise<void>}
   */
  async function drawerOut(drawer, side) {
    const to = side === 'right' ? 'translateX(100%)' : 'translateX(-100%)';
    await drawer.animate(
      [
        { transform: 'translateX(0)', opacity: 1 },
        { transform: to, opacity: 0.7 },
      ],
      { duration: PAGE_DURATION, easing: EASE_SHARP, fill: 'forwards' }
    ).finished;
  }

  /**
   * Ripple effect on a button press.
   * @param {MouseEvent|TouchEvent} event
   * @param {HTMLElement} btn
   */
  function ripple(event, btn) {
    const existing = btn.querySelector('.ripple-wave');
    if (existing) existing.remove();

    const rect = btn.getBoundingClientRect();
    const x = (event.clientX || event.touches?.[0]?.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (event.clientY || event.touches?.[0]?.clientY || rect.top + rect.height / 2) - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;

    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.cssText = `
      position:absolute; border-radius:50%; pointer-events:none;
      width:${size}px; height:${size}px;
      left:${x - size / 2}px; top:${y - size / 2}px;
      background:rgba(255,255,255,0.35);
      transform:scale(0); opacity:1;
    `;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(wave);

    wave.animate(
      [
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: 500, easing: 'ease-out', fill: 'forwards' }
    ).finished.then(() => wave.remove());
  }

  /**
   * Win celebration: scale-bounce the board.
   * @param {HTMLElement} boardEl
   * @returns {Promise<void>}
   */
  function winBounce(boardEl) {
    return boardEl.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.04)' },
        { transform: 'scale(0.97)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' },
      ],
      { duration: 500, easing: EASE_BOUNCE }
    ).finished;
  }

  /**
   * Fade in an element.
   * @param {HTMLElement} el
   * @param {number} [duration=300]
   */
  function fadeIn(el, duration = 300) {
    el.style.display = '';
    return el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration, easing: EASE_SHARP, fill: 'forwards' }
    ).finished;
  }

  /**
   * Fade out an element.
   * @param {HTMLElement} el
   * @param {number} [duration=200]
   */
  async function fadeOut(el, duration = 200) {
    await el.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration, easing: EASE_SHARP, fill: 'forwards' }
    ).finished;
    el.style.display = 'none';
  }

  return {
    slideTile,
    slideMultipleTiles,
    shake,
    popupIn,
    popupOut,
    drawerIn,
    drawerOut,
    ripple,
    winBounce,
    fadeIn,
    fadeOut,
    TILE_DURATION,
  };
})();
