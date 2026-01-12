/**
 * Victory Screen Component
 * Displays post-game results with stats and rankings
 */

class VictoryScreen {
    constructor() {
        this.overlay = null;
        this.isVisible = false;
    }

    show(gameData) {
        // Create overlay if it doesn't exist
        if (!this.overlay) {
            this.createOverlay();
        }

        // Populate with game data
        this.populateData(gameData);

        // Show overlay
        this.overlay.classList.add('show');
        this.isVisible = true;

        // Trigger confetti
        if (window.ConfettiManager) {
            setTimeout(() => {
                window.ConfettiManager.victory();
            }, 300);
        }

        // Play victory sound (if audio system exists)
        this.playVictorySound(gameData.isVictory);
    }

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('show');
            this.isVisible = false;
        }
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'victory-screen-overlay';
        this.overlay.className = 'victory-screen-overlay';
        this.overlay.innerHTML = `
            <div class="victory-screen-content">
                <div class="victory-header">
                    <h1 class="victory-title" id="victory-title">Victory!</h1>
                    <div class="victory-subtitle" id="victory-subtitle">You won the match!</div>
                </div>

                <div class="victory-stats-container">
                    <!-- Winner Podium -->
                    <div class="winner-podium" id="winner-podium">
                        <div class="podium-place" data-place="2">
                            <div class="podium-player">
                                <div class="podium-avatar">🥈</div>
                                <div class="podium-name">Player 2</div>
                                <div class="podium-score">1,234</div>
                            </div>
                            <div class="podium-stand second"></div>
                        </div>
                        <div class="podium-place" data-place="1">
                            <div class="podium-player">
                                <div class="podium-avatar winner">🏆</div>
                                <div class="podium-name">Winner!</div>
                                <div class="podium-score">2,345</div>
                            </div>
                            <div class="podium-stand first"></div>
                        </div>
                        <div class="podium-place" data-place="3">
                            <div class="podium-player">
                                <div class="podium-avatar">🥉</div>
                                <div class="podium-name">Player 3</div>
                                <div class="podium-score">987</div>
                            </div>
                            <div class="podium-stand third"></div>
                        </div>
                    </div>

                    <!-- Detailed Stats -->
                    <div class="detailed-stats">
                        <h2>Match Statistics</h2>
                        <div class="stats-grid" id="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">🌊</div>
                                <div class="stat-value" id="final-wave">20</div>
                                <div class="stat-label">Waves Completed</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">💀</div>
                                <div class="stat-value" id="total-kills">145</div>
                                <div class="stat-label">Enemies Killed</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">🏰</div>
                                <div class="stat-value" id="towers-placed">12</div>
                                <div class="stat-label">Towers Placed</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon">⏱️</div>
                                <div class="stat-value" id="game-duration">12:34</div>
                                <div class="stat-label">Game Duration</div>
                            </div>
                        </div>
                    </div>

                    <!-- Player Rankings Table -->
                    <div class="rankings-table">
                        <h2>Player Rankings</h2>
                        <table id="rankings-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th>Score</th>
                                    <th>Wave</th>
                                    <th>Kills</th>
                                    <th>Gold</th>
                                </tr>
                            </thead>
                            <tbody id="rankings-tbody">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="victory-actions">
                    <button class="btn btn-primary btn-large" id="play-again-btn">
                        🔄 Play Again
                    </button>
                    <button class="btn btn-secondary btn-large" id="return-lobby-btn">
                        🏠 Return to Lobby
                    </button>
                    <button class="btn btn-secondary" id="share-results-btn">
                        📤 Share Results
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Add event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        const playAgainBtn = this.overlay.querySelector('#play-again-btn');
        const returnLobbyBtn = this.overlay.querySelector('#return-lobby-btn');
        const shareResultsBtn = this.overlay.querySelector('#share-results-btn');

        playAgainBtn?.addEventListener('click', () => {
            this.hide();
            this.onPlayAgain();
        });

        returnLobbyBtn?.addEventListener('click', () => {
            this.hide();
            this.onReturnToLobby();
        });

        shareResultsBtn?.addEventListener('click', () => {
            this.shareResults();
        });
    }

    populateData(gameData) {
        const {
            isVictory,
            winner,
            rankings,
            stats,
            mode,
            duration
        } = gameData;

        // Update title
        const title = this.overlay.querySelector('#victory-title');
        const subtitle = this.overlay.querySelector('#victory-subtitle');

        if (isVictory) {
            title.textContent = '🎉 Victory!';
            title.className = 'victory-title victory';
            subtitle.textContent = `You won the ${mode} match!`;
        } else {
            title.textContent = '💀 Defeated';
            title.className = 'victory-title defeat';
            subtitle.textContent = `Better luck next time!`;
        }

        // Update podium (top 3 only)
        this.updatePodium(rankings.slice(0, 3));

        // Update stats
        this.updateStats(stats, duration);

        // Update rankings table
        this.updateRankingsTable(rankings);
    }

    updatePodium(topThree) {
        const podium = this.overlay.querySelector('#winner-podium');
        const places = podium.querySelectorAll('.podium-place');

        const positions = [1, 0, 2]; // 2nd, 1st, 3rd visual order

        topThree.forEach((player, index) => {
            const placeIndex = positions[index];
            const place = places[placeIndex];

            if (place) {
                const avatar = place.querySelector('.podium-avatar');
                const name = place.querySelector('.podium-name');
                const score = place.querySelector('.podium-score');

                const medals = ['🏆', '🥈', '🥉'];
                avatar.textContent = medals[index];
                name.textContent = player.name;
                score.textContent = player.score.toLocaleString();

                // Show animated entrance
                setTimeout(() => {
                    place.classList.add('show');
                }, index * 200);
            }
        });

        // Hide 4th+ place slots if less than 3 players
        for (let i = topThree.length; i < 3; i++) {
            const placeIndex = positions[i];
            if (places[placeIndex]) {
                places[placeIndex].style.display = 'none';
            }
        }
    }

    updateStats(stats, duration) {
        const finalWave = this.overlay.querySelector('#final-wave');
        const totalKills = this.overlay.querySelector('#total-kills');
        const towersPlaced = this.overlay.querySelector('#towers-placed');
        const gameDuration = this.overlay.querySelector('#game-duration');

        if (finalWave) finalWave.textContent = stats.wave || 0;
        if (totalKills) totalKills.textContent = (stats.kills || 0).toLocaleString();
        if (towersPlaced) towersPlaced.textContent = stats.towers || 0;
        if (gameDuration) gameDuration.textContent = this.formatDuration(duration || 0);
    }

    updateRankingsTable(rankings) {
        const tbody = this.overlay.querySelector('#rankings-tbody');
        if (!tbody) return;

        tbody.innerHTML = rankings.map((player, index) => `
            <tr class="${index === 0 ? 'winner-row' : ''}">
                <td class="rank-cell">
                    <span class="rank-badge rank-${index + 1}">${index + 1}</span>
                </td>
                <td class="player-cell">
                    <span class="player-avatar">${player.avatar || '🎮'}</span>
                    <span class="player-name">${player.name}</span>
                    ${player.isYou ? '<span class="you-badge">You</span>' : ''}
                </td>
                <td class="score-cell">${player.score.toLocaleString()}</td>
                <td>${player.wave || 0}</td>
                <td>${player.kills || 0}</td>
                <td>${player.gold || 0}</td>
            </tr>
        `).join('');
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    playVictorySound(isVictory) {
        // Placeholder for audio system integration
        console.log('[Victory] Playing', isVictory ? 'victory' : 'defeat', 'sound');
    }

    shareResults() {
        // Generate shareable text
        const title = this.overlay.querySelector('#victory-title').textContent;
        const subtitle = this.overlay.querySelector('#victory-subtitle').textContent;
        const stats = this.overlay.querySelector('#final-wave').textContent;

        const text = `${title}\n${subtitle}\nWaves: ${stats}\n\nPlay Tower Defense on Linera!`;

        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                if (window.NotificationManager) {
                    window.NotificationManager.success('Results copied to clipboard!');
                }
            });
        }
    }

    onPlayAgain() {
        // Override this in implementation
        console.log('[Victory] Play again clicked');
        window.location.reload();
    }

    onReturnToLobby() {
        // Override this in implementation
        console.log('[Victory] Return to lobby clicked');
        window.location.href = 'lobby.html';
    }
}

// Create global instance
window.VictoryScreen = new VictoryScreen();

// Add CSS styles
const victoryStyles = document.createElement('style');
victoryStyles.textContent = `
.victory-screen-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    z-index: 9998;
    display: none;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
}

.victory-screen-overlay.show {
    display: flex;
    animation: fadeIn 0.5s ease;
}

.victory-screen-content {
    width: 90%;
    max-width: 1200px;
    margin: 40px auto;
    padding: 40px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 20px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.victory-header {
    text-align: center;
    margin-bottom: 40px;
}

.victory-title {
    font-size: 4rem;
    margin: 0 0 10px 0;
    animation: scaleIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.victory-title.victory {
    background: linear-gradient(135deg, #FFD700, #FFA500);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.victory-title.defeat {
    color: #888;
}

.victory-subtitle {
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.7);
}

/* Winner Podium */
.winner-podium {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 20px;
    margin: 40px 0;
    min-height: 300px;
}

.podium-place {
    display: flex;
    flex-direction: column;
    align-items: center;
    opacity: 0;
    transform: translateY(50px);
    transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.podium-place.show {
    opacity: 1;
    transform: translateY(0);
}

.podium-player {
    text-align: center;
    margin-bottom: 20px;
}

.podium-avatar {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    margin: 0 auto 10px;
    border: 3px solid rgba(255, 255, 255, 0.2);
}

.podium-avatar.winner {
    width: 100px;
    height: 100px;
    font-size: 3rem;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    border-color: #FFD700;
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

.podium-name {
    font-weight: bold;
    font-size: 1.1rem;
    margin-bottom: 5px;
}

.podium-score {
    color: #4CAF50;
    font-size: 1.3rem;
    font-weight: bold;
}

.podium-stand {
    border-radius: 10px 10px 0 0;
    background: linear-gradient(to top, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.1));
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.podium-stand.first {
    width: 150px;
    height: 180px;
    background: linear-gradient(to top, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.3));
    border-color: #FFD700;
}

.podium-stand.second {
    width: 130px;
    height: 140px;
}

.podium-stand.third {
    width: 110px;
    height: 100px;
}

/* Detailed Stats */
.detailed-stats {
    margin: 40px 0;
}

.detailed-stats h2 {
    text-align: center;
    margin-bottom: 25px;
    font-size: 1.8rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
}

.stat-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 15px;
    padding: 25px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.stat-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-5px);
}

.stat-icon {
    font-size: 2.5rem;
    margin-bottom: 10px;
}

.stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: #4CAF50;
    margin-bottom: 5px;
}

.stat-label {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
}

/* Rankings Table */
.rankings-table {
    margin: 40px 0;
}

.rankings-table h2 {
    text-align: center;
    margin-bottom: 25px;
    font-size: 1.8rem;
}

#rankings-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 8px;
}

#rankings-table thead th {
    background: rgba(255, 255, 255, 0.05);
    padding: 15px;
    text-align: left;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.9);
    border: none;
}

#rankings-table tbody tr {
    background: rgba(255, 255, 255, 0.03);
    transition: all 0.3s ease;
}

#rankings-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.08);
}

#rankings-table tbody tr.winner-row {
    background: rgba(255, 215, 0, 0.1);
    border-left: 3px solid #FFD700;
}

#rankings-table td {
    padding: 15px;
    border: none;
}

.rank-badge {
    display: inline-block;
    width: 30px;
    height: 30px;
    line-height: 30px;
    text-align: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    font-weight: bold;
}

.rank-badge.rank-1 {
    background: linear-gradient(135deg, #FFD700, #FFA500);
}

.rank-badge.rank-2 {
    background: linear-gradient(135deg, #C0C0C0, #A8A8A8);
}

.rank-badge.rank-3 {
    background: linear-gradient(135deg, #CD7F32, #A0522D);
}

.player-cell {
    display: flex;
    align-items: center;
    gap: 10px;
}

.player-avatar {
    font-size: 1.5rem;
}

.you-badge {
    background: #4CAF50;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: bold;
    margin-left: 8px;
}

.score-cell {
    color: #4CAF50;
    font-weight: bold;
    font-size: 1.1rem;
}

/* Actions */
.victory-actions {
    display: flex;
    justify-content: center;
    gap: 15px;
    flex-wrap: wrap;
    margin-top: 40px;
}

/* Animations */
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes scaleIn {
    from {
        transform: scale(0.5);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

/* Responsive */
@media (max-width: 768px) {
    .victory-screen-content {
        padding: 20px;
        margin: 20px auto;
    }

    .victory-title {
        font-size: 2.5rem;
    }

    .victory-subtitle {
        font-size: 1.1rem;
    }

    .winner-podium {
        flex-direction: column-reverse;
        min-height: auto;
    }

    .podium-place[data-place="1"] {
        order: -1;
    }

    .stats-grid {
        grid-template-columns: 1fr 1fr;
    }

    #rankings-table {
        font-size: 0.85rem;
    }

    #rankings-table td {
        padding: 10px 5px;
    }

    .victory-actions {
        flex-direction: column;
    }

    .victory-actions .btn {
        width: 100%;
    }
}

@media (prefers-reduced-motion: reduce) {
    .victory-title,
    .podium-place,
    .stat-card {
        animation: none !important;
        transition: none !important;
    }
}
`;
document.head.appendChild(victoryStyles);

console.log('[Victory] Victory screen component loaded');
