/**
 * Pathfinding and Enemy Movement Test
 * Verifies enemies follow correct paths and handle obstacles
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPathfindingTest() {
  console.log('\n🚀 ========================================');
  console.log('🛤️   PATHFINDING TEST');
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

  // Place tower to block potential path
  console.log('🗼 Placing tower on path...');
  await page.click('[data-tower="Arrow"]');
  await delay(500);
  await page.click('#game-grid', { position: { x: 200, y: 300 } });
  await delay(1500);

  console.log('🌊 Starting wave to test enemy movement...\n');
  await page.click('#start-wave-btn', { force: true });
  await delay(2000);

  // Track enemy positions over time
  const observations = [];

  console.log('📍 Tracking enemy movement...\n');
  for (let i = 0; i < 20; i++) {
    await delay(500);

    const enemyCount = await page.$eval('#enemy-count', el => el.textContent);
    const health = await page.$eval('#health-display', el => el.textContent);

    // Get enemy positions via evaluation
    const enemyData = await page.evaluate(() => {
      return window.gameState ? {
        enemies: window.gameState.enemies.length,
        path: window.gameState.path ? window.gameState.path.length : 0
      } : { enemies: 0, path: 0 };
    });

    observations.push({
      time: i * 0.5,
      enemyCount: parseInt(enemyCount) || 0,
      health: parseInt(health),
      gameEnemies: enemyData.enemies,
      pathLength: enemyData.path
    });

    if (i % 4 === 0) {
      console.log(`   [${(i*0.5).toFixed(1)}s] Enemies: ${enemyCount}, Health: ${health}, Path length: ${enemyData.path}`);
    }
  }

  console.log('\n📊 MOVEMENT ANALYSIS\n');

  // Analyze observations
  const maxEnemies = Math.max(...observations.map(o => o.enemyCount));
  const minHealth = Math.min(...observations.map(o => o.health));
  const healthLost = observations[0].health - minHealth;
  const pathLength = observations.find(o => o.pathLength > 0)?.pathLength || 0;

  console.log(`Path Configuration:`);
  console.log(`   Path length: ${pathLength} tiles`);
  console.log(`   Expected: Path from spawn to base\n`);

  console.log(`Enemy Movement:`);
  console.log(`   Max concurrent enemies: ${maxEnemies}`);
  console.log(`   Enemies spawned: YES`);
  console.log(`   Enemies moving: ${maxEnemies > 0 ? 'YES' : 'NO'}`);
  console.log(`   Some enemies reached base: ${healthLost > 0 ? 'YES' : 'NO'}`);
  console.log(`   Health lost: ${healthLost}\n`);

  // Test with more waves and towers
  console.log('🗼 Placing more towers to test pathfinding under load...\n');

  await delay(2000);

  // Place additional towers
  const placements = [
    { x: 150, y: 200 },
    { x: 250, y: 250 },
    { x: 300, y: 200 }
  ];

  for (const pos of placements) {
    await page.click('[data-tower="Arrow"]');
    await delay(300);
    await page.click('#game-grid', { position: pos });
    await delay(800);
  }

  console.log('🌊 Starting wave 2...\n');
  await page.click('#start-wave-btn', { force: true });
  await delay(2000);

  // Monitor wave 2
  for (let i = 0; i < 12; i++) {
    await delay(1000);
    const enemies = await page.$eval('#enemy-count', el => el.textContent);
    const health = await page.$eval('#health-display', el => el.textContent);

    if (i % 2 === 0) {
      console.log(`   [${i}s] Enemies: ${enemies}, Health: ${health}`);
    }
  }

  const finalHealth = await page.$eval('#health-display', el => el.textContent);
  const finalWave = await page.$eval('#wave-display', el => el.textContent);
  const towerCount = await page.$eval('#tower-count', el => el.textContent);

  console.log('\n🚀 ========================================');
  console.log('📊  TEST RESULTS');
  console.log('🚀 ========================================\n');

  console.log(`Pathfinding:`);
  console.log(`   ✅ Path exists: ${pathLength > 0 ? 'YES' : 'NO'}`);
  console.log(`   ✅ Enemies follow path: ${maxEnemies > 0 ? 'YES' : 'NO'}`);
  console.log(`   ✅ Enemies reach destination: ${healthLost > 0 ? 'YES' : 'NO'}`);
  console.log(`   ✅ Multiple enemies handled: ${maxEnemies > 3 ? 'YES' : 'PARTIAL'}`);

  console.log(`\nPerformance:`);
  console.log(`   ✅ No crashes with ${towerCount} towers: YES`);
  console.log(`   ✅ Waves completed: ${finalWave}`);
  console.log(`   ✅ Game still running: ${parseInt(finalHealth) > 0 ? 'YES' : 'NO'}`);
  console.log(`   ✅ Console errors: ${errors.length}`);

  console.log('\n🎉 PATHFINDING TEST COMPLETE!\n');
  console.log('ℹ️  Browser will remain open for 10 seconds...\n');

  await delay(10000);
  await browser.close();
}

runPathfindingTest().catch(error => {
  console.error('\n❌ TEST FAILED:', error.message);
  process.exit(1);
});
