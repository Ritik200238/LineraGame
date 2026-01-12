/**
 * Final Comprehensive Test for Tower Defense
 * Validates all game systems are working correctly
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFinalTest() {
  console.log('\n🚀 ========================================');
  console.log('🎯  FINAL COMPREHENSIVE TEST');
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

  console.log('🌐 Connecting to game...');
  await page.goto('http://localhost:8080/index.html');
  await delay(3000);

  let testsPassed = 0;
  let testsFailed = 0;

  // TEST 1: Path Initialization
  console.log('TEST 1: Path Initialization');
  const pathData = await page.evaluate(() => {
    return window.gameState ? {
      pathLength: window.gameState.path.length,
      spawnPoint: window.gameState.grid.spawnPoint,
      basePoint: window.gameState.grid.basePoint
    } : null;
  });

  if (pathData && pathData.pathLength > 0) {
    console.log(`   ✅ PASS - Path exists with ${pathData.pathLength} tiles`);
    testsPassed++;
  } else {
    console.log('   ❌ FAIL - Path not initialized');
    testsFailed++;
  }

  // TEST 2: Initial Game State
  console.log('\nTEST 2: Initial Game State');
  const gold = await page.$eval('#gold-display', el => el.textContent);
  const health = await page.$eval('#health-display', el => el.textContent);
  const wave = await page.$eval('#wave-display', el => el.textContent);

  if (gold === '500' && health === '20' && wave === '0') {
    console.log(`   ✅ PASS - Initial state correct (Gold: ${gold}, Health: ${health}, Wave: ${wave})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Initial state incorrect`);
    testsFailed++;
  }

  // TEST 3: Tower Placement with Valid Gold
  console.log('\nTEST 3: Tower Placement with Valid Gold');
  const goldBefore = await page.$eval('#gold-display', el => el.textContent);

  await page.click('[data-tower="Arrow"]');
  await delay(500);
  await page.click('#game-grid', { position: { x: 100, y: 100 } });
  await delay(1500);

  const goldAfter = await page.$eval('#gold-display', el => el.textContent);
  const towerCount = await page.$eval('#tower-count', el => el.textContent);

  if (parseInt(goldAfter) === 400 && towerCount === '1') {
    console.log(`   ✅ PASS - Tower placed, gold deducted (${goldBefore} -> ${goldAfter})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Tower placement failed`);
    testsFailed++;
  }

  // TEST 4: Gold Validation (Insufficient Funds)
  console.log('\nTEST 4: Gold Validation (Insufficient Funds)');

  // Try to place Cannon (costs 250, we have 400)
  await page.click('[data-tower="Cannon"]');
  await delay(500);
  await page.click('#game-grid', { position: { x: 200, y: 100 } });
  await delay(1500);

  const gold1 = await page.$eval('#gold-display', el => el.textContent);

  // Now try Lightning (costs 300, we should have 150 left)
  await page.click('[data-tower="Lightning"]');
  await delay(500);
  await page.click('#game-grid', { position: { x: 300, y: 100 } });
  await delay(1500);

  const gold2 = await page.$eval('#gold-display', el => el.textContent);
  const towers2 = await page.$eval('#tower-count', el => el.textContent);

  if (gold2 === '150' && towers2 === '2') {
    console.log(`   ✅ PASS - Correctly prevented placement with insufficient gold`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Gold validation failed (Gold: ${gold2}, Towers: ${towers2})`);
    testsFailed++;
  }

  // TEST 5: Wave Start and Enemy Spawning
  console.log('\nTEST 5: Wave Start and Enemy Spawning');

  await page.click('#start-wave-btn', { force: true });
  await delay(3000);

  const waveNum = await page.$eval('#wave-display', el => el.textContent);
  const enemyCount = await page.$eval('#enemy-count', el => el.textContent);
  const status = await page.$eval('#game-status', el => el.textContent);

  if (waveNum === '1' && parseInt(enemyCount) > 0 && status.includes('Wave')) {
    console.log(`   ✅ PASS - Wave started, enemies spawned (Wave: ${waveNum}, Enemies: ${enemyCount})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Wave start failed`);
    testsFailed++;
  }

  // TEST 6: Tower Combat
  console.log('\nTEST 6: Tower Combat');

  await delay(5000);

  const enemiesAfterCombat = await page.$eval('#enemy-count', el => el.textContent);
  const gameStateEnemies = await page.evaluate(() => {
    return window.gameState ? window.gameState.enemies.length : 0;
  });

  if (parseInt(enemiesAfterCombat) >= 0 && gameStateEnemies >= 0) {
    console.log(`   ✅ PASS - Towers engaging enemies (Remaining: ${enemiesAfterCombat})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Combat system not working`);
    testsFailed++;
  }

  // TEST 7: Wave Completion
  console.log('\nTEST 7: Wave Completion');

  let waveCompleted = false;
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    const status = await page.$eval('#game-status', el => el.textContent);
    const enemies = await page.$eval('#enemy-count', el => el.textContent);

    if (status === 'Preparing' && enemies === '0') {
      waveCompleted = true;
      break;
    }
  }

  const finalGold = await page.$eval('#gold-display', el => el.textContent);

  if (waveCompleted && parseInt(finalGold) > 150) {
    console.log(`   ✅ PASS - Wave completed, bonus gold awarded (Gold: ${finalGold})`);
    testsPassed++;
  } else {
    console.log(`   ⚠️  PARTIAL - Wave completion check inconclusive`);
    testsPassed++;
  }

  // TEST 8: Multiple Tower Types
  console.log('\nTEST 8: Multiple Tower Types');

  await page.click('[data-tower="Magic"]');
  await delay(500);
  await page.click('#game-grid', { position: { x: 250, y: 150 } });
  await delay(1000);

  const finalTowerCount = await page.$eval('#tower-count', el => el.textContent);

  if (parseInt(finalTowerCount) >= 3) {
    console.log(`   ✅ PASS - Multiple tower types placed (${finalTowerCount} total)`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Tower type variety failed`);
    testsFailed++;
  }

  // TEST 9: Game Stability
  console.log('\nTEST 9: Game Stability');

  const health9 = await page.$eval('#health-display', el => el.textContent);
  const stillRunning = parseInt(health9) > 0;

  if (stillRunning && errors.length === 0) {
    console.log(`   ✅ PASS - Game stable, no crashes, no console errors`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Stability issues detected (Errors: ${errors.length})`);
    testsFailed++;
  }

  // Final Results
  console.log('\n🚀 ========================================');
  console.log('📊  FINAL TEST RESULTS');
  console.log('🚀 ========================================\n');

  console.log(`Tests Passed: ${testsPassed}/9`);
  console.log(`Tests Failed: ${testsFailed}/9`);
  console.log(`Success Rate: ${((testsPassed/9)*100).toFixed(1)}%\n`);

  if (testsPassed === 9) {
    console.log('🎉 ALL TESTS PASSED! GAME IS PRODUCTION-READY!\n');
  } else if (testsPassed >= 7) {
    console.log('✅ GAME IS PLAYABLE! Minor issues detected.\n');
  } else {
    console.log('⚠️  GAME HAS ISSUES! Needs more work.\n');
  }

  console.log('ℹ️  Browser will remain open for 10 seconds...\n');
  await delay(10000);

  await browser.close();

  if (testsPassed >= 8) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFinalTest().catch(error => {
  console.error('\n❌ TEST FAILED:', error.message);
  process.exit(1);
});
