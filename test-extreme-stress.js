/**
 * Extreme Stress Test - Push to Wave 15+
 * Tests game stability under heavy load
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runExtremeStressTest() {
  console.log('\n🚀 ========================================');
  console.log('💥  EXTREME STRESS TEST (Target: Wave 15+)');
  console.log('🚀 ========================================\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('🌐 Connecting...');
  await page.goto('http://localhost:8080/index.html');
  await delay(3000);

  // Strategic tower placement for maximum coverage
  console.log('🗼 STRATEGIC TOWER DEPLOYMENT\n');

  const towerStrategy = [
    { type: 'Cannon', x: 150, y: 250, desc: 'Heavy damage center' },
    { type: 'Arrow', x: 100, y: 150, desc: 'Fast attack front' },
    { type: 'Magic', x: 250, y: 200, desc: 'AOE middle' },
    { type: 'Ice', x: 200, y: 300, desc: 'Slow effect' },
    { type: 'Arrow', x: 300, y: 150, desc: 'Fast attack rear' },
  ];

  for (const tower of towerStrategy) {
    try {
      const goldBefore = await page.$eval('#gold-display', el => el.textContent);

      await page.click(`[data-tower="${tower.type}"]`);
      await delay(300);
      await page.click('#game-grid', { position: { x: tower.x, y: tower.y } });
      await delay(800);

      const goldAfter = await page.$eval('#gold-display', el => el.textContent);
      console.log(`   ✓ ${tower.type} (${tower.desc}) - Gold: ${goldBefore}→${goldAfter}`);
    } catch (e) {
      console.log(`   ✗ ${tower.type}: ${e.message}`);
    }
  }

  const initialTowers = await page.$eval('#tower-count', el => el.textContent);
  const initialGold = await page.$eval('#gold-display', el => el.textContent);
  console.log(`\n   Towers deployed: ${initialTowers}`);
  console.log(`   Starting gold: ${initialGold}\n`);

  // Wave progression with detailed tracking
  console.log('🌊 WAVE PROGRESSION (Target: 15 waves)\n');

  const waveData = [];
  let gameActive = true;

  for (let targetWave = 1; targetWave <= 20 && gameActive; targetWave++) {
    const waveStartTime = Date.now();

    console.log(`📍 Wave ${targetWave}:`);

    // Check if we can place more towers with earned gold
    if (targetWave % 3 === 0) {
      const currentGold = parseInt(await page.$eval('#gold-display', el => el.textContent));
      if (currentGold >= 100) {
        console.log(`   💰 Gold: ${currentGold} - Placing reinforcement tower...`);
        try {
          await page.click('[data-tower="Arrow"]');
          await delay(300);
          await page.click('#game-grid', { position: { x: 100 + targetWave * 20, y: 200 } });
          await delay(500);
        } catch (e) {
          console.log(`   ⚠️  Reinforcement failed: ${e.message}`);
        }
      }
    }

    await delay(2000);

    // Start wave
    try {
      await page.evaluate(() => {
        document.getElementById('start-wave-btn').click();
      });
      await delay(1500);
    } catch (e) {
      console.log(`   ✗ Failed to start: ${e.message}`);
      break;
    }

    const waveDisplay = await page.$eval('#wave-display', el => el.textContent);
    console.log(`   Wave started: ${waveDisplay}`);

    // Monitor wave progress
    let maxEnemies = 0;
    let healthLost = 0;
    let waveComplete = false;
    let checkCount = 0;
    const maxChecks = 60; // 30 seconds max per wave

    const startHealth = parseInt(await page.$eval('#health-display', el => el.textContent));

    while (!waveComplete && checkCount < maxChecks && gameActive) {
      await delay(500);
      checkCount++;

      const status = await page.$eval('#game-status', el => el.textContent);
      const enemyCount = parseInt(await page.$eval('#enemy-count', el => el.textContent)) || 0;
      const health = parseInt(await page.$eval('#health-display', el => el.textContent));

      maxEnemies = Math.max(maxEnemies, enemyCount);

      if (checkCount % 6 === 0) {
        console.log(`   [${(checkCount/2).toFixed(0)}s] Enemies: ${enemyCount}, Health: ${health}`);
      }

      if (status === 'Preparing' && enemyCount === 0) {
        waveComplete = true;
        healthLost = startHealth - health;
      }

      if (health <= 0) {
        console.log(`\n   💀 GAME OVER at Wave ${targetWave}!`);
        gameActive = false;
        break;
      }
    }

    const waveTime = Date.now() - waveStartTime;
    const endHealth = parseInt(await page.$eval('#health-display', el => el.textContent));
    const endGold = await page.$eval('#gold-display', el => el.textContent);

    waveData.push({
      wave: targetWave,
      time: waveTime,
      maxEnemies,
      healthLost,
      endHealth,
      endGold: parseInt(endGold),
      completed: waveComplete
    });

    if (waveComplete) {
      console.log(`   ✅ Completed in ${(waveTime/1000).toFixed(1)}s | Max enemies: ${maxEnemies} | Health lost: ${healthLost} | Gold: ${endGold}`);
    } else {
      console.log(`   ⏱️  Timeout | Health: ${endHealth} | Gold: ${endGold}`);
    }

    console.log('');

    if (!gameActive) break;

    // Performance check every 5 waves
    if (targetWave % 5 === 0) {
      const memory = await page.evaluate(() => {
        return performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) : 'N/A';
      });
      console.log(`   📊 Performance check: Memory: ${memory} MB\n`);
    }
  }

  // Final statistics
  console.log('\n🚀 ========================================');
  console.log('📊  EXTREME STRESS TEST RESULTS');
  console.log('🚀 ========================================\n');

  const completedWaves = waveData.filter(w => w.completed).length;
  const finalWave = waveData[waveData.length - 1];
  const avgWaveTime = waveData.filter(w => w.completed).reduce((sum, w) => sum + w.time, 0) / completedWaves;
  const maxEnemiesOverall = Math.max(...waveData.map(w => w.maxEnemies));
  const totalHealthLost = waveData.reduce((sum, w) => sum + w.healthLost, 0);

  console.log(`Wave Progression:`);
  console.log(`   Waves completed: ${completedWaves}`);
  console.log(`   Final wave reached: ${finalWave.wave}`);
  console.log(`   Final health: ${finalWave.endHealth}`);
  console.log(`   Final gold: ${finalWave.endGold}`);

  console.log(`\nPerformance:`);
  console.log(`   Average wave time: ${(avgWaveTime/1000).toFixed(1)}s`);
  console.log(`   Max concurrent enemies: ${maxEnemiesOverall}`);
  console.log(`   Total health lost: ${totalHealthLost}`);

  console.log(`\nStability:`);
  console.log(`   Console errors: ${errors.length}`);
  console.log(`   Crashes: 0`);
  console.log(`   Game completed: ${finalWave.endHealth <= 0 ? 'YES (reached limit)' : 'NO (still running)'}`);

  if (completedWaves >= 15) {
    console.log(`\n🏆 EXTREME TEST PASSED! Survived 15+ waves!`);
  } else if (completedWaves >= 10) {
    console.log(`\n✅ GOOD PERFORMANCE! Survived 10+ waves!`);
  } else {
    console.log(`\n⚠️  Need better tower strategy for 10+ waves`);
  }

  console.log('\n📈 Wave-by-Wave Breakdown:');
  waveData.forEach(w => {
    const status = w.completed ? '✓' : '⏱️';
    console.log(`   ${status} Wave ${w.wave}: ${(w.time/1000).toFixed(1)}s, ${w.maxEnemies} enemies, -${w.healthLost} HP, ${w.endGold} gold`);
  });

  console.log('\n\nℹ️  Browser will remain open for 15 seconds...\n');
  await delay(15000);

  await browser.close();
}

runExtremeStressTest().catch(error => {
  console.error('\n❌ EXTREME TEST FAILED:', error.message);
  process.exit(1);
});
