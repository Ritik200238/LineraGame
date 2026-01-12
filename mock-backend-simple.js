/**
 * Simple Mock Backend for Tower Defense Multiplayer Testing
 * Provides game state synchronization without GraphQL complexity
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Game state storage
const gameStates = new Map();

// Initialize default state for a chain
function getOrCreateGameState(chainId) {
  if (!gameStates.has(chainId)) {
    gameStates.set(chainId, {
      gold: 500,
      health: 20,
      wave: 0,
      status: 'Preparing',
      towers: [],
      enemies: []
    });
  }
  return gameStates.get(chainId);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    games: gameStates.size,
    timestamp: Date.now()
  });
});

// Linera-style GraphQL endpoint (handles both queries and mutations)
app.post('/chains/:chainId/applications/:appId', (req, res) => {
  const chainId = req.params.chainId;
  const query = req.body.query || '';
  const operation = req.body.operation || '';

  console.log(`[Request] Chain: ${chainId.substring(0, 8)}... Type: ${operation || 'query'}`);

  // Handle mutations
  if (query.includes('placeTower') || operation === 'placeTower') {
    const state = getOrCreateGameState(chainId);
    // Tower placement would be handled here, but for now just return success
    res.json({ data: { success: true } });
    return;
  }

  if (query.includes('startWave') || operation === 'startWave') {
    const state = getOrCreateGameState(chainId);
    // Wave start would be handled here, but for now just return success
    res.json({ data: { success: true } });
    return;
  }

  // Handle queries
  if (query.includes('gameState')) {
    const state = getOrCreateGameState(chainId);
    res.json({ data: { gameState: state } });
  } else {
    res.json({ data: null });
  }
});

// RESTful endpoints for easier testing
app.get('/api/game/:chainId', (req, res) => {
  const state = getOrCreateGameState(req.params.chainId);
  res.json(state);
});

app.post('/api/game/:chainId/tower', (req, res) => {
  const state = getOrCreateGameState(req.params.chainId);
  const { x, y, towerType, cost } = req.body;

  if (state.gold >= cost) {
    const tower = {
      id: `tower_${Date.now()}_${Math.random()}`,
      towerType,
      position: { x, y },
      level: 1
    };
    state.towers.push(tower);
    state.gold -= cost;
    gameStates.set(req.params.chainId, state);
    res.json({ success: true, tower, gold: state.gold });
  } else {
    res.json({ success: false, error: 'Not enough gold' });
  }
});

app.post('/api/game/:chainId/wave', (req, res) => {
  const state = getOrCreateGameState(req.params.chainId);
  state.wave += 1;
  state.status = `Wave ${state.wave}`;
  gameStates.set(req.params.chainId, state);
  res.json({ success: true, wave: state.wave });
});

app.post('/api/game/:chainId/update', (req, res) => {
  const state = getOrCreateGameState(req.params.chainId);
  const { gold, health, wave, status } = req.body;

  if (gold !== undefined) state.gold = gold;
  if (health !== undefined) state.health = health;
  if (wave !== undefined) state.wave = wave;
  if (status !== undefined) state.status = status;

  gameStates.set(req.params.chainId, state);
  res.json({ success: true, state });
});

const PORT = 8081;
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('🎮  Tower Defense Mock Backend Started');
  console.log('🚀 ========================================');
  console.log(`📡  Server: http://localhost:${PORT}`);
  console.log(`🏥  Health: http://localhost:${PORT}/health`);
  console.log(`🎯  Ready for multiplayer testing!`);
  console.log('');
});
