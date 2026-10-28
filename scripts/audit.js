// 布局体检：溢出、可点区域尺寸、字体、对比度粗查
const { chromium } = require(process.env.TEMP + '/e2e/node_modules/playwright-core');
const URL = 'http://127.0.0.1:8765/index.html';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const VIEWS = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'tablet', w: 820, h: 1180 },
  { name: 'desktop', w: 1440, h: 900 }
];
const ROUTES = ['#/home', '#/chart', '#/initial', '#/char', '#/write', '#/read', '#/badges', '#/settings'];

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const out = [];

  for (const v of VIEWS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.setItem('pinyin-planet-welcomed', '1'));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);

    for (const r of ROUTES) {
      await page.evaluate(h => { location.hash = h; }, r);
      await page.waitForTimeout(r === '#/write' ? 2200 : 400);
      const res = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflowX = doc.scrollWidth - doc.clientWidth;
        // 找横向溢出的元素
        const bad = [];
        document.querySelectorAll('#screen *').forEach(n => {
          const b = n.getBoundingClientRect();
          if (b.width < 1) return;
          if (b.right > doc.clientWidth + 1.5 || b.left < -1.5) {
            bad.push(n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ')[0] + ' [' + Math.round(b.left) + ',' + Math.round(b.right) + ']');
          }
        });
        // 可点元素尺寸
        const small = [];
        document.querySelectorAll('button, a, [role=button], input[type=checkbox], label').forEach(n => {
          const b = n.getBoundingClientRect();
          if (b.width < 1 || b.height < 1) return;
          if (b.height < 40 || b.width < 40) {
            small.push(n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ')[0] + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
          }
        });
        // 字号
        const tiny = [];
        document.querySelectorAll('#screen *').forEach(n => {
          if (!n.textContent || !n.textContent.trim()) return;
          if (n.children.length) return;
          const fs = parseFloat(getComputedStyle(n).fontSize);
          if (fs < 11) tiny.push(n.tagName.toLowerCase() + '.' + (n.className || '').toString().split(' ')[0] + ' ' + fs + 'px');
        });
        return { overflowX, bad: bad.slice(0, 6), small: small.slice(0, 8), tiny: [...new Set(tiny)].slice(0, 6) };
      });
      out.push({ view: v.name, route: r, ...res });
    }
    await page.close();
  }

  console.log('view    route        overflowX  bad  small  tiny');
  out.forEach(o => {
    const flag = (o.overflowX > 0 || o.bad.length || o.small.length || o.tiny.length) ? '  <-- ' : '';
    console.log(
      o.view.padEnd(8) + o.route.padEnd(12) +
      String(o.overflowX).padStart(3) + '  ' +
      String(o.bad.length).padStart(3) + '  ' +
      String(o.small.length).padStart(3) + '  ' +
      String(o.tiny.length).padStart(3) + flag
    );
    o.bad.forEach(x => console.log('    overflow: ' + x));
    o.small.forEach(x => console.log('    small:    ' + x));
    o.tiny.forEach(x => console.log('    tiny:     ' + x));
  });
  await browser.close();
})();
