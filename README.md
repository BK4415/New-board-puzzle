# 🧩 Board Puzzle

A **production-quality, fully offline sliding puzzle game** built with pure HTML5, CSS3, and Vanilla JavaScript. No frameworks. No CDN. No external dependencies.

---

## Features

- **4 Number Modes** — Classic, Snake, Spiral, Upside Down
- **Photo Mode** — Solve puzzles from preset or custom-uploaded images
- **3 Grid Sizes** — 3×3, 4×4, 5×5 (Photo mode: 3×3 only)
- **Multi-tile swipe** — Slide an entire row or column in one gesture
- **Wood Theme** — Warm wooden tiles, board texture (auto on light/mobile)
- **Dark Theme** — Dark walnut + gold highlights (auto on system dark mode)
- **Resume** — Autosaves every move; pick up where you left off
- **Dashboard** — Games played, wins, best time/moves, streaks
- **15 Achievements** — Fast Solver, No Undo, Spiral Master, and more
- **PWA** — Installable, works completely offline
- **Accessibility** — Arrow-key controls, ARIA labels, reduced-motion support
- **Security** — Right-click, image drag, context menu, and text selection disabled

---

## Folder Structure

```
BoardPuzzle/
├── index.html          ← Home screen
├── game.html           ← Game screen
├── about.html          ← About page (loaded in popup)
├── guide.html          ← How-to-play guide (loaded in popup)
├── policy.html         ← Privacy policy (loaded in popup)
│
├── css/
│   ├── style.css       ← Globals, themes, home layout, drawers
│   ├── game.css        ← Board, tiles, wood texture, controls
│   └── popup.css       ← Modal overlays, win/pause dialogs
│
├── js/
│   ├── storage.js      ← LocalStorage typed wrapper
│   ├── sound.js        ← Web Audio engine + mute
│   ├── board.js        ← Pure board logic (no DOM)
│   ├── image.js        ← Canvas image crop + tile slicing
│   ├── animation.js    ← Tile slide, popup, ripple animations
│   ├── dashboard.js    ← Stats tracking + achievement checker
│   ├── popup.js        ← Modal/drawer system
│   ├── app.js          ← Home screen controller
│   └── game.js         ← Game controller (rendering, input, timer)
│
├── assets/
│   ├── logo.png        ← App icon (512×512, maskable)
│   ├── trophy.png      ← Win screen trophy
│   ├── preset-1.jpg    ← Photo preset: Raj
│   ├── preset-2.jpg    ← Photo preset: Ronit
│   ├── preset-3.jpg    ← Photo preset: Aradhya
│   ├── preset-4.jpg    ← Photo preset: Lovely
│   ├── preset-5.jpg    ← Photo preset: Biklu
│   ├── move.wav        ← Tile movement sound
│   └── click.wav       ← Button click sound
│
├── manifest.json       ← PWA manifest
├── service-worker.js   ← Offline cache strategy
└── README.md           ← This file
```

---

## How Image Slicing Works

Photo mode uses the **Canvas 2D API** for zero-distortion image slicing:

1. **Load** — `ImageProcessor.loadImage(url)` loads the image into an `<img>` element
2. **Center-crop** — `centerCrop(img, resolution)` draws a square crop (centered) at the target resolution (600px default), maintaining aspect ratio
3. **Slice** — `sliceIntoTiles(canvas, size)` divides the square canvas into `size × size` equal tiles using `getImageData` / `putImageData`
4. **Render** — Each tile canvas is converted to a `data:image/jpeg` URL and set as the `background-image` of a tile `<div>`

The result is pixel-perfect, no-distortion tiles at 60fps.

---

## How to Add Custom Presets

Replace any of the `assets/preset-N.jpg` files with your own **square images** (at least 600×600px recommended). The names shown in the selector are hardcoded in `index.html`:

```html
<button class="preset-btn" data-preset="1">Raj</button>
```

Change the button text to match your new images. Photo mode always uses 3×3 only.

---

## How to Replace Sounds

Replace `assets/move.wav` and `assets/click.wav` with your own WAV files. Supported formats depend on the browser — WAV works universally. For smaller file sizes, convert to MP3 or OGG and update `SOUNDS` in `js/sound.js`:

```js
const SOUNDS = {
  move:  'assets/move.mp3',
  click: 'assets/click.mp3',
};
```

---

## PWA Installation

### Mobile (Android)
1. Open the app in Chrome
2. Tap the browser menu → "Add to Home screen" / "Install app"

### Mobile (iOS Safari)
1. Open in Safari
2. Tap the **Share** icon → "Add to Home Screen"

### Desktop (Chrome / Edge)
1. Look for the install icon (⊕) in the address bar
2. Click "Install"

After installation, the game runs in standalone mode and works fully offline.

---

## Running Locally

No build step required. Simply serve the folder with any HTTP server:

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code
# Use the "Live Server" extension
```

Then open `http://localhost:8080` in your browser.

> ⚠️ **Do not open `index.html` directly from the filesystem** (`file://`).
> Service Workers require an HTTP server.

---

## Architecture Notes

### State Flow
```
index.html (app.js)
  → user selects config
  → sessionStorage.setItem('bp_gameConfig', JSON)
  → window.location.href = 'game.html'

game.html (game.js)
  → reads config from sessionStorage
  → creates BoardState + Game
  → autosaves to localStorage on every move
  → on win: clears session, records stats

index.html (app.js resume card)
  → reads localStorage session
  → shows resume card if session exists
  → "Continue" restores config + board state
```

### Board Logic (`board.js`)
- `BoardState.createSolvedTiles(size, mode)` — generates the goal arrangement
- `board.shuffle(n)` — applies `n` random valid single-moves from solved state → **guaranteed solvable**
- `board.moveSingle(index)` — classic adjacent-tile move
- `board.moveSwipe(direction)` — shifts entire row/column toward the empty space
- Full undo/redo via snapshot history array

### Theme System
Themes are CSS custom properties on `:root` and `[data-theme="dark"]`.
Detection order: `localStorage` preference → system `prefers-color-scheme`.
The info panel has a toggle button that overrides the system setting.

---

## Future Improvements

- [ ] Additional grid sizes (6×6, 7×7)
- [ ] Animation speed settings (slow/normal/fast)
- [ ] Daily challenge with shared seed
- [ ] Hint system (BFS pathfinder)
- [ ] Online leaderboard (opt-in)
- [ ] More photo presets / categories
- [ ] Sound effect variations
- [ ] Haptic feedback (Vibration API)
- [ ] Replay / solution viewer

---

## License

MIT License — free to use, modify, and distribute.

---

*Board Puzzle — Crafted with care. No frameworks harmed in the making.*
