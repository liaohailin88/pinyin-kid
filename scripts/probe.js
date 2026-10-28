// 题目生成器不变量检查：跑 120 题，验证没有"空选项 / 答案不在选项里 / 标签 undefined / 重复选项"
const { chromium } = require(process.env.TEMP + '/e2e/node_modules/playwright-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:8765/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const problems = [];
  const kinds = {};
  const cards = {};
  let lastSeq = 0;

  await page.evaluate(() => { location.hash = '#/mix'; });
  await page.waitForTimeout(700);

  for (let i = 0; i < 150; i++) {
    const q = await page.evaluate(() => {
      const q = window.__currentQ;
      if (!q) return null;
      return {
        seq: window.__qSeq || 0,
        kind: q.kind,
        answer: String(q.answer),
        opts: q.opts.map(o => String(o.v)),
        labels: q.opts.map(o => String(o.label)),
        glyph: (q.card && q.card.glyph) || '',
        listen: !!(q.card && q.card.listen),
        prompt: q.prompt,
        hasReveal: !!q.reveal
      };
    });
    if (!q) { problems.push(i + ': no question'); break; }
    if (q.seq === lastSeq) {
      // 没换题（结算弹窗/被暂停），重新进入挑战
      await page.evaluate(() => {
        const m = document.querySelector('.modal-mask');
        if (m) { const b = m.querySelectorAll('.btn'); if (b.length) b[b.length - 1].click(); }
      });
      await page.waitForTimeout(250);
      await page.evaluate(() => { location.hash = '#/home'; });
      await page.waitForTimeout(120);
      await page.evaluate(() => { location.hash = '#/mix'; });
      await page.waitForTimeout(500);
      lastSeq = 0;
      continue;
    }
    lastSeq = q.seq;
    kinds[q.kind] = (kinds[q.kind] || 0) + 1;
    cards[q.listen ? 'listen' : 'text'] = (cards[q.listen ? 'listen' : 'text'] || 0) + 1;

    if (q.opts.length < 3) problems.push(i + ' ' + q.kind + ': only ' + q.opts.length + ' opts');
    if (q.opts.indexOf(q.answer) < 0) problems.push(i + ' ' + q.kind + ': answer not in opts -> ' + q.answer + ' / ' + q.opts);
    if (new Set(q.opts).size !== q.opts.length) problems.push(i + ' ' + q.kind + ': dup opts ' + q.opts);
    if (q.labels.some(l => /undefined|null|NaN/.test(l))) problems.push(i + ' ' + q.kind + ': bad label ' + q.labels);
    if (/undefined|NaN/.test(q.glyph)) problems.push(i + ' ' + q.kind + ': bad glyph ' + q.glyph);
    if (q.listen && q.glyph !== '🔊') problems.push(i + ' ' + q.kind + ': listen glyph ' + q.glyph);
    if (q.listen && q.glyph.indexOf(q.answer) >= 0) problems.push(i + ' ' + q.kind + ': answer leaked on card');
    if (q.kind === 'tone' && !['1', '2', '3', '4'].includes(q.answer)) problems.push(i + ': tone answer ' + q.answer);
    if (q.kind === 'pin') {
      const isPair = q.answer.indexOf(' + ') >= 0;
      if (isPair && !q.listen) problems.push(i + ': split pin not listen card');
      if (!isPair && q.listen) problems.push(i + ': combine pin wrongly listen card');
      if (!isPair && q.glyph.indexOf('+') < 0) problems.push(i + ': combine card missing + -> ' + q.glyph);
    }

    await page.evaluate((ans) => {
      const b = Array.from(document.querySelectorAll('.opt')).find(x => x.dataset.v === ans);
      if (b) b.click();
    }, q.answer);
    await page.waitForTimeout(900);
  }

  // 拼读页单独多跑几次，确保两种模式都出现
  await page.evaluate(() => { location.hash = '#/pin'; });
  await page.waitForTimeout(600);
  let combos = 0, splits = 0;
  for (let i = 0; i < 24; i++) {
    const q = await page.evaluate(() => window.__currentQ && { a: String(window.__currentQ.answer), seq: window.__qSeq || 0 });
    if (q && q.a.indexOf(' + ') >= 0) splits++; else combos++;
    await page.evaluate((ans) => {
      const b = Array.from(document.querySelectorAll('.opt')).find(x => x.dataset.v === ans);
      if (b) b.click();
    }, q.a);
    await page.waitForTimeout(950);
    // 10 题后弹结算窗，重开一局
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(120);
    await page.evaluate(() => { location.hash = '#/pin'; });
    await page.waitForTimeout(420);
  }

  // 教读数据自检：呼读音全覆盖 + 拼一拼的拼音与生字库一致
  async function clearModals() {
    await page.evaluate(() => document.querySelectorAll('.modal-mask').forEach(n => n.remove()));
  }
  await clearModals();
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(150);
  await page.evaluate(() => { location.hash = '#/teach'; });
  await page.waitForTimeout(600);
  const iniSay = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('[data-ini]').forEach(b => {
      const s = b.querySelector('small');
      out[b.dataset.ini] = s ? s.textContent.trim() : '';
    });
    return out;
  });
  Object.keys(iniSay).forEach(k => { if (!iniSay[k]) problems.push('teach: 空呼读音 ini:' + k); });
  await clearModals();
  await page.locator('.tab', { hasText: '韵母' }).click();
  await page.waitForTimeout(500);
  const finSay = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('[data-fin]').forEach(b => {
      const s = b.querySelector('small');
      out[b.dataset.fin] = s ? s.textContent.trim() : '';
    });
    return out;
  });
  Object.keys(finSay).forEach(k => { if (!finSay[k]) problems.push('teach: 空呼读音 fin:' + k); });
  await clearModals();
  await page.locator('.tab', { hasText: '拼一拼' }).click();
  await page.waitForTimeout(500);
  const blendCheck = await page.evaluate(() => {
    const db = window.CHAR_DB.chars;
    return [...document.querySelectorAll('[data-bl]')].map(b => {
      const zi = b.childNodes[0].textContent.trim();
      const py = (b.querySelector('small') || {}).textContent || '';
      const hit = db.find(x => x.c === zi);
      return { zi, py, db: hit ? hit.p : '' };
    });
  });
  blendCheck.forEach((x, i) => {
    if (!x.py) problems.push('teach blend ' + i + ': 无拼音 ' + x.zi);
    if (x.db && x.db !== x.py) problems.push('teach blend ' + i + ': ' + x.zi + ' 拼音不符 ' + x.py + ' vs 库 ' + x.db);
  });
  const teach = { ini: Object.keys(iniSay).length, fin: Object.keys(finSay).length, blend: blendCheck.length };

  console.log(JSON.stringify({ kinds, cards, pinPage: { combos, splits }, teach, problems: problems.slice(0, 20), problemCount: problems.length }, null, 2));
  console.log('--- ERRORS (' + errors.length + ') ---');
  errors.slice(0, 10).forEach(e => console.log(e));
  await browser.close();
  process.exit(problems.length || errors.length ? 1 : 0);
})();
