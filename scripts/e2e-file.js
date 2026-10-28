// 直接双击打开（file://）是否可用
const { chromium } = require(process.env.TEMP + '/e2e/node_modules/playwright-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///F:/harness0916/pinyin-kid/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const R = {};
  R.tiles = await page.locator('.tile').count();
  await page.evaluate(() => { location.hash = '#/write'; });
  await page.waitForTimeout(4000);
  R.writeStroke = await page.locator('#strokeInfo').innerText().catch(() => '');
  R.writePaths = await page.locator('#hwHost svg path').count();
  R.bulkLoaded = await page.evaluate(() => !!(window.HANZI_STROKES && Object.keys(window.HANZI_STROKES).length));
  await page.evaluate(() => { location.hash = '#/chart'; });
  await page.waitForTimeout(500);
  R.chartCells = await page.locator('.pc-cell').count();
  await page.evaluate(() => { location.hash = '#/char'; });
  await page.waitForTimeout(400);
  await page.locator('#allChars').click();
  await page.waitForTimeout(600);
  R.charOpts = await page.locator('.opt').count();
  // 课文朗读：古诗 + 我的课文（懒加载 pinyin-pro 也要能读到本地文件）
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/text'; });
  await page.waitForTimeout(500);
  R.textCards = await page.locator('.tx-card').count();
  await page.locator('.tx-card').first().click();
  await page.waitForTimeout(400);
  R.textLines = await page.locator('.tl-line').count();
  await page.locator('#txBack').click();
  await page.waitForTimeout(300);
  await page.locator('.tab', { hasText: '我的课文' }).click();
  await page.waitForTimeout(200);
  await page.locator('#txTa').fill('春眠不觉晓，处处闻啼鸟。');
  await page.locator('#txGen').click();
  await page.waitForTimeout(2500);
  R.mineLines = await page.locator('.tl-line').count();
  R.minePy = await page.evaluate(() => [...document.querySelectorAll('.tl-line .u .py')].map(n => n.textContent).filter(Boolean).join(' '));
  // 拼音教读：三个 tab 都能出内容
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/teach'; });
  await page.waitForTimeout(600);
  R.teachIni = await page.locator('[data-ini]').count();
  R.teachBig = await page.locator('.tc-big').innerText();
  await page.locator('.tab', { hasText: '拼一拼' }).click();
  await page.waitForTimeout(400);
  R.teachBlend = await page.locator('.bl-item').count();
  R.teachWord = await page.locator('.tc-word').innerText();
  // file:// 下也要能加载内置语音（直接双击 index.html 的用法）
  R.voiceApi = await page.evaluate(() => !!window.VOICE && VOICE.available('female'));
  R.voiceIds = await page.evaluate(() => Object.keys(VOICE.list('female') || {}).length);
  await page.locator('#tcPlay').click();
  await page.waitForTimeout(4000);
  R.voicePlayed = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(e => /assets\/voice\/.*\.mp3$/.test(e.name)).length);
  R.voiceStats = await page.evaluate(() => VOICE.stats());
  console.log(JSON.stringify(R, null, 2));
  console.log('--- ERRORS (' + errors.length + ') ---');
  errors.slice(0, 12).forEach(e => console.log(e));
  await browser.close();
})();
