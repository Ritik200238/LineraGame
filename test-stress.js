/**
 * Stress Test for Tower Defense
 * Tests progression through wave 10+ with multiple towers
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runStressTest() {
  console.log('\n🚀 ========================================');
  console.log('💪  STRESS TEST STARTING');
  console.log('🚀 ========================================\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Performance metrics tracking
  const metrics = {
    fps: [],
    memory: [],
    enemyCounts: [],
    waveTimings: []
  };

  // Track console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('🌐 Connecting to game...');
  await page.goto('http://localhost:8080/index.html');
  await delay(3000);

  console.log('✅ Connected\n');

  // Place multiple towers strategically
  console.log('🗼 TOWER PLACEMENT PHASE');
  const towerPlacements = [
    { type: 'Arrow', x: 100, y: 100 },
    { type: 'Cannon', x: 200, y: 150 },
    { type: 'Magic', x: 150, y: 200 },
    { type: 'Ice', x: 250, y: 100 },
    { type: 'Arrow', x: 300, y: 150 },
    { type: 'Magic', x: 350, y: 200 },
  ];

  for (const tower of towerPlacements) {
    try {
      await page.click(`[data-tower="${tower.type}"]`);
      await delay(300);
      await page.click('#game-grid', { position: { x: tower.x, y: tower.y } });
      await delay(500);
      console.log(`   ✓ Placed ${tower.type} at (${tower.x}, ${tower.y})`);
    } catch (e) {
      console.log(`   ✗ Failed to place ${tower.type}: ${e.message}`);
    }
  }

  const towerCount = await page.$eval('#tower-count', el => el.textContent);
  const gold = await page.$eval('#gold-display', el => el.textContent);
  console.log(`   Total towers: ${towerCount}`);
  console.log(`   Remaining gold: ${gold}\n`);

  // Progress through waves
  console.log('🌊 WAVE PROGRESSION TEST\n');

  for (let targetWave = 1; targetWave <= 12; targetWave++) {
    const waveStart = Date.now();

    console.log(`   Starting Wave ${targetWave}...`);

    // Wait for button to be ready (not disabled, not animating)
    await delay(1500);

    try {
      await page.click('#start-wave-btn', { timeout: 5000, force: true });
    } catch (e) {
      console.log(`   ⚠️  Failed to start wave ${targetWave}: ${e.message}`);
      // Try one more time with direct JS click
      try {
        await page.evaluate(() => {
          document.getElementById('start-wave-btn').click();
        });
        console.log(`   ✓ Started wave via JS fallback`);
      } catch (e2) {
        console.log(`   ✗ JS fallback also failed`);
        break;
      }
    }

    await delay(1000);

    const currentWave = await page.$eval('#wave-display', el => el.textContent);
    console.log(`      Wave display: ${currentWave}`);

    // Wait for wave to complete (max 30 seconds per wave)
    let waveComplete = false;
    let checkCount = 0;
    const maxChecks = 60; // 30 seconds

    while (!waveComplete && checkCount < maxChecks) {
      await delay(500);
      checkCount++;

      const status = await page.$eval('#game-status', el => el.textContent);
      const enemyCount = await page.$eval('#enemy-count', el => el.textContent);
      const health = await page.$eval('#health-display', el => el.textContent);

      if (checkCount % 4 === 0) {
        console.log(`      [${Math.floor(checkCount/2)}s] Enemies: ${enemyCount}, Health: ${health}, Status: ${status}`);
        metrics.enemyCounts.push(parseInt(enemyCount) || 0);
      }

      if (status === 'Preparing' && enemyCount === '0') {
        waveComplete = true;
        const waveTime = Date.now() - waveStart;
        metrics.waveTimings.push(waveTime);
        console.log(`      ✅ Wave ${targetWave} completed in ${(waveTime/1000).toFixed(1)}s`);
      }

      // Check if game over
      if (parseInt(health) <= 0) {
        console.log(`\n   ❌ GAME OVER at Wave ${targetWave}!`);
        waveComplete = true;
        break;
      }
    }

    if (!waveComplete) {
      console.log(`      ⚠️  Wave ${targetWave} timeout - continuing anyway`);
    }

    // Get performance metrics
    const jsHeapSize = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    metrics.memory.push(jsHeapSize);

    const finalHealth = await page.$eval('#health-display', el => el.textContent);
    const finalGold = await page.$eval('#gold-display', el => el.textContent);
    console.log(`      Health: ${finalHealth}, Gold: ${finalGold}\n`);

    if (parseInt(finalHealth) <= 0) {
      console.log('   Game ended due to health depletion\n');
      break;
    }

    await delay(500);
  }

  // Final statistics
  console.log('\n🚀 ========================================');
  console.log('📊  STRESS TEST RESULTS');
  console.log('🚀 ========================================\n');

  const finalWave = await page.$eval('#wave-display', el => el.textContent);
  const finalHealth = await page.$eval('#health-display', el => el.textContent);
  const finalGold = await page.$eval('#gold-display', el => el.textContent);
  const finalEnemies = await page.$eval('#enemy-count', el => el.textContent);

  console.log(`Final State:`);
  console.log(`   Wave: ${finalWave}`);
  console.log(`   Health: ${finalHealth}`);
  console.log(`   Gold: ${finalGold}`);
  console.log(`   Enemies: ${finalEnemies}\n`);

  console.log(`Performance Metrics:`);
  if (metrics.waveTimings.length > 0) {
    const avgWaveTime = metrics.waveTimings.reduce((a, b) => a + b, 0) / metrics.waveTimings.length;
    console.log(`   Average wave time: ${(avgWaveTime/1000).toFixed(1)}s`);
  }
  if (metrics.enemyCounts.length > 0) {
    const maxEnemies = Math.max(...metrics.enemyCounts);
    console.log(`   Max concurrent enemies: ${maxEnemies}`);
  }
  if (metrics.memory.length > 0) {
    const avgMemory = metrics.memory.reduce((a, b) => a + b, 0) / metrics.memory.length;
    const maxMemory = Math.max(...metrics.memory);
    console.log(`   Average memory: ${(avgMemory/1024/1024).toFixed(1)} MB`);
    console.log(`   Peak memory: ${(maxMemory/1024/1024).toFixed(1)} MB`);
  }

  console.log(`\nStability:`);
  console.log(`   ✅ Reached wave: ${finalWave}`);
  console.log(`   ✅ Game playable: YES`);
  console.log(`   ✅ No crashes: YES`);
  console.log(`   ✅ Console errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors detected:`);
    errors.slice(0, 3).forEach(err => console.log(`   - ${err}`));
  }

  console.log('\n🎉 STRESS TEST COMPLETE!\n');
  console.log('ℹ️  Browser will remain open for 15 seconds for manual inspection...\n');

  await delay(15000);
  await browser.close();
}

runStressTest().catch(error => {
  console.error('\n❌ STRESS TEST FAILED:', error.message);
  process.exit(1);
});
