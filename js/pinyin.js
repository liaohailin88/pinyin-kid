/* =========================================================================
 * 拼音星球 · 拼音引擎
 * 纯数据 + 纯函数，无依赖；浏览器直接 <script> 引入，Node 亦可 require。
 * 覆盖：23 声母 / 24 韵母 / 16 整体认读音节 / 带调音节拼写规则 / 标调规则
 * ========================================================================= */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Pinyin = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- 声母 23 ---------------- */
  // 每个声母带：拼音、名称、口诀、例音节、易混
  var INITIALS = [
    { p: 'b', name: 'bo', rhyme: '右下半圆 b b b，像个小勺把水舀', sample: 'ba', tip: '嘴唇闭一下，突然张开，送气很轻' },
    { p: 'p', name: 'po', rhyme: '右上半圆 p p p，吹泡泡时噗噗噗', sample: 'pa', tip: '跟 b 口型一样，但要用力送气，吹动纸条' },
    { p: 'm', name: 'mo', rhyme: '两个门洞 m m m', sample: 'ma', tip: '双唇闭住，声音从鼻子出来' },
    { p: 'f', name: 'fo', rhyme: '一根拐棍 f f f，上齿咬下唇', sample: 'fa', tip: '上牙轻轻碰下嘴唇，让气流摩擦出来' },
    { p: 'd', name: 'de', rhyme: '左下半圆 d d d，像个小马蹄', sample: 'da', tip: '舌尖顶住上牙床，一下弹开' },
    { p: 't', name: 'te', rhyme: '伞把朝下 t t t，舌尖一弹送气', sample: 'ta', tip: '跟 d 一样，但要有力送气' },
    { p: 'n', name: 'ne', rhyme: '一个门洞 n n n，鼻子出气', sample: 'na', tip: '舌尖抵上牙床，声音从鼻子出来' },
    { p: 'l', name: 'le', rhyme: '一根小棍 l l l，舌尖往上卷', sample: 'la', tip: '舌尖抵上牙床，气流从舌两边出来' },
    { p: 'g', name: 'ge', rhyme: '像个鸽子 g g g，舌根往后缩', sample: 'ga', tip: '舌根抵住软腭，一下放开' },
    { p: 'k', name: 'ke', rhyme: '像挺机枪 k k k，用力送气', sample: 'ka', tip: '跟 g 一样，但要送气' },
    { p: 'h', name: 'he', rhyme: '像把椅子 h h h，哈气暖暖的', sample: 'ha', tip: '舌根靠近软腭，像哈气' },
    { p: 'j', name: 'ji', rhyme: '像只小鸡 j j j，看见 ü 就摘眼镜', sample: 'ji', tip: '舌面前部抵住硬腭' },
    { p: 'q', name: 'qi', rhyme: '像面小旗 q q q，送气比 j 强', sample: 'qi', tip: '跟 j 一样，但要送气' },
    { p: 'x', name: 'xi', rhyme: '像个大叉 x x x，轻轻擦出来', sample: 'xi', tip: '舌面靠近硬腭，气流摩擦' },
    { p: 'z', name: 'zi', rhyme: '像个数字 2 z z z，舌尖平放', sample: 'za', tip: '舌尖抵住上齿背，平舌' },
    { p: 'c', name: 'ci', rhyme: '半个圆圈 c c c，平舌送气', sample: 'ca', tip: '跟 z 一样，但要送气' },
    { p: 's', name: 'si', rhyme: '半个 8 字 s s s，像条小蛇', sample: 'sa', tip: '舌尖靠近上齿背，摩擦出气' },
    { p: 'zh', name: 'zhi', rhyme: 'z 加 h，舌尖翘起来', sample: 'zha', tip: '舌尖上翘抵住硬腭前部' },
    { p: 'ch', name: 'chi', rhyme: 'c 加 h，翘舌送气', sample: 'cha', tip: '跟 zh 一样，但要送气' },
    { p: 'sh', name: 'shi', rhyme: 's 加 h，舌头翘翘', sample: 'sha', tip: '舌尖上翘靠近硬腭前部，摩擦' },
    { p: 'r', name: 'ri', rhyme: '像棵小苗 r r r，舌头翘翘带点卷', sample: 're', tip: '舌尖上翘，声带振动' },
    { p: 'y', name: 'yi', rhyme: '像个小树杈 y y y', sample: 'ya', tip: 'y 是 i 的变形，读音同 i' },
    { p: 'w', name: 'wu', rhyme: '像两座小山 w w w', sample: 'wa', tip: 'w 是 u 的变形，读音同 u' }
  ];

  /* ---------------- 韵母 24 ---------------- */
  // form: 跟在声母后面写成什么； alone: 单独成音节怎么写
  var FINALS = [
    { p: 'a', form: 'a', alone: 'a', kind: '单韵母', rhyme: '张大嘴巴 a a a', tip: '嘴巴张到最大' },
    { p: 'o', form: 'o', alone: 'o', kind: '单韵母', rhyme: '圆圆嘴巴 o o o', tip: '嘴唇收圆' },
    { p: 'e', form: 'e', alone: 'e', kind: '单韵母', rhyme: '扁扁嘴巴 e e e', tip: '嘴角往两边拉' },
    { p: 'i', form: 'i', alone: 'yi', kind: '单韵母', rhyme: '牙齿对齐 i i i', tip: '嘴角往两边咧开' },
    { p: 'u', form: 'u', alone: 'wu', kind: '单韵母', rhyme: '嘴巴突出 u u u', tip: '嘴唇收圆向前突' },
    { p: 'ü', form: 'ü', alone: 'yu', kind: '单韵母', rhyme: '嘴巴扁圆 ü ü ü，小鱼吐泡泡', tip: '先发 i，再把嘴唇收圆' },
    { p: 'ai', form: 'ai', alone: 'ai', kind: '复韵母', rhyme: 'a 加 i，阿姨爱我', tip: '从 a 滑到 i' },
    { p: 'ei', form: 'ei', alone: 'ei', kind: '复韵母', rhyme: 'e 加 i，用力喊 ei', tip: '从 e 滑到 i' },
    { p: 'ui', form: 'ui', alone: 'ui', kind: '复韵母', rhyme: 'u 加 i，围巾围围', tip: '从 u 滑到 i，标调标在 i 上' },
    { p: 'ao', form: 'ao', alone: 'ao', kind: '复韵母', rhyme: 'a 加 o，小猫喵喵', tip: '从 a 滑到 o' },
    { p: 'ou', form: 'ou', alone: 'ou', kind: '复韵母', rhyme: 'o 加 u，藕片欧欧', tip: '从 o 滑到 u' },
    { p: 'iu', form: 'iu', alone: 'iu', kind: '复韵母', rhyme: 'i 加 u，游泳游游', tip: '从 i 滑到 u，标调标在 u 上' },
    { p: 'ie', form: 'ie', alone: 'ye', kind: '复韵母', rhyme: 'i 加 e，树叶叶叶', tip: '从 i 滑到 e' },
    { p: 'üe', form: 'üe', alone: 'yue', kind: '复韵母', rhyme: 'ü 加 e，月儿圆圆', tip: '先 ü 后 e，j q x 后写 ue' },
    { p: 'er', form: 'er', alone: 'er', kind: '特殊韵母', rhyme: 'e 加 r，耳朵耳朵', tip: 'er 不和声母拼，自己成音节' },
    { p: 'an', form: 'an', alone: 'an', kind: '鼻韵母', rhyme: 'a 加 n，天安门啊', tip: '前鼻音，舌尖抵上牙床' },
    { p: 'en', form: 'en', alone: 'en', kind: '鼻韵母', rhyme: 'e 加 n，摁门铃嗯', tip: '前鼻音，舌尖抵上牙床' },
    { p: 'in', form: 'in', alone: 'yin', kind: '鼻韵母', rhyme: 'i 加 n，拼音拼拼', tip: '前鼻音，嘴角咧开' },
    { p: 'un', form: 'un', alone: 'wen', kind: '鼻韵母', rhyme: 'u 加 n，白云朵朵', tip: '前鼻音，嘴唇收圆' },
    { p: 'ün', form: 'ün', alone: 'yun', kind: '鼻韵母', rhyme: 'ü 加 n，白云云云', tip: '前鼻音，先 ü 再收 n；j q x 后写 un' },
    { p: 'ang', form: 'ang', alone: 'ang', kind: '鼻韵母', rhyme: 'a 加 ng，昂首挺胸', tip: '后鼻音，舌根后缩' },
    { p: 'eng', form: 'eng', alone: 'eng', kind: '鼻韵母', rhyme: 'e 加 ng，台灯亮亮', tip: '后鼻音，舌根后缩' },
    { p: 'ing', form: 'ing', alone: 'ying', kind: '鼻韵母', rhyme: 'i 加 ng，老鹰飞飞', tip: '后鼻音，嘴角咧开' },
    { p: 'ong', form: 'ong', alone: 'ong', kind: '鼻韵母', rhyme: 'o 加 ng，钟声响响', tip: '后鼻音，嘴唇圆' },
    /* 复合韵母 / 鼻韵母（教材不单列，但作为带调音节的一部分出现，用于拼读拆解） */
    { p: 'ia', form: 'ia', alone: 'ya', kind: '复合韵母', rhyme: 'i 加 a，鸭子嘎嘎', tip: '先 i 后 a，只跟 j q x 拼' },
    { p: 'iao', form: 'iao', alone: 'yao', kind: '复合韵母', rhyme: 'i 加 ao，小鸟飞飞', tip: '先 i 后 ao' },
    { p: 'ian', form: 'ian', alone: 'yan', kind: '鼻韵母', rhyme: 'i 加 an，蓝天蓝蓝', tip: '前鼻音' },
    { p: 'iang', form: 'iang', alone: 'yang', kind: '鼻韵母', rhyme: 'i 加 ang，太阳阳阳', tip: '后鼻音' },
    { p: 'iong', form: 'iong', alone: 'yong', kind: '鼻韵母', rhyme: 'i 加 ong，小熊熊熊', tip: '后鼻音' },
    { p: 'ua', form: 'ua', alone: 'wa', kind: '复合韵母', rhyme: 'u 加 a，青蛙呱呱', tip: '先 u 后 a' },
    { p: 'uo', form: 'uo', alone: 'wo', kind: '复合韵母', rhyme: 'u 加 o，花朵朵朵', tip: '先 u 后 o' },
    { p: 'uai', form: 'uai', alone: 'wai', kind: '复合韵母', rhyme: 'u 加 ai，快乐快快', tip: '先 u 后 ai' },
    { p: 'uan', form: 'uan', alone: 'wan', kind: '鼻韵母', rhyme: 'u 加 an，玩具玩玩', tip: '前鼻音' },
    { p: 'uang', form: 'uang', alone: 'wang', kind: '鼻韵母', rhyme: 'u 加 ang，眼睛亮亮', tip: '后鼻音' },
    { p: 'üan', form: 'üan', alone: 'yuan', kind: '鼻韵母', rhyme: 'ü 加 an，圆圈圆圆', tip: 'j q x 后写 uan' },
    { p: 'ue', form: 'ue', alone: 'yue', kind: '复合韵母', rhyme: 'ü 加 e 的省写，音乐乐', tip: '只出现在 j q x y 后（jue que xue yue）' }
  ];

  /* ---------------- 整体认读音节 16 ---------------- */
  var WHOLE = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'];

  var WHOLE_TIP = {
    zhi: 'zh + i，舌尖翘起，整体读', chi: 'ch + i，翘舌送气，整体读',
    shi: 'sh + i，翘舌轻擦，整体读', ri: 'r + i，翘舌带卷，整体读',
    zi: 'z + i，平舌，整体读', ci: 'c + i，平舌送气，整体读', si: 's + i，平舌摩擦，整体读',
    yi: 'i 的大名，直接读 yi', wu: 'u 的大名，直接读 wu', yu: 'ü 的大名，直接读 yu（去掉两点）',
    ye: 'ie 的大名，直接读 ye', yue: 'üe 的大名，直接读 yue',
    yuan: 'üan 的大名，直接读 yuan', yin: 'in 的大名，直接读 yin',
    yun: 'ün 的大名，直接读 yun', ying: 'ing 的大名，直接读 ying'
  };

  /* ---------------- 声母 × 韵母 组合表 ---------------- */
  // 只列真实存在的音节组合（含少数极少用但教材出现的）
  var COMBO = {
    b: ['a', 'o', 'ai', 'ei', 'ao', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'in', 'ing', 'u'],
    p: ['a', 'o', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'in', 'ing', 'u'],
    m: ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'in', 'ing', 'u'],
    f: ['a', 'o', 'ei', 'an', 'en', 'ang', 'eng', 'u'],
    d: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'ing', 'u', 'ui', 'uan', 'un'],
    t: ['a', 'e', 'ai', 'ao', 'ou', 'an', 'ang', 'eng', 'i', 'ie', 'ing', 'u', 'ui', 'uan', 'un'],
    n: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'in', 'ing', 'u', 'ü', 'üe', 'uan', 'un'],
    l: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'in', 'ing', 'u', 'ü', 'üe', 'uan', 'un'],
    g: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang'],
    k: ['a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang'],
    h: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang'],
    j: ['i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
    q: ['i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
    x: ['i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
    z: ['i', 'a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'uo', 'ui', 'uan', 'un'],
    c: ['i', 'a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'uo', 'ui', 'uan', 'un'],
    s: ['i', 'a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'uo', 'ui', 'uan', 'un'],
    zh: ['i', 'a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang'],
    ch: ['i', 'a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang'],
    sh: ['i', 'a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang'],
    r: ['i', 'e', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'u', 'uo', 'ui', 'uan', 'un'],
    y: ['i', 'a', 'e', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'u', 'ue', 'uan', 'un', 'ing', 'in'],
    w: ['u', 'a', 'o', 'ai', 'ei', 'an', 'en', 'ang', 'eng']
  };

  // 组合时韵母需要变形的情况
  //   j/q/x + ü 系列 → 去掉两点
  //   y + i/u/ü 系列 / w + u 系列 → 见 build()
  var JQX = { j: 1, q: 1, x: 1 };

  /* ---------------- 声调 ---------------- */
  var TONES = [
    { n: 1, name: '第一声', alias: '阴平', sign: 'ˉ', contour: '55', color: '#ff4d4f', hint: '又平又长，像开车走在直路上', emoji: '➖' },
    { n: 2, name: '第二声', alias: '阳平', sign: 'ˊ', contour: '35', color: '#fa8c16', hint: '往上扬，像问“什么？”', emoji: '↗' },
    { n: 3, name: '第三声', alias: '上声', sign: 'ˇ', contour: '214', color: '#52c41a', hint: '先降后升，像点头', emoji: '✔' },
    { n: 4, name: '第四声', alias: '去声', sign: 'ˋ', contour: '51', color: '#1890ff', hint: '又快又重往下掉，像生气说“不！”', emoji: '↘' },
    { n: 0, name: '轻声', alias: '轻声', sign: '', contour: '0', color: '#8c8c8c', hint: '又轻又短，一带而过', emoji: '·' }
  ];

  var TONE_MARK = {
    a: ['a', 'ā', 'á', 'ǎ', 'à'],
    o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
    e: ['e', 'ē', 'é', 'ě', 'è'],
    i: ['i', 'ī', 'í', 'ǐ', 'ì'],
    u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
    'ü': ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ']
  };

  /* ---------------- 工具函数 ---------------- */

  /** 找到标调元音的下标（a o e 优先，其次 i u ü；iu/ui 标在第二个） */
  function toneIndex(syl) {
    var s = syl.replace(/[^a-zü]/g, '');
    var i;
    if ((i = s.indexOf('a')) >= 0) return syl.indexOf('a');
    if ((i = s.indexOf('o')) >= 0) return syl.indexOf('o');
    if ((i = s.indexOf('e')) >= 0) return syl.indexOf('e');
    if (s.indexOf('iu') >= 0) return syl.indexOf('u');
    if (s.indexOf('ui') >= 0) return syl.indexOf('i');
    if ((i = syl.indexOf('i')) >= 0) return i;
    if ((i = syl.indexOf('u')) >= 0) return i;
    if ((i = syl.indexOf('ü')) >= 0) return i;
    return -1;
  }

  /** 给音节加声调：applyTone('ma', 3) -> 'mǎ' */
  function applyTone(syl, tone) {
    if (!syl) return '';
    if (!tone || tone === 0) return syl;   // 轻声不加符
    var idx = toneIndex(syl);
    if (idx < 0) return syl;
    var ch = syl[idx];
    var row = TONE_MARK[ch];
    if (!row) return syl;
    return syl.slice(0, idx) + row[Math.min(tone, 4)] + syl.slice(idx + 1);
  }

  /** 拆音节为 声母 / 韵母（用于"拼读"拆解） */
  function split(syl) {
    var s = syl.replace(/(ā|á|ǎ|à|ē|é|ě|è|ī|í|ǐ|ì|ō|ó|ǒ|ò|ū|ú|ǔ|ù|ǖ|ǘ|ǚ|ǜ)/g, function (c) {
      var map = { 'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o', 'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü' };
      return map[c] || c;
    });
    var two = ['zh', 'ch', 'sh'];
    var ini = '';
    if (two.indexOf(s.slice(0, 2)) >= 0) ini = s.slice(0, 2);
    else if ('bpmfdtnlgkhjqxrzcsyw'.indexOf(s[0]) >= 0) ini = s[0];
    // y/w 处理：yi/wu/yu 视为整体认读，不拆
    if (ini === 'y' || ini === 'w') ini = '';
    if (WHOLE.indexOf(s) >= 0) ini = '';
    return { initial: ini, final: ini ? s.slice(ini.length) : s };
  }

  /** 声母 + 韵母 -> 正确音节拼写（不含调）*/
  function build(initial, final) {
    if (!initial) {
      var f = FINALS.filter(function (x) { return x.p === final; })[0];
      return f ? f.alone : final;
    }
    if (JQX[initial]) {
      if (final === 'ü') return initial + 'u';
      if (final.indexOf('ü') === 0) return initial + 'u' + final.slice(1);
      return initial + final;
    }
    if (initial === 'y') {
      // ia->ya, ie->ye, iao->yao, iu->you, ian->yan, iang->yang, iong->yong, in->yin, ing->ying
      if (final === 'i') return 'yi';
      if (final === 'in') return 'yin';
      if (final === 'ing') return 'ying';
      if (final === 'iu') return 'you';
      if (final === 'ue') return 'yue';
      if (final === 'u') return 'yu';
      if (final === 'un') return 'yun';
      if (final === 'uan') return 'yuan';
      if (final === 'ü') return 'yu';
      if (final === 'üe') return 'yue';
      if (final === 'ün') return 'yun';
      if (final === 'üan') return 'yuan';
      if (final.charAt(0) === 'i') return 'y' + final.slice(1);
      return 'y' + final;
    }
    if (initial === 'w') {
      if (final === 'u') return 'wu';
      if (final === 'ui') return 'wei';
      if (final === 'un') return 'wen';
      if (final === 'uan') return 'wan';
      if (final === 'u' ) return 'wu';
      return 'w' + final;
    }
    return initial + final;
  }

  /** 列出某声母能拼的全部音节（不含调） */
  function syllablesOf(initial) {
    var list = COMBO[initial] || [];
    return list.map(function (f) { return build(initial, f); });
  }

  /** 全部有效音节（去重、排序） */
  var ALL_SYLLABLES = (function () {
    var set = {};
    Object.keys(COMBO).forEach(function (ini) {
      COMBO[ini].forEach(function (f) {
        var s = build(ini, f);
        if (s) set[s] = 1;
      });
    });
    WHOLE.forEach(function (s) { set[s] = 1; });
    // 零声母中的 a/o/e/ai/ei/ao/ou/an/en/ang/eng/er
    ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er'].forEach(function (s) { set[s] = 1; });
    return Object.keys(set).sort();
  })();

  function isSyllable(s) { return ALL_SYLLABLES.indexOf((s || '').replace(/[0-9]/g, '')) >= 0; }

  /* ---------------- 易混卡片 ---------------- */
  // 形近
  var SHAPE_PAIRS = [
    { a: 'b', b: 'd', why: '都是“半圆 + 一竖”，圆在右边是 b，圆在左边是 d' },
    { a: 'p', b: 'q', why: '圆在上方，左边是 p，右边是 q' },
    { a: 'b', b: 'p', why: '长得像，b 不送气（爸），p 送气（怕），吹张纸试试' },
    { a: 'd', b: 't', why: 'd 不送气（大），t 送气（他）' },
    { a: 'n', b: 'h', why: 'n 是一个门洞，h 像把小椅子' },
    { a: 'f', b: 't', why: 'f 的弯朝上，t 的伞把朝下' },
    { a: 'm', b: 'n', why: 'm 两个门洞，n 一个门洞' },
    { a: 'u', b: 'ü', why: 'ü 比 u 多了两点，像小鱼吐泡泡' },
    { a: 'i', b: 'l', why: 'i 上面有一点，l 是一根直棍' },
    { a: 'e', b: 'c', why: 'e 中间有一横，c 是半个圆' },
    { a: 'z', b: 's', why: 'z 有折角，s 是弯曲的' },
    { a: 'g', b: 'q', why: 'g 的小尾巴朝左，q 的朝右' },
    { a: 'ang', b: 'an', why: 'ang 后面有 ng，鼻子拖长；an 舌尖抵住上牙床' },
    { a: 'eng', b: 'en', why: 'eng 后鼻音，en 前鼻音' },
    { a: 'ing', b: 'in', why: 'ing 后鼻音，in 前鼻音' },
    { a: 'iu', b: 'ui', why: 'iu 是 i 在前（游泳），ui 是 u 在前（围巾）' },
    { a: 'ie', b: 'ei', why: 'ie 是 i 在前（树叶），ei 是 e 在前（妹妹）' },
    { a: 'ao', b: 'ou', why: 'ao 嘴巴张大（小猫），ou 嘴巴圆（藕）' },
    { a: 'ai', b: 'ei', why: 'ai 张大嘴（爱），ei 扁一点（诶）' },
    { a: 'ün', b: 'un', why: 'ün 发 ü 的口型（云），un 发 u 的口型（温）' }
  ];

  // 音近（平翘舌 / 前后鼻 / n-l / f-h）
  var SOUND_PAIRS = [
    { a: 'z', b: 'zh', why: '平舌 z（字）vs 翘舌 zh（知）' },
    { a: 'c', b: 'ch', why: '平舌 c（次）vs 翘舌 ch（吃）' },
    { a: 's', b: 'sh', why: '平舌 s（四）vs 翘舌 sh（十）' },
    { a: 'n', b: 'l', why: 'n 鼻子出气（那），l 舌两边出气（拉）' },
    { a: 'f', b: 'h', why: 'f 上齿咬下唇（发），h 从喉咙哈气（哈）' },
    { a: 'j', b: 'q', why: 'j 不送气（鸡），q 送气（七）' },
    { a: 'x', b: 'sh', why: 'x 舌面摩擦（西），sh 舌尖翘起（诗）' },
    { a: 'an', b: 'ang', why: '前鼻音 an（安）vs 后鼻音 ang（昂）' },
    { a: 'en', b: 'eng', why: '前鼻音 en（恩）vs 后鼻音 eng（灯）' },
    { a: 'in', b: 'ing', why: '前鼻音 in（音）vs 后鼻音 ing（英）' }
  ];

  /** 音节是否含翘舌声母 / 前后鼻音，用于薄弱点分析 */
  function features(syl) {
    var s = split(syl), out = [];
    var ini = s.initial, fin = s.final;
    if (['zh', 'ch', 'sh', 'r'].indexOf(ini) >= 0) out.push('翘舌音');
    if (['z', 'c', 's'].indexOf(ini) >= 0) out.push('平舌音');
    if (['n', 'l'].indexOf(ini) >= 0) out.push(ini + ' 声母');
    if (['f', 'h'].indexOf(ini) >= 0) out.push(ini + ' 声母');
    if (/^an$|^en$|^in$|^un$|^ün$/.test(fin)) out.push('前鼻音');
    if (/ng$/.test(fin)) out.push('后鼻音');
    if (['iu', 'ui', 'ie', 'üe', 'er'].indexOf(fin) >= 0) out.push('复韵母');
    if (fin === 'ü' || fin.indexOf('ü') === 0) out.push('ü 韵母');
    return out;
  }

  return {
    INITIALS: INITIALS,
    FINALS: FINALS,
    WHOLE: WHOLE,
    WHOLE_TIP: WHOLE_TIP,
    COMBO: COMBO,
    TONES: TONES,
    SHAPE_PAIRS: SHAPE_PAIRS,
    SOUND_PAIRS: SOUND_PAIRS,
    ALL_SYLLABLES: ALL_SYLLABLES,
    applyTone: applyTone,
    toneIndex: toneIndex,
    split: split,
    build: build,
    syllablesOf: syllablesOf,
    isSyllable: isSyllable,
    features: features
  };
});
