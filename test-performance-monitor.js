/**
 * Real-time Performance Monitoring
 * Tracks FPS, memory, and performance metrics during gameplay
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPerformanceMonitor() {
  console.log('\n🚀 ========================================');
  console.log('📈  PERFORMANCE MONITORING');
  console.log('🚀 ========================================\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('🌐 Connecting...');
  await page.goto('http://localhost:8080/index.html');
  await delay(3000);

  // Inject FPS counter
  await page.evaluate(() => {
    window.fpsData = {
      fps: 0,
      lastFrameTime: performance.now(),
      frames: 0
    };

    function measureFPS() {
      const now = performance.now();
      window.fpsData.frames++;

      if (now >= window.fpsData.lastFrameTime + 1000) {
        window.fpsData.fps = Math.round(window.fpsData.frames * 1000 / (now - window.fpsData.lastFrameTime));
        window.fpsData.frames = 0;
        window.fpsData.lastFrameTime = now;
      }

      requestAnimationFrame(measureFPS);
    }

    measureFPS();
  });

  // Place towers
  console.log('🗼 Placing towers...\n');
  const towerPlacements = [
    { type: 'Cannon', x: 150, y: 200 },
    { type: 'Arrow', x: 200, y: 100 },
    { type: 'Magic', x: 250, y: 200 },
    { type: 'Ice', x: 300, y: 100 },
  ];

  for (const tower of towerPlacements) {
    await page.click(`[data-tower="${tower.type}"]`);
    await delay(300);
    await page.click('#game-grid', { position: { x: tower.x, y: tower.y } });
    await delay(500);
  }

  console.log('   Towers placed\n');

  // Start monitoring
  console.log('📊 PERFORMANCE METRICS (Every 5 seconds)\n');
  console.log('Time | Wave | Enemies | FPS | Memory (MB) | Health\n' + '-'.repeat(60));

  const metrics = [];
  let monitoringTime = 0;

  // Start waves and monitor
  for (let wave = 1; wave <= 5; wave++) {
    await delay(2000);

    // Start wave
    try {
      await page.evaluate(() => document.getElementById('start-wave-btn').click());
      await delay(1000);
    } catch (e) {
      break;
    }

    // Monitor for 30 seconds per wave
    for (let i = 0; i < 6; i++) {
      await delay(5000);
      monitoringTime += 5;

      const data = await page.evaluate(() => {
        return {
          fps: window.fpsData ? window.fpsData.fps : 0,
          memory: performance.memory ? (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) : 'N/A',
          wave: document.getElementById('wave-display').textContent,
          enemies: document.getElementById('enemy-count').textContent,
          health: document.getElementById('health-display').textContent,
          towers: document.getElementById('tower-count').textContent,
          gold: document.getElementById('gold-display').textContent,
          status: document.getElementById('game-status').textContent
        };
      });

      metrics.push({
        time: monitoringTime,
        ...data
      });

      console.log(`${monitoringTime}s   | W${data.wave}   | ${data.enemies.padEnd(7)} | ${String(data.fps).padEnd(3)} | ${String(data.memory).padEnd(11)} | ${data.health}`);

      // Check if game over
      if (parseInt(data.health) <= 0) {
        console.log('\n💀 Game Over detected\n');
        break;
      }

      // Check if wave completed
      if (data.status === 'Preparing' && parseInt(data.enemies) === 0) {
        break;
      }
    }

    // Check if game still running
    const health = await page.$eval('#health-display', el => el.textContent);
    if (parseInt(health) <= 0) {
      break;
    }
  }

  // Analysis
  console.log('\n' + '='.repeat(60));
  console.log('📊  PERFORMANCE ANALYSIS');
  console.log('='.repeat(60) + '\n');

  const fpsValues = metrics.map(m => m.fps).filter(f => f > 0);
  const memoryValues = metrics.map(m => parseFloat(m.memory)).filter(m => !isNaN(m));

  if (fpsValues.length > 0) {
    const avgFPS = (fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length).toFixed(1);
    const minFPS = Math.min(...fpsValues);
    const maxFPS = Math.max(...fpsValues);

    console.log(`Frame Rate:`);
    console.log(`   Average FPS: ${avgFPS}`);
    console.log(`   Min FPS: ${minFPS}`);
    console.log(`   Max FPS: ${maxFPS}`);
    console.log(`   Performance: ${avgFPS >= 30 ? '✅ SMOOTH' : '⚠️ LAGGY'}\n`);
  }

  if (memoryValues.length > 0) {
    const avgMemory = (memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length).toFixed(1);
    const maxMemory = Math.max(...memoryValues).toFixed(1);
    const memoryGrowth = (memoryValues[memoryValues.length - 1] - memoryValues[0]).toFixed(1);

    console.log(`Memory Usage:`);
    console.log(`   Average: ${avgMemory} MB`);
    console.log(`   Peak: ${maxMemory} MB`);
    console.log(`   Growth: ${memoryGrowth} MB`);
    console.log(`   Memory Leaks: ${Math.abs(memoryGrowth) < 10 ? '✅ NONE DETECTED' : '⚠️ POSSIBLE LEAK'}\n`);
  }

  const finalMetric = metrics[metrics.length - 1];
  console.log(`Final State:`);
  console.log(`   Wave: ${finalMetric.wave}`);
  console.log(`   Health: ${finalMetric.health}`);
  console.log(`   Towers: ${finalMetric.towers}`);
  console.log(`   Gold: ${finalMetric.gold}\n`);

  console.log('🎉 PERFORMANCE MONITORING COMPLETE!\n');
  console.log('ℹ️  Browser will remain open for 10 seconds...\n');

  await delay(10000);
  await browser.close();
}

runPerformanceMonitor().catch(error => {
  console.error('\n❌ MONITORING FAILED:', error.message);
  process.exit(1);
});
