/* =========================================================================
 * 拼音星球 · 发声
 * 1) 朗读：Web Speech API（zh-CN），支持单字、拼音、句子
 * 2) 音效：Web Audio 合成（叮咚/错误/星星），不依赖音频文件
 * 3) 跟读评分：webkitSpeechRecognition（Chrome/Edge 可用，可选）
 * ========================================================================= */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis || null;
  var voices = [];
  var zhVoice = null;
  var enabled = true;
  var rate = 0.85;

  /* ---------- 音色：女声 / 男声 / 童声 ---------- */
  var kind = 'female';          // female | male | child
  var wantName = '';            // 手动指定的发音人（空 = 自动挑）
  // 系统里一般没有真正的童声，只能把女声调高一点；1.62 太尖（像卡通松鼠），1.42 自然些
  var KIND_PITCH = { female: 1.15, male: 0.8, child: 1.42 };
  var KIND_RATE = { female: 1, male: 1, child: 0.95 };

  var FEMALE_RE = /Huihui|Yaoyao|Xiaoxiao|Xiaoyi|Xiaohan|Xiaomo|Xiaoxuan|Xiaorui|Xiaoshuang|Yunxia|Yuning|Yunye|Yunmeng|Female|女/i;
  var MALE_RE = /Kangkang|Yunxi|Yunjian|Yunyang|Yunfeng|Yunhao|Yunze|Yunjie|Yunbo|Yunye-male|Male|男/i;

  function isZh(v) {
    return /^zh/i.test(v.lang) || /Chinese|中文|普通话|Xiaoxiao|Yunxi|Huihui|Kangkang|Yaoyao/i.test(v.name);
  }

  function sexOf(v) {
    var n = (v.name || '') + ' ' + (v.voiceURI || '');
    if (FEMALE_RE.test(n)) return 'female';   // 先判女声，避免 Yunxia 被 Yunxi 抢走
    if (MALE_RE.test(n)) return 'male';
    return '';
  }

  function zhVoices() {
    return (voices || []).filter(function (v) { return isZh(v); });
  }

  function pickVoice() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    var zh = zhVoices();
    if (!zh.length) { zhVoice = null; return; }

    // 1) 手动指定
    if (wantName) {
      for (var i = 0; i < zh.length; i++) if (zh[i].name === wantName) { zhVoice = zh[i]; return; }
    }
    // 2) 按音色挑
    var want = kind === 'male' ? 'male' : 'female';
    var pref = zh.filter(function (v) { return sexOf(v) === want; });
    if (!pref.length) pref = zh;
    // 3) 有网时优先"神经语音"（Natural/Online）：比老式的 Huihui 好听太多；
    //    没网就退回本地发音人（离线也能读）
    var nat = pref.filter(function (v) { return /Natural|Online|Neural/i.test(v.name); });
    var local = pref.filter(function (v) { return v.localService; });
    var online = !global.navigator || global.navigator.onLine !== false;
    zhVoice = (online && nat[0]) || local[0] || nat[0] || pref[0];
  }
  if (synth) {
    pickVoice();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = pickVoice;
  }

  var audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  /** 单音（钢琴感）：freq 频率，dur 秒 */
  function tone(freq, dur, when, gainVal) {
    var c = ctx();
    if (!c) return;
    var t0 = c.currentTime + (when || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal == null ? 0.18 : gainVal, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  var SFX = {
    tap: function () { tone(880, 0.07, 0, 0.08); },
    right: function () { tone(784, 0.12, 0); tone(1046, 0.18, 0.1); },
    wrong: function () { tone(311, 0.18, 0, 0.12); tone(233, 0.22, 0.12, 0.12); },
    star: function () { tone(1046, 0.1, 0); tone(1318, 0.1, 0.08); tone(1568, 0.22, 0.16); },
    badge: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.24, i * 0.12, 0.16); }); },
    sweep: function () { tone(300, 0.3, 0, 0.06); tone(600, 0.3, 0.08, 0.05); }
  };

  var api = {
    init: pickVoice,

    setEnabled: function (v) { enabled = !!v; if (!v && synth) synth.cancel(); },
    setRate: function (v) { rate = v; },
    hasVoice: function () { if (!voices.length) pickVoice(); return !!zhVoice; },
    voiceName: function () { if (!voices.length) pickVoice(); return zhVoice ? zhVoice.name : ''; },

    /** 音色：female / male / child */
    setKind: function (k) {
      kind = KIND_PITCH[k] ? k : 'female';
      pickVoice();
      return kind;
    },
    kind: function () { return kind; },
    kindLabel: function () { return kind === 'male' ? '男声' : kind === 'child' ? '童声' : '女声'; },
    sex: function () { return zhVoice ? sexOf(zhVoice) : ''; },

    /** 手动指定发音人；传空字符串 = 自动 */
    setVoiceName: function (n) { wantName = n || ''; pickVoice(); },
    voiceNameSetting: function () { return wantName; },

    /** 设备上所有中文发音人，供设置页选择 */
    voiceList: function () {
      if (!voices.length) pickVoice();
      return zhVoices().map(function (v) {
        return { name: v.name, lang: v.lang, local: !!v.localService, sex: sexOf(v) };
      });
    },

    /**
     * 朗读
     * @param {string} text 要读的文字
     * @param {object} opt { rate, pitch, interrupt, onend, onboundary, onerror }
     */
    say: function (text, opt) {
      opt = opt || {};
      if (!enabled || !synth || !text) { if (opt.onend) setTimeout(opt.onend, 60); return; }
      if (!voices.length) pickVoice();
      try {
        if (opt.interrupt !== false) synth.cancel();
        speakWith(zhVoice, false);
      } catch (e) { if (opt.onend) opt.onend(); }

      /** 在线语音有时一直不开口（断网 / 被浏览器拦），1.6 秒没动静就换本地的 */
      function speakWith(voice, isRetry) {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        if (voice) u.voice = voice;
        // 音色靠 音调 体现（系统里通常没有童声，就把女声调高、调慢）
        var basePitch = opt.pitch != null ? opt.pitch : 1.15;
        var p = basePitch * (KIND_PITCH[kind] || 1.15) / 1.15;
        u.pitch = Math.max(0.1, Math.min(2, p));
        var baseRate = opt.rate != null ? opt.rate : rate;
        u.rate = Math.max(0.1, Math.min(2, baseRate * (KIND_RATE[kind] || 1)));
        u.volume = 1;
        if (opt.onend) u.onend = opt.onend;
        if (opt.onerror) u.onerror = opt.onerror;
        if (opt.onboundary) u.onboundary = opt.onboundary;
        if (!isRetry && voice && voice.localService === false) {
          var started = false;
          var wd = setTimeout(function () {
            if (started) return;
            var alt = localAlt(voice);
            if (!alt) return;
            try { synth.cancel(); } catch (e) { }
            speakWith(alt, true);
          }, 1600);
          u.onstart = function () { started = true; clearTimeout(wd); };
        }
        synth.speak(u);
      }

      /** 挑一个本地中文发音人（优先同性别），在线语音哑火时兜底 */
      function localAlt(cur) {
        var list = zhVoices().filter(function (v) { return v.localService && v !== cur; });
        if (!list.length) return null;
        var want = kind === 'male' ? 'male' : 'female';
        return list.filter(function (v) { return sexOf(v) === want; })[0] || list[0];
      }
    },

    /** 读一个音节：尽量用"字音"读准（拼音直接读会读成英文字母） */
    saySyllable: function (syllable, opt) {
      opt = opt || {};
      var ch = (opt.char || '').trim();
      if (ch) return api.say(ch, Object.assign({ rate: 0.8 }, opt));
      return api.say(syllable, Object.assign({ rate: 0.7, pitch: 1.2 }, opt));
    },

    /** 依次朗读多个片段，间隔 gap 毫秒 */
    saySeq: function (list, gap, done) {
      var i = 0;
      function next() {
        if (i >= list.length) { if (done) done(); return; }
        var item = list[i++];
        api.say(item.text != null ? item.text : item, {
          rate: item.rate != null ? item.rate : rate,
          pitch: item.pitch != null ? item.pitch : 1.15,
          onend: function () { setTimeout(next, gap == null ? 260 : gap); }
        });
      }
      next();
    },

    sfx: function (name) {
      if (!enabled) return;
      var fn = SFX[name];
      if (fn) { try { fn(); } catch (e) { } }
    },

    stop: function () { if (synth) synth.cancel(); },

    /** 应用设置 */
    apply: function (st) {
      enabled = st.voice !== false;
      rate = st.rate || 0.85;
      kind = KIND_PITCH[st.voiceKind] ? st.voiceKind : 'female';
      wantName = st.voiceName || '';
      pickVoice();
    }
  };

  /* ---------------- 跟读识别（可选） ---------------- */
  var Rec = (function () {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    var supported = !!SR;
    var recog = null;
    var listening = false;

    function start(cb) {
      if (!supported) { cb('unsupported'); return; }
      if (listening) { try { recog.stop(); } catch (e) { } }
      try {
        recog = new SR();
        recog.lang = 'zh-CN';
        recog.interimResults = true;
        recog.maxAlternatives = 3;
        recog.continuous = false;
        var finalText = '';
        recog.onresult = function (ev) {
          var interim = '';
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            var r = ev.results[i];
            if (r.isFinal) finalText += r[0].transcript;
            else interim += r[0].transcript;
          }
          cb('interim', interim);
        };
        recog.onerror = function (e) { listening = false; cb('error', e.error); };
        recog.onend = function () { listening = false; cb('end', finalText); };
        recog.start();
        listening = true;
        return true;
      } catch (e) {
        listening = false;
        cb('error', 'start-failed');
        return false;
      }
    }

    function stop() { if (recog) { try { recog.stop(); } catch (e) { } } listening = false; }

    return { supported: supported, start: start, stop: stop, listening: function () { return listening; } };
  })();

  api.recognition = Rec;

  /** 简易评分：把识别文本和目标字比对 */
  api.score = function (target, heard) {
    if (!heard) return { score: 0, level: 'none' };
    var t = target.replace(/[^\u4e00-\u9fff]/g, '');
    var h = heard.replace(/[^\u4e00-\u9fff]/g, '');
    if (!t) return { score: 0, level: 'none' };
    if (h.indexOf(t) >= 0) return { score: 100, level: 'perfect' };
    var hit = 0;
    for (var i = 0; i < t.length; i++) if (h.indexOf(t[i]) >= 0) hit++;
    var s = Math.round(hit / t.length * 100);
    return { score: s, level: s >= 100 ? 'perfect' : s >= 50 ? 'good' : 'retry' };
  };

  global.Speech = api;
})(window);
