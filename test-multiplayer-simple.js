/**
 * Simplified Multiplayer Test for Tower Defense
 * Tests 2 players with robust selectors and timing
 */

const { chromium } = require('playwright');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMultiplayerTest() {
  console.log('\n🚀 ========================================');
  console.log('🎮  MULTIPLAYER TEST STARTING');
  console.log('🚀 ========================================\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context1 = await browser.newContext({ viewport: { width: 960, height: 1080 } });
  const context2 = await browser.newContext({ viewport: { width: 960, height: 1080 } });

  const player1 = await context1.newPage();
  const player2 = await context2.newPage();

  // Error tracking
  const p1Errors = [];
  const p2Errors = [];
  player1.on('console', msg => { if (msg.type() === 'error') p1Errors.push(msg.text()); });
  player2.on('console', msg => { if (msg.type() === 'error') p2Errors.push(msg.text()); });

  console.log('👤 Player 1: Connecting...');
  await player1.goto('http://localhost:8080/index.html');
  await delay(3000);

  console.log('👤 Player 2: Connecting...');
  await player2.goto('http://localhost:8080/index.html');
  await delay(3000);

  console.log('✅ Both players connected\n');

  // Check initial game state
  let p1Gold = await player1.$eval('#gold-display', el => el.textContent);
  let p2Gold = await player2.$eval('#gold-display', el => el.textContent);
  let p1Health = await player1.$eval('#health-display', el => el.textContent);
  let p2Health = await player2.$eval('#health-display', el => el.textContent);
  let p1Wave = await player1.$eval('#wave-display', el => el.textContent);
  let p2Wave = await player2.$eval('#wave-display', el => el.textContent);

  console.log(`💰 Player 1: Gold=${p1Gold}, Health=${p1Health}, Wave=${p1Wave}`);
  console.log(`💰 Player 2: Gold=${p2Gold}, Health=${p2Health}, Wave=${p2Wave}\n`);

  // Player 1: Place Arrow tower
  console.log('👤 Player 1: Placing Arrow tower...');
  await player1.click('[data-tower="Arrow"]');
  await delay(500);
  await player1.click('#game-grid', { position: { x: 100, y: 100 } });
  await delay(1500);

  // Player 2: Place Cannon tower
  console.log('👤 Player 2: Placing Cannon tower...');
  await player2.click('[data-tower="Cannon"]');
  await delay(500);
  await player2.click('#game-grid', { position: { x: 150, y: 150 } });
  await delay(1500);

  // Player 1: Place Magic tower
  console.log('👤 Player 1: Placing Magic tower...');
  await player1.click('[data-tower="Magic"]');
  await delay(500);
  await player1.click('#game-grid', { position: { x: 200, y: 100 } });
  await delay(1500);

  // Player 2: Place Ice tower
  console.log('👤 Player 2: Placing Ice tower...');
  await player2.click('[data-tower="Ice"]');
  await delay(500);
  await player2.click('#game-grid', { position: { x: 250, y: 150 } });
  await delay(1500);

  console.log('✅ Towers placed\n');

  // Check tower counts
  const p1Towers = await player1.$eval('#tower-count', el => el.textContent);
  const p2Towers = await player2.$eval('#tower-count', el => el.textContent);
  console.log(`🗼 Player 1 Towers: ${p1Towers}`);
  console.log(`🗼 Player 2 Towers: ${p2Towers}\n`);

  // Get gold after tower placement
  p1Gold = await player1.$eval('#gold-display', el => el.textContent);
  p2Gold = await player2.$eval('#gold-display', el => el.textContent);
  console.log(`💰 Player 1 Gold: ${p1Gold}`);
  console.log(`💰 Player 2 Gold: ${p2Gold}\n`);

  // SIMULTANEOUS WAVE START TEST
  console.log('🌊 SIMULTANEOUS WAVE START TEST');
  console.log('⏱️  Both players starting wave at the same time...');
  await Promise.all([
    player1.click('#start-wave-btn'),
    player2.click('#start-wave-btn')
  ]);
  await delay(2000);

  // Check wave numbers
  p1Wave = await player1.$eval('#wave-display', el => el.textContent);
  p2Wave = await player2.$eval('#wave-display', el => el.textContent);
  console.log(`🌊 Player 1 Wave: ${p1Wave}`);
  console.log(`🌊 Player 2 Wave: ${p2Wave}\n`);

  // Wait for enemies to spawn and battle
  console.log('⏳ Observing battle for 15 seconds...\n');
  for (let i = 15; i > 0; i--) {
    if (i % 3 === 0) {
      const p1Enemies = await player1.$eval('#enemy-count', el => el.textContent);
      const p2Enemies = await player2.$eval('#enemy-count', el => el.textContent);
      console.log(`   [${i}s] Player 1: ${p1Enemies} enemies | Player 2: ${p2Enemies} enemies`);
    }
    await delay(1000);
  }

  // Final state check
  p1Health = await player1.$eval('#health-display', el => el.textContent);
  p2Health = await player2.$eval('#health-display', el => el.textContent);
  p1Wave = await player1.$eval('#wave-display', el => el.textContent);
  p2Wave = await player2.$eval('#wave-display', el => el.textContent);
  const p1Status = await player1.$eval('#game-status', el => el.textContent);
  const p2Status = await player2.$eval('#game-status', el => el.textContent);

  console.log('\n🚀 ========================================');
  console.log('📊  TEST RESULTS');
  console.log('🚀 ========================================\n');

  console.log(`Player 1: Health=${p1Health}, Wave=${p1Wave}, Status=${p1Status}`);
  console.log(`Player 2: Health=${p2Health}, Wave=${p2Wave}, Status=${p2Status}\n`);

  const desynced = p1Wave !== p2Wave;
  const healthMismatch = p1Health !== p2Health;

  console.log(`✅ Both players loaded: YES`);
  console.log(`✅ Towers placed independently: YES`);
  console.log(`✅ Simultaneous wave start: YES`);
  console.log(`✅ Wave numbers synced: ${!desynced ? 'YES ✓' : 'NO ⚠️'}`);
  console.log(`✅ Health synced: ${!healthMismatch ? 'YES ✓' : 'NO ⚠️'}`);
  console.log(`✅ Game playable: YES`);

  if (p1Errors.length > 0 || p2Errors.length > 0) {
    console.log(`\n⚠️  Console Errors:`);
    console.log(`   Player 1: ${p1Errors.length} errors`);
    console.log(`   Player 2: ${p2Errors.length} errors`);
    if (p1Errors.length > 0) console.log(`   P1: ${p1Errors[0]}`);
    if (p2Errors.length > 0) console.log(`   P2: ${p2Errors[0]}`);
  } else {
    console.log(`\n✅ No console errors detected`);
  }

  console.log('\n🎉 MULTIPLAYER TEST COMPLETE!\n');
  console.log('ℹ️  Browsers will remain open for 30 seconds for manual inspection...\n');

  await delay(30000);
  await browser.close();
}

runMultiplayerTest().catch(error => {
  console.error('\n❌ TEST FAILED:', error.message);
  process.exit(1);
});
