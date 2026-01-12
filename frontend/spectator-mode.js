/**
 * Spectator Mode Component
 * Allows eliminated players or external viewers to watch ongoing games
 */

class SpectatorMode {
    constructor() {
        this.isSpectating = false;
        this.gameId = null;
        this.focusedPlayer = null;
        this.players = [];
        this.updateInterval = null;
    }

    async enter(gameId) {
        console.log('[Spectator] Entering spectator mode for game:', gameId);
        this.gameId = gameId;
        this.isSpectating = true;

        // Show spectator UI
        this.showSpectatorUI();

        // Start polling for game updates
        this.startPolling();

        // Show notification
        if (window.NotificationManager) {
            window.NotificationManager.info('Entered spectator mode', 3000);
        }
    }

    exit() {
        console.log('[Spectator] Exiting spectator mode');
        this.isSpectating = false;
        this.stopPolling();
        this.hideSpectatorUI();
    }

    showSpectatorUI() {
        // Add spectator overlay to game UI
        const gameContainer = document.querySelector('.game-container') || document.body;

        // Create spectator banner
        const banner = document.createElement('div');
        banner.id = 'spectator-banner';
        banner.className = 'spectator-banner';
        banner.innerHTML = `
            <div class="spectator-label">
                <span class="spectator-icon">👁️</span>
                <span>Spectating</span>
            </div>
            <div class="spectator-controls">
                <button class="spectator-btn" id="prev-player-btn" aria-label="Previous player">
                    ←
                </button>
                <span class="spectator-player-name" id="focused-player-name">Player 1</span>
                <button class="spectator-btn" id="next-player-btn" aria-label="Next player">
                    →
                </button>
            </div>
            <button class="spectator-exit-btn" id="exit-spectator-btn" aria-label="Exit spectator mode">
                Exit Spectator
            </button>
        `;

        gameContainer.appendChild(banner);

        // Add player grid overlay
        const gridOverlay = document.createElement('div');
        gridOverlay.id = 'spectator-grid-overlay';
        gridOverlay.className = 'spectator-grid-overlay';
        gridOverlay.innerHTML = `
            <div class="spectator-grid-container">
                <div class="spectator-mini-grid" id="spectator-grid-1" data-player="1">
                    <div class="spectator-grid-header">
                        <span class="spectator-grid-player">Player 1</span>
                        <span class="spectator-grid-health">❤️ 20</span>
                    </div>
                    <canvas class="spectator-grid-canvas" width="150" height="150"></canvas>
                </div>
                <div class="spectator-mini-grid" id="spectator-grid-2" data-player="2">
                    <div class="spectator-grid-header">
                        <span class="spectator-grid-player">Player 2</span>
                        <span class="spectator-grid-health">❤️ 20</span>
                    </div>
                    <canvas class="spectator-grid-canvas" width="150" height="150"></canvas>
                </div>
                <div class="spectator-mini-grid" id="spectator-grid-3" data-player="3">
                    <div class="spectator-grid-header">
                        <span class="spectator-grid-player">Player 3</span>
                        <span class="spectator-grid-health">❤️ 20</span>
                    </div>
                    <canvas class="spectator-grid-canvas" width="150" height="150"></canvas>
                </div>
                <div class="spectator-mini-grid" id="spectator-grid-4" data-player="4">
                    <div class="spectator-grid-header">
                        <span class="spectator-grid-player">Player 4</span>
                        <span class="spectator-grid-health">❤️ 20</span>
                    </div>
                    <canvas class="spectator-grid-canvas" width="150" height="150"></canvas>
                </div>
            </div>
        `;

        gameContainer.appendChild(gridOverlay);

        // Setup event listeners
        this.setupEventListeners();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    hideSpectatorUI() {
        document.getElementById('spectator-banner')?.remove();
        document.getElementById('spectator-grid-overlay')?.remove();
    }

    setupEventListeners() {
        const prevBtn = document.getElementById('prev-player-btn');
        const nextBtn = document.getElementById('next-player-btn');
        const exitBtn = document.getElementById('exit-spectator-btn');

        prevBtn?.addEventListener('click', () => this.focusPreviousPlayer());
        nextBtn?.addEventListener('click', () => this.focusNextPlayer());
        exitBtn?.addEventListener('click', () => this.exit());

        // Click on mini grids to focus that player
        document.querySelectorAll('.spectator-mini-grid').forEach((grid, index) => {
            grid.addEventListener('click', () => {
                this.focusPlayer(index);
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isSpectating) return;

            switch (e.key) {
                case '1':
                case '2':
                case '3':
                case '4':
                    this.focusPlayer(parseInt(e.key) - 1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.focusPreviousPlayer();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.focusNextPlayer();
                    break;
                case 'Escape':
                    this.exit();
                    break;
            }
        });
    }

    focusPlayer(index) {
        if (index < 0 || index >= this.players.length) return;

        this.focusedPlayer = index;

        // Update UI
        const playerName = document.getElementById('focused-player-name');
        if (playerName && this.players[index]) {
            playerName.textContent = this.players[index].name;
        }

        // Highlight focused grid
        document.querySelectorAll('.spectator-mini-grid').forEach((grid, i) => {
            if (i === index) {
                grid.classList.add('focused');
            } else {
                grid.classList.remove('focused');
            }
        });

        // Update main view (in production, would switch camera/view)
        console.log('[Spectator] Focused on player', index + 1);
    }

    focusPreviousPlayer() {
        const newIndex = this.focusedPlayer === null || this.focusedPlayer === 0
            ? this.players.length - 1
            : this.focusedPlayer - 1;
        this.focusPlayer(newIndex);
    }

    focusNextPlayer() {
        const newIndex = this.focusedPlayer === null || this.focusedPlayer >= this.players.length - 1
            ? 0
            : this.focusedPlayer + 1;
        this.focusPlayer(newIndex);
    }

    startPolling() {
        this.updateInterval = setInterval(() => {
            this.updateGameState();
        }, 2000);
    }

    stopPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateGameState() {
        // In production, would query GraphQL for current game state
        // For now, simulate with mock data

        // Mock player data
        this.players = [
            { name: 'Player 1', health: 18, wave: 5, alive: true },
            { name: 'Player 2', health: 12, wave: 4, alive: true },
            { name: 'Player 3', health: 0, wave: 3, alive: false },
            { name: 'Player 4', health: 20, wave: 6, alive: true }
        ];

        // Update mini grids
        this.updateMiniGrids();
    }

    updateMiniGrids() {
        this.players.forEach((player, index) => {
            const grid = document.getElementById(`spectator-grid-${index + 1}`);
            if (!grid) return;

            const playerName = grid.querySelector('.spectator-grid-player');
            const health = grid.querySelector('.spectator-grid-health');

            if (playerName) playerName.textContent = player.name;
            if (health) {
                health.textContent = `❤️ ${player.health}`;
                health.style.color = player.alive ? '#4CAF50' : '#888';
            }

            // Grey out eliminated players
            if (!player.alive) {
                grid.classList.add('eliminated');
            } else {
                grid.classList.remove('eliminated');
            }
        });
    }
}

// Create global instance
window.SpectatorMode = new SpectatorMode();

// Add CSS styles
const spectatorStyles = document.createElement('style');
spectatorStyles.textContent = `
.spectator-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7));
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 1000;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.spectator-label {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #FFA500;
    font-weight: bold;
    font-size: 1.1rem;
}

.spectator-icon {
    font-size: 1.5rem;
}

.spectator-controls {
    display: flex;
    align-items: center;
    gap: 15px;
}

.spectator-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
}

.spectator-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
}

.spectator-player-name {
    font-weight: bold;
    color: #fff;
    min-width: 120px;
    text-align: center;
}

.spectator-exit-btn {
    background: linear-gradient(135deg, #f44336, #e91e63);
    border: none;
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.3s ease;
}

.spectator-exit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(244, 67, 54, 0.3);
}

.spectator-grid-overlay {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
}

.spectator-grid-container {
    display: flex;
    gap: 15px;
}

.spectator-mini-grid {
    background: rgba(26, 26, 46, 0.95);
    border-radius: 10px;
    padding: 10px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.3s ease;
}

.spectator-mini-grid:hover {
    border-color: #4CAF50;
    transform: translateY(-5px);
    box-shadow: 0 5px 20px rgba(76, 175, 80, 0.3);
}

.spectator-mini-grid.focused {
    border-color: #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.spectator-mini-grid.eliminated {
    opacity: 0.5;
    filter: grayscale(100%);
}

.spectator-grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.85rem;
}

.spectator-grid-player {
    font-weight: bold;
    color: #fff;
}

.spectator-grid-health {
    color: #4CAF50;
}

.spectator-grid-canvas {
    display: block;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 5px;
}

@media (max-width: 768px) {
    .spectator-banner {
        flex-direction: column;
        gap: 10px;
        padding: 10px;
    }

    .spectator-grid-container {
        flex-wrap: wrap;
        justify-content: center;
    }

    .spectator-mini-grid {
        flex: 0 0 calc(50% - 10px);
    }

    .spectator-grid-canvas {
        width: 100%;
        height: auto;
    }
}

@media (prefers-reduced-motion: reduce) {
    .spectator-btn,
    .spectator-exit-btn,
    .spectator-mini-grid {
        transition: none !important;
        transform: none !important;
    }
}
`;
document.head.appendChild(spectatorStyles);

console.log('[Spectator] Spectator mode component loaded');
