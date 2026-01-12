# Phase 8: Stress Testing & Performance Validation

## 🎯 Objective

Validate that the multiplayer system can handle real-world usage patterns including rapid actions, network issues, concurrent games, and extended sessions without performance degradation or crashes.

**Duration:** 30 minutes
**Prerequisites:** Phases 5-6 complete (Docker running, basic tests passing)

---

## Test Categories

### 1. Rapid Action Testing (5 min)

**Goal:** Ensure system handles high-frequency player actions without desync or errors.

#### Test: Rapid Tower Placement
```javascript
// Playwright test
test('Rapid tower placement - 100 actions/minute', async ({ page }) => {
    await page.goto('http://localhost:5173?mode=multiplayer&gameId=test1');

    const startTime = Date.now();
    const targetActions = 100;

    for (let i = 0; i < targetActions; i++) {
        // Select random tower type
        const towerTypes = ['Arrow', 'Cannon', 'Magic', 'Sniper'];
        const randomType = towerTypes[Math.floor(Math.random() * towerTypes.length)];
        await page.click(`[data-tower-type="${randomType}"]`);

        // Place on random valid grid cell
        const x = Math.floor(Math.random() * 16);
        const y = Math.floor(Math.random() * 12);
        await page.click(`.grid-cell[data-x="${x}"][data-y="${y}"]`);

        // Don't wait - fire and forget
    }

    const duration = Date.now() - startTime;
    const actionsPerMinute = (targetActions / duration) * 60000;

    console.log(`Actions per minute: ${actionsPerMinute}`);
    expect(actionsPerMinute).toBeGreaterThan(80); // 80+ APM acceptable

    // Verify no errors
    const errors = await page.evaluate(() => {
        return window.gameState?.errors?.length || 0;
    });
    expect(errors).toBe(0);
});
```

**Expected Results:**
- ✅ System handles 80-100 actions/minute
- ✅ No client-side errors
- ✅ No server crashes
- ✅ UI remains responsive
- ✅ State stays synchronized

**Failure Conditions:**
- ❌ Rate limiting blocks legitimate actions
- ❌ UI freezes or becomes unresponsive
- ❌ Backend crashes or returns errors
- ❌ Player states desynchronize

#### Test: Rapid Wave Progression
```javascript
test('Rapid wave starts - spam start button', async ({ page }) => {
    await page.goto('http://localhost:5173?mode=multiplayer&gameId=test2');

    // Spam the start wave button
    for (let i = 0; i < 50; i++) {
        await page.click('#start-wave-btn');
        await page.waitForTimeout(10); // 10ms between clicks
    }

    // Verify only one wave actually started
    const waveNumber = await page.locator('#wave-display').textContent();
    expect(parseInt(waveNumber)).toBe(1);

    // Verify no duplicate waves
    const enemyCount = await page.evaluate(() => {
        return window.gameState?.enemies?.length || 0;
    });
    expect(enemyCount).toBeLessThan(50); // Not 50 waves worth of enemies
});
```

---

### 2. Disconnect/Reconnect Scenarios (10 min)

**Goal:** Verify graceful handling of network interruptions and player disconnections.

#### Test: Player Disconnect Mid-Game
```javascript
test('Player disconnect during active game', async ({ browser }) => {
    const player1 = await browser.newPage();
    const player2 = await browser.newPage();

    // Both join game
    await player1.goto('http://localhost:5173/lobby.html');
    await player1.click('#create-game');
    await player1.click('button[type="submit"]');

    await player2.goto('http://localhost:5173/lobby.html');
    await player2.click('.game-listing');

    // Both ready and start
    await player1.click('#ready-button');
    await player2.click('#ready-button');
    await player1.click('#start-game-button');

    // Play for a bit
    await player1.click('.tower-button[data-type="Arrow"]');
    await player1.click('.grid-cell[data-x="3"][data-y="3"]');
    await player1.click('#start-wave-btn');

    // Player 2 disconnects abruptly
    await player2.close();

    // Wait 5 seconds
    await page.waitForTimeout(5000);

    // Player 1 should see notification
    const notification = await player1.locator('.notification').textContent();
    expect(notification).toContain('Player 2 disconnected');

    // Game should continue for Player 1
    const isGameActive = await player1.evaluate(() => {
        return window.gameState?.status === 'active';
    });
    expect(isGameActive).toBe(true);

    // Player 1 can still play
    await player1.click('#start-wave-btn');
    await player1.waitForSelector('.wave-complete-notification', { timeout: 30000 });
});
```

#### Test: Reconnection Within Timeout Window
```javascript
test('Player reconnects within 60 seconds', async ({ browser }) => {
    const context1 = await browser.newContext();
    const player1 = await context1.newPage();

    // Join game
    await player1.goto('http://localhost:5173/lobby.html');
    await player1.click('#create-game');
    await player1.click('button[type="submit"]');
    await player1.click('#ready-button');
    await player1.click('#start-game-button');

    // Get game ID
    const gameId = await player1.evaluate(() => window.currentGameId);

    // Disconnect
    await context1.close();

    // Wait 30 seconds (within 60s timeout)
    await page.waitForTimeout(30000);

    // Reconnect with same user
    const context2 = await browser.newContext();
    const player1Reconnected = await context2.newPage();
    await player1Reconnected.goto(`http://localhost:5173?reconnect=${gameId}`);

    // Should rejoin successfully
    const status = await player1Reconnected.locator('.game-status').textContent();
    expect(status).toContain('Reconnected');

    // State should be synchronized
    const wave = await player1Reconnected.locator('#wave-display').textContent();
    expect(parseInt(wave)).toBeGreaterThan(0);
});
```

#### Test: Multiple Simultaneous Disconnects
```javascript
test('All players disconnect simultaneously', async ({ browser }) => {
    // Create 4 players
    const players = [];
    for (let i = 0; i < 4; i++) {
        players.push(await browser.newPage());
    }

    // All join same game
    await players[0].goto('http://localhost:5173/lobby.html');
    await players[0].click('#create-game');
    await players[0].click('button[type="submit"]');

    for (let i = 1; i < 4; i++) {
        await players[i].goto('http://localhost:5173/lobby.html');
        await players[i].click('.game-listing');
    }

    // All ready and start
    for (const player of players) {
        await player.click('#ready-button');
    }
    await players[0].click('#start-game-button');

    // All disconnect at once
    await Promise.all(players.map(p => p.close()));

    // Backend should cleanup game state after timeout
    // Wait for cleanup (60s timeout + 10s grace)
    await page.waitForTimeout(70000);

    // Verify game no longer in active games list
    const newPlayer = await browser.newPage();
    await newPlayer.goto('http://localhost:5173/lobby.html');

    const gameExists = await newPlayer.evaluate(() => {
        return document.querySelectorAll('.game-listing').length;
    });

    // Game should be removed from listings
    // (Implementation detail - may vary)
});
```

---

### 3. Concurrent Action Testing (5 min)

**Goal:** Verify correct handling when multiple players perform actions simultaneously.

#### Test: Simultaneous Tower Placement (Same Position)
```javascript
test('Two players place tower at same position simultaneously', async ({ browser }) => {
    const player1 = await browser.newPage();
    const player2 = await browser.newPage();

    // Setup game with both players
    // ... (setup code) ...

    // Both select Arrow tower
    await Promise.all([
        player1.click('.tower-button[data-type="Arrow"]'),
        player2.click('.tower-button[data-type="Arrow"]')
    ]);

    // Both try to place at same position simultaneously
    await Promise.all([
        player1.click('.grid-cell[data-x="5"][data-y="5"]'),
        player2.click('.grid-cell[data-x="5"][data-y="5"]')
    ]);

    // Wait for resolution
    await page.waitForTimeout(2000);

    // Verify only ONE tower placed at that position
    const towersAtPosition = await player1.evaluate(() => {
        const cell = document.querySelector('.grid-cell[data-x="5"][data-y="5"]');
        return cell.querySelectorAll('.tower-sprite').length;
    });
    expect(towersAtPosition).toBe(1);

    // One player should see success, other should see error
    const p1Notification = await player1.locator('.notification').textContent();
    const p2Notification = await player2.locator('.notification').textContent();

    const successCount = [p1Notification, p2Notification].filter(n => n.includes('placed')).length;
    const errorCount = [p1Notification, p2Notification].filter(n => n.includes('error') || n.includes('occupied')).length;

    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
});
```

#### Test: Simultaneous Wave Starts (Synchronized Mode)
```javascript
test('Multiple players start wave in synchronized mode', async ({ browser }) => {
    // Co-op mode (synchronized)
    const players = [
        await browser.newPage(),
        await browser.newPage(),
        await browser.newPage()
    ];

    // Setup Co-op game
    // ... (setup code with mode: CoOp) ...

    // All 3 players hit start wave simultaneously
    await Promise.all(players.map(p => p.click('#start-wave-btn')));

    // Wait for wave to start
    await page.waitForTimeout(1000);

    // Verify only ONE wave started (not 3)
    const waveNumber = await players[0].locator('#wave-display').textContent();
    expect(parseInt(waveNumber)).toBe(1);

    // Verify all players see the same wave
    for (const player of players) {
        const wave = await player.locator('#wave-display').textContent();
        expect(parseInt(wave)).toBe(1);
    }
});
```

---

### 4. Long Session Testing (10 min)

**Goal:** Ensure stability over extended gameplay sessions.

#### Test: 30-Minute Continuous Session
```javascript
test('30-minute continuous 4-player game', async ({ browser }) => {
    const players = [];
    for (let i = 0; i < 4; i++) {
        players.push(await browser.newPage());
    }

    // Setup 4-player Versus game
    // ... (setup code) ...

    const startTime = Date.now();
    const duration = 30 * 60 * 1000; // 30 minutes

    let waveCount = 0;
    let actionCount = 0;

    while (Date.now() - startTime < duration) {
        // Each player performs random actions
        for (const player of players) {
            // Check if player still alive
            const isAlive = await player.evaluate(() => {
                return window.gameState?.health > 0;
            });

            if (!isAlive) continue;

            // Random action: place tower (70%) or start wave (30%)
            if (Math.random() < 0.7) {
                // Place tower
                const towerType = ['Arrow', 'Cannon', 'Magic'][Math.floor(Math.random() * 3)];
                await player.click(`[data-tower-type="${towerType}"]`);

                const x = Math.floor(Math.random() * 16);
                const y = Math.floor(Math.random() * 12);
                await player.click(`.grid-cell[data-x="${x}"][data-y="${y}"]`);

                actionCount++;
            } else {
                // Start wave
                await player.click('#start-wave-btn');
                waveCount++;

                // Wait for wave completion
                await player.waitForSelector('.wave-complete-notification', { timeout: 60000 });
            }

            // Random delay between actions (1-5 seconds)
            await page.waitForTimeout(1000 + Math.random() * 4000);
        }

        // Check memory usage every 5 minutes
        if ((Date.now() - startTime) % (5 * 60 * 1000) < 10000) {
            const memoryUsage = await players[0].evaluate(() => {
                return {
                    usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
                    jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0
                };
            });

            console.log('Memory usage:', memoryUsage);

            // Memory should not exceed 80% of limit
            const memoryPercent = memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit;
            expect(memoryPercent).toBeLessThan(0.8);
        }
    }

    console.log(`Session completed: ${waveCount} waves, ${actionCount} actions`);

    // Verify no memory leaks
    const finalMemory = await players[0].evaluate(() => {
        return performance.memory?.usedJSHeapSize || 0;
    });

    // Final memory should be reasonable (< 500MB)
    expect(finalMemory).toBeLessThan(500 * 1024 * 1024);

    // Verify game still playable
    await players[0].click('.tower-button[data-type="Arrow"]');
    await players[0].click('.grid-cell[data-x="8"][data-y="8"]');

    const goldBefore = await players[0].locator('#gold-display').textContent();
    const goldAfter = await players[0].locator('#gold-display').textContent();
    expect(parseInt(goldAfter)).toBeLessThan(parseInt(goldBefore));
});
```

---

### 5. Multiple Concurrent Games (5 min)

**Goal:** Verify system can handle multiple simultaneous games without interference.

#### Test: 5 Concurrent 4-Player Games
```javascript
test('5 simultaneous 4-player games (20 players total)', async ({ browser }) => {
    const games = [];

    // Create 5 games with 4 players each
    for (let gameIndex = 0; gameIndex < 5; gameIndex++) {
        const gamePlayers = [];

        // Create 4 players for this game
        for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
            gamePlayers.push(await browser.newPage());
        }

        // Setup game
        await gamePlayers[0].goto('http://localhost:5173/lobby.html');
        await gamePlayers[0].click('#create-game');
        await gamePlayers[0].selectOption('#game-mode-select', 'Versus');
        await gamePlayers[0].click('button[type="submit"]');

        // Other players join
        for (let i = 1; i < 4; i++) {
            await gamePlayers[i].goto('http://localhost:5173/lobby.html');
            await gamePlayers[i].click('.game-listing:first-child');
        }

        // All ready and start
        for (const player of gamePlayers) {
            await player.click('#ready-button');
        }
        await gamePlayers[0].click('#start-game-button');

        games.push({
            players: gamePlayers,
            gameIndex
        });
    }

    // All games play simultaneously
    await Promise.all(games.map(async (game) => {
        for (const player of game.players) {
            // Each player places 3 towers
            for (let i = 0; i < 3; i++) {
                await player.click('.tower-button[data-type="Arrow"]');
                const x = 3 + i;
                const y = 3 + game.gameIndex;
                await player.click(`.grid-cell[data-x="${x}"][data-y="${y}"]`);
            }

            // Start wave
            await player.click('#start-wave-btn');
        }
    }));

    // Wait for all waves to complete
    await page.waitForTimeout(30000);

    // Verify all games progressed independently
    for (const game of games) {
        for (const player of game.players) {
            const wave = await player.locator('#wave-display').textContent();
            expect(parseInt(wave)).toBeGreaterThanOrEqual(1);

            const health = await player.locator('#health-display').textContent();
            expect(parseInt(health)).toBeGreaterThan(0);
        }
    }

    // Verify no cross-contamination
    // Each game should have unique state
    const gameStates = await Promise.all(
        games.map(game =>
            game.players[0].evaluate(() => window.currentGameId)
        )
    );

    const uniqueGameIds = new Set(gameStates);
    expect(uniqueGameIds.size).toBe(5); // All different game IDs
});
```

---

## Performance Monitoring

### Metrics to Track

#### Frontend Performance
```javascript
// Add to game.js
window.performanceMonitor = {
    frameRates: [],
    actionLatencies: [],
    memorySnapshots: [],

    startMonitoring() {
        // Track frame rate
        let lastFrame = performance.now();
        const checkFrame = () => {
            const now = performance.now();
            const fps = 1000 / (now - lastFrame);
            this.frameRates.push(fps);
            lastFrame = now;

            if (this.frameRates.length > 60) {
                this.frameRates.shift();
            }

            requestAnimationFrame(checkFrame);
        };
        requestAnimationFrame(checkFrame);

        // Track memory every 10 seconds
        setInterval(() => {
            if (performance.memory) {
                this.memorySnapshots.push({
                    time: Date.now(),
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                });
            }
        }, 10000);
    },

    getAverageFPS() {
        return this.frameRates.reduce((a, b) => a + b, 0) / this.frameRates.length;
    },

    getReport() {
        return {
            avgFPS: this.getAverageFPS(),
            minFPS: Math.min(...this.frameRates),
            maxFPS: Math.max(...this.frameRates),
            avgLatency: this.actionLatencies.reduce((a, b) => a + b, 0) / this.actionLatencies.length,
            memoryTrend: this.memorySnapshots
        };
    }
};
```

#### Backend Performance
```bash
# Monitor backend resource usage
docker stats --no-stream

# Check for memory leaks in Rust
# Add to Cargo.toml:
# [profile.release]
# debug = true

# Run with memory profiling
RUST_LOG=debug cargo run --release

# Monitor GraphQL query performance
# Log slow queries (> 100ms)
```

---

## Success Criteria

### Performance Targets
| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Average FPS | > 50 | > 30 |
| Min FPS (under load) | > 30 | > 20 |
| Action Latency | < 200ms | < 500ms |
| Memory Growth | < 10MB/hour | < 50MB/hour |
| Actions/Minute | > 80 | > 50 |
| Concurrent Games | 10+ | 5+ |
| Session Duration | 60+ min | 30+ min |

### Reliability Targets
| Scenario | Target | Critical |
|----------|--------|----------|
| Disconnection Recovery | 100% | 95% |
| Concurrent Action Conflicts | 0 errors | < 5% errors |
| Memory Leaks | None | < 1MB/hour |
| Crashes | 0 | < 1/100 sessions |
| Desync Events | 0 | < 1/1000 actions |

---

## Issues to Watch For

### Common Problems

1. **Memory Leaks**
   - Symptom: Steadily increasing memory usage over time
   - Cause: Event listeners not cleaned up, particle systems not disposed
   - Fix: Implement proper cleanup in component lifecycle

2. **State Desynchronization**
   - Symptom: Players see different game states
   - Cause: Race conditions, missed events, clock skew
   - Fix: Add state hash verification, sequence numbers

3. **Action Rate Limiting False Positives**
   - Symptom: Legitimate actions blocked during rapid gameplay
   - Cause: Rate limit too aggressive
   - Fix: Increase limit or add burst allowance

4. **Backend Resource Exhaustion**
   - Symptom: Slow responses, timeouts, crashes under load
   - Cause: Too many concurrent games, memory leaks, inefficient queries
   - Fix: Optimize database queries, add connection pooling, scale horizontally

5. **Network Latency Amplification**
   - Symptom: Actions take longer than network RTT
   - Cause: Synchronous processing, blocking operations
   - Fix: Use async operations, optimistic UI updates

---

## Test Execution Plan

### Sequence (30 minutes)

**Minutes 0-5:** Rapid Action Testing
- Run rapid tower placement test
- Run rapid wave start test
- Verify rate limiting not too aggressive
- **Pass Criteria:** 80+ APM, no errors

**Minutes 5-15:** Disconnect/Reconnect
- Test player disconnect mid-game
- Test reconnection within timeout
- Test simultaneous disconnects
- **Pass Criteria:** Clean disconnect handling, successful reconnects

**Minutes 15-20:** Concurrent Actions
- Test simultaneous tower placement
- Test simultaneous wave starts
- **Pass Criteria:** Correct conflict resolution, no duplicate actions

**Minutes 20-30:** Long Session (in background)
- Start 30-min continuous session
- Monitor memory usage
- **Pass Criteria:** No crashes, memory stable

**Minutes 25-30:** Concurrent Games
- Test 5 simultaneous games
- Verify no interference
- **Pass Criteria:** All games independent, no cross-contamination

---

## Automated Test Runner

```bash
#!/bin/bash
# stress-test.sh

echo "=== Phase 8: Stress Testing ==="
echo "Starting comprehensive stress tests..."
echo ""

# Start timer
START_TIME=$(date +%s)

# 1. Rapid Action Testing
echo "[1/5] Running rapid action tests..."
npx playwright test tests/stress/rapid-actions.spec.js
RAPID_RESULT=$?

# 2. Disconnect Testing
echo "[2/5] Running disconnect/reconnect tests..."
npx playwright test tests/stress/disconnect.spec.js
DISCONNECT_RESULT=$?

# 3. Concurrent Action Testing
echo "[3/5] Running concurrent action tests..."
npx playwright test tests/stress/concurrent-actions.spec.js
CONCURRENT_RESULT=$?

# 4. Long Session (background)
echo "[4/5] Starting long session test (30 min)..."
npx playwright test tests/stress/long-session.spec.js &
LONG_SESSION_PID=$!

# 5. Concurrent Games
echo "[5/5] Running concurrent games test..."
npx playwright test tests/stress/concurrent-games.spec.js
GAMES_RESULT=$?

# Wait for long session
echo "Waiting for long session test to complete..."
wait $LONG_SESSION_PID
LONG_SESSION_RESULT=$?

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
echo "=== Stress Test Results ==="
echo "Duration: ${DURATION}s"
echo ""
echo "Rapid Actions:     $([[ $RAPID_RESULT -eq 0 ]] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Disconnect Tests:  $([[ $DISCONNECT_RESULT -eq 0 ]] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Concurrent Actions: $([[ $CONCURRENT_RESULT -eq 0 ]] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Long Session:      $([[ $LONG_SESSION_RESULT -eq 0 ]] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Concurrent Games:  $([[ $GAMES_RESULT -eq 0 ]] && echo '✅ PASS' || echo '❌ FAIL')"
echo ""

# Overall result
if [[ $RAPID_RESULT -eq 0 && $DISCONNECT_RESULT -eq 0 && $CONCURRENT_RESULT -eq 0 && $LONG_SESSION_RESULT -eq 0 && $GAMES_RESULT -eq 0 ]]; then
    echo "✅ ALL STRESS TESTS PASSED"
    exit 0
else
    echo "❌ SOME TESTS FAILED"
    exit 1
fi
```

---

## Next Steps After Completion

If all tests pass:
- ✅ Mark Phase 8 as complete
- ➡️ Proceed to Phase 9 (Final Validation)

If tests fail:
- 📝 Document failures
- 🔧 Fix critical issues
- 🔄 Re-run failed tests
- ➡️ Repeat until all pass

---

**Generated:** Phase 8 Stress Testing Documentation
**Status:** Ready for execution when backend available
**Estimated Duration:** 30 minutes
**Pass Criteria:** All 5 test categories pass with metrics above thresholds
