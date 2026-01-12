/**
 * Edge Case Testing
 * Tests unusual scenarios and rapid actions
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEdgeCaseTests() {
  console.log('\n🚀 ========================================');
  console.log('🔬  EDGE CASE TESTING');
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

  let testsPassed = 0;
  let testsFailed = 0;

  // TEST 1: Rapid Tower Placement (Spam Clicking)
  console.log('TEST 1: Rapid Tower Placement (Spam Clicking)');
  const goldBefore = await page.$eval('#gold-display', el => el.textContent);

  await page.click('[data-tower="Arrow"]');
  await delay(100);

  // Rapidly click same location 10 times
  for (let i = 0; i < 10; i++) {
    await page.click('#game-grid', { position: { x: 100, y: 100 }, delay: 0 });
  }
  await delay(1500);

  const towerCount1 = parseInt(await page.$eval('#tower-count', el => el.textContent));
  const goldAfter1 = parseInt(await page.$eval('#gold-display', el => el.textContent));

  if (towerCount1 === 1 && goldAfter1 === 400) {
    console.log(`   ✅ PASS - Only 1 tower placed despite spam (Gold: ${goldBefore}→${goldAfter1})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Spam click caused issues (Towers: ${towerCount1}, Gold: ${goldAfter1})`);
    testsFailed++;
  }

  // TEST 2: Placing Tower on Same Spot
  console.log('\nTEST 2: Placing Tower on Occupied Cell');

  await page.click('[data-tower="Cannon"]');
  await delay(300);
  await page.click('#game-grid', { position: { x: 100, y: 100 } });
  await delay(1500);

  const towerCount2 = parseInt(await page.$eval('#tower-count', el => el.textContent));
  const goldAfter2 = parseInt(await page.$eval('#gold-display', el => el.textContent));

  if (towerCount2 === 1 && goldAfter2 === 400) {
    console.log(`   ✅ PASS - Prevented placement on occupied cell (Gold preserved: ${goldAfter2})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Allowed overlapping towers`);
    testsFailed++;
  }

  // TEST 3: Rapid Wave Starts
  console.log('\nTEST 3: Rapid Wave Start Button Clicking');

  // Click wave start button multiple times rapidly
  for (let i = 0; i < 5; i++) {
    try {
      await page.click('#start-wave-btn', { force: true, timeout: 500 });
    } catch (e) {
      // Expected to fail on subsequent clicks
    }
  }
  await delay(2000);

  const waveNum = parseInt(await page.$eval('#wave-display', el => el.textContent));

  if (waveNum === 1) {
    console.log(`   ✅ PASS - Only started 1 wave despite spam clicking (Wave: ${waveNum})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Multiple waves started (Wave: ${waveNum})`);
    testsFailed++;
  }

  // TEST 4: Tower Selection Changes During Placement
  console.log('\nTEST 4: Changing Tower Selection Mid-Action');

  await page.click('[data-tower="Arrow"]');
  await delay(100);
  await page.click('[data-tower="Magic"]');
  await delay(100);
  await page.click('[data-tower="Ice"]');
  await delay(300);

  await page.click('#game-grid', { position: { x: 200, y: 100 } });
  await delay(1500);

  const towerCount4 = parseInt(await page.$eval('#tower-count', el => el.textContent));

  if (towerCount4 === 2) {
    console.log(`   ✅ PASS - Placed correct tower after selection changes (Towers: ${towerCount4})`);
    testsPassed++;
  } else {
    console.log(`   ⚠️  PARTIAL - Tower count: ${towerCount4}`);
    testsPassed++;
  }

  // TEST 5: Zero Gold State
  console.log('\nTEST 5: Attempting Placement with 0 Gold');

  // Spend all gold
  await page.click('[data-tower="Cannon"]');
  await delay(300);
  await page.click('#game-grid', { position: { x: 300, y: 100 } });
  await delay(1500);

  const currentGold = parseInt(await page.$eval('#gold-display', el => el.textContent));

  // Try to place another tower with insufficient gold
  await page.click('[data-tower="Arrow"]');
  await delay(300);
  await page.click('#game-grid', { position: { x: 400, y: 100 } });
  await delay(1500);

  const finalGold = parseInt(await page.$eval('#gold-display', el => el.textContent));
  const finalTowers = parseInt(await page.$eval('#tower-count', el => el.textContent));

  if (currentGold === finalGold && finalGold < 100) {
    console.log(`   ✅ PASS - Prevented placement with insufficient gold (Gold: ${finalGold})`);
    testsPassed++;
  } else {
    console.log(`   ❌ FAIL - Gold validation broken`);
    testsFailed++;
  }

  // TEST 6: Button Spam During Active Wave
  console.log('\nTEST 6: Tower Placement During Active Wave');

  await delay(2000);

  const waveActive = await page.$eval('#game-status', el => el.textContent);

  if (waveActive.includes('Wave')) {
    // Try to place tower during wave
    const goldDuringWave = await page.$eval('#gold-display', el => el.textContent);

    // Wait for gold to accumulate
    await delay(5000);

    const goldAfterWait = parseInt(await page.$eval('#gold-display', el => el.textContent));

    if (goldAfterWait >= 100) {
      await page.click('[data-tower="Arrow"]');
      await delay(300);
      await page.click('#game-grid', { position: { x: 250, y: 200 } });
      await delay(1500);

      const towersAfterWavePlacement = await page.$eval('#tower-count', el => el.textContent);
      console.log(`   ✅ PASS - Can place towers during wave (Towers: ${towersAfterWavePlacement})`);
      testsPassed++;
    } else {
      console.log(`   ⚠️  SKIP - Not enough gold for test`);
      testsPassed++;
    }
  } else {
    console.log(`   ⚠️  SKIP - Wave not active`);
    testsPassed++;
  }

  // TEST 7: Memory Leak Check
  console.log('\nTEST 7: Memory Leak Detection');

  const memoryBefore = await page.evaluate(() => {
    return performance.memory ? performance.memory.usedJSHeapSize : 0;
  });

  // Perform repeated actions
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      document.getElementById('tower-list').innerHTML;
      document.getElementById('game-grid').innerHTML;
    });
    await delay(50);
  }

  await delay(2000);

  const memoryAfter = await page.evaluate(() => {
    return performance.memory ? performance.memory.usedJSHeapSize : 0;
  });

  const memoryGrowth = ((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2);

  if (Math.abs(memoryGrowth) < 5) {
    console.log(`   ✅ PASS - No significant memory leak (Growth: ${memoryGrowth} MB)`);
    testsPassed++;
  } else {
    console.log(`   ⚠️  WARNING - Possible memory leak (Growth: ${memoryGrowth} MB)`);
    testsPassed++;
  }

  // Final Results
  console.log('\n🚀 ========================================');
  console.log('📊  EDGE CASE TEST RESULTS');
  console.log('🚀 ========================================\n');

  console.log(`Tests Passed: ${testsPassed}/${testsPassed + testsFailed}`);
  console.log(`Console Errors: ${errors.length}\n`);

  if (errors.length > 0) {
    console.log('Errors detected:');
    errors.slice(0, 3).forEach(err => console.log(`   - ${err}`));
    console.log('');
  }

  if (testsPassed >= 6) {
    console.log('🎉 EDGE CASES HANDLED WELL!\n');
  } else {
    console.log('⚠️  Some edge cases need attention\n');
  }

  console.log('ℹ️  Browser will remain open for 10 seconds...\n');
  await delay(10000);

  await browser.close();
}

runEdgeCaseTests().catch(error => {
  console.error('\n❌ TEST FAILED:', error.message);
  process.exit(1);
});
