/* =========================================================================
 * 拼音星球 · 本地存储
 * 记录：星星、徽章、连胜、每张卡的掌握度、错题统计、设置
 * ========================================================================= */
(function (global) {
  'use strict';
  var KEY = 'pinyin-planet-v1';
  var DEFAULT = {
    stars: 0,
    streak: 0,          // 连续答对
    bestStreak: 0,
    badges: {},         // id -> 获得时间
    cards: {},          // key -> { right, wrong, last, box }  box: 0..5 记忆盒
    errors: {},         // 错题 key -> 次数
    days: {},           // '2026-01-01' -> 当日题数
    settings: { voice: true, sfx: true, rate: 0.85, asr: false, showToneColor: true },
    unlocked: 1,        // 已解锁的关卡数（渐进开放）
    sel: { book: 'all' }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = null;

  function load() {
    if (state) return state;
    try {
      var raw = global.localStorage.getItem(KEY);
      state = raw ? merge(clone(DEFAULT), JSON.parse(raw)) : clone(DEFAULT);
    } catch (e) {
      state = clone(DEFAULT);
    }
    return state;
  }

  function merge(base, patch) {
    for (var k in patch) {
      if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && base[k] && typeof base[k] === 'object') {
        merge(base[k], patch[k]);
      } else base[k] = patch[k];
    }
    return base;
  }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var api = {
    get: function () { return load(); },
    reset: function () { state = clone(DEFAULT); save(); return state; },
    today: today,

    addStars: function (n) {
      var s = load();
      s.stars += n;
      s.days[today()] = (s.days[today()] || 0) + Math.abs(n);
      save();
      return s.stars;
    },

    /** 答题结果：key 为卡片唯一键（如 'py:b'、'ch:天'） */
    answer: function (key, ok) {
      var s = load();
      var card = s.cards[key] || { right: 0, wrong: 0, box: 0 };
      if (ok) {
        card.right++;
        card.box = Math.min(5, card.box + 1);
        s.streak++;
        if (s.streak > s.bestStreak) s.bestStreak = s.streak;
        s.stars += 1;
        if (s.errors[key]) s.errors[key] = Math.max(0, s.errors[key] - 1);
      } else {
        card.wrong++;
        card.box = Math.max(0, card.box - 1);
        s.streak = 0;
        s.errors[key] = (s.errors[key] || 0) + 1;
      }
      card.last = Date.now();
      s.cards[key] = card;
      s.days[today()] = (s.days[today()] || 0) + 1;
      save();
      return card;
    },

    mastery: function (key) {
      var s = load(), c = s.cards[key];
      if (!c) return 0;
      var total = c.right + c.wrong;
      return total ? c.right / total : 0;
    },

    box: function (key) {
      var c = load().cards[key];
      return c ? c.box : 0;
    },

    /** 取最需要复习的键 */
    needReview: function (keys, limit) {
      var s = load();
      var scored = keys.map(function (k) {
        var c = s.cards[k];
        if (!c) return { k: k, score: 0 };
        return { k: k, score: (c.box + 1) * 10 - c.right + c.wrong * 3 };
      });
      scored.sort(function (a, b) { return (a.score - b.score) || (Math.random() - 0.5); });
      return scored.slice(0, limit || 10).map(function (x) { return x.k; });
    },

    badge: function (id, name) {
      var s = load();
      if (s.badges[id]) return false;
      s.badges[id] = Date.now();
      save();
      return name || true;
    },

    hasBadge: function (id) { return !!load().badges[id]; },

    setting: function (k, v) {
      var s = load();
      if (v === undefined) return s.settings[k];
      s.settings[k] = v; save(); return v;
    },

    stats: function () {
      var s = load();
      var cards = 0, mastered = 0, learning = 0;
      for (var k in s.cards) {
        cards++;
        if (s.cards[k].box >= 4) mastered++;
        else if (s.cards[k].box >= 1) learning++;
      }
      return {
        stars: s.stars, streak: s.streak, bestStreak: s.bestStreak,
        badges: Object.keys(s.badges).length, cards: cards,
        mastered: mastered, learning: learning,
        today: s.days[today()] || 0,
        errors: s.errors
      };
    }
  };

  global.Store = api;
})(window);
