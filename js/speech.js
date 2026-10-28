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

  function pickVoice() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    var zh = voices.filter(function (v) { return /^zh/i.test(v.lang) || /Chinese|中文|普通话|Xiaoxiao|Yunxi|Huihui|Kangkang/i.test(v.name); });
    // 优先本地（离线可用）、女声
    zhVoice = zh.filter(function (v) { return v.localService; })[0] || zh[0] || null;
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

    /**
     * 朗读
     * @param {string} text 要读的文字
     * @param {object} opt { rate, pitch, interrupt, onend }
     */
    say: function (text, opt) {
      opt = opt || {};
      if (!enabled || !synth || !text) { if (opt.onend) setTimeout(opt.onend, 60); return; }
      if (!voices.length) pickVoice();
      try {
        if (opt.interrupt !== false) synth.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        if (zhVoice) u.voice = zhVoice;
        u.rate = opt.rate != null ? opt.rate : rate;
        u.pitch = opt.pitch != null ? opt.pitch : 1.15;
        u.volume = 1;
        if (opt.onend) u.onend = opt.onend;
        if (opt.onerror) u.onerror = opt.onerror;
        if (opt.onboundary) u.onboundary = opt.onboundary;
        synth.speak(u);
      } catch (e) { if (opt.onend) opt.onend(); }
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
