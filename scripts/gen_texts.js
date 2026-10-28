/* 生成 data/texts.js：课文朗读数据（古诗全文 + 课本短句分组）
 * 用法：node scripts/gen_texts.js
 * 依赖：assets/pinyin-pro.min.js（本地已内置，MIT）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const pinyinPro = require(path.join(ROOT, 'assets/pinyin-pro.min.js'));

/* ---------------- 古诗（全部为公有领域作品，可放全文） ---------------- */
const POEMS = [
  { id: 'p01', title: '咏鹅', dynasty: '唐', author: '骆宾王', book: '上册', where: '课文',
    lines: ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'] },
  { id: 'p02', title: '江南', dynasty: '汉', author: '汉乐府', book: '上册', where: '课文',
    lines: ['江南可采莲，', '莲叶何田田。', '鱼戏莲叶间。', '鱼戏莲叶东，', '鱼戏莲叶西，', '鱼戏莲叶南，', '鱼戏莲叶北。'] },
  { id: 'p03', title: '画', dynasty: '', author: '', book: '上册', where: '课文',
    lines: ['远看山有色，', '近听水无声。', '春去花还在，', '人来鸟不惊。'] },
  { id: 'p04', title: '悯农（其二）', dynasty: '唐', author: '李绅', book: '上册', where: '课本古诗',
    lines: ['锄禾日当午，', '汗滴禾下土。', '谁知盘中餐，', '粒粒皆辛苦。'] },
  { id: 'p05', title: '古朗月行（节选）', dynasty: '唐', author: '李白', book: '上册', where: '课本古诗',
    lines: ['小时不识月，', '呼作白玉盘。', '又疑瑶台镜，', '飞在青云端。'] },
  { id: 'p06', title: '风', dynasty: '唐', author: '李峤', book: '上册', where: '课本古诗',
    lines: ['解落三秋叶，', '能开二月花。', '过江千尺浪，', '入竹万竿斜。'] },
  { id: 'p07', title: '春晓', dynasty: '唐', author: '孟浩然', book: '下册', where: '语文园地',
    lines: ['春眠不觉晓，', '处处闻啼鸟。', '夜来风雨声，', '花落知多少。'] },
  { id: 'p08', title: '赠汪伦', dynasty: '唐', author: '李白', book: '下册', where: '语文园地',
    lines: ['李白乘舟将欲行，', '忽闻岸上踏歌声。', '桃花潭水深千尺，', '不及汪伦送我情。'] },
  { id: 'p09', title: '静夜思', dynasty: '唐', author: '李白', book: '下册', where: '课文',
    lines: ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'] },
  { id: 'p10', title: '寻隐者不遇', dynasty: '唐', author: '贾岛', book: '下册', where: '语文园地',
    lines: ['松下问童子，', '言师采药去。', '只在此山中，', '云深不知处。'] },
  { id: 'p11', title: '池上', dynasty: '唐', author: '白居易', book: '下册', where: '课文',
    lines: ['小娃撑小艇，', '偷采白莲回。', '不解藏踪迹，', '浮萍一道开。'] },
  { id: 'p12', title: '小池', dynasty: '宋', author: '杨万里', book: '下册', where: '课文',
    lines: ['泉眼无声惜细流，', '树阴照水爱晴柔。', '小荷才露尖尖角，', '早有蜻蜓立上头。'] },
  { id: 'p13', title: '画鸡', dynasty: '明', author: '唐寅', book: '下册', where: '语文园地',
    lines: ['头上红冠不用裁，', '满身雪白走将来。', '平生不敢轻言语，', '一叫千门万户开。'] }
];

/* 多音字人工校正（键为"字"，值为该字在此处的读音；只对古诗生效） */
const POEM_FIX = {
  '曲': 'qū',    // 曲项向天歌
  '冠': 'guān',  // 头上红冠
  '露': 'lù',    // 小荷才露尖尖角
  '藏': 'cáng',  // 不解藏踪迹
  '行': 'xíng',  // 李白乘舟将欲行
  '斜': 'xié'    // 入竹万竿斜
};

function annotate(text, fix) {
  const arr = pinyinPro.pinyin(text, { type: 'all' });
  const out = [];
  let src = text;
  arr.forEach(function (o, i) {
    const origin = o.origin || '';
    let p = o.pinyin || '';
    if (fix && src.indexOf(origin) >= 0 && Object.prototype.hasOwnProperty.call(fix, origin)) p = fix[origin];
    out.push([origin, p]);
  });
  // 对齐自检
  if (out.length !== src.length) {
    throw new Error('注音对齐失败: "' + src + '" ' + out.length + ' vs ' + src.length);
  }
  return out;
}

/* ---------------- 读取生字库里的课本短句 ---------------- */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/characters.js'), 'utf8'), ctx);
const DB = ctx.window.CHAR_DB;

const unitTitle = {};
DB.units.forEach(function (u) { unitTitle[u.id] = { title: u.title, book: u.book }; });

const byUnit = {};
(DB.sentences || []).forEach(function (s) {
  (byUnit[s.unit] = byUnit[s.unit] || []).push(s);
});

const groups = [];
DB.units.forEach(function (u) {
  const list = byUnit[u.id];
  if (!list || !list.length) return;
  groups.push({
    unit: u.id,
    title: u.title,
    book: u.book,
    lines: list.map(function (s) { return { cn: s.cn, py: annotate(s.cn, null) }; })
  });
});

/* ---------------- 输出 ---------------- */
const poems = POEMS.map(function (p) {
  return {
    id: p.id, title: p.title, dynasty: p.dynasty, author: p.author,
    book: p.book, where: p.where, n: p.lines.length,
    lines: p.lines.map(function (ln) { return { cn: ln, py: annotate(ln, POEM_FIX) }; })
  };
});

const out = {
  meta: {
    version: 1,
    poems: poems.length,
    poemLines: poems.reduce(function (a, p) { return a + p.n; }, 0),
    groups: groups.length,
    sentences: groups.reduce(function (a, g) { return a + g.lines.length; }, 0),
    note: '古诗均为公有领域作品，内置全文；课文原文受版权保护，这里只内置课本短句，' +
      '课文全文可在「我的课文」里粘贴任意内容，自动注音后逐句朗读。'
  },
  poems: poems,
  groups: groups
};

const target = path.join(ROOT, 'data/texts.js');
fs.writeFileSync(target,
  '/* 自动生成：由 scripts/gen_texts.js 编译，请勿手改 */\n' +
  'window.LESSON_TEXTS = ' + JSON.stringify(out) + ';\n', 'utf8');

console.log('古诗 ' + out.meta.poems + ' 首 / ' + out.meta.poemLines + ' 句');
console.log('课文短句 ' + out.meta.sentences + ' 句 / ' + out.meta.groups + ' 组');
console.log('输出 ' + target + '  ' + Math.round(fs.statSync(target).size / 1024) + ' KB');

// 抽查几条，方便肉眼核对
poems.slice(0, 3).forEach(function (p) {
  console.log('· ' + p.title + ' : ' + p.lines.map(function (l) {
    return l.py.map(function (x) { return x[1]; }).filter(Boolean).join(' ');
  }).join(' / '));
});
