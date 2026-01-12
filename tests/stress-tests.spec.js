/**
 * Stress Testing Suite
 * Tests system under load and edge cases
 * Phase 8 - Stress Testing
 */

const { test, expect } = require('@playwright/test');

// Performance monitoring helper
class PerformanceMonitor {
    constructor(page) {
        this.page = page;
        this.samples = [];
    }

    async startMonitoring(durationMs = 30000) {
        return await this.page.evaluate((duration) => {
            return new Promise((resolve) => {
                const samples = [];
                let frameCount = 0;
                let lastTime = performance.now();
                let startTime = performance.now();

                const measure = () => {
                    frameCount++;
                    const currentTime = performance.now();

                    // Sample FPS every second
                    if (currentTime >= lastTime + 1000) {
                        samples.push({
                            fps: frameCount,
                            timestamp: currentTime - startTime,
                            memory: performance.memory ? performance.memory.usedJSHeapSize : null
                        });
                        frameCount = 0;
                        lastTime = currentTime;
                    }

                    if (currentTime - startTime < duration) {
                        requestAnimationFrame(measure);
                    } else {
                        const avgFPS = samples.reduce((a, b) => a + b.fps, 0) / samples.length;
                        const minFPS = Math.min(...samples.map(s => s.fps));
                        const maxFPS = Math.max(...samples.map(s => s.fps));

                        resolve({
                            avgFPS,
                            minFPS,
                            maxFPS,
                            samples: samples.length,
                            duration: currentTime - startTime
                        });
                    }
                };

                requestAnimationFrame(measure);
            });
        }, durationMs);
    }

    async getMemoryUsage() {
        return await this.page.evaluate(() => {
            if (performance.memory) {
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
            }
            return null;
        });
    }
}

test.describe('Stress Testing', () => {

    test.describe('Rapid Action Testing', () => {

        test('Tower placement - 100 actions/minute', async ({ page }) => {
            await page.goto('http://localhost:8080/index.html');
            await page.waitForTimeout(2000);

            const towerTypes = ['Cannon', 'Laser', 'Missile', 'Sniper'];
            const startTime = Date.now();
            const targetActions = 100;
            let successfulActions = 0;
            let failedActions = 0;

            console.log('[Stress] Starting rapid tower placement test...');

            for (let i = 0; i < targetActions; i++) {
                try {
                    const randomType = towerTypes[Math.floor(Math.random() * towerTypes.length)];
                    const randomX = 100 + Math.random() * 600;
                    const randomY = 100 + Math.random() * 400;

                    await page.click(`[data-tower-type="${randomType}"]`);
                    await page.click('#game-canvas', { position: { x: randomX, y: randomY } });

                    successfulActions++;

                    // No waiting - go as fast as possible
                } catch (error) {
                    failedActions++;
                }

                // Progress indicator
                if (i % 20 === 0) {
                    console.log(`[Stress] Progress: ${i}/${targetActions} actions`);
                }
            }

            const duration = Date.now() - startTime;
            const actionsPerMinute = (successfulActions / duration) * 60000;

            console.log('[Stress] Rapid tower placement results:');
            console.log(`  - Total attempts: ${targetActions}`);
            console.log(`  - Successful: ${successfulActions}`);
            console.log(`  - Failed: ${failedActions}`);
            console.log(`  - Duration: ${duration}ms`);
            console.log(`  - Rate: ${actionsPerMinute.toFixed(2)} actions/minute`);

            // Should handle at least 80 actions/minute
            expect(actionsPerMinute).toBeGreaterThan(80);
            // Success rate should be high
            expect(successfulActions / targetActions).toBeGreaterThan(0.8);
        });

        test('Wave starts - rapid succession', async ({ page }) => {
            await page.goto('http://localhost:8080/index.html');
            await page.waitForTimeout(2000);

            // Place towers first
            await page.click('[data-tower-type="Cannon"]');
            await page.click('#game-canvas', { position: { x: 200, y: 200 } });
            await page.click('[data-tower-type="Laser"]');
            await page.click('#game-canvas', { position: { x: 300, y: 200 } });

            console.log('[Stress] Testing rapid wave starts...');

            let successfulStarts = 0;

            for (let i = 0; i < 10; i++) {
                try {
                    await page.click('#start-wave-btn');
                    successfulStarts++;
                    await page.waitForTimeout(100); // Very short delay
                } catch (error) {
                    console.log(`[Stress] Wave start ${i} failed (expected rate limiting)`);
                }
            }

            console.log(`[Stress] Successful wave starts: ${successfulStarts}/10`);

            // Should rate limit to reasonable number
            expect(successfulStarts).toBeLessThan(10);
            expect(successfulStarts).toBeGreaterThan(0);
        });

        test('UI interactions - 100 APM sustained', async ({ page }) => {
            await page.goto('http://localhost:8080/lobby.html');

            const startTime = Date.now();
            const durationMs = 60000; // 1 minute
            let actionCount = 0;

            console.log('[Stress] Testing sustained 100 APM UI interactions...');

            while (Date.now() - startTime < durationMs) {
                try {
                    // Random UI actions
                    const actions = [
                        () => page.click('#refresh-games'),
                        () => page.click('[data-mode="Versus"]'),
                        () => page.click('[data-mode="CoOp"]'),
                        () => page.click('[data-mode="Race"]'),
                        () => page.click('[data-mode="all"]'),
                        () => page.click('#quick-match'),
                        () => page.keyboard.press('Escape'),
                    ];

                    const randomAction = actions[Math.floor(Math.random() * actions.length)];
                    await randomAction();
                    actionCount++;

                    // Brief delay to reach target APM
                    await page.waitForTimeout(600); // 100 APM = 600ms between actions
                } catch (error) {
                    // Some actions might fail, that's ok
                }
            }

            const actualDuration = Date.now() - startTime;
            const apm = (actionCount / actualDuration) * 60000;

            console.log(`[Stress] UI stress test results:`);
            console.log(`  - Actions: ${actionCount}`);
            console.log(`  - Duration: ${(actualDuration / 1000).toFixed(1)}s`);
            console.log(`  - APM: ${apm.toFixed(1)}`);

            expect(apm).toBeGreaterThan(80);
        });
    });

    test.describe('Disconnect/Reconnect Scenarios', () => {

        test('Player disconnect during active game', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();

            const player1 = await context1.newPage();
            const player2 = await context2.newPage();

            try {
                console.log('[Disconnect] Setting up 2-player game...');

                // Create game
                await player1.goto('http://localhost:8080/lobby.html');
                await player1.click('#create-game');
                await player1.selectOption('#game-mode-select', 'Versus');
                await player1.click('button[type="submit"]');

                const gameId = await player1.locator('#room-id').textContent();

                // Player 2 joins
                await player2.goto('http://localhost:8080/lobby.html');
                await player2.click(`[data-game-id="${gameId}"]`);

                // Ready up
                await player1.click('#ready-button');
                await player2.click('#ready-button');

                await player1.waitForTimeout(2000);

                console.log('[Disconnect] Starting game...');
                await player1.click('#start-game-btn');

                await player1.waitForTimeout(3000);

                console.log('[Disconnect] Player 2 disconnecting...');

                // Player 2 disconnects abruptly
                await player2.close();

                // Player 1 should continue playing
                await player1.waitForTimeout(2000);

                // Should see disconnect notification
                const notification = await player1.locator('.notification').first().textContent();
                console.log('[Disconnect] Notification:', notification);

                // Game should still be playable
                const gameCanvas = await player1.locator('#game-canvas').isVisible();
                expect(gameCanvas).toBe(true);

                console.log('[Disconnect] Player 1 continuing after disconnect');

            } finally {
                await context1.close();
                // context2 already closed
            }
        });

        test('Host disconnect - game migration', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();

            const host = await context1.newPage();
            const player = await context2.newPage();

            try {
                console.log('[Host DC] Setting up game with host...');

                await host.goto('http://localhost:8080/lobby.html');
                await host.click('#create-game');
                await host.selectOption('#game-mode-select', 'CoOp');
                await host.click('button[type="submit"]');

                const gameId = await host.locator('#room-id').textContent();

                await player.goto('http://localhost:8080/lobby.html');
                await player.click(`[data-game-id="${gameId}"]`);

                await host.click('#ready-button');
                await player.click('#ready-button');

                console.log('[Host DC] Host disconnecting...');

                // Host disconnects
                await host.close();

                // Other player should see notification and potentially become host
                await player.waitForTimeout(3000);

                const roomStatus = await player.locator('#room-status').textContent();
                console.log('[Host DC] Room status:', roomStatus);

                expect(roomStatus).toBeTruthy();

            } finally {
                await context2.close();
            }
        });

        test('Reconnect after brief disconnect', async ({ browser }) => {
            const context = await browser.newContext();
            const page = await context.newPage();

            try {
                console.log('[Reconnect] Creating game...');

                await page.goto('http://localhost:8080/lobby.html');
                await page.click('#create-game');
                await page.selectOption('#game-mode-select', 'Versus');
                await page.click('button[type="submit"]');

                const gameId = await page.locator('#room-id').textContent();

                console.log('[Reconnect] Simulating brief disconnect...');

                // Simulate network issue by going offline
                await context.setOffline(true);
                await page.waitForTimeout(5000);

                // Come back online
                await context.setOffline(false);
                await page.reload();

                console.log('[Reconnect] Reconnected, checking state...');

                // Should be able to navigate back to lobby
                await page.waitForSelector('#game-listings', { timeout: 10000 });

                const lobbyVisible = await page.locator('#game-listings').isVisible();
                expect(lobbyVisible).toBe(true);

                console.log('[Reconnect] Successfully reconnected');

            } finally {
                await context.close();
            }
        });
    });

    test.describe('Concurrent Actions', () => {

        test('Simultaneous tower placement by 4 players', async ({ browser }) => {
            const contexts = await Promise.all([
                browser.newContext(),
                browser.newContext(),
                browser.newContext(),
                browser.newContext()
            ]);

            const players = await Promise.all(
                contexts.map(ctx => ctx.newPage())
            );

            try {
                console.log('[Concurrent] Setting up 4-player game...');

                // Setup game
                await players[0].goto('http://localhost:8080/lobby.html');
                await players[0].click('#create-game');
                await players[0].selectOption('#game-mode-select', 'Versus');
                await players[0].click('button[type="submit"]');

                const gameId = await players[0].locator('#room-id').textContent();

                // Others join
                await Promise.all([
                    players[1].goto('http://localhost:8080/lobby.html'),
                    players[2].goto('http://localhost:8080/lobby.html'),
                    players[3].goto('http://localhost:8080/lobby.html')
                ]);

                await Promise.all([
                    players[1].click(`[data-game-id="${gameId}"]`),
                    players[2].click(`[data-game-id="${gameId}"]`),
                    players[3].click(`[data-game-id="${gameId}"]`)
                ]);

                // All ready
                await Promise.all(players.map(p => p.click('#ready-button')));

                await players[0].waitForTimeout(3000);

                console.log('[Concurrent] All players placing towers simultaneously...');

                // All players place towers at exact same time
                await Promise.all(players.map(async (player, i) => {
                    await player.click('[data-tower-type="Cannon"]');
                    await player.click('#game-canvas', { position: { x: 200 + i * 100, y: 200 } });
                }));

                console.log('[Concurrent] Checking for conflicts...');

                await players[0].waitForTimeout(2000);

                // All actions should have been processed
                const errors = await players[0].evaluate(() => window.errors || []);
                console.log('[Concurrent] Errors:', errors.length);

                // Should handle concurrent actions without crashes
                expect(errors.length).toBeLessThan(5);

            } finally {
                await Promise.all(contexts.map(ctx => ctx.close()));
            }
        });

        test('Multiple wave starts at same instant', async ({ browser }) => {
            const contexts = await Promise.all([
                browser.newContext(),
                browser.newContext(),
                browser.newContext()
            ]);

            const players = await Promise.all(
                contexts.map(ctx => ctx.newPage())
            );

            try {
                console.log('[Wave Race] Setting up 3-player race...');

                // Setup
                await players[0].goto('http://localhost:8080/lobby.html');
                await players[0].click('#create-game');
                await players[0].selectOption('#game-mode-select', 'Race');
                await players[0].click('button[type="submit"]');

                const gameId = await players[0].locator('#room-id').textContent();

                await Promise.all([
                    players[1].goto('http://localhost:8080/lobby.html'),
                    players[2].goto('http://localhost:8080/lobby.html')
                ]);

                await Promise.all([
                    players[1].click(`[data-game-id="${gameId}"]`),
                    players[2].click(`[data-game-id="${gameId}"]`)
                ]);

                await Promise.all(players.map(p => p.click('#ready-button')));

                await players[0].waitForTimeout(3000);

                console.log('[Wave Race] All starting waves simultaneously...');

                // All click start at exact same moment
                await Promise.all(players.map(p => p.click('#start-wave-btn')));

                await players[0].waitForTimeout(2000);

                // All should have started waves
                const waves = await Promise.all(players.map(async p => {
                    const waveText = await p.locator('#current-wave').textContent();
                    return parseInt(waveText.replace('Wave ', ''));
                }));

                console.log('[Wave Race] Wave numbers:', waves);

                waves.forEach(wave => {
                    expect(wave).toBeGreaterThan(0);
                });

            } finally {
                await Promise.all(contexts.map(ctx => ctx.close()));
            }
        });
    });

    test.describe('Long Session Testing', () => {

        test('30-minute continuous gameplay session', async ({ page }) => {
            test.setTimeout(1800000 + 60000); // 31 minutes

            await page.goto('http://localhost:8080/index.html');
            await page.waitForTimeout(2000);

            const monitor = new PerformanceMonitor(page);

            console.log('[Long Session] Starting 30-minute stress test...');

            const startTime = Date.now();
            const durationMs = 30 * 60 * 1000; // 30 minutes
            const heapSamples = [];

            // Place initial towers
            await page.click('[data-tower-type="Cannon"]');
            await page.click('#game-canvas', { position: { x: 200, y: 200 } });
            await page.click('[data-tower-type="Laser"]');
            await page.click('#game-canvas', { position: { x: 300, y: 200 } });

            let waveCount = 0;

            while (Date.now() - startTime < durationMs) {
                // Start wave
                await page.click('#start-wave-btn');
                waveCount++;

                console.log(`[Long Session] Wave ${waveCount} - ${((Date.now() - startTime) / 60000).toFixed(1)} min elapsed`);

                // Play for a bit
                await page.waitForTimeout(20000);

                // Sample memory every 5 minutes
                if (waveCount % 5 === 0) {
                    const heap = await monitor.getMemoryUsage();
                    if (heap) {
                        heapSamples.push({
                            wave: waveCount,
                            used: heap.used,
                            timestamp: Date.now() - startTime
                        });
                        console.log(`[Long Session] Heap: ${(heap.used / 1048576).toFixed(2)} MB`);
                    }
                }

                // Occasionally place new tower
                if (waveCount % 3 === 0) {
                    const types = ['Cannon', 'Laser', 'Missile'];
                    const randomType = types[Math.floor(Math.random() * types.length)];
                    await page.click(`[data-tower-type="${randomType}"]`);
                    await page.click('#game-canvas', {
                        position: {
                            x: 100 + Math.random() * 600,
                            y: 100 + Math.random() * 400
                        }
                    });
                }
            }

            const totalDuration = Date.now() - startTime;

            console.log('[Long Session] 30-minute test complete!');
            console.log(`  - Total waves: ${waveCount}`);
            console.log(`  - Duration: ${(totalDuration / 60000).toFixed(1)} minutes`);

            // Check for memory leaks
            if (heapSamples.length > 2) {
                const firstHeap = heapSamples[0].used;
                const lastHeap = heapSamples[heapSamples.length - 1].used;
                const growth = ((lastHeap - firstHeap) / firstHeap) * 100;

                console.log(`[Long Session] Memory growth: ${growth.toFixed(2)}%`);

                // Should not have excessive memory growth
                expect(growth).toBeLessThan(50); // Allow 50% growth max
            }

            // Check FPS stability
            const perfResults = await monitor.startMonitoring(10000);
            console.log(`[Long Session] Final FPS: ${perfResults.avgFPS.toFixed(1)}`);

            expect(perfResults.avgFPS).toBeGreaterThan(30);
        });

        test('Memory leak detection over time', async ({ page }) => {
            test.setTimeout(600000); // 10 minutes

            await page.goto('http://localhost:8080/index.html');
            await page.waitForTimeout(2000);

            const monitor = new PerformanceMonitor(page);
            const samples = [];

            console.log('[Memory Leak] Starting memory leak detection...');

            for (let i = 0; i < 10; i++) {
                // Simulate gameplay
                await page.click('[data-tower-type="Cannon"]');
                await page.click('#game-canvas', {
                    position: { x: 100 + Math.random() * 600, y: 100 + Math.random() * 400 }
                });

                await page.waitForTimeout(60000); // 1 minute

                const heap = await monitor.getMemoryUsage();
                if (heap) {
                    samples.push(heap.used);
                    console.log(`[Memory Leak] Minute ${i + 1}: ${(heap.used / 1048576).toFixed(2)} MB`);
                }
            }

            // Check for unbounded growth
            if (samples.length > 5) {
                const firstFiveAvg = samples.slice(0, 5).reduce((a, b) => a + b) / 5;
                const lastFiveAvg = samples.slice(-5).reduce((a, b) => a + b) / 5;
                const growth = ((lastFiveAvg - firstFiveAvg) / firstFiveAvg) * 100;

                console.log(`[Memory Leak] Growth over session: ${growth.toFixed(2)}%`);

                expect(growth).toBeLessThan(30);
            }
        });
    });

    test.describe('Multiple Concurrent Games', () => {

        test('5 games with 4 players each (20 concurrent)', async ({ browser }) => {
            test.setTimeout(180000); // 3 minutes

            console.log('[Concurrent Games] Launching 5 games with 4 players each...');

            const gameSetups = [];

            // Create 5 games
            for (let gameNum = 0; gameNum < 5; gameNum++) {
                const players = [];

                // Create 4 players for this game
                for (let playerNum = 0; playerNum < 4; playerNum++) {
                    const context = await browser.newContext();
                    const page = await context.newPage();
                    players.push({ context, page });
                }

                gameSetups.push({ gameNum, players });
            }

            console.log('[Concurrent Games] Created 20 player contexts');

            // Setup all games in parallel
            await Promise.all(gameSetups.map(async ({ gameNum, players }) => {
                console.log(`[Game ${gameNum + 1}] Setting up...`);

                // Player 1 creates game
                await players[0].page.goto('http://localhost:8080/lobby.html');
                await players[0].page.click('#create-game');
                await players[0].page.selectOption('#game-mode-select', 'Versus');
                await players[0].page.click('button[type="submit"]');

                const gameId = await players[0].page.locator('#room-id').textContent();

                // Other 3 players join
                await Promise.all(players.slice(1).map(async ({ page }) => {
                    await page.goto('http://localhost:8080/lobby.html');
                    await page.click(`[data-game-id="${gameId}"]`);
                }));

                // All ready up
                await Promise.all(players.map(({ page }) => page.click('#ready-button')));

                console.log(`[Game ${gameNum + 1}] All players ready`);
            }));

            console.log('[Concurrent Games] All 5 games ready with 4 players each');

            // Let games run for a bit
            await gameSetups[0].players[0].page.waitForTimeout(10000);

            console.log('[Concurrent Games] Verifying all games stable...');

            // Check all games still responsive
            let responsiveCount = 0;
            for (const { players } of gameSetups) {
                try {
                    const canvasVisible = await players[0].page.locator('#game-canvas').isVisible();
                    if (canvasVisible) responsiveCount++;
                } catch (error) {
                    console.log('[Concurrent Games] Game not responsive');
                }
            }

            console.log(`[Concurrent Games] ${responsiveCount}/5 games responsive`);

            // At least 4 out of 5 should be stable
            expect(responsiveCount).toBeGreaterThanOrEqual(4);

            // Cleanup
            console.log('[Concurrent Games] Cleaning up...');
            for (const { players } of gameSetups) {
                for (const { context } of players) {
                    await context.close();
                }
            }

            console.log('[Concurrent Games] Test complete!');
        });
    });
});

console.log('[Tests] Stress testing suite loaded');
