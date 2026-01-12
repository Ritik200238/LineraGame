# Phase 5-6 Testing Guide
## Docker Validation & Playwright Testing

This guide documents the exact steps to execute Phase 5 (Docker Validation) and Phase 6 (Playwright Testing) when Docker environment is available.

---

## Phase 5: Docker Validation (30 min)

### Step 1: Clean Docker Environment
```bash
cd /d/workspace/tower-defense
docker compose down -v
docker system prune -f
```

### Step 2: Rebuild with Multiplayer Changes
```bash
docker compose up --build
```

**Expected Output:**
- Linera proxy server starts on port 8080
- Vite dev server starts on port 5173
- No compilation errors in Rust build
- All WASM targets compile successfully

### Step 3: Initialize Linera Project
```bash
# In a new terminal
linera project new --name tower-defense
linera project publish-and-create
```

**Expected Output:**
- Application ID generated
- Chain ID created
- Master chain initialized
- GraphQL endpoint available at http://localhost:8080/graphql

### Step 4: Test GraphQL Queries

#### Query 1: List Active Games
```graphql
query ListGames {
  games {
    gameId
    mode
    maxPlayers
    currentPlayers
    status
    hostName
  }
}
```

#### Query 2: Get Player Profile
```graphql
query GetProfile($playerId: String!) {
  playerProfile(playerId: $playerId) {
    name
    wins
    losses
    highestWave
    highestScore
  }
}
```

#### Query 3: Get Game State
```graphql
query GetGameState($gameId: String!) {
  gameState(gameId: $gameId) {
    gameId
    mode
    status
    players {
      playerId
      playerName
      health
      gold
      currentWave
      score
      isAlive
      isReady
    }
  }
}
```

### Step 5: Test Mutations

#### Create Game
```graphql
mutation CreateGame($input: CreateGameInput!) {
  createGame(input: $input) {
    gameId
    success
  }
}

# Variables:
{
  "input": {
    "mode": "Versus",
    "maxPlayers": 4,
    "isPrivate": false
  }
}
```

#### Join Game
```graphql
mutation JoinGame($gameId: String!) {
  joinGame(gameId: $gameId) {
    success
    error
  }
}
```

#### Set Ready Status
```graphql
mutation SetReady($gameId: String!, $ready: Boolean!) {
  setPlayerReady(gameId: $gameId, ready: $ready)
}
```

### Step 6: Validation Checklist

- [ ] Docker containers start without errors
- [ ] Rust backend compiles successfully
- [ ] WASM targets build correctly
- [ ] GraphQL endpoint responds to queries
- [ ] All new structs serialize/deserialize correctly
- [ ] CreateGame mutation works
- [ ] JoinGame mutation works
- [ ] SetPlayerReady mutation works
- [ ] Events are emitted correctly
- [ ] Cross-chain messages are delivered
- [ ] Frontend can query game list
- [ ] Frontend can create games
- [ ] Frontend can join games

---

## Phase 6: Playwright Testing (60 min)

### Setup Playwright
```bash
cd /d/workspace/tower-defense/frontend
npm install -D @playwright/test
npx playwright install
```

### Test 1: 2-Player Versus Mode (15 min)

Create `tests/versus-mode.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('2-player Versus mode - complete game', async ({ browser }) => {
  // Launch 2 browser contexts (2 players)
  const player1Context = await browser.newContext();
  const player2Context = await browser.newContext();

  const player1 = await player1Context.newPage();
  const player2 = await player2Context.newPage();

  // Player 1: Navigate to lobby
  await player1.goto('http://localhost:5173/lobby.html');
  await expect(player1.locator('h1')).toContainText('Multiplayer Lobby');

  // Player 1: Create Versus game
  await player1.click('#create-game');
  await player1.selectOption('#game-mode-select', 'Versus');
  await player1.selectOption('#max-players-select', '2');
  await player1.click('button[type="submit"]');

  // Wait for game creation
  await player1.waitForSelector('#active-room', { state: 'visible' });
  const gameId = await player1.locator('#room-id').textContent();

  // Player 2: Join the game
  await player2.goto('http://localhost:5173/lobby.html');
  await player2.click('.game-listing'); // Click first game
  await player2.waitForSelector('#active-room', { state: 'visible' });

  // Both players ready up
  await player1.click('#ready-button');
  await player2.click('#ready-button');

  // Player 1 (host) starts game
  await player1.waitForSelector('#start-game-button', { state: 'visible' });
  await player1.click('#start-game-button');

  // Both should be redirected to game
  await expect(player1).toHaveURL(/mode=multiplayer/);
  await expect(player2).toHaveURL(/mode=multiplayer/);

  // Player 1: Place towers
  await player1.click('.tower-button[data-type="Arrow"]');
  await player1.click('.grid-cell[data-x="3"][data-y="3"]');
  await player1.click('.grid-cell[data-x="4"][data-y="3"]');

  // Player 2: Place towers
  await player2.click('.tower-button[data-type="Arrow"]');
  await player2.click('.grid-cell[data-x="3"][data-y="4"]');
  await player2.click('.grid-cell[data-x="4"][data-y="4"]');

  // Both players start wave 1
  await player1.click('#start-wave-btn');
  await player2.click('#start-wave-btn');

  // Wait for wave completion
  await player1.waitForSelector('.wave-complete-notification', { timeout: 30000 });
  await player2.waitForSelector('.wave-complete-notification', { timeout: 30000 });

  // Continue for several waves...
  for (let wave = 2; wave <= 5; wave++) {
    await player1.click('#start-wave-btn');
    await player2.click('#start-wave-btn');
    await player1.waitForSelector('.wave-complete-notification', { timeout: 30000 });
    await player2.waitForSelector('.wave-complete-notification', { timeout: 30000 });
  }

  // Check health status
  const p1Health = await player1.locator('#health-display').textContent();
  const p2Health = await player2.locator('#health-display').textContent();

  console.log('Player 1 health:', p1Health);
  console.log('Player 2 health:', p2Health);

  // Cleanup
  await player1Context.close();
  await player2Context.close();
});
```

Run test:
```bash
npx playwright test tests/versus-mode.spec.js
```

### Test 2: 4-Player Co-op Mode (15 min)

Create `tests/coop-mode.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('4-player Co-op mode - shared health', async ({ browser }) => {
  const contexts = [];
  const pages = [];

  // Launch 4 browser contexts
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
  }

  const [p1, p2, p3, p4] = pages;

  // Player 1 creates Co-op game
  await p1.goto('http://localhost:5173/lobby.html');
  await p1.click('#create-game');
  await p1.selectOption('#game-mode-select', 'CoOp');
  await p1.selectOption('#max-players-select', '4');
  await p1.click('button[type="submit"]');
  await p1.waitForSelector('#active-room', { state: 'visible' });

  // Players 2-4 join
  for (const player of [p2, p3, p4]) {
    await player.goto('http://localhost:5173/lobby.html');
    await player.click('.game-listing');
    await player.waitForSelector('#active-room', { state: 'visible' });
  }

  // All ready up
  for (const player of pages) {
    await player.click('#ready-button');
  }

  // Start game
  await p1.click('#start-game-button');

  // Verify all players see shared health pool
  for (const player of pages) {
    await expect(player).toHaveURL(/mode=multiplayer/);
    const health = await player.locator('#health-display').textContent();
    expect(parseInt(health)).toBe(80); // 20 * 4 players
  }

  // All place towers cooperatively
  await p1.click('.tower-button[data-type="Arrow"]');
  await p1.click('.grid-cell[data-x="2"][data-y="2"]');

  await p2.click('.tower-button[data-type="Arrow"]');
  await p2.click('.grid-cell[data-x="5"][data-y="2"]');

  await p3.click('.tower-button[data-type="Cannon"]');
  await p3.click('.grid-cell[data-x="3"][data-y="5"]');

  await p4.click('.tower-button[data-type="Cannon"]');
  await p4.click('.grid-cell[data-x="4"][data-y="5"]');

  // Majority vote to start wave
  await p1.click('#start-wave-btn');
  await p2.click('#start-wave-btn'); // 2/4 votes needed

  // Wait for wave completion
  await p1.waitForSelector('.wave-complete-notification', { timeout: 30000 });

  // Verify shared health decreased
  const newHealth = await p1.locator('#health-display').textContent();
  expect(parseInt(newHealth)).toBeLessThan(80);

  // Cleanup
  for (const context of contexts) {
    await context.close();
  }
});
```

### Test 3: Race Mode (15 min)

Create `tests/race-mode.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('Race mode - first to wave 20 wins', async ({ browser }) => {
  const p1Context = await browser.newContext();
  const p2Context = await browser.newContext();

  const p1 = await p1Context.newPage();
  const p2 = await p2Context.newPage();

  // Setup Race game
  await p1.goto('http://localhost:5173/lobby.html');
  await p1.click('#create-game');
  await p1.selectOption('#game-mode-select', 'Race');
  await p1.click('button[type="submit"]');

  await p2.goto('http://localhost:5173/lobby.html');
  await p2.click('.game-listing');

  // Ready and start
  await p1.click('#ready-button');
  await p2.click('#ready-button');
  await p1.click('#start-game-button');

  // Race through waves as fast as possible
  for (let wave = 1; wave <= 20; wave++) {
    // Player 1 tries to go faster
    await p1.click('#start-wave-btn');

    // Wait just a bit before Player 2
    await p1.page.waitForTimeout(500);
    await p2.click('#start-wave-btn');

    // Wait for wave completion
    await Promise.race([
      p1.waitForSelector('.wave-complete-notification', { timeout: 30000 }),
      p2.waitForSelector('.wave-complete-notification', { timeout: 30000 })
    ]);
  }

  // Check for victory screen
  const winner = await Promise.race([
    p1.waitForSelector('.victory-screen', { timeout: 5000 }),
    p2.waitForSelector('.victory-screen', { timeout: 5000 })
  ]);

  expect(winner).toBeTruthy();

  // Cleanup
  await p1Context.close();
  await p2Context.close();
});
```

### Test 4: High Score Mode (15 min)

Create `tests/highscore-mode.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('High Score mode - best score after 10 waves', async ({ browser }) => {
  const p1Context = await browser.newContext();
  const p2Context = await browser.newContext();

  const p1 = await p1Context.newPage();
  const p2 = await p2Context.newPage();

  // Setup High Score game
  await p1.goto('http://localhost:5173/lobby.html');
  await p1.click('#create-game');
  await p1.selectOption('#game-mode-select', 'HighScore');
  await p1.click('button[type="submit"]');

  await p2.goto('http://localhost:5173/lobby.html');
  await p2.click('.game-listing');

  await p1.click('#ready-button');
  await p2.click('#ready-button');
  await p1.click('#start-game-button');

  // Play all 10 waves
  for (let wave = 1; wave <= 10; wave++) {
    // Both start wave simultaneously
    await Promise.all([
      p1.click('#start-wave-btn'),
      p2.click('#start-wave-btn')
    ]);

    // Wait for completion
    await Promise.all([
      p1.waitForSelector('.wave-complete-notification', { timeout: 30000 }),
      p2.waitForSelector('.wave-complete-notification', { timeout: 30000 })
    ]);
  }

  // Check final scores
  const p1Score = await p1.locator('.final-score').textContent();
  const p2Score = await p2.locator('.final-score').textContent();

  console.log('Player 1 score:', p1Score);
  console.log('Player 2 score:', p2Score);

  // Verify winner announcement
  const winnerAnnouncement = await p1.locator('.winner-announcement').textContent();
  expect(winnerAnnouncement).toContain('wins with');

  // Cleanup
  await p1Context.close();
  await p2Context.close();
});
```

### Run All Tests
```bash
npx playwright test
```

### Test Report
```bash
npx playwright show-report
```

---

## Validation Criteria

### Phase 5 Success Criteria
- [ ] No compilation errors
- [ ] All GraphQL queries work
- [ ] All mutations work
- [ ] Events are emitted
- [ ] Cross-chain messages delivered
- [ ] Frontend can interact with backend

### Phase 6 Success Criteria
- [ ] All 4 game modes playable
- [ ] 2-4 player support works
- [ ] Lobby matchmaking functional
- [ ] Ready state syncs across players
- [ ] Tower placement broadcasts
- [ ] Wave progression works
- [ ] Winner detection accurate
- [ ] Leaderboards update
- [ ] No crashes or hangs
- [ ] Performance acceptable (< 2s latency)

---

## Known Issues to Watch For

1. **GraphQL Import Errors:** If `tower_defense_abi` types aren't exported correctly
2. **WASM Size:** Large WASM files may cause slow load times
3. **Cross-Chain Message Delay:** Messages may take 1-2 seconds to propagate
4. **State Desync:** If polling interval too slow, players may see different states
5. **Race Conditions:** Simultaneous actions may conflict without proper locking

---

## Debugging Commands

### Check Docker Logs
```bash
docker compose logs -f
```

### Check Linera Status
```bash
linera project info
linera query-application <app-id>
```

### Test GraphQL Directly
```bash
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ games { gameId } }"}'
```

### Monitor Network Traffic
```bash
# In browser DevTools
Network tab → Filter: graphql
```

---

## Next Steps After Successful Testing

1. Document any bugs found
2. Fix critical issues
3. Optimize performance bottlenecks
4. Move to Phase 7 (Polish & Enhancements)
5. Complete Phase 8 (Stress Testing)
6. Execute Phase 9 (Final Validation)
7. Deploy to production (Phase 10)

---

**Generated:** Phase 5-6 Testing Documentation
**Status:** Ready for execution when Docker environment available
**Estimated Execution Time:** 90 minutes total (30 min Phase 5 + 60 min Phase 6)
