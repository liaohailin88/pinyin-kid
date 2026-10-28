// 端到端检查（含截图）：验证无报错、三条路线可用、答题计分正确
const { chromium } = require(process.env.TEMP + '/e2e/node_modules/playwright-core');
const fs = require('fs');

const URL = 'http://127.0.0.1:8765/index.html';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SHOT = 'F:\\harness0916\\pinyin-kid\\_shots';

(async () => {
  fs.mkdirSync(SHOT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('reqfail: ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')));

  async function dismiss() {
    for (let i = 0; i < 4; i++) {
      if (!(await page.locator('.modal-mask').count())) return;
      await page.locator('.modal .btn').last().click({ force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  async function home() { await dismiss(); await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForTimeout(350); }
  async function shot(name) { await page.screenshot({ path: SHOT + '\\' + name + '.png' }); }

  const R = {};
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  R.tiles = await page.locator('.tile').count();
  await shot('01-home');

  // ---- 拼音地图 ----
  await page.locator('.tile', { hasText: '拼音地图' }).click();
  await page.waitForTimeout(400);
  R.chartCells = await page.locator('.pc-cell').count();
  await shot('02-chart');
  await home();

  // ---- 声母：答对一题 ----
  await page.locator('.tile', { hasText: '声母认读' }).click();
  await page.waitForTimeout(600);
  const q1 = await page.evaluate(() => ({ ans: window.__currentQ.answer, key: window.__currentQ.key, glyph: window.__currentQ.card.glyph }));
  R.q1 = q1;
  await shot('03-initial');
  await page.locator(`.opt[data-v="${q1.ans}"]`).click();
  await page.waitForTimeout(500);
  R.starsAfterCorrect = await page.locator('#starCount').innerText();
  R.progressAfterCorrect = await page.locator('.chip').first().innerText();
  await shot('04-initial-correct');
  await home();

  // ---- 拼读 ----
  await page.locator('.tile', { hasText: '拼读推一推' }).click();
  await page.waitForTimeout(600);
  const q2 = await page.evaluate(() => ({ ans: window.__currentQ.answer, card: window.__currentQ.card.glyph, opts: [...document.querySelectorAll('.opt')].map(o => o.textContent) }));
  R.q2 = q2;
  await shot('05-pin');
  await home();

  // ---- 声调 ----
  await page.locator('.tile', { hasText: '声调小侦探' }).click();
  await page.waitForTimeout(600);
  R.toneQ = await page.evaluate(() => ({ ans: window.__currentQ.answer, glyph: window.__currentQ.card.glyph }));
  await page.locator('.opt').first().click();
  await page.waitForTimeout(400);
  await shot('06-tone');
  await home();

  // ---- 认字 ----
  await page.locator('.tile', { hasText: '认字卡' }).click();
  await page.waitForTimeout(400);
  R.unitRows = await page.locator('.unit-row').count();
  await shot('07-char-picker');
  await page.locator('#allChars').click();
  await page.waitForTimeout(700);
  await dismiss();
  R.charQ = await page.evaluate(() => ({ ans: window.__currentQ.answer, zi: window.__currentQ.card.zi }));
  await shot('08-char-card');
  await page.locator(`.opt[data-v="${R.charQ.ans}"]`).click();
  await page.waitForTimeout(500);
  await shot('09-char-correct');
  await home();

  // ---- 写字 ----
  await page.evaluate(() => { location.hash = '#/write'; });
  await page.waitForTimeout(2500);
  R.writePaths = await page.locator('#hwHost svg path').count();
  R.writeStroke = await page.locator('#strokeInfo').innerText();
  await shot('10-write');
  await page.locator('#btnTrace').click();
  await page.waitForTimeout(900);
  R.traceSvg = await page.locator('#hwHost svg').count();
  await shot('11-write-trace');
  await dismiss();

  // ---- 朗读 ----
  await page.evaluate(() => { location.hash = '#/read'; });
  await page.waitForTimeout(600);
  R.readChars = await page.locator('#cnLine .ch').count();
  await shot('12-read');

  // ---- 设置 / 徽章 ----
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(500);
  R.settingRows = await page.locator('.unit-row').count();
  await shot('13-settings');

  await page.evaluate(() => { location.hash = '#/badges'; });
  await page.waitForTimeout(400);
  R.badges = await page.locator('.badge-item').count();
  await shot('14-badges');

  // ---- 手机尺寸 ----
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await m.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));
  await m.goto(URL, { waitUntil: 'networkidle' });
  await m.waitForTimeout(500);
  await m.screenshot({ path: SHOT + '\\20-phone-home.png' });
  await m.locator('.tile', { hasText: '声母认读' }).click();
  await m.waitForTimeout(600);
  await m.screenshot({ path: SHOT + '\\21-phone-initial.png' });
  await m.evaluate(() => { location.hash = '#/write'; });
  await m.waitForTimeout(2500);
  await m.screenshot({ path: SHOT + '\\22-phone-write.png' });

  // ---- 平板横屏 ----
  const t = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await t.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));
  await t.goto(URL, { waitUntil: 'networkidle' });
  await t.waitForTimeout(400);
  await t.evaluate(() => { location.hash = '#/read'; });
  await t.waitForTimeout(600);
  await t.screenshot({ path: SHOT + '\\23-tablet-read.png' });

  console.log(JSON.stringify(R, null, 2));
  console.log('--- ERRORS (' + errors.length + ') ---');
  errors.slice(0, 25).forEach(e => console.log(e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
