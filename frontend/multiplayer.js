/**
 * Tower Defense Multiplayer System
 * Handles lobby, matchmaking, and multiplayer game logic
 */

// ===== Configuration =====
const MULTIPLAYER_CONFIG = {
    POLL_INTERVAL: 2000, // Poll for game updates every 2 seconds
    MAX_PLAYERS: 4,
    MODE_DESCRIPTIONS: {
        Versus: 'Compete against other players. Last survivor wins!',
        CoOp: 'Work together with other players to survive waves. Shared health pool!',
        Race: 'Race to wave 20! First player to complete wins.',
        HighScore: 'Compete for the highest score after 10 waves.'
    }
};

// ===== Lobby Manager =====
window.LobbyManager = {
    currentFilter: 'all',
    selectedGame: null,
    isHost: false,
    playerReady: false,
    pollInterval: null,

    init() {
        console.log('[Lobby] Initializing multiplayer lobby');
        this.setupEventListeners();
        this.loadGameList();
        this.startPolling();
    },

    setupEventListeners() {
        // Back to menu
        document.getElementById('back-to-menu')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Refresh games
        document.getElementById('refresh-games')?.addEventListener('click', () => {
            this.loadGameList();
        });

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.mode);
            });
        });

        // Quick match
        document.getElementById('quick-match')?.addEventListener('click', () => {
            this.quickMatch();
        });

        // Create game
        document.getElementById('create-game')?.addEventListener('click', () => {
            this.showCreateGameModal();
        });

        // Create game form
        document.getElementById('create-game-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createGame();
        });

        // Mode selector change
        document.getElementById('game-mode-select')?.addEventListener('change', (e) => {
            this.updateModeDescription(e.target.value);
        });

        // Modal close buttons
        document.querySelectorAll('[data-dismiss="modal"], .modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideModal();
            });
        });

        // Ready button
        document.getElementById('ready-button')?.addEventListener('click', () => {
            this.toggleReady();
        });

        // Start game button
        document.getElementById('start-game-button')?.addEventListener('click', () => {
            this.startGame();
        });

        // Leave room button
        document.getElementById('leave-room')?.addEventListener('click', () => {
            this.leaveRoom();
        });
    },

    setFilter(mode) {
        this.currentFilter = mode;

        // Update tab UI
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        const activeTab = document.querySelector(`[data-mode="${mode}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }

        this.loadGameList();
    },

    async loadGameList() {
        console.log('[Lobby] Loading game list');
        const container = document.getElementById('game-listings');

        // Show loading state
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading games...</p>
            </div>
        `;

        try {
            // Mock data for demo (would query GraphQL in production)
            const games = this.getMockGames();

            // Filter games
            const filtered = this.currentFilter === 'all'
                ? games
                : games.filter(g => g.mode === this.currentFilter);

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🎮</div>
                        <h3>No Games Found</h3>
                        <p>Be the first to create a ${this.currentFilter} game!</p>
                    </div>
                `;
                return;
            }

            // Render games
            container.innerHTML = filtered.map(game => this.renderGameListing(game)).join('');

            // Add click listeners
            container.querySelectorAll('.game-listing').forEach(el => {
                el.addEventListener('click', () => {
                    const gameId = el.dataset.gameId;
                    this.joinGame(gameId);
                });
            });

        } catch (error) {
            console.error('[Lobby] Failed to load games:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Error Loading Games</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    },

    renderGameListing(game) {
        const modeClass = `mode-${game.mode.toLowerCase()}`;
        const modeIcon = {
            Versus: '⚔️',
            CoOp: '🤝',
            Race: '🏁',
            HighScore: '🏆'
        }[game.mode] || '🎮';

        return `
            <div class="game-listing" data-game-id="${game.id}" role="listitem">
                <div class="game-listing-header">
                    <div class="game-listing-title">${game.hostName}'s Game</div>
                    <span class="game-mode-badge ${modeClass}">${modeIcon} ${game.mode}</span>
                </div>
                <div class="game-listing-meta">
                    <span>👥 ${game.currentPlayers}/${game.maxPlayers}</span>
                    <span>📍 ${game.region || 'Global'}</span>
                    <span>⏱️ ${game.status === 'Lobby' ? 'Waiting' : 'In Progress'}</span>
                </div>
            </div>
        `;
    },

    getMockGames() {
        // Mock game data (would come from GraphQL in production)
        return [
            {
                id: 'game_001',
                hostName: 'Player1',
                mode: 'Versus',
                currentPlayers: 2,
                maxPlayers: 4,
                status: 'Lobby',
                region: 'NA'
            },
            {
                id: 'game_002',
                hostName: 'Player2',
                mode: 'CoOp',
                currentPlayers: 3,
                maxPlayers: 4,
                status: 'Lobby',
                region: 'EU'
            },
            {
                id: 'game_003',
                hostName: 'Player3',
                mode: 'Race',
                currentPlayers: 1,
                maxPlayers: 4,
                status: 'Lobby',
                region: 'NA'
            }
        ];
    },

    quickMatch() {
        console.log('[Lobby] Finding quick match');

        // Find first available game with space
        const games = this.getMockGames();
        const available = games.find(g =>
            g.status === 'Lobby' && g.currentPlayers < g.maxPlayers
        );

        if (available) {
            this.joinGame(available.id);
        } else {
            // No games available, create one
            alert('No games available. Creating a new Versus game...');
            this.createQuickGame();
        }
    },

    async createQuickGame() {
        // Create a quick versus game
        await this.createGameWithOptions({
            mode: 'Versus',
            maxPlayers: 4,
            isPrivate: false
        });
    },

    showCreateGameModal() {
        const modal = document.getElementById('create-game-modal');
        if (modal) {
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            this.updateModeDescription('Versus');
        }
    },

    hideModal() {
        const modal = document.getElementById('create-game-modal');
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
        }
    },

    updateModeDescription(mode) {
        const descEl = document.getElementById('mode-description');
        if (descEl) {
            descEl.textContent = MULTIPLAYER_CONFIG.MODE_DESCRIPTIONS[mode] || '';
        }
    },

    async createGame() {
        const mode = document.getElementById('game-mode-select')?.value;
        const maxPlayers = parseInt(document.getElementById('max-players-select')?.value);
        const isPrivate = document.getElementById('private-game-checkbox')?.checked;

        console.log('[Lobby] Creating game:', { mode, maxPlayers, isPrivate });

        try {
            await this.createGameWithOptions({ mode, maxPlayers, isPrivate });
        } catch (error) {
            console.error('[Lobby] Failed to create game:', error);
            alert('Failed to create game: ' + error.message);
        }
    },

    async createGameWithOptions(options) {
        const { mode, maxPlayers, isPrivate } = options;

        // Hide modal
        this.hideModal();

        // In production, would send GraphQL mutation to create game
        // For now, simulate game creation
        const gameId = `game_${Date.now()}`;

        // Show game room
        this.isHost = true;
        this.selectedGame = {
            id: gameId,
            mode,
            maxPlayers,
            isPrivate,
            hostName: 'You',
            players: [
                {
                    id: 'player_1',
                    name: 'You',
                    avatar: '🎮',
                    ready: false,
                    isHost: true
                }
            ]
        };

        this.showGameRoom();
    },

    async joinGame(gameId) {
        console.log('[Lobby] Joining game:', gameId);

        // In production, would send GraphQL mutation to join game
        // For now, simulate joining
        this.selectedGame = {
            id: gameId,
            mode: 'Versus',
            maxPlayers: 4,
            isPrivate: false,
            hostName: 'Player1',
            players: [
                {
                    id: 'player_1',
                    name: 'Player1',
                    avatar: '🎮',
                    ready: true,
                    isHost: true
                },
                {
                    id: 'player_2',
                    name: 'You',
                    avatar: '🎯',
                    ready: false,
                    isHost: false
                }
            ]
        };

        this.isHost = false;
        this.playerReady = false;
        this.showGameRoom();
    },

    showGameRoom() {
        // Hide empty state, show active room
        document.getElementById('empty-room').style.display = 'none';
        document.getElementById('active-room').style.display = 'flex';

        // Update room info
        document.getElementById('room-title').textContent = `${this.selectedGame.hostName}'s Game`;
        document.getElementById('room-mode-badge').textContent = this.selectedGame.mode;
        document.getElementById('room-id').textContent = `Game #${this.selectedGame.id.substr(-6)}`;

        // Update settings
        document.getElementById('setting-mode').textContent = this.selectedGame.mode;
        document.getElementById('setting-max-players').textContent = this.selectedGame.maxPlayers;
        document.getElementById('setting-visibility').textContent = this.selectedGame.isPrivate ? 'Private' : 'Public';

        // Update player slots
        this.updatePlayerSlots();

        // Show/hide start button for host
        const startBtn = document.getElementById('start-game-button');
        if (this.isHost) {
            startBtn.style.display = 'block';
        } else {
            startBtn.style.display = 'none';
        }

        // Update room status
        this.updateRoomStatus();
    },

    updatePlayerSlots() {
        const players = this.selectedGame.players || [];

        for (let i = 1; i <= MULTIPLAYER_CONFIG.MAX_PLAYERS; i++) {
            const slot = document.getElementById(`player-slot-${i}`);
            const player = players[i - 1];

            if (player) {
                // Occupied slot
                slot.classList.add('occupied');
                if (player.ready) {
                    slot.classList.add('ready');
                } else {
                    slot.classList.remove('ready');
                }

                slot.querySelector('.player-avatar').textContent = player.avatar;
                slot.querySelector('.player-name').textContent = player.name + (player.isHost ? ' 👑' : '');
                slot.querySelector('.player-status').textContent = player.ready ? 'Ready!' : 'Not ready';
                slot.querySelector('.ready-icon').textContent = player.ready ? '✅' : '⏳';
                slot.querySelector('.player-ready-indicator').setAttribute('aria-label', player.ready ? 'Ready' : 'Not ready');
            } else {
                // Empty slot
                slot.classList.remove('occupied', 'ready');
                slot.querySelector('.player-avatar').textContent = '🎮';
                slot.querySelector('.player-name').textContent = 'Empty Slot';
                slot.querySelector('.player-status').textContent = 'Waiting...';
                slot.querySelector('.ready-icon').textContent = '⏳';
                slot.querySelector('.player-ready-indicator').setAttribute('aria-label', 'Empty');
            }
        }
    },

    updateRoomStatus() {
        const statusEl = document.getElementById('room-status');
        const players = this.selectedGame.players || [];
        const allReady = players.every(p => p.ready);
        const minPlayers = 2;

        if (players.length < minPlayers) {
            statusEl.className = 'room-status';
            statusEl.querySelector('.status-text').textContent = `Waiting for more players... (${players.length}/${minPlayers} minimum)`;
        } else if (allReady) {
            statusEl.className = 'room-status all-ready';
            statusEl.querySelector('.status-text').textContent = '✅ All players ready! Host can start the game.';
        } else {
            statusEl.className = 'room-status';
            const readyCount = players.filter(p => p.ready).length;
            statusEl.querySelector('.status-text').textContent = `Waiting for players... (${readyCount}/${players.length} ready)`;
        }
    },

    toggleReady() {
        this.playerReady = !this.playerReady;
        console.log('[Lobby] Player ready status:', this.playerReady);

        // Update local player ready status
        const myPlayer = this.selectedGame.players.find(p => p.name === 'You');
        if (myPlayer) {
            myPlayer.ready = this.playerReady;
        }

        // Update UI
        const readyBtn = document.getElementById('ready-button');
        if (this.playerReady) {
            readyBtn.textContent = 'Not Ready';
            readyBtn.classList.remove('btn-primary');
            readyBtn.classList.add('btn-secondary');
        } else {
            readyBtn.textContent = 'Ready Up';
            readyBtn.classList.remove('btn-secondary');
            readyBtn.classList.add('btn-primary');
        }

        this.updatePlayerSlots();
        this.updateRoomStatus();

        // In production, would send GraphQL mutation to update ready status
    },

    startGame() {
        console.log('[Lobby] Starting game');

        const players = this.selectedGame.players || [];
        const allReady = players.every(p => p.ready);

        if (!allReady) {
            alert('All players must be ready before starting the game!');
            return;
        }

        if (players.length < 2) {
            alert('Need at least 2 players to start the game!');
            return;
        }

        // In production, would send GraphQL mutation to start game
        // For now, redirect to game
        alert(`Starting ${this.selectedGame.mode} game with ${players.length} players!`);
        window.location.href = `index.html?mode=multiplayer&gameId=${this.selectedGame.id}`;
    },

    leaveRoom() {
        console.log('[Lobby] Leaving room');

        // Reset state
        this.selectedGame = null;
        this.isHost = false;
        this.playerReady = false;

        // Show empty state, hide active room
        document.getElementById('empty-room').style.display = 'flex';
        document.getElementById('active-room').style.display = 'none';

        // In production, would send GraphQL mutation to leave game
    },

    startPolling() {
        // Poll for game updates
        this.pollInterval = setInterval(() => {
            if (this.selectedGame) {
                this.updateGameState();
            }
        }, MULTIPLAYER_CONFIG.POLL_INTERVAL);
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    async updateGameState() {
        // In production, would query GraphQL for game state updates
        // For now, just update UI with current state
        this.updatePlayerSlots();
        this.updateRoomStatus();
    }
};

// ===== Multiplayer Game Manager =====
window.MultiplayerGame = {
    gameId: null,
    mode: null,
    players: [],
    myPlayerId: null,

    init(gameId, mode) {
        console.log('[MultiplayerGame] Initializing:', { gameId, mode });
        this.gameId = gameId;
        this.mode = mode;
        this.loadGameState();
        this.setupMultiplayerUI();
        this.startGameLoop();
    },

    async loadGameState() {
        // In production, would query GraphQL for full game state
        console.log('[MultiplayerGame] Loading game state');
    },

    setupMultiplayerUI() {
        // Add opponent mini-grids to the UI
        const gameContainer = document.querySelector('.game-container');
        if (!gameContainer) return;

        // Create multiplayer overlay
        const mpOverlay = document.createElement('div');
        mpOverlay.className = 'multiplayer-overlay';
        mpOverlay.innerHTML = `
            <div class="opponent-grids">
                <div class="opponent-grid" id="opponent-1">
                    <div class="opponent-header">
                        <span class="opponent-name">Player 1</span>
                        <span class="opponent-health">❤️ 20</span>
                        <span class="opponent-wave">Wave 0</span>
                    </div>
                    <canvas class="opponent-canvas" width="200" height="200"></canvas>
                </div>
                <div class="opponent-grid" id="opponent-2">
                    <div class="opponent-header">
                        <span class="opponent-name">Player 2</span>
                        <span class="opponent-health">❤️ 20</span>
                        <span class="opponent-wave">Wave 0</span>
                    </div>
                    <canvas class="opponent-canvas" width="200" height="200"></canvas>
                </div>
                <div class="opponent-grid" id="opponent-3">
                    <div class="opponent-header">
                        <span class="opponent-name">Player 3</span>
                        <span class="opponent-health">❤️ 20</span>
                        <span class="opponent-wave">Wave 0</span>
                    </div>
                    <canvas class="opponent-canvas" width="200" height="200"></canvas>
                </div>
            </div>
        `;

        gameContainer.appendChild(mpOverlay);
    },

    startGameLoop() {
        // Poll for game state updates every second
        setInterval(() => {
            this.updateOpponentStates();
        }, 1000);
    },

    async updateOpponentStates() {
        // In production, would query GraphQL for opponent states
        // Update opponent mini-grids
    },

    handlePlayerAction(action, data) {
        // Broadcast player action to game chain
        console.log('[MultiplayerGame] Player action:', action, data);
        // In production, would send GraphQL mutation
    }
};

// Export for use in other scripts
window.MULTIPLAYER_CONFIG = MULTIPLAYER_CONFIG;

console.log('[Multiplayer] Module loaded successfully');
