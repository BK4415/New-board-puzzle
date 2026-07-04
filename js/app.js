/* ============================================================
   Board Puzzle — app.js
   UI Controller & Game Engine
   ============================================================ */

const App = {
    // State management
    state: {
        gridSize: 4,      // Default 4x4
        mode: 'number',    // 'number' or 'photo'
        theme: 'light',
        moves: 0,
        seconds: 0,
        tiles: [],        // Current tile positions
        emptyIndex: 15,   // Blank tile position
        isGameActive: false
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadSettings();
        this.renderPreview();
    },

    cacheDOM() {
        this.homePage = document.querySelector('.home-page');
        this.gameScreen = document.getElementById('game-screen'); // Make sure this ID exists
        this.board = document.getElementById('puzzle-board');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.moveDisplay = document.getElementById('move-count');
        
        // Buttons
        this.gridBtns = document.querySelectorAll('.grid-btn');
        this.styleBtns = document.querySelectorAll('.style-btn');
        this.startBtn = document.querySelector('.start-btn');
        this.themeBtn = document.getElementById('theme-toggle'); // Add this ID in HTML
    },

    bindEvents() {
        // Grid Size Selection
        this.gridBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.gridBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.gridSize = parseInt(btn.innerText);
                this.renderPreview();
            });
        });

        // Style Selection
        this.styleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.styleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.mode = btn.innerText.toLowerCase();
                this.renderPreview();
            });
        });

        // Start Game
        this.startBtn.addEventListener('click', () => this.startGame());

        // Drawer Logic
        window.openDrawer = (id) => document.getElementById(id).classList.add('open');
        window.closeDrawer = (id) => document.getElementById(id).classList.remove('open');
    },

    // ─── Theme Management ───
    toggleTheme() {
        this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.state.theme);
        localStorage.setItem('puzzle-theme', this.state.theme);
    },

    loadSettings() {
        const savedTheme = localStorage.getItem('puzzle-theme') || 'light';
        this.state.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
    },

    // ─── Game Engine ───
    startGame() {
        this.state.moves = 0;
        this.state.isGameActive = true;
        this.homePage.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        
        this.initTiles();
        this.shuffleTiles();
        this.renderBoard();
    },

    initTiles() {
        const totalTiles = this.state.gridSize * this.state.gridSize;
        this.state.tiles = Array.from({length: totalTiles}, (_, i) => i + 1);
        this.state.emptyIndex = totalTiles - 1;
        this.state.tiles[this.state.emptyIndex] = null; // Blank tile
    },

    shuffleTiles() {
        // Shuffle using valid moves only to ensure solvability
        for (let i = 0; i < 200; i++) {
            const neighbors = this.getNeighbors(this.state.emptyIndex);
            const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
            this.swap(this.state.emptyIndex, randomNeighbor);
            this.state.emptyIndex = randomNeighbor;
        }
    },

    getNeighbors(index) {
        const size = this.state.gridSize;
        const row = Math.floor(index / size);
        const col = index % size;
        const neighbors = [];

        if (row > 0) neighbors.push(index - size); // Top
        if (row < size - 1) neighbors.push(index + size); // Bottom
        if (col > 0) neighbors.push(index - 1); // Left
        if (col < size - 1) neighbors.push(index + 1); // Right

        return neighbors;
    },

    swap(idx1, idx2) {
        const temp = this.state.tiles[idx1];
        this.state.tiles[idx1] = this.state.tiles[idx2];
        this.state.tiles[idx2] = temp;
    },

    moveTile(index) {
        const neighbors = this.getNeighbors(index);
        if (neighbors.includes(this.state.emptyIndex)) {
            this.swap(index, this.state.emptyIndex);
            this.state.emptyIndex = index;
            this.state.moves++;
            this.updateUI();
            this.checkWin();
        }
    },

    updateUI() {
        this.renderBoard();
        if(this.moveDisplay) this.moveDisplay.innerText = this.state.moves;
    },

    renderBoard() {
        this.board.innerHTML = '';
        this.board.style.gridTemplateColumns = `repeat(${this.state.gridSize}, 1fr)`;
        
        this.state.tiles.forEach((tileValue, index) => {
            const tileEl = document.createElement('div');
            tileEl.classList.add('tile'); // Make sure to add .tile styles in CSS
            
            if (tileValue === null) {
                tileEl.style.opacity = '0';
                tileEl.classList.add('empty');
            } else {
                tileEl.innerText = tileValue;
                tileEl.addEventListener('click', () => this.moveTile(index));
            }
            this.board.appendChild(tileEl);
        });
    },

    checkWin() {
        const isWin = this.state.tiles.every((tile, i) => {
            if (i === this.state.tiles.length - 1) return tile === null;
            return tile === i + 1;
        });

        if (isWin && this.state.moves > 0) {
            setTimeout(() => alert(`Congratulations! Finished in ${this.state.moves} moves.`), 300);
        }
    },

    renderPreview() {
        // Yeh Home Screen ke board preview ko update karega
        if(!this.previewCanvas) return;
        const ctx = this.previewCanvas.getContext('2d');
        // Simple preview logic...
    }
};

// Initialize App on load
document.addEventListener('DOMContentLoaded', () => App.init());
