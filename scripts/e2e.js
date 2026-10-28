// 端到端检查（含截图）：验证无报错、三条路线可用、答题计分正确
const { chromium } = require(process.env.TEMP + '/e2e/node_modules/playwright-core');
const fs = require('fs');

const URL = process.env.E2E_URL || 'http://127.0.0.1:8765/index.html';
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

  // ---- 课文朗读 ----
  await page.evaluate(() => { location.hash = '#/text'; });
  await page.waitForTimeout(500);
  R.textTabs = await page.locator('.tabbar .tab').count();
  R.textCards = await page.locator('.tx-card').count();
  await shot('15-text-list');
  await page.locator('.tx-card').first().click();
  await page.waitForTimeout(600);
  R.textTitle = await page.locator('.tx-head h2').innerText();
  R.textLines = await page.locator('.tl-line').count();
  R.textUnits = await page.locator('.tl-line .u').count();
  R.textPinyin = await page.locator('.tl-line .u .py').first().innerText();
  const starsBefore = Number(await page.locator('#starCount').innerText());
  await page.locator('#txPlay').click();
  await page.waitForTimeout(1600);
  R.textCur = await page.locator('.tl-line.cur').count();
  R.textHot = await page.locator('.tl-line.cur .u.hot').count();
  await shot('16-text-read');
  await page.waitForTimeout(14000);   // 无语音环境下按字扫一遍，4 句约 12 秒
  R.textStars = [starsBefore, Number(await page.locator('#starCount').innerText())];
  R.textReads = await page.evaluate(() => (JSON.parse(localStorage.getItem('pinyin-planet-v1')) || {}).readTexts);
  await page.locator('#txPy').click();
  await page.waitForTimeout(200);
  R.textNoPy = await page.locator('.tx-body.nopy').count();
  await page.locator('#txPy').click();
  await page.locator('#txBack').click();
  await page.waitForTimeout(300);
  // 课文句子 tab
  await page.locator('.tab', { hasText: '课文句子' }).click();
  await page.waitForTimeout(300);
  R.textSents = await page.locator('.tx-sent').count();
  R.textGroups = await page.locator('.tx-group').count();
  await shot('17-text-lessons');
  // 我的课文 tab：粘贴 → 自动注音
  await page.locator('.tab', { hasText: '我的课文' }).click();
  await page.waitForTimeout(300);
  await page.locator('#txTa').fill('天气凉了，树叶黄了。\n一片片叶子从树上落下来。');
  await page.locator('#txGen').click();
  await page.waitForTimeout(2500);
  R.mineLines = await page.locator('.tl-line').count();
  R.minePy = await page.evaluate(() => [...document.querySelectorAll('.tl-line .u .py')].map(n => n.textContent).filter(Boolean).join(' '));
  R.mineUnits = await page.locator('.tl-line .u').count();
  await shot('18-text-mine');

  // ---- 拼音教读 ----
  await page.evaluate(() => { location.hash = '#/teach'; });
  await page.waitForTimeout(600);
  R.teachTabs = await page.locator('#tcTabs .tab').count();
  R.teachIniChips = await page.locator('[data-ini]').count();
  R.teachBig = await page.locator('.tc-big').innerText();
  R.teachRhyme = await page.locator('.tc-rhyme').innerText();
  R.teachTag = await page.locator('.tc-tag').innerText();
  R.teachEx = await page.locator('.ex-chip').count();
  await shot('23-teach-initial');
  await page.locator('[data-ini="m"]').click();
  await page.waitForTimeout(500);
  R.teachIniM = await page.locator('.tc-big').innerText();
  await page.locator('#tcNext').click();
  await page.waitForTimeout(400);
  R.teachNext = await page.locator('.tc-big').innerText();
  // 韵母
  await page.locator('.tab', { hasText: '韵母' }).click();
  await page.waitForTimeout(600);
  R.teachFinChips = await page.locator('[data-fin]').count();
  await page.locator('[data-fin="üe"]').click();
  await page.waitForTimeout(500);
  R.teachFinBig = await page.locator('.tc-big').innerText();
  R.teachFinSay = await page.locator('.tc-hw').innerText();
  await shot('24-teach-final');
  // 拼一拼
  await page.locator('.tab', { hasText: '拼一拼' }).click();
  await page.waitForTimeout(600);
  R.teachBlChips = await page.locator('[data-bl]').count();
  R.teachBlItems = await page.locator('.bl-item').count();
  R.blendFirst = await page.evaluate(() => ({
    parts: [...document.querySelectorAll('.bl-item b')].map(n => n.textContent),
    word: (document.querySelector('.tc-word') || {}).innerText,
    chip: (document.querySelector('[data-bl] small') || {}).textContent
  }));
  await page.locator('[data-bl="29"]').click();   // q + ü → 去
  await page.waitForTimeout(800);
  R.blendQu = await page.evaluate(() => ({
    parts: [...document.querySelectorAll('.bl-item b')].map(n => n.textContent),
    hot: document.querySelectorAll('.bl-item.hot').length
  }));
  R.blendAll = await page.evaluate(() => [...document.querySelectorAll('[data-bl]')].map(b => ({
    zi: b.textContent.replace(/\s.*$/, ''),
    py: b.querySelector('small').textContent
  })));
  await shot('25-teach-blend');
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(300);

  // ---- 设置 / 徽章 ----
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(500);
  R.settingRows = await page.locator('.unit-row').count();
  R.voiceKinds = await page.locator('[data-kind]').count();
  R.voiceChips = await page.locator('.vchip').count();
  await page.evaluate(() => {
    window.__said = [];
    try {
      window.speechSynthesis.speak = function (u) { window.__said.push({ t: u.text, p: u.pitch, r: u.rate }); };
    } catch (e) { window.__sayErr = String(e); }
  });
  async function pickKind(k) {
    await page.locator('[data-kind="' + k + '"]').click();
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      var st = (JSON.parse(localStorage.getItem('pinyin-planet-v1')) || {}).settings || {};
      var s = (window.__said || []).slice(-1)[0] || null;
      return { saved: st.voiceKind, pitch: s ? +s.p.toFixed(3) : null, rate: s ? +s.r.toFixed(3) : null, info: (document.querySelector('#vInfo') || {}).textContent };
    });
  }
  R.vkFemale = await pickKind('female');
  R.vkMale = await pickKind('male');
  R.vkChild = await pickKind('child');
  if (R.voiceChips > 1) {
    await page.locator('.vchip').nth(1).click();
    await page.waitForTimeout(300);
    R.chipPick = await page.evaluate(() => ({
      saved: ((JSON.parse(localStorage.getItem('pinyin-planet-v1')) || {}).settings || {}).voiceName,
      info: (document.querySelector('#vInfo') || {}).textContent
    }));
  }
  await shot('19-settings-voice');

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
