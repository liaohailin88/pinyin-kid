// 线上地址验收：node scripts/e2e-live.js <url> [proxy]
// 检查：无报错、10 个入口、拼音地图格子数、认字出题、笔顺 SVG 真的画出来
const { chromium } = require(process.env.TEMP + '/e2e/node_modules/playwright-core');

const URL_ARG = process.argv[2];
const PROXY = process.argv[3] || '';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (!URL_ARG) {
  console.error('usage: node scripts/e2e-live.js <url> [proxy]');
  process.exit(2);
}

(async () => {
  const args = ['--no-sandbox'];
  if (PROXY) args.push('--proxy-server=' + PROXY);

  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => errors.push('reqfail: ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')));

  const R = { url: URL_ARG, proxy: PROXY || '(direct)' };

  async function dismiss() {
    for (let i = 0; i < 4; i++) {
      if (!(await page.locator('.modal-mask').count())) return;
      await page.locator('.modal .btn').last().click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  async function home() {
    await dismiss();
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(300);
  }

  const resp = await page.goto(URL_ARG, { waitUntil: 'networkidle', timeout: 60000 });
  R.httpStatus = resp ? resp.status() : 0;
  R.title = await page.title();
  await page.waitForTimeout(400);
  R.tiles = await page.locator('.tile').count();

  // 拼音地图（纯前端数据，不依赖网络）
  await page.locator('.tile', { hasText: '拼音地图' }).click();
  await page.waitForTimeout(300);
  R.chartCells = await page.locator('.pc-cell').count();
  await home();

  // 认字卡：需要 data/characters.js
  await page.locator('.tile', { hasText: '认字卡' }).click();
  await page.waitForTimeout(300);
  R.unitRows = await page.locator('.unit-row').count();
  await page.locator('#allChars').click();
  await page.waitForTimeout(600);
  await dismiss();
  R.charQ = await page.evaluate(() => (window.__currentQ ? { zi: window.__currentQ.card.zi, ans: window.__currentQ.answer } : null));
  await home();

  // 笔顺描红：需要 assets/hanzi-writer.min.js + assets/hanzi/*.json（XHR 或 data/hanzi-all.js 兜底）
  await page.evaluate(() => { location.hash = '#/write'; });
  await page.waitForTimeout(3000);
  R.writePaths = await page.locator('#hwHost svg path').count();
  R.strokeInfo = await page.locator('#strokeInfo').innerText().catch(() => '');
  R.bulkLoaded = await page.evaluate(() => !!(window.HANZI_STROKES && Object.keys(window.HANZI_STROKES).length > 600));

  // 课文朗读：data/texts.js（古诗注音）+ assets/pinyin-pro.min.js（自动注音，用到才加载）
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/text'; });
  await page.waitForTimeout(600);
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
  await page.waitForTimeout(5000);   // 首次要下载 318 KB 的 pinyin-pro
  R.mineLines = await page.locator('.tl-line').count();
  R.minePy = await page.evaluate(() => [...document.querySelectorAll('.tl-line .u .py')].map(n => n.textContent).filter(Boolean).join(' '));

  // 拼音教读：声母 23 / 韵母 24 / 拼一拼 30
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(200);
  await page.locator('.tile', { hasText: '拼音教读' }).click();
  await page.waitForTimeout(600);
  R.teachIni = await page.locator('[data-ini]').count();
  R.teachBig = await page.locator('.tc-big').innerText();
  R.teachRhyme = await page.locator('.tc-rhyme').innerText();
  await page.locator('.tab', { hasText: '韵母' }).click();
  await page.waitForTimeout(400);
  R.teachFin = await page.locator('[data-fin]').count();
  await page.locator('.tab', { hasText: '拼一拼' }).click();
  await page.waitForTimeout(400);
  R.teachBlend = await page.locator('[data-bl]').count();
  await page.locator('[data-bl="0"]').click();
  await page.waitForTimeout(900);
  R.blend = await page.evaluate(() => ({
    parts: [...document.querySelectorAll('.bl-item b')].map(n => n.textContent),
    word: document.querySelector('.tc-word').innerText,
    hot: document.querySelectorAll('.bl-item.hot').length
  }));
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(200);

  // 声音角色：女声 / 男声 / 童声 换的是音调，检查真的传给了 TTS
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(500);
  R.voiceKinds = await page.locator('[data-kind]').count();
  R.voiceChips = await page.locator('.vchip').count();
  await page.evaluate(() => {
    window.__said = [];
    try { window.speechSynthesis.speak = function (u) { window.__said.push({ p: u.pitch, r: u.rate }); }; } catch (e) { }
  });
  R.voice = {};
  for (const k of ['female', 'male', 'child']) {
    await page.locator('[data-kind="' + k + '"]').click();
    await page.waitForTimeout(300);
    R.voice[k] = await page.evaluate(() => {
      var s = (window.__said || []).slice(-1)[0];
      return { pitch: s ? +s.p.toFixed(2) : null, saved: (JSON.parse(localStorage.getItem('pinyin-planet-v1') || '{}').settings || {}).voiceKind };
    });
  }

  // 手机尺寸再跑一次首页
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));
  await m.goto(URL_ARG, { waitUntil: 'networkidle', timeout: 60000 });
  await m.waitForTimeout(400);
  R.phoneTiles = await m.locator('.tile').count();

  await browser.close();

  console.log(JSON.stringify(R, null, 2));
  console.log('--- ERRORS (' + errors.length + ') ---');
  [...new Set(errors)].slice(0, 20).forEach(e => console.log(e));
  process.exit(0);
})();
