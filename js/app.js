/* =========================================================================
 * 拼音星球 · 主程序
 * 路由：#/home  #/chart  #/initial  #/final  #/whole  #/pin  #/tone
 *       #/mix  #/char  #/write  #/read
 * ========================================================================= */
(function (global) {
  'use strict';

  var P = global.Pinyin;
  var S = global.Speech;
  var Store = global.Store;
  var DB = global.CHAR_DB;

  /* ---------------- 小工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rnd(arr.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  var TONE_COLOR = { 1: 'var(--t1)', 2: 'var(--t2)', 3: 'var(--t3)', 4: 'var(--t4)', 0: 'var(--t0)' };
  var TONE_CLS = { 1: 'tone-1', 2: 'tone-2', 3: 'tone-3', 4: 'tone-4', 0: '' };

  /* ---------------- 音效/朗读封装 ---------------- */
  function say(text, opt) { S.say(text, opt); }
  function sfx(n) { S.sfx(n); }

  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 1500);
  }

  function modal(opt) {
    var mask = el('div', 'modal-mask');
    var box = el('div', 'modal');
    box.innerHTML =
      '<div class="m-emo">' + (opt.emo || '🎉') + '</div>' +
      '<h3>' + (opt.title || '') + '</h3>' +
      '<p>' + (opt.text || '') + '</p>' +
      '<div class="m-body">' + (opt.body || '') + '</div>';
    var row = el('div', 'btn-row');
    (opt.buttons || [{ label: '好的', cls: 'primary' }]).forEach(function (b) {
      var btn = el('button', 'btn ' + (b.cls || 'primary'), b.label);
      btn.onclick = function () {
        mask.remove();
        if (b.onClick) b.onClick();
      };
      row.appendChild(btn);
    });
    box.appendChild(row);
    mask.appendChild(box);
    mask.onclick = function (e) { if (e.target === mask && opt.dismiss !== false) mask.remove(); };
    document.body.appendChild(mask);
    return mask;
  }

  function flyStar(x, y) {
    var n = el('div', 'star-fly', '⭐');
    n.style.left = (x || global.innerWidth / 2) + 'px';
    n.style.top = (y || global.innerHeight / 2) + 'px';
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 1000);
  }

  function refreshStars(bump) {
    var st = Store.stats();
    var node = $('#starCount');
    if (!node) return;
    node.textContent = st.stars;
    if (bump) {
      var wrap = $('#starWrap');
      wrap.classList.remove('bump');
      void wrap.offsetWidth;
      wrap.classList.add('bump');
    }
  }

  /* ---------------- 徽章定义 ---------------- */
  var BADGES = [
    { id: 'first', emo: '🌟', name: '启程星', tip: '第一次答对' },
    { id: 's10', emo: '✨', name: '十连对', tip: '连续答对 10 题' },
    { id: 's20', emo: '💫', name: '二十连对', tip: '连续答对 20 题' },
    { id: 'pinyin-pro', emo: '🅰️', name: '拼音小达人', tip: '声母/韵母问答全对一轮' },
    { id: 'tone-master', emo: '🎵', name: '声调小侦探', tip: '声调题连对 10' },
    { id: 'read-10', emo: '📖', name: '朗读小百灵', tip: '朗读 10 句' },
    { id: 'write-10', emo: '✍️', name: '写字小书法家', tip: '描红 10 个字' },
    { id: 'char-50', emo: '🏮', name: '识字半百', tip: '掌握 50 个字' },
    { id: 'char-200', emo: '📚', name: '识字两百', tip: '掌握 200 个字' },
    { id: 'star-100', emo: '👑', name: '百星王者', tip: '累计 100 颗星' }
  ];

  function grantBadge(id) {
    if (Store.hasBadge(id)) return;
    var b = BADGES.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    Store.badge(id);
    sfx('badge');
    modal({
      emo: b.emo,
      title: '获得徽章：' + b.name,
      text: b.tip,
      buttons: [{ label: '太棒了！', cls: 'primary' }]
    });
  }

  /* ---------------- 题库 ---------------- */
  var Initials = P.INITIALS.map(function (x) { return x.p; });
  var Finals = P.FINALS.filter(function (f) { return ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong'].indexOf(f.p) >= 0; });
  var Whole = P.WHOLE;

  function cardKeys() {
    return {
      initial: Initials.map(function (p) { return 'pyi:' + p; }),
      final: Finals.map(function (f) { return 'pyf:' + f.p; }),
      whole: Whole.map(function (w) { return 'pyw:' + w; }),
      char: DB.chars.map(function (c) { return 'ch:' + c.c; })
    };
  }

  /* ---- 生字索引：声母 / 韵母 / 整体认读 ---- */
  var ALLF = P.FINALS.map(function (f) { return f.p; });
  var IDX = { ini: {}, fin: {}, whole: {} };
  DB.chars.forEach(function (c) {
    var sp = P.split(c.p);
    if (sp.initial) {
      if (!IDX.ini[sp.initial]) IDX.ini[sp.initial] = [];
      IDX.ini[sp.initial].push(c);
      if (!IDX.fin[sp.final]) IDX.fin[sp.final] = [];
      IDX.fin[sp.final].push(c);
    } else {
      if (!IDX.whole[sp.final]) IDX.whole[sp.final] = [];
      IDX.whole[sp.final].push(c);
    }
  });

  /** 易混项优先的干扰池 */
  function confusable(x, pool) {
    var conf = P.SHAPE_PAIRS.concat(P.SOUND_PAIRS)
      .filter(function (p) { return p.a === x || p.b === x; })
      .map(function (p) { return p.a === x ? p.b : p.a; })
      .filter(function (y) { return pool.indexOf(y) >= 0 && y !== x; });
    return uniq(conf.concat(shuffle(pool))).filter(function (y) { return y !== x; });
  }

  /** 听音卡片：先不给字形，避免"看答案" */
  function listenCard(sub) {
    return { listen: true, glyph: '🔊', sub: sub || '点下面的按钮再听一次' };
  }

  /** 声母：听字音 → 找开头的声母 */
  function qInitial() {
    var keys = Object.keys(IDX.ini).filter(function (k) { return Initials.indexOf(k) >= 0; });
    var ini = pick(keys);
    var c = pick(IDX.ini[ini]);
    var opts = shuffle([ini].concat(confusable(ini, Initials).slice(0, 3)));
    return {
      key: 'pyi:' + ini,
      kind: 'initial',
      prompt: '听一听，这个字开头的声母是哪个？',
      card: listenCard(),
      speak: function () { S.say(c.c, { rate: 0.5 }); },
      autoSpeak: true,
      opts: opts.map(function (x) { return { v: x, label: x }; }),
      answer: ini,
      reveal: { big: c.c, small: c.p, tip: c.w },
      onCorrect: function () { S.say(c.w || c.c, { rate: 0.7 }); }
    };
  }

  /** 韵母：听字音 → 找韵母 */
  function qFinal() {
    var keys = Object.keys(IDX.fin).filter(function (k) { return ALLF.indexOf(k) >= 0; });
    var fin = pick(keys);
    var c = pick(IDX.fin[fin]);
    var opts = shuffle([fin].concat(confusable(fin, ALLF).slice(0, 3)));
    return {
      key: 'pyf:' + fin,
      kind: 'final',
      prompt: '听一听，这个字的韵母是哪个？',
      card: listenCard(),
      speak: function () { S.say(c.c, { rate: 0.5 }); },
      autoSpeak: true,
      opts: opts.map(function (x) { return { v: x, label: x }; }),
      answer: fin,
      reveal: { big: c.c, small: c.p, tip: c.w },
      onCorrect: function () { S.say(c.w || c.c, { rate: 0.7 }); }
    };
  }

  /** 整体认读音节：听字音 → 找音节 */
  function qWhole() {
    var keys = Object.keys(IDX.whole).filter(function (k) { return Whole.indexOf(k) >= 0; });
    var w = pick(keys);
    var c = pick(IDX.whole[w]);
    var opts = shuffle([w].concat(shuffle(Whole.filter(function (x) { return x !== w; })).slice(0, 3)));
    return {
      key: 'pyw:' + w,
      kind: 'whole',
      prompt: '听一听，这个字是哪个整体认读音节？',
      card: listenCard(),
      speak: function () { S.say(c.c, { rate: 0.5 }); },
      autoSpeak: true,
      opts: opts.map(function (x) { return { v: x, label: x }; }),
      answer: w,
      reveal: { big: c.c, small: c.p, tip: P.WHOLE_TIP[w] || c.w },
      onCorrect: function () { S.say(c.w || c.c, { rate: 0.7 }); }
    };
  }

  /** 拼读：
   *   A 合（经典拼读）：看见 b + ān → 选出 bān
   *   B 拆：听字音 → 选出它由哪两个音拼成
   */
  function qPin() {
    var keys = Object.keys(IDX.ini).filter(function (k) { return Initials.indexOf(k) >= 0; });
    var ini = pick(keys);
    var c = pick(IDX.ini[ini]);
    var sp = P.split(c.p);
    var fin = sp.final;
    var tone = c.t || 1;

    if (rnd(10) < 5) return qPinCombine(ini, fin, tone, c);
    return qPinSplit(ini, fin, c);
  }

  /** A：拼一拼 → 这个音节读什么 */
  function qPinCombine(ini, fin, tone, c) {
    var answer = P.applyTone(P.build(ini, fin), tone);
    var shown = ini + ' + ' + P.applyTone(fin, tone);

    var cands = [];
    // 同韵母、不同声母（最容易看错）
    shuffle(confusable(ini, Initials)).forEach(function (i2) {
      var s = P.applyTone(P.build(i2, fin), tone);
      if (s !== answer && P.isSyllable(P.build(i2, fin))) cands.push(s);
    });
    // 同声母、不同韵母
    shuffle(Object.keys(IDX.fin)).forEach(function (f2) {
      if (f2 === fin) return;
      var s = P.applyTone(P.build(ini, f2), tone);
      if (s !== answer && P.isSyllable(P.build(ini, f2))) cands.push(s);
    });
    var opts = shuffle([answer].concat(uniq(cands).slice(0, 3)));

    return {
      key: 'pin:' + c.p,
      kind: 'pin',
      prompt: '拼一拼，读出来是哪个音节？',
      card: { glyph: shown, sub: '先读左边的声母，再读右边的韵母，两音相连猛一碰', cls: 'combo' },
      speak: function () { S.say(c.c, { rate: 0.45 }); },
      opts: opts.map(function (x) { return { v: x, label: x }; }),
      answer: answer,
      reveal: { big: c.c, small: c.p, tip: c.w },
      onCorrect: function () { S.say(c.w || c.c, { rate: 0.7 }); }
    };
  }

  /** B：听字音 → 它由哪两个音拼成 */
  function qPinSplit(ini, fin, c) {
    var pair = ini + ' + ' + fin;
    var cands = [];
    // 同声母、不同韵母：只取拼得出来的（避免 b + ui 这种不存在的音节）
    shuffle(Object.keys(IDX.fin)).forEach(function (f) {
      if (f === fin || cands.length > 12) return;
      if (P.isSyllable(P.build(ini, f))) cands.push(ini + ' + ' + f);
    });
    // 不同声母、同韵母：优先易混
    shuffle(confusable(ini, Initials)).forEach(function (i2) {
      if (cands.length > 20) return;
      if (P.isSyllable(P.build(i2, fin))) cands.push(i2 + ' + ' + fin);
    });
    var opts = shuffle([pair].concat(shuffle(uniq(cands)).slice(0, 3)));

    return {
      key: 'pin:' + c.p,
      kind: 'pin',
      prompt: '听一听：这个字是由哪两个音拼起来的？',
      card: listenCard('先听清楚，再看选项'),
      speak: function () { S.say(c.c, { rate: 0.45 }); },
      autoSpeak: true,
      opts: opts.map(function (x) { return { v: x, label: x, cls: 'wide' }; }),
      answer: pair,
      reveal: { big: c.c, small: c.p, tip: c.w },
      onCorrect: function () { S.say(c.w || c.c, { rate: 0.7 }); }
    };
  }

  /** 声调：听字音 → 第几声 */
  function qTone() {
    var pool = DB.chars.filter(function (c) { return c.t >= 1 && c.t <= 4; });
    var c = pick(pool);
    var tone = c.t;
    return {
      key: 'tone:' + c.p,
      kind: 'tone',
      prompt: '听一听，这是第几声？',
      card: listenCard('听声音的高低变化'),
      speak: function () { S.say(c.c, { rate: 0.45 }); },
      autoSpeak: true,
      opts: P.TONES.slice(0, 4).map(function (t) {
        return { v: t.n, label: t.n + '声', cls: 'col', sub: t.emoji + ' ' + t.hint.split('，')[0] };
      }),
      answer: tone,
      reveal: { big: c.c, small: c.p, tip: c.w },
      onCorrect: function () { S.say(c.c, { rate: 0.4 }); }
    };
  }

  /** 认字：看字 → 选拼音 */
  function qChar(pool) {
    var list = pool && pool.length > 3 ? pool : DB.chars;
    var c = pick(list);
    var others = shuffle(DB.chars.filter(function (x) { return x.c !== c.c; }));
    var near = others.filter(function (x) { return x.sb === c.sb || x.t === c.t; }).slice(0, 30);
    var cands = uniq(near.concat(others).map(function (x) { return x.p; }))
      .filter(function (p) { return p !== c.p; }).slice(0, 3);
    return {
      key: 'ch:' + c.c,
      kind: 'char',
      prompt: '这个字读什么？',
      card: { zi: c.c, sub: c.w, meaning: c.m || '', toneN: c.t },
      speak: function () { S.say(c.c, { rate: 0.55 }); },
      opts: shuffle([c.p].concat(cands)).map(function (p) { return { v: p, label: p }; }),
      answer: c.p,
      speakOpt: true,
      onCorrect: function () { S.say(c.w || c.c, { rate: 0.7 }); }
    };
  }

  /** 综合题池 */
  function qMix() {
    var r = rnd(10);
    if (r < 2) return qInitial();
    if (r < 4) return qFinal();
    if (r < 5) return qWhole();
    if (r < 7) return qPin();
    if (r < 9) return qTone();
    return qChar();
  }

  /* ---------------- 通用出题引擎 ---------------- */
  function Game(opt) {
    // opt: { gen, total, title, onExit }
    this.opt = opt;
    this.total = opt.total || 10;
    this.done = 0;
    this.right = 0;
    this.locked = false;
    this.seq = [];
  }

  Game.prototype.mount = function (host) {
    this.host = host;
    var self = this;
    host.innerHTML = '';
    this.wrap = el('div', 'view');
    this.head = el('div', 'btn-row', '');
    this.head.style.marginBottom = '12px';
    this.head.style.alignItems = 'center';
    this.progress = el('div', 'progress', '<i></i>');
    this.progress.style.flex = '1';
    this.head.appendChild(this.progress);
    this.counter = el('div', 'chip', '0 / ' + this.total);
    this.head.appendChild(this.counter);
    this.wrap.appendChild(this.head);

    this.stage = el('div', 'card-stage');
    this.wrap.appendChild(this.stage);
    host.appendChild(this.wrap);

    this.next();
    return this;
  };

  Game.prototype.setProgress = function () {
    var pct = Math.round(this.done / this.total * 100);
    this.progress.firstChild.style.width = pct + '%';
    this.counter.textContent = this.done + ' / ' + this.total;
  };

  Game.prototype.next = function () {
    if (this.done >= this.total) return this.finish();
    this.locked = false;
    this.stage.innerHTML = '';
    var q = this.opt.gen();
    this.q = q;
    global.__currentQ = q;   // 便于自动化测试与家长排查
    global.__qSeq = (global.__qSeq || 0) + 1;
    var self = this;

    // 题干
    var prompt = el('div', '', q.prompt);
    prompt.style.cssText = 'font-size:15px;font-weight:900;color:var(--ink-2)';
    this.stage.appendChild(prompt);

    // 卡片
    var card = el('div', 'big-card');
    card.style.position = 'relative';
    if (q.card.zi) {
      card = el('div', 'char-card');
      var bar = el('div', 'tone-bar');
      bar.style.background = TONE_COLOR[q.card.toneN || 0] || '#eee';
      card.appendChild(bar);
      card.appendChild(el('div', 'zi', q.card.zi));
      card.appendChild(el('div', 'word', q.card.sub || ''));
      if (q.card.meaning) {
        var mm = el('div', 'rhyme', '💡 ' + q.card.meaning);
        mm.style.maxWidth = '80%';
        card.appendChild(mm);
      }
    } else {
      if (q.card.sameSize) card.style.setProperty('--x', '0');
      if (q.card.cls) card.classList.add(q.card.cls);
      if (q.card.listen) card.classList.add('listen');
      card.classList.add('in');
      var g = el('div', 'glyph', q.card.glyph);
      if (q.card.sameSize) g.style.fontSize = 'clamp(46px, 11vw, 76px)';
      card.appendChild(g);
      if (q.card.rhyme) card.appendChild(el('div', 'rhyme', q.card.rhyme));
      card.appendChild(el('div', 'hint', q.card.sub || ''));
    }
    this.stage.appendChild(card);
    this.card = card;

    // 重听按钮
    var hearRow = el('div', 'btn-row');
    hearRow.style.maxWidth = '420px';
    var hearBtn = el('button', 'btn blue', '🔊 再听一次');
    hearBtn.onclick = function () { sfx('tap'); q.speak(); };
    hearRow.appendChild(hearBtn);
    this.stage.appendChild(hearRow);

    // 选项
    var opts = el('div', 'opts' + (q.opts.length === 3 ? ' three' : ''));
    this.optNodes = q.opts.map(function (o) {
      var b = el('button', 'opt ' + (o.cls || ''));
      b.dataset.v = String(o.v);
      if (o.sub) {
        b.innerHTML = '<span>' + o.label + '</span><span class="sub">' + o.sub + '</span>';
      } else {
        b.textContent = o.label;
      }
      b.onclick = function () { self.answer(o.v, b); };
      opts.appendChild(b);
      return b;
    });
    this.stage.appendChild(opts);

    if (q.autoSpeak) setTimeout(function () { q.speak(); }, 220);
  };

  Game.prototype.answer = function (val, node) {
    if (this.locked) return;
    var self = this;
    var q = this.q;
    var ok = String(val) === String(q.answer);
    if (!ok) {
      // 允许多点一次，但记录错误
      node.classList.add('wrong');
      node.disabled = true;
      sfx('wrong');
      Store.answer(q.key, false);
      toast('再想想～ 点 🔊 听一听');
      this.wrongTries = (this.wrongTries || 0) + 1;
      if (this.wrongTries >= 2) this.reveal();
      return;
    }
    this.locked = true;
    clearTimeout(this._revealTimer);
    this.wrongTries = 0;
    node.classList.add('correct');
    sfx('right');
    this.showReveal();
    Store.answer(q.key, true);
    this.right++;
    var st = Store.stats();
    refreshStars(true);
    if (!Store.hasBadge('first')) grantBadge('first');
    if (st.streak >= 10) grantBadge('s10');
    if (st.streak >= 20) grantBadge('s20');
    if (st.stars >= 100) grantBadge('star-100');
    if (q.onCorrect) setTimeout(function () { q.onCorrect(); }, 220);
    var rect = node.getBoundingClientRect();
    flyStar(rect.left + rect.width / 2, rect.top);
    this.done++;
    this.setProgress();
    setTimeout(function () { self.next(); }, 780);
  };

  /** 答对/揭晓时把听音卡片换成真正的字 */
  Game.prototype.showReveal = function () {
    var q = this.q, card = this.card;
    if (!q || !q.reveal || !card) return;
    var g = card.querySelector('.glyph');
    if (g) {
      g.textContent = q.reveal.big;
      g.classList.add('revealed');
      card.classList.remove('listen');
      card.classList.remove('combo');
    }
    var h = card.querySelector('.hint');
    if (h) {
      h.innerHTML = '<b style="font-size:20px;color:var(--ink)">' + (q.reveal.small || '') + '</b>' +
        (q.reveal.tip ? '<br><span style="font-size:13px">' + q.reveal.tip + '</span>' : '');
    }
  };

  Game.prototype.reveal = function () {
    if (this.locked) return;
    var self = this;
    this.locked = true;
    this.optNodes.forEach(function (b) {
      if (b.dataset.v === String(self.q.answer)) b.classList.add('correct');
      else b.disabled = true;
    });
    this.showReveal();
    if (this.q.onCorrect) this.q.onCorrect();
    this.done++;
    this.setProgress();
    setTimeout(function () { self.next(); }, 1400);
  };

  Game.prototype.finish = function () {
    this.stage.innerHTML = '';
    var st = Store.stats();
    var pct = Math.round(this.right / this.total * 100);
    var emo = pct >= 90 ? '🏆' : pct >= 70 ? '🌟' : '💪';
    var txt = pct >= 90 ? '太厉害了，全对！' : pct >= 70 ? '很不错，再练一练就更好！' : '没关系，多听几遍就会啦！';
    sfx('badge');
    var self = this;
    modal({
      emo: emo,
      title: '本轮答对 ' + this.right + ' / ' + this.total,
      text: txt,
      body: '<div class="stat-grid">' +
        '<div class="stat-box"><b>' + st.stars + '</b><span>总星星</span></div>' +
        '<div class="stat-box"><b>' + st.streak + '</b><span>连胜</span></div>' +
        '<div class="stat-box"><b>' + st.bestStreak + '</b><span>最高连胜</span></div>' +
        '</div>',
      buttons: [
        { label: '再来一轮', cls: 'primary', onClick: function () { self.done = 0; self.right = 0; self.setProgress(); self.next(); } },
        { label: '回到首页', cls: 'ghost', onClick: function () { navigate('#/home'); } }
      ]
    });
  };

  /* ---------------- 视图：首页 ---------------- */
  var TILES = [
    { id: 'chart', emo: '🗺️', name: '拼音地图', sub: '声母韵母全表·点一点就发音', cls: 'g2' },
    { id: 'initial', emo: '🅰️', name: '声母认读', sub: '听字音，找开头的声母', cls: 'g1' },
    { id: 'final', emo: '🔤', name: '韵母认读', sub: '听字音，找韵母', cls: 'g3' },
    { id: 'whole', emo: '🎯', name: '整体认读', sub: '16 个整体认读音节', cls: 'g4' },
    { id: 'pin', emo: '🧩', name: '拼读推一推', sub: '这个字是怎么拼出来的', cls: 'g8' },
    { id: 'tone', emo: '🎵', name: '声调小侦探', sub: '听一听，是第几声？', cls: 'g9' },
    { id: 'char', emo: '🏮', name: '认字卡', sub: '看字读拼音·按课选字', cls: 'g5' },
    { id: 'write', emo: '✍️', name: '笔顺描红', sub: '田字格里跟着写', cls: 'g6' },
    { id: 'read', emo: '📖', name: '朗读小站', sub: '课文短句跟读', cls: 'g7' },
    { id: 'mix', emo: '🎪', name: '每日挑战', sub: '综合大闯关 15 题', cls: 'g10' }
  ];

  function viewHome() {
    var st = Store.stats();
    var html = '' +
      '<div class="hero">' +
      '  <div class="hero-avatar">🐣</div>' +
      '  <div class="hero-txt">' +
      '    <h1>拼音星球</h1>' +
      '    <p>一年级 · 部编版 · 一天 10 分钟</p>' +
      '    <div class="hero-mini">' +
      '      <span class="chip">⭐ ' + st.stars + ' 颗星</span>' +
      '      <span class="chip hot">🔥 连胜 ' + st.streak + '</span>' +
      '      <span class="chip">🏅 ' + st.badges + ' 枚徽章</span>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="sect-h"><h2>开始学习</h2><span>点一点就进去</span></div>' +
      '<div class="menu" id="menu"></div>' +
      '<div class="sect-h"><h2>我的成绩</h2><span>你自己看</span></div>' +
      '<div class="stat-grid">' +
      '  <button class="stat-box" data-go="#/badges"><b>' + st.mastered + '</b><span>已掌握字音</span></button>' +
      '  <button class="stat-box" data-go="#/badges"><b>' + st.learning + '</b><span>正在学</span></button>' +
      '  <button class="stat-box" data-go="#/badges"><b>' + st.today + '</b><span>今天练了</span></button>' +
      '  <button class="stat-box" data-go="#/settings"><b>⚙️</b><span>设置</span></button>' +
      '</div>';

    var host = el('div', 'view');
    host.innerHTML = html;
    var menu = host.querySelector('#menu');
    TILES.forEach(function (t) {
      var b = el('button', 'tile ' + t.cls,
        '<span class="emo">' + t.emo + '</span>' +
        '<span class="t-name">' + t.name + '</span>' +
        '<span class="t-sub">' + t.sub + '</span>');
      b.onclick = function () { sfx('tap'); navigate('#/' + t.id); };
      menu.appendChild(b);
    });
    host.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { navigate(b.dataset.go); };
    });
    return host;
  }

  /* ---------------- 视图：拼音地图 ---------------- */
  function chartCell(key, label, example, extraCls) {
    var bs = Store.box(key);
    return '<button class="pc-cell' + (extraCls || '') + (bs >= 4 ? ' mastered' : '') + '" data-k="' + key + '">' +
      label + (example ? '<small>' + example + '</small>' : '') +
      (bs > 0 ? '<i class="dot"></i>' : '') + '</button>';
  }

  function viewChart() {
    var host = el('div', 'view');
    var html = '<div class="pinyin-chart">';
    html += '<div class="sect-h" style="margin-top:0"><h2>点一点就发音</h2>' +
      '<span>23 声母 · 36 韵母 · 16 整体认读</span></div>';

    html += '<div class="pc-group"><h3>声母（23）</h3><div class="pc-grid">';
    P.INITIALS.forEach(function (x) {
      var ch = IDX.ini[x.p] && IDX.ini[x.p][0];
      html += chartCell('pyi:' + x.p, x.p, ch ? ch.c : '');
    });
    html += '</div></div>';

    html += '<div class="pc-group"><h3>韵母（24）</h3><div class="pc-grid">';
    Finals.forEach(function (x) {
      var ch = IDX.fin[x.p] && IDX.fin[x.p][0];
      html += chartCell('pyf:' + x.p, x.p, ch ? ch.c : '');
    });
    html += '</div></div>';

    var extra = P.FINALS.filter(function (f) { return Finals.indexOf(f) < 0; });
    html += '<div class="pc-group"><h3>组合韵母（' + extra.length + '）</h3><div class="pc-grid">';
    extra.forEach(function (x) {
      var ch = IDX.fin[x.p] && IDX.fin[x.p][0];
      html += chartCell('pyf:' + x.p, x.p, ch ? ch.c : '');
    });
    html += '</div></div>';

    html += '<div class="pc-group"><h3>整体认读音节（16）</h3><div class="pc-grid">';
    Whole.forEach(function (w) {
      var ch = IDX.whole[w] && IDX.whole[w][0];
      html += chartCell('pyw:' + w, w, ch ? ch.c : '', ' whole');
    });
    html += '</div></div>';

    html += '<div class="pc-group"><h3>四声示范（妈）</h3><div class="pc-grid">';
    [['ā', '一声', 1], ['á', '二声', 2], ['ǎ', '三声', 3], ['à', '四声', 4]].forEach(function (t) {
      html += '<button class="pc-cell" data-tone="' + t[2] + '" style="color:' + TONE_COLOR[t[2]] + '">' + t[0] +
        '<small>' + t[1] + '</small></button>';
    });
    html += '</div></div>';

    html += '<div class="sect-h"><h2>小提示</h2><span>不会读？先听例字</span></div>' +
      '<p style="font-size:13px;font-weight:700;color:var(--ink-2);line-height:1.7;text-align:center;max-width:520px;margin:0 auto 20px">' +
      '每个格子下面小字是"例字"。点一下听到的是这个例字的音，' +
      '跟着念一遍，再试试点右上角的 🔊 反复听。</p>';
    html += '</div>';

    host.innerHTML = html;

    function speakKey(key) {
      var parts = key.split(':');
      var kind = parts[0], val = parts[1];
      var c = null;
      if (kind === 'pyi') c = IDX.ini[val] && IDX.ini[val][0];
      else if (kind === 'pyf') c = IDX.fin[val] && IDX.fin[val][0];
      else if (kind === 'pyw') c = IDX.whole[val] && IDX.whole[val][0];
      if (c) return S.say(c.c, { rate: 0.5 });
      S.say(val, { rate: 0.6 });
    }

    host.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () {
        sfx('tap');
        speakKey(b.dataset.k);
        b.classList.add('in');
        setTimeout(function () { b.classList.remove('in'); }, 320);
      };
    });
    host.querySelectorAll('[data-tone]').forEach(function (b) {
      b.onclick = function () {
        sfx('tap');
        var n = +b.dataset.tone;
        var toneChars = { 1: '妈', 2: '麻', 3: '马', 4: '骂' };
        S.say(toneChars[n], { rate: 0.45 });
        b.classList.add('in');
        setTimeout(function () { b.classList.remove('in'); }, 320);
      };
    });
    return host;
  }

  /* ---------------- 视图：认字（选课程） ---------------- */
  function viewCharPicker() {
    var host = el('div', 'view');
    var sel = Store.get().sel && Store.get().sel.unit || '';
    var html = '<div class="sect-h" style="margin-top:0"><h2>选一课来认字</h2><span>共 ' + DB.units.reduce(function (a, u) { return a + u.chars.length; }, 0) + ' 字</span></div>';
    html += '<div class="btn-row" style="margin-bottom:12px">' +
      '<button class="btn primary" id="allChars">全部生字（随机）</button>' +
      '<button class="btn ghost" id="reviewChars">复习易错字</button>' +
      '</div>';
    html += '<div class="unit-list">';
    DB.units.forEach(function (u, i) {
      var emo = u.book === '上册' ? '🟠' : '🔵';
      html += '<button class="unit-row' + (sel === u.id ? ' on' : '') + '" data-u="' + u.id + '">' +
        '<span class="u-emo">' + emo + '</span>' +
        '<span class="u-body"><span class="u-t">' + u.title + '</span>' +
        '<span class="u-s">' + u.desc + '</span></span>' +
        '<span class="u-n">' + u.chars.length + '</span>' +
        '</button>';
    });
    html += '</div>';
    host.innerHTML = html;

    host.querySelector('#allChars').onclick = function () { startCharGame(DB.chars); };
    host.querySelector('#reviewChars').onclick = function () {
      var keys = Store.needReview(cardKeys().char, 20);
      var pool = DB.chars.filter(function (c) { return keys.indexOf('ch:' + c.c) >= 0; });
      if (pool.length < 4) pool = shuffle(DB.chars.slice()).slice(0, 20);
      startCharGame(pool);
    };
    host.querySelectorAll('[data-u]').forEach(function (b) {
      b.onclick = function () {
        Store.get().sel = Store.get().sel || {};
        Store.get().sel.unit = b.dataset.u;
        var u = DB.units.filter(function (x) { return x.id === b.dataset.u; })[0];
        var pool = DB.chars.filter(function (c) { return u.chars.indexOf(c.c) >= 0; });
        startCharGame(pool);
      };
    });
    return host;
  }

  function startCharGame(pool) {
    navigate('#/char/play', function (host) {
      host.innerHTML = '';
      var wrap = el('div', 'view');
      host.appendChild(wrap);
      var g = new Game({
        gen: function () { return qChar(pool); },
        total: Math.min(10, Math.max(6, pool.length))
      });
      g.mount(wrap);
      return null;
    });
  }

  /* ---------------- 视图：写字 ---------------- */
  function viewWrite() {
    var host = el('div', 'view');
    var html = '<div class="write-stage">' +
      '<div class="sect-h" style="margin-top:0;width:100%"><h2>笔顺描红</h2><span id="wInfo">加载中…</span></div>' +
      '<div class="tian"><div class="hw-host" id="hwHost"></div></div>' +
      '<div class="stroke-count" id="strokeInfo"></div>' +
      '<div class="write-tools">' +
      '  <button class="btn blue" id="btnShow">▶ 看笔顺</button>' +
      '  <button class="btn primary" id="btnTrace">✍️ 我来写</button>' +
      '  <button class="btn green" id="btnQuiz">🎯 考考我</button>' +
      '  <button class="btn ghost" id="btnNext">➡ 换一个字</button>' +
      '</div>' +
      '<div class="read-text" id="wWord" style="font-size:22px;padding:10px;max-width:420px"></div>' +
      '</div>';
    host.innerHTML = html;

    var cur = null, writer = null;
    var host2 = host.querySelector('#hwHost');

    function render(c) {
      cur = c;
      host.querySelector('#wInfo').textContent = c.c + '（' + c.p + '）';
      host.querySelector('#strokeInfo').textContent = '';
      host.querySelector('#wWord').innerHTML = '<b style="font-family:KaiTi,serif">' + c.c + '</b> ' +
        '<span style="color:var(--ink-2);font-size:15px">' + c.w + '</span>';
      host2.innerHTML = '';
      if (!global.HanziWriter) {
        host2.innerHTML = '<div style="padding:20px;font-size:14px;color:#888">笔画库未加载</div>';
        return;
      }
      loadStroke(c.c, function (data) {
        if (!data) { host2.innerHTML = '<div style="padding:20px">该字暂无笔顺数据</div>'; return; }
        var size = host2.clientWidth || 300;
        try {
          writer = global.HanziWriter.create(host2, c.c, {
            width: size, height: size, padding: 8,
            showOutline: true,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 260,
            strokeColor: '#ff6b35',
            radicalColor: '#4dabf7',
            highlightOnComplete: true,
            charDataLoader: function (ch, onLoad) { onLoad(data); }
          });
        } catch (e) {
          host2.innerHTML = '<div style="padding:20px;font-size:13px;color:#c00">笔顺组件出错：' + (e && e.message) + '</div>';
          return;
        }
        var nStrokes = (data.strokes || []).length;
        host.querySelector('#strokeInfo').textContent = '共 ' + nStrokes + ' 笔';
        c._writer = writer;
        c._data = data;
        setTimeout(function () { runAnimate(); }, 260);
      });
    }

    function ensureBulk(cb) {
      if (global.HANZI_STROKES && Object.keys(global.HANZI_STROKES).length) return cb();
      if (global._bulkLoading) { global._bulkQueue.push(cb); return; }
      global._bulkLoading = true;
      global._bulkQueue = [cb];
      var sc = document.createElement('script');
      sc.src = 'data/hanzi-all.js';
      sc.onload = function () {
        var q = global._bulkQueue; global._bulkQueue = [];
        q.forEach(function (f) { try { f(); } catch (e) { } });
      };
      sc.onerror = function () {
        var q = global._bulkQueue; global._bulkQueue = [];
        q.forEach(function (f) { try { f(); } catch (e) { } });
      };
      document.head.appendChild(sc);
    }

    function loadStroke(ch, cb) {
      if (global.HANZI_STROKES && global.HANZI_STROKES[ch]) return cb(global.HANZI_STROKES[ch]);
      if (global.location.protocol === 'file:') {
        // 直接打开 HTML 文件时 XHR 会被拦截，改用整体数据文件
        return ensureBulk(function () {
          cb(global.HANZI_STROKES && global.HANZI_STROKES[ch] ? global.HANZI_STROKES[ch] : null);
        });
      }
      var url = 'assets/hanzi/' + encodeURIComponent(ch) + '.json';
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          var d = null;
          try {
            d = JSON.parse(xhr.responseText);
            global.HANZI_STROKES = global.HANZI_STROKES || {};
            global.HANZI_STROKES[ch] = d;
          } catch (e) { d = null; }
          cb(d);
        } else {
          ensureBulk(function () {
            cb(global.HANZI_STROKES && global.HANZI_STROKES[ch] ? global.HANZI_STROKES[ch] : null);
          });
        }
      };
      xhr.onerror = function () {
        ensureBulk(function () {
          cb(global.HANZI_STROKES && global.HANZI_STROKES[ch] ? global.HANZI_STROKES[ch] : null);
        });
      };
      xhr.send();
    }

    function runAnimate() {
      if (!writer) return;
      S.say(cur.c, { rate: 0.5, interrupt: false });
      writer.animateCharacter();
    }

    function runTrace() {
      if (!writer) return;
      host2.innerHTML = '';
      var size = host2.clientWidth || 300;
      writer = global.HanziWriter.create(host2, cur.c, {
        width: size, height: size, padding: 8,
        showOutline: true, showCharacter: false,
        strokeColor: '#1c7ed6',
        highlightOnComplete: true,
        charDataLoader: function (ch, onLoad) { onLoad(cur._data); }
      });
      var strokes = (cur._data && cur._data.strokes || []).length;
      var doneN = 0;
      writer.quiz({
        onMistake: function () { sfx('wrong'); toast('这里不对，看看田字格'); },
        onCorrectStroke: function () { sfx('tap'); },
        onComplete: function (summary) {
          sfx('star');
          Store.answer('ch:' + cur.c, true);
          refreshStars(true);
          var n = (Store.get().writeCount = (Store.get().writeCount || 0) + 1);
          if (n >= 10) grantBadge('write-10');
          toast('太棒了！写完啦 🌟');
          setTimeout(function () { nextChar(); }, 900);
        }
      });
    }

    /** 写字池：优先必写字；若在认字卡里选过单元，就只练这一课 */
    function buildPool() {
      var sel = Store.get().sel && Store.get().sel.unit;
      var base = DB.chars.filter(function (c) { return c.w100; });
      var unit = sel ? DB.units.filter(function (u) { return u.id === sel; })[0] : null;
      if (unit) {
        var inUnit = base.filter(function (c) { return unit.chars.indexOf(c.c) >= 0; });
        if (inUnit.length >= 6) {
          base = inUnit;
          host.querySelector('#wInfo').dataset.unit = unit.title;
        }
      }
      if (base.length < 6) base = DB.chars;
      return shuffle(base).slice(0, 30);
    }

    var pool = [], pi = 0;
    function nextChar() {
      if (!pool.length || pi >= pool.length) {
        pool = buildPool();
        pi = 0;
      }
      render(pool[pi++]);
    }

    var unitLabel = host.querySelector('#wInfo');
    unitLabel.textContent = '必写字';

    host.querySelector('#btnShow').onclick = function () { sfx('tap'); runAnimate(); };
    host.querySelector('#btnTrace').onclick = function () { sfx('tap'); runTrace(); };
    host.querySelector('#btnNext').onclick = function () { sfx('tap'); nextChar(); };
    host.querySelector('#btnQuiz').onclick = function () {
      sfx('tap');
      var sel = Store.get().sel && Store.get().sel.unit;
      var pool2 = sel ? DB.chars.filter(function (c) { return c.u === sel; }) : DB.chars.filter(function (c) { return c.w100; });
      if (pool2.length < 4) pool2 = DB.chars;
      startCharGame(pool2);
    };

    nextChar();
    return host;
  }

  /* ---------------- 视图：朗读 ---------------- */
  function viewRead() {
    var host = el('div', 'view');
    var html = '<div class="read-stage">' +
      '<div class="sect-h" style="margin-top:0;width:100%"><h2>朗读小站</h2><span>先听，再跟着读</span></div>' +
      '<div class="py-line" id="pyLine"></div>' +
      '<div class="read-text" id="cnLine"></div>' +
      '<div class="btn-row" style="max-width:520px">' +
      '  <button class="btn blue" id="btnPlay">🔊 听一听</button>' +
      '  <button class="btn primary" id="btnSlow">🐢 慢慢读</button>' +
      '</div>' +
      '<button class="mic-btn" id="btnMic">🎤</button>' +
      '<div class="stroke-count" id="micTip">点麦克风，跟读一遍（需要联网）</div>' +
      '<div class="btn-row" style="max-width:520px">' +
      '  <button class="btn ghost" id="btnPrev">⬅ 上一句</button>' +
      '  <button class="btn ghost" id="btnNext2">下一句 ➡</button>' +
      '</div>' +
      '</div>';
    host.innerHTML = html;

    var idx = 0;
    var list = DB.sentences || [];
    if (!list.length) {
      host.querySelector('#cnLine').textContent = '暂无句子';
      return host;
    }

    function renderRead() {
      var s = list[idx];
      host.querySelector('#pyLine').textContent = s.py;
      var cnNode = host.querySelector('#cnLine');
      cnNode.innerHTML = '';
      s.cn.split('').forEach(function (ch) {
        var sp = el('span', 'ch', ch);
        cnNode.appendChild(sp);
      });
      host.querySelector('#micTip').textContent = '第 ' + (idx + 1) + ' / ' + list.length + ' 句';
    }

    function speakLine(slow) {
      var s = list[idx];
      var rate = slow ? 0.5 : 0.78;
      var spans = host.querySelectorAll('#cnLine .ch');
      spans.forEach(function (x) { x.classList.remove('hot'); });
      clearInterval(host._hl);
      var gotBoundary = false;
      S.say(s.cn, {
        rate: rate,
        onboundary: function (e) {
          if (!e || e.charIndex == null) return;
          gotBoundary = true;
          var k = e.charIndex;
          spans.forEach(function (x, i) {
            if (i === k) x.classList.add('hot');
            else x.classList.remove('hot');
            if (i < k) x.classList.add('done');
          });
        },
        onend: function () {
          spans.forEach(function (x) { x.classList.remove('hot'); });
        }
      });
      // 兜底：部分系统的中文语音不触发 boundary，按平均时长高亮
      var i = 0;
      setTimeout(function () {
        if (gotBoundary) return;
        host._hl = setInterval(function () {
          if (i >= spans.length) { clearInterval(host._hl); return; }
          spans.forEach(function (x) { x.classList.remove('hot'); });
          if (spans[i]) { spans[i].classList.add('hot'); spans[i].classList.add('done'); }
          i++;
        }, Math.max(170, 430 / rate));
      }, 900);
    }

    host.querySelector('#btnPlay').onclick = function () { sfx('tap'); speakLine(false); };
    host.querySelector('#btnSlow').onclick = function () { sfx('tap'); speakLine(true); };
    host.querySelector('#btnPrev').onclick = function () { idx = (idx - 1 + list.length) % list.length; renderRead(); };
    host.querySelector('#btnNext2').onclick = function () { idx = (idx + 1) % list.length; renderRead(); };

    host.querySelector('#btnMic').onclick = function () {
      var btn = this;
      var s = list[idx];
      if (!S.recognition.supported) {
        toast('这个浏览器不支持跟读评分，用「听一听」跟读吧');
        return;
      }
      btn.classList.add('rec');
      host.querySelector('#micTip').textContent = '请朗读…';
      S.recognition.start(function (type, data) {
        if (type === 'end') {
          btn.classList.remove('rec');
          var res = S.score(s.cn, data);
          var n = (Store.get().readCount = (Store.get().readCount || 0) + 1);
          if (res.level === 'perfect' || res.level === 'good') {
            sfx('right');
            Store.addStars(2);
            refreshStars(true);
            if (n >= 10) grantBadge('read-10');
            host.querySelector('#micTip').textContent = '👏 读得真棒！' + (res.score >= 100 ? '完全正确' : '继续加油');
          } else {
            host.querySelector('#micTip').textContent = '再试一次，先听一遍范读～';
            S.say(s.cn, { rate: 0.65 });
          }
        } else if (type === 'error') {
          btn.classList.remove('rec');
          host.querySelector('#micTip').textContent = data === 'not-allowed'
            ? '没有麦克风权限，请在浏览器设置里允许'
            : '没听清，再来一次吧';
        }
      });
    };

    renderRead();
    return host;
  }

  /* ---------------- 视图：徽章 / 设置 ---------------- */
  function viewBadges() {
    var host = el('div', 'view');
    var st = Store.stats();
    var html = '<div class="sect-h" style="margin-top:0"><h2>我的徽章</h2><span>' + st.badges + ' / ' + BADGES.length + '</span></div>';
    html += '<div class="badge-grid">';
    BADGES.forEach(function (b) {
      var got = Store.hasBadge(b.id);
      html += '<div class="badge-item' + (got ? ' got' : '') + '">' +
        '<div class="b-emo">' + b.emo + '</div>' +
        '<div class="b-name">' + b.name + '</div></div>';
    });
    html += '</div>';
    html += '<div class="sect-h"><h2>错得最多的</h2><span>多练几遍</span></div>';
    var errs = Object.keys(st.errors).filter(function (k) { return st.errors[k] > 0; })
      .sort(function (a, b) { return st.errors[b] - st.errors[a]; }).slice(0, 12);
    if (!errs.length) {
      html += '<div class="empty"><div class="e-emo">🌤️</div><p>还没有错题，真好！</p></div>';
    } else {
      html += '<div class="zi-grid">';
      errs.forEach(function (k) {
        var label = k.split(':')[1];
        html += '<div class="zi-cell"><span class="z">' + label + '</span><span class="p">错 ' + st.errors[k] + ' 次</span></div>';
      });
      html += '</div>';
    }
    host.innerHTML = html;
    return host;
  }

  function viewSettings() {
    var host = el('div', 'view');
    var st = Store.get().settings;
    var hasVoice = S.hasVoice();
    var html = '<div class="sect-h" style="margin-top:0"><h2>设置</h2><span>给爸爸妈妈</span></div>';
    html += '<div class="unit-list">';
    html += rowSwitch('voice', '🔊 语音朗读', '读字母、读字音', st.voice !== false);
    html += rowSwitch('sfx', '🎵 音效', '答对答错的提示音', st.sfx !== false);
    html += rowSwitch('showToneColor', '🌈 声调颜色', '一声红 二声橙 三声绿 四声蓝', st.showToneColor !== false);
    html += '<div class="unit-row"><span class="u-emo">🐢</span><span class="u-body"><span class="u-t">朗读语速</span>' +
      '<span class="u-s"><input type="range" min="0.5" max="1.2" step="0.05" value="' + (st.rate || 0.85) + '" id="rateRange" style="width:100%"></span></span></div>';
    html += '</div>';
    html += '<div class="sect-h"><h2>语音检查</h2></div>';
    html += '<div class="unit-row"><span class="u-emo">' + (hasVoice ? '✅' : '⚠️') + '</span><span class="u-body">' +
      '<span class="u-t">' + (hasVoice ? '已找到中文语音' : '没有找到中文语音') + '</span>' +
      '<span class="u-s">' + (hasVoice ? S.voiceName() : '请在系统设置里安装中文语音包，或使用 Edge 浏览器') + '</span></span></div>';
    html += '<div class="btn-row" style="margin-top:16px">' +
      '<button class="btn blue" id="testVoice">🔊 试听</button>' +
      '<button class="btn ghost" id="resetAll">🗑 清空进度</button>' +
      '</div>';
    html += '<div class="sect-h"><h2>关于</h2></div>';
    html += '<div class="unit-row"><span class="u-emo">📦</span><span class="u-body"><span class="u-t">生字库</span>' +
      '<span class="u-s">共 ' + DB.meta.count + ' 字 · 必写字 ' + DB.meta.writeCount + ' 个 · ' + DB.meta.edition + '</span></span></div>';
    html += '<div class="unit-row"><span class="u-emo">📝</span><span class="u-body"><span class="u-t">说明</span>' +
      '<span class="u-s">' + DB.meta.note + '</span></span></div>';
    host.innerHTML = html;

    function rowSwitch(id, title, sub, on) {
      return '<div class="unit-row"><span class="u-emo">' + title.split(' ')[0] + '</span>' +
        '<span class="u-body"><span class="u-t">' + title.split(' ').slice(1).join(' ') + '</span>' +
        '<span class="u-s">' + sub + '</span></span>' +
        '<label style="position:relative;display:inline-block;width:70px;height:44px;flex:0 0 auto">' +
        '<input type="checkbox" id="sw_' + id + '" ' + (on ? 'checked' : '') + ' aria-label="' + title + '" style="opacity:0;width:100%;height:100%;position:absolute;margin:0;cursor:pointer">' +
        '<span style="position:absolute;inset:0;border-radius:999px;background:' + (on ? '#51cf66' : '#ccd6e0') + ';transition:.2s"></span>' +
        '<span style="position:absolute;top:5px;left:' + (on ? '32px' : '5px') + ';width:34px;height:34px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 4px rgba(0,0,0,.2)"></span>' +
        '</label></div>';
    }

    host.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.onchange = function () {
        var id = cb.id.replace('sw_', '');
        Store.setting(id, cb.checked);
        if (id === 'voice') S.setEnabled(cb.checked);
        else if (id === 'sfx') { /* 立即生效 */ }
        // 重绘
        navigate('#/settings');
      };
    });
    var rr = host.querySelector('#rateRange');
    if (rr) rr.oninput = function () {
      Store.setting('rate', +rr.value);
      S.setRate(+rr.value);
    };
    host.querySelector('#testVoice').onclick = function () {
      S.say('小朋友你好，我们一起来学拼音吧', { rate: Store.setting('rate') });
    };
    host.querySelector('#resetAll').onclick = function () {
      modal({
        emo: '⚠️',
        title: '确定要清空吗？',
        text: '星星、徽章和练习记录都会消失。',
        buttons: [
          { label: '确定清空', cls: 'primary', onClick: function () { Store.reset(); navigate('#/home'); toast('已清空'); } },
          { label: '不要', cls: 'ghost' }
        ]
      });
    };
    return host;
  }

  /* ---------------- 路由 ---------------- */
  var routes = {
    '#/home': { title: '拼音星球', view: viewHome },
    '#/chart': { title: '拼音地图', view: viewChart },
    '#/initial': { title: '声母认读', view: function () { return gameView(qInitial, '声母认读'); } },
    '#/final': { title: '韵母认读', view: function () { return gameView(qFinal, '韵母认读'); } },
    '#/whole': { title: '整体认读', view: function () { return gameView(qWhole, '整体认读'); } },
    '#/pin': { title: '拼读推一推', view: function () { return gameView(qPin, '拼读推一推'); } },
    '#/tone': { title: '声调小侦探', view: function () { return gameView(qTone, '声调小侦探'); } },
    '#/mix': { title: '每日挑战', view: function () { return gameView(qMix, '每日挑战', 15); } },
    '#/char': { title: '认字卡', view: viewCharPicker },
    '#/char/play': { title: '认字卡', view: viewCharPicker },
    '#/write': { title: '笔顺描红', view: viewWrite },
    '#/read': { title: '朗读小站', view: viewRead },
    '#/badges': { title: '我的徽章', view: viewBadges },
    '#/settings': { title: '设置', view: viewSettings }
  };

  function gameView(gen, title, total) {
    var host = el('div', 'view');
    var g = new Game({ gen: gen, total: total || 10 });
    g.mount(host);
    return host;
  }

  var currentRoute = '#/home';

  function navigate(hash, custom) {
    if (global.location.hash === hash && !custom) return;
    currentRoute = hash;
    if (global.location.hash !== hash && !custom) {
      global.location.hash = hash;
      return; // hashchange 会触发渲染
    }
    render(hash, custom);
  }

  function render(hash, custom) {
    var screen = $('#screen');
    var topbar = $('#topbar');
    var r = routes[hash] || routes['#/home'];
    var isHome = hash === '#/home';

    topbar.innerHTML = '';
    if (!isHome) {
      var back = el('button', 'icon-btn', '←');
      back.setAttribute('aria-label', '返回');
      back.onclick = function () { sfx('tap'); navigate('#/home'); };
      topbar.appendChild(back);
    }
    var t = el('div', 'tb-title');
    t.innerHTML = r.title + (isHome ? '<small>小朋友，今天想学什么？</small>' : '');
    topbar.appendChild(t);

    if (!isHome) {
      var homeBtn = el('button', 'icon-btn ghost', '🏠');
      homeBtn.setAttribute('aria-label', '首页');
      homeBtn.onclick = function () { navigate('#/home'); };
      topbar.appendChild(homeBtn);
    }

    var star = el('div', 'tb-star');
    star.id = 'starWrap';
    star.innerHTML = '<span class="ico">⭐</span><span id="starCount">' + Store.stats().stars + '</span>';
    topbar.appendChild(star);

    screen.scrollTop = 0;
    screen.innerHTML = '';
    S.stop();
    if (custom) {
      var node = custom(screen);
      if (node) screen.appendChild(node);
    } else {
      screen.appendChild(r.view());
    }
    refreshStars(false);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var st = Store.get();
    S.apply(st.settings || {});
    S.setEnabled(st.settings.voice !== false);

    global.addEventListener('hashchange', function () {
      var exact = global.location.hash;
      if (exact.indexOf('#/char/play') === 0) return;
      render(exact);
    });

    // 首次进入提示
    var hash = global.location.hash || '#/home';
    if (hash.indexOf('#/char/play') === 0) hash = '#/char';
    render(routes[hash] ? hash : '#/home');

    if (!global.localStorage.getItem('pinyin-planet-welcomed')) {
      global.localStorage.setItem('pinyin-planet-welcomed', '1');
      setTimeout(function () {
        modal({
          emo: '🪐',
          title: '欢迎来到拼音星球',
          text: '这里的每个小游戏都能玩。建议先点右上角的「⚙️设置」，试试有没有声音～',
          buttons: [{ label: '开始探索！', cls: 'primary' }]
        });
      }, 600);
    }

    // 解锁音频上下文（首次点击）
    document.addEventListener('click', function once() {
      S.init();
      document.removeEventListener('click', once);
    }, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = { navigate: navigate, toast: toast, modal: modal, Game: Game };
})(window);
