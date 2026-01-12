/**
 * Cartoon Defense - Tower Defense Game
 * With colorful cartoon graphics and visual effects
 */

// ===== Configuration =====
const CONFIG = {
    serviceUrl: 'http://localhost:8081',
    chainId: '',
    appId: '',
    pollInterval: 2000,
    gridSize: 20,
};

// ===== Game State =====
const gameState = {
    connected: false,
    gold: 500,
    health: 20,
    wave: 0,
    waveActive: false,
    gameStatus: 'Preparing',
    selectedTower: null,
    towers: [],
    enemies: [],
    path: [],
    grid: {
        width: 20,
        height: 20,
        spawnPoint: [0, 10],
        basePoint: [19, 14],
    },
};

// ===== Tower Definitions with Cartoon Graphics =====
const TOWER_TYPES = {
    Arrow: {
        icon: '🏹',
        sprite: '🧝',
        projectile: 'bullet',
        cost: 100,
        damage: 10,
        range: 3,
        color: '#FFD700',
        description: 'Quick archer with golden arrows'
    },
    Cannon: {
        icon: '💥',
        sprite: '🤖',
        projectile: 'bullet',
        cost: 250,
        damage: 50,
        range: 4,
        color: '#FF5722',
        description: 'Heavy mech with explosive rounds'
    },
    Magic: {
        icon: '✨',
        sprite: '🧙',
        projectile: 'magic',
        cost: 200,
        damage: 15,
        range: 2,
        color: '#9C27B0',
        description: 'Mystic mage with arcane power'
    },
    Ice: {
        icon: '❄️',
        sprite: '🥶',
        projectile: 'ice',
        cost: 150,
        damage: 5,
        range: 3,
        color: '#03A9F4',
        description: 'Frost warrior with freezing blast'
    },
    Lightning: {
        icon: '⚡',
        sprite: '⚡',
        projectile: 'lightning',
        cost: 300,
        damage: 30,
        range: 3,
        color: '#FFEB3B',
        description: 'Electric trooper with tesla power'
    },
};

// ===== Enemy Types with Cartoon Graphics =====
const ENEMY_TYPES = {
    BasicScout: {
        icon: '👾',
        sprite: '🐙',
        health: 30,
        speed: 1,
        reward: 10,
        color: '#9C27B0',
        name: 'Alien Scout'
    },
    FastRunner: {
        icon: '💨',
        sprite: '🦎',
        health: 20,
        speed: 2,
        reward: 15,
        color: '#4CAF50',
        name: 'Speed Lizard'
    },
    HeavySoldier: {
        icon: '🛡️',
        sprite: '🦂',
        health: 80,
        speed: 0.5,
        reward: 25,
        color: '#F44336',
        name: 'Armored Bug'
    },
    Tank: {
        icon: '🦏',
        sprite: '🐛',
        health: 150,
        speed: 0.3,
        reward: 50,
        color: '#7B1FA2',
        name: 'Heavy Beetle'
    },
    Boss: {
        icon: '👹',
        sprite: '👁️',
        health: 500,
        speed: 0.2,
        reward: 200,
        color: '#FF5722',
        name: 'Eye Overlord'
    },
};

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏰 Cartoon Defense - Initializing...');

    // Initialize default path
    initializePath();

    // Setup UI components
    setupTowerSelection();
    initializeGrid();
    setupEventListeners();

    // Try to load config
    await loadConfig();

    // Update UI
    updateUI();

    // Start polling if connected
    if (CONFIG.chainId && CONFIG.appId) {
        startPolling();
    }

    showToast('Welcome to Cartoon Defense! Build your defenses!', 'success');
    console.log('✅ Cartoon Defense ready!');
});

// ===== Initialize Path =====
function initializePath() {
    gameState.path = [];
    // Create a winding path through the terrain
    for (let x = 0; x < 8; x++) gameState.path.push([x, 10]);
    for (let y = 9; y >= 5; y--) gameState.path.push([7, y]);
    for (let x = 7; x < 15; x++) gameState.path.push([x, 5]);
    for (let y = 5; y < 15; y++) gameState.path.push([14, y]);
    for (let x = 14; x < 20; x++) gameState.path.push([x, 14]);
}

// ===== Setup Tower Selection =====
function setupTowerSelection() {
    const towerList = document.getElementById('tower-list');
    if (!towerList) return;

    towerList.innerHTML = '';

    Object.entries(TOWER_TYPES).forEach(([name, tower], index) => {
        const towerItem = document.createElement('div');
        towerItem.className = 'tower-item';
        towerItem.dataset.tower = name;

        // Add tooltip with full stats
        towerItem.title = `${name} Tower [${index + 1}]\n${tower.description}\nCost: ${tower.cost} | Damage: ${tower.damage} | Range: ${tower.range}`;

        towerItem.innerHTML = `
            <div class="tower-header">
                <span class="tower-icon">${tower.sprite}</span>
                <div>
                    <div class="tower-name">${name}</div>
                </div>
                <div class="tower-cost">💰 ${tower.cost}</div>
            </div>
            <div class="tower-stats">
                <span class="tower-stat">⚔️ ${tower.damage}</span>
                <span class="tower-stat">📐 ${tower.range}</span>
            </div>
        `;

        towerItem.addEventListener('click', () => selectTower(name, tower, towerItem));
        towerList.appendChild(towerItem);
    });
}

function selectTower(name, tower, element) {
    // Deselect previous
    document.querySelectorAll('.tower-item.selected').forEach(el => el.classList.remove('selected'));

    // Select new
    element.classList.add('selected');
    gameState.selectedTower = name;

    // Update info panel
    const infoPanel = document.getElementById('selected-tower-info');
    if (infoPanel) {
        infoPanel.innerHTML = `
            <div class="status-label">Selected</div>
            <div class="status-value">${tower.sprite} ${name}</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.5rem; opacity: 0.9;">
                ${tower.description}
            </div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ⚔️ ${tower.damage} DMG | 📐 ${tower.range} Range
            </div>
        `;
    }

    showToast(`Selected ${name} defender`, 'info');
}

// ===== Initialize Grid =====
function initializeGrid() {
    const gridElement = document.getElementById('game-grid');
    if (!gridElement) return;

    gridElement.innerHTML = '';

    // Add decorative elements randomly
    const decorations = generateDecorations();

    for (let y = 0; y < CONFIG.gridSize; y++) {
        for (let x = 0; x < CONFIG.gridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;

            // Check if on path
            const isOnPath = gameState.path.some(p => p[0] === x && p[1] === y);
            if (isOnPath) {
                cell.classList.add('path');
            } else {
                // Add random decorations to non-path cells
                if (decorations.grass.has(`${x},${y}`)) {
                    cell.classList.add('grass-tuft');
                }
                if (decorations.rocks.has(`${x},${y}`)) {
                    cell.classList.add('rock');
                }
            }

            // Check spawn point (enemy portal)
            if (x === gameState.grid.spawnPoint[0] && y === gameState.grid.spawnPoint[1]) {
                cell.classList.add('spawn');
                cell.innerHTML = '<span style="font-size: 1.2rem;">🌀</span>';
            }

            // Check base point (castle)
            if (x === gameState.grid.basePoint[0] && y === gameState.grid.basePoint[1]) {
                cell.classList.add('base');
                cell.innerHTML = '<span style="font-size: 1.2rem;">🏰</span>';
            }

            // Click handler
            cell.addEventListener('click', () => handleCellClick(x, y, cell));

            gridElement.appendChild(cell);
        }
    }
}

// Generate random decorations for the terrain
function generateDecorations() {
    const grass = new Set();
    const rocks = new Set();

    for (let i = 0; i < 30; i++) {
        const x = Math.floor(Math.random() * CONFIG.gridSize);
        const y = Math.floor(Math.random() * CONFIG.gridSize);
        const key = `${x},${y}`;

        // Don't place on path
        const isOnPath = gameState.path.some(p => p[0] === x && p[1] === y);
        if (!isOnPath) {
            if (i < 20) {
                grass.add(key);
            } else {
                rocks.add(key);
            }
        }
    }

    return { grass, rocks };
}

// ===== Cell Click Handler =====
function handleCellClick(x, y, cell) {
    if (!gameState.selectedTower) {
        showToast('Select a defender first!', 'error');
        return;
    }

    // Check if on path
    const isOnPath = gameState.path.some(p => p[0] === x && p[1] === y);
    if (isOnPath) {
        showToast('Cannot place on the path!', 'error');
        return;
    }

    // Check if already has tower
    const existingTower = gameState.towers.find(t => t.position[0] === x && t.position[1] === y);
    if (existingTower) {
        showToast('Defender already stationed here!', 'error');
        return;
    }

    // Check gold
    const towerDef = TOWER_TYPES[gameState.selectedTower];
    if (gameState.gold < towerDef.cost) {
        showToast('Not enough gold!', 'error');
        return;
    }

    // Place tower
    placeTowerDemo(x, y, gameState.selectedTower, towerDef);
}

function placeTowerDemo(x, y, towerType, towerDef) {
    // Deduct gold
    gameState.gold -= towerDef.cost;

    // Add to towers array
    const tower = {
        id: Date.now().toString(),
        position: [x, y],
        towerType: towerType,
        level: 1,
        lastFired: 0,
    };
    gameState.towers.push(tower);

    // Update cell with tower sprite
    const cell = document.querySelector(`.grid-cell[data-x="${x}"][data-y="${y}"]`);
    if (cell) {
        cell.classList.add('tower');
        cell.classList.remove('grass-tuft', 'rock');
        cell.innerHTML = `<span class="tower-sprite" data-tower-id="${tower.id}">${towerDef.sprite}</span>`;
    }

    // Update UI
    updateUI();
    showToast(`${towerType} defender deployed!`, 'success');

    // Announce if first tower
    if (gameState.towers.length === 1 && window.AnnouncementSystem) {
        window.AnnouncementSystem.show('FIRST DEFENDER READY!', 2000);
    }
}

// ===== Update UI =====
function updateUI() {
    const goldDisplay = document.getElementById('gold-display');
    const healthDisplay = document.getElementById('health-display');
    const waveDisplay = document.getElementById('wave-display');
    const statusDisplay = document.getElementById('game-status');
    const enemyCount = document.getElementById('enemy-count');
    const towerCount = document.getElementById('tower-count');

    if (goldDisplay) goldDisplay.textContent = gameState.gold;
    if (healthDisplay) healthDisplay.textContent = gameState.health;
    if (waveDisplay) waveDisplay.textContent = gameState.wave;
    if (statusDisplay) statusDisplay.textContent = gameState.gameStatus;
    if (enemyCount) enemyCount.textContent = gameState.enemies.length;
    if (towerCount) towerCount.textContent = gameState.towers.length;

    // Update button states (Web2 quality feedback)
    const startWaveBtn = document.getElementById('start-wave-btn');
    if (startWaveBtn) {
        if (gameState.waveActive || gameState.towers.length === 0) {
            startWaveBtn.disabled = true;
            startWaveBtn.classList.add('disabled');
        } else {
            startWaveBtn.disabled = false;
            startWaveBtn.classList.remove('disabled');
        }
    }

    // Update tower items based on gold
    document.querySelectorAll('.tower-item').forEach(item => {
        const towerType = item.dataset.tower;
        const towerDef = TOWER_TYPES[towerType];
        if (towerDef && gameState.gold < towerDef.cost) {
            item.classList.add('disabled');
            item.style.opacity = '0.5';
        } else {
            item.classList.remove('disabled');
            item.style.opacity = '1';
        }
    });

    // Update portraits based on game state
    updatePortraits();
}

function updatePortraits() {
    const defenderPortrait = document.getElementById('portrait-defender');
    const enemyPortrait = document.getElementById('portrait-enemy');

    if (defenderPortrait) {
        // Show selected tower or default hero
        const selected = gameState.selectedTower;
        defenderPortrait.textContent = selected ? TOWER_TYPES[selected].sprite : '🦸';
    }

    if (enemyPortrait) {
        // Show current wave enemy or default
        if (gameState.enemies.length > 0) {
            const enemy = gameState.enemies[0];
            enemyPortrait.textContent = ENEMY_TYPES[enemy.enemyType]?.sprite || '👾';
        } else {
            enemyPortrait.textContent = '👾';
        }
    }
}

// ===== Setup Event Listeners =====
function setupEventListeners() {
    // Start Wave button
    const startWaveBtn = document.getElementById('start-wave-btn');
    if (startWaveBtn) {
        startWaveBtn.addEventListener('click', startWave);
    }

    // Find Game button
    const findGameBtn = document.getElementById('find-game-btn');
    if (findGameBtn) {
        findGameBtn.addEventListener('click', () => {
            showToast('Finding game... (requires Linera connection)', 'info');
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            initializeGrid();
            renderTowers();
            showToast('Battlefield refreshed!', 'success');
        });
    }

    // Settings modal
    setupSettingsModal();

    // Demo mode link
    const demoLink = document.getElementById('demo-mode-link');
    if (demoLink) {
        demoLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Demo mode active! Build and defend!', 'info');
        });
    }
}

function setupSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModal = document.getElementById('close-modal');
    const cancelSettings = document.getElementById('cancel-settings');
    const saveSettings = document.getElementById('save-settings');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('show');
            const serviceUrl = document.getElementById('service-url');
            const chainInput = document.getElementById('chain-input');
            const appIdInput = document.getElementById('app-id');
            if (serviceUrl) serviceUrl.value = CONFIG.serviceUrl;
            if (chainInput) chainInput.value = CONFIG.chainId;
            if (appIdInput) appIdInput.value = CONFIG.appId;
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => settingsModal.classList.remove('show'));
    }

    if (cancelSettings) {
        cancelSettings.addEventListener('click', () => settingsModal.classList.remove('show'));
    }

    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            const serviceUrl = document.getElementById('service-url');
            const chainInput = document.getElementById('chain-input');
            const appIdInput = document.getElementById('app-id');

            CONFIG.serviceUrl = serviceUrl?.value || CONFIG.serviceUrl;
            CONFIG.chainId = chainInput?.value || '';
            CONFIG.appId = appIdInput?.value || '';

            localStorage.setItem('td-config', JSON.stringify({
                serviceUrl: CONFIG.serviceUrl,
                chainId: CONFIG.chainId,
                appId: CONFIG.appId,
            }));

            const chainDisplay = document.getElementById('chain-id');
            if (chainDisplay) {
                chainDisplay.textContent = CONFIG.chainId ? CONFIG.chainId.slice(0, 8) + '...' : 'Not connected';
            }

            const connectionStatus = document.getElementById('connection-status');
            if (connectionStatus && CONFIG.chainId && CONFIG.appId) {
                connectionStatus.classList.add('connected');
            }

            settingsModal.classList.remove('show');
            showToast('Settings saved!', 'success');

            if (CONFIG.chainId && CONFIG.appId) {
                startPolling();
            }
        });
    }
}

// ===== Start Wave (Demo) =====
function startWave() {
    if (gameState.waveActive) {
        showToast('Wave already in progress!', 'error');
        return;
    }

    if (gameState.towers.length === 0) {
        showToast('Deploy at least one defender first!', 'error');
        return;
    }

    gameState.wave++;
    gameState.waveActive = true;
    gameState.gameStatus = 'Wave ' + gameState.wave;
    updateUI();

    // Show announcement
    if (window.AnnouncementSystem) {
        window.AnnouncementSystem.show(`WAVE ${gameState.wave} INCOMING!`, 2500);
    }

    showToast(`Wave ${gameState.wave} started!`, 'success');

    // Spawn demo enemies
    setTimeout(() => spawnDemoEnemies(), 1500);
}

function spawnDemoEnemies() {
    const enemyTypes = ['BasicScout', 'FastRunner', 'HeavySoldier'];
    const count = 3 + gameState.wave * 2;

    // Add Tank and Boss at higher waves
    if (gameState.wave >= 3) enemyTypes.push('Tank');
    if (gameState.wave >= 5) enemyTypes.push('Boss');

    let spawned = 0;
    const spawnInterval = setInterval(() => {
        if (spawned >= count) {
            clearInterval(spawnInterval);
            // Wait then end wave
            checkWaveEnd();
            return;
        }

        const type = enemyTypes[Math.floor(Math.random() * Math.min(enemyTypes.length, 3 + Math.floor(gameState.wave / 2)))];
        const enemyDef = ENEMY_TYPES[type];

        const enemy = {
            id: Date.now().toString() + spawned,
            enemyType: type,
            position: [...gameState.grid.spawnPoint],
            pathIndex: 0,
            health: enemyDef.health,
            maxHealth: enemyDef.health,
        };
        gameState.enemies.push(enemy);
        spawned++;

        updateUI();
        renderEnemies();

        // Move enemy along path
        moveEnemy(enemy);
    }, 800);
}

function checkWaveEnd() {
    const checkInterval = setInterval(() => {
        if (gameState.enemies.length === 0) {
            clearInterval(checkInterval);
            endWave();
        }
    }, 500);
}

function endWave() {
    gameState.waveActive = false;
    gameState.gameStatus = 'Preparing';
    const bonus = 50 + gameState.wave * 10;
    gameState.gold += bonus;
    updateUI();

    if (window.AnnouncementSystem) {
        window.AnnouncementSystem.show('WAVE CLEARED! 🎉', 2500);
    }
    showToast(`Wave ${gameState.wave} complete! +${bonus} gold`, 'success');
}

function moveEnemy(enemy) {
    const enemyDef = ENEMY_TYPES[enemy.enemyType];
    const moveSpeed = Math.max(200, 600 - enemyDef.speed * 150);

    const moveInterval = setInterval(() => {
        // Check if enemy still exists
        if (!gameState.enemies.find(e => e.id === enemy.id)) {
            clearInterval(moveInterval);
            return;
        }

        enemy.pathIndex++;

        if (enemy.pathIndex >= gameState.path.length) {
            // Enemy reached base
            gameState.health--;
            removeEnemy(enemy);
            clearInterval(moveInterval);
            updateUI();

            if (gameState.health <= 0) {
                gameOver();
            }
            return;
        }

        // Tower attacks
        processTowerAttacks(enemy, moveInterval);

        // Update position
        enemy.position = gameState.path[enemy.pathIndex];
        renderEnemies();
    }, moveSpeed);
}

function processTowerAttacks(enemy, moveInterval) {
    const currentPos = gameState.path[enemy.pathIndex];

    gameState.towers.forEach(tower => {
        const towerDef = TOWER_TYPES[tower.towerType];
        const dx = tower.position[0] - currentPos[0];
        const dy = tower.position[1] - currentPos[1];
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= towerDef.range) {
            // Tower can hit this enemy
            const now = Date.now();
            if (now - tower.lastFired > 500) { // Fire rate limit
                tower.lastFired = now;

                // Create projectile effect
                if (window.EffectsManager) {
                    const towerPos = window.EffectsManager.getCellCenter(tower.position[0], tower.position[1]);
                    const enemyPos = window.EffectsManager.getCellCenter(currentPos[0], currentPos[1]);
                    window.EffectsManager.createProjectile(
                        towerPos.x, towerPos.y,
                        enemyPos.x, enemyPos.y,
                        towerDef.projectile
                    );
                }

                // Apply damage
                enemy.health -= towerDef.damage;

                // Show damage number
                if (window.EffectsManager) {
                    const pos = window.EffectsManager.getCellCenter(currentPos[0], currentPos[1]);
                    window.EffectsManager.createDamageNumber(pos.x, pos.y - 10, towerDef.damage);
                }

                // Animate tower firing
                animateTowerFiring(tower);

                // Check if enemy died
                if (enemy.health <= 0) {
                    const reward = ENEMY_TYPES[enemy.enemyType]?.reward || 10;
                    gameState.gold += reward;

                    // Death effect
                    if (window.EffectsManager) {
                        const pos = window.EffectsManager.getCellCenter(currentPos[0], currentPos[1]);
                        window.EffectsManager.createDeathEffect(pos.x, pos.y, ENEMY_TYPES[enemy.enemyType].color);
                        window.EffectsManager.createGoldPickup(pos.x, pos.y, reward);
                    }

                    removeEnemy(enemy);
                    clearInterval(moveInterval);
                    updateUI();
                    renderEnemies();
                }
            }
        }
    });
}

function animateTowerFiring(tower) {
    const cell = document.querySelector(`.grid-cell[data-x="${tower.position[0]}"][data-y="${tower.position[1]}"]`);
    if (cell) {
        const sprite = cell.querySelector('.tower-sprite');
        if (sprite) {
            sprite.classList.add('firing');
            setTimeout(() => sprite.classList.remove('firing'), 150);
        }
    }
}

function removeEnemy(enemy) {
    gameState.enemies = gameState.enemies.filter(e => e.id !== enemy.id);
}

function gameOver() {
    gameState.gameStatus = 'Game Over';
    gameState.waveActive = false;

    if (window.AnnouncementSystem) {
        window.AnnouncementSystem.show('GAME OVER! 💀', 4000);
    }
    showToast('Game Over! Your base was destroyed.', 'error');
    updateUI();
}

function renderEnemies() {
    // Clear enemy markers
    document.querySelectorAll('.grid-cell.enemy').forEach(cell => {
        if (!cell.classList.contains('tower') && !cell.classList.contains('spawn') && !cell.classList.contains('base')) {
            cell.classList.remove('enemy');
            const enemySprite = cell.querySelector('.enemy-sprite');
            if (enemySprite) enemySprite.remove();
        }
    });

    // Render enemies with sprites and health bars
    gameState.enemies.forEach(enemy => {
        const cell = document.querySelector(`.grid-cell[data-x="${enemy.position[0]}"][data-y="${enemy.position[1]}"]`);
        if (cell && !cell.classList.contains('tower')) {
            cell.classList.add('enemy');

            const enemyDef = ENEMY_TYPES[enemy.enemyType];
            const healthPercent = (enemy.health / enemy.maxHealth) * 100;
            const healthClass = healthPercent > 50 ? '' : healthPercent > 25 ? 'low' : 'critical';

            cell.innerHTML = `
                <span class="enemy-sprite moving">${enemyDef?.sprite || '👾'}</span>
                <div class="health-bar-container">
                    <div class="health-bar-fill ${healthClass}" style="width: ${healthPercent}%"></div>
                </div>
            `;
        }
    });
}

function renderTowers() {
    gameState.towers.forEach(tower => {
        const cell = document.querySelector(`.grid-cell[data-x="${tower.position[0]}"][data-y="${tower.position[1]}"]`);
        if (cell) {
            cell.classList.add('tower');
            cell.classList.remove('grass-tuft', 'rock');
            const towerDef = TOWER_TYPES[tower.towerType];
            cell.innerHTML = `<span class="tower-sprite" data-tower-id="${tower.id}">${towerDef?.sprite || '🗼'}</span>`;
        }
    });
}

// ===== Load Config =====
async function loadConfig() {
    // Try config.json first
    try {
        const response = await fetch('config.json');
        if (response.ok) {
            const config = await response.json();
            CONFIG.serviceUrl = config.serviceUrl || CONFIG.serviceUrl;
            CONFIG.chainId = config.chainId || '';
            CONFIG.appId = config.appId || '';
            console.log('✅ Loaded config from config.json');
        }
    } catch (e) {
        console.log('📋 No config.json, using localStorage');
    }

    // Fallback to localStorage
    try {
        const saved = localStorage.getItem('td-config');
        if (saved && !CONFIG.chainId) {
            const parsed = JSON.parse(saved);
            CONFIG.serviceUrl = parsed.serviceUrl || CONFIG.serviceUrl;
            CONFIG.chainId = parsed.chainId || '';
            CONFIG.appId = parsed.appId || '';
        }
    } catch (e) {
        console.warn('Failed to load localStorage config');
    }

    // Update connection display
    const chainDisplay = document.getElementById('chain-id');
    if (chainDisplay) {
        chainDisplay.textContent = CONFIG.chainId ? CONFIG.chainId.slice(0, 8) + '...' : 'Not connected';
    }

    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus && CONFIG.chainId && CONFIG.appId) {
        connectionStatus.classList.add('connected');
    }
}

// ===== Polling & GraphQL =====
let pollInterval = null;

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        if (!CONFIG.chainId || !CONFIG.appId) return;

        const data = await graphqlQuery(`
            query {
                gameState {
                    gold
                    health
                    wave
                    status
                }
            }
        `);

        if (data?.gameState) {
            gameState.gold = data.gameState.gold ?? gameState.gold;
            gameState.health = data.gameState.health ?? gameState.health;
            gameState.wave = data.gameState.wave ?? gameState.wave;
            gameState.gameStatus = data.gameState.status ?? gameState.gameStatus;
            updateUI();
        }
    }, CONFIG.pollInterval);
}

async function graphqlQuery(query) {
    if (!CONFIG.chainId || !CONFIG.appId) return null;

    const url = `${CONFIG.serviceUrl}/chains/${CONFIG.chainId}/applications/${CONFIG.appId}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) return null;

        const result = await response.json();
        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            return null;
        }

        return result.data;
    } catch (error) {
        return null;
    }
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        info: '💡'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${icons[type] || 'ℹ️'}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Keyboard Shortcuts (Web2 Quality) =====
document.addEventListener('keydown', (e) => {
    // ESC - Close modal
    if (e.key === 'Escape' || e.key === 'Esc') {
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal && settingsModal.classList.contains('show')) {
            settingsModal.classList.remove('show');
        }
        // Deselect tower
        gameState.selectedTower = null;
        document.querySelectorAll('.tower-item.selected').forEach(el => el.classList.remove('selected'));
        const infoPanel = document.getElementById('selected-tower-info');
        if (infoPanel) {
            infoPanel.innerHTML = `
                <div class="status-label">Selection</div>
                <div class="status-value">Choose a defender</div>
            `;
        }
    }
    
    // Space - Start Wave
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); // Prevent page scroll
        const startWaveBtn = document.getElementById('start-wave-btn');
        if (startWaveBtn && !startWaveBtn.disabled && !gameState.waveActive && gameState.towers.length > 0) {
            startWave();
        }
    }
    
    // R - Refresh grid
    if (e.key === 'r' || e.key === 'R') {
        initializeGrid();
        renderTowers();
        showToast('Battlefield refreshed!', 'success');
    }
    
    // Numbers 1-5 - Select tower type quickly
    const num = parseInt(e.key);
    if (num >= 1 && num <= 5) {
        const towerTypes = Object.keys(TOWER_TYPES);
        if (towerTypes[num - 1]) {
            const towerName = towerTypes[num - 1];
            const towerDef = TOWER_TYPES[towerName];
            const towerElement = document.querySelector(`.tower-item[data-tower="${towerName}"]`);
            if (towerElement && gameState.gold >= towerDef.cost) {
                selectTower(towerName, towerDef, towerElement);
            }
        }
    }
});

console.log('⌨️ Keyboard shortcuts enabled: Space (start wave), ESC (cancel), R (refresh), 1-5 (select towers)');
