/* =========================================================================
 * 拼音星球 · 内置语音
 * 「拼音教读」里 声母 / 韵母 / 拼一拼 的声音是**预先做好的 MP3**（assets/voice/），
 * 不是系统朗读——这样：
 *   · 读得准：声母、韵母单独念不好读，系统 TTS 常常读成英文字母或错声调；
 *   · 音色统一：电脑、手机、平板听到的都是同一个自然的人声，还能真·童声；
 *   · 离线可用：设备没装中文语音包也有声音。
 * 找不到文件（比如只拷了一半）就自动退回系统朗读。
 * ========================================================================= */
(function (global) {
  'use strict';

  var BASE = 'assets/voice/';
  var MAN = global.VOICE_MANIFEST || {};
  var enabled = true;
  var cache = {};          // 'kind/id' → Audio
  var playing = null;
  var stats = { ok: 0, miss: 0, err: 0 };

  function list(kind) { return MAN[kind] || null; }

  function has(kind, id) {
    var m = list(kind);
    return !!(m && m[id]);
  }

  function dur(kind, id) {
    var m = list(kind);
    return (m && m[id]) || 0;
  }

  function url(kind, id) { return BASE + kind + '/' + id + '.mp3'; }

  function el(kind, id) {
    var k = kind + '/' + id;
    if (cache[k]) return cache[k];
    var a = new Audio();
    a.preload = 'auto';
    a.src = url(kind, id);
    // 慢放时保持音高（各家浏览器的写法不一样，都设一遍）
    a.preservesPitch = true;
    a.mozPreservesPitch = true;
    a.webkitPreservesPitch = true;
    cache[k] = a;
    return a;
  }

  /**
   * 播一条
   * @param {string} kind female | male | child
   * @param {string} id   如 ini-b / fin-a / bl-3 / bw-3
   * @param {object} opt  { slow:boolean, rate:number }
   * @returns {Promise<string>} 'ok' | 'miss' | 'error' | 'off'
   */
  function play(kind, id, opt) {
    opt = opt || {};
    return new Promise(function (resolve) {
      if (!enabled) return resolve('off');
      if (!has(kind, id)) { stats.miss++; return resolve('miss'); }
      var a = el(kind, id);
      var done = false;
      var timedOut = false;
      function fin(r) {
        if (done) return;
        done = true;
        a.onended = null;
        a.onerror = null;
        if (!timedOut) { if (r === 'ok') stats.ok++; else if (r === 'error') stats.err++; }
        resolve(r);
      }
      try {
        a.pause();
        a.currentTime = 0;
        a.playbackRate = opt.slow ? (opt.rate || 0.72) : 1;
      } catch (e) { return fin('error'); }
      a.onended = function () { fin('ok'); };
      a.onerror = function () { fin('error'); };
      playing = a;
      var p;
      try { p = a.play(); } catch (e) { return fin('error'); }
      if (p && p.catch) p.catch(function () { fin('error'); });
      // 兜底：真卡住了也要往下走（算作播过，别再用系统朗读重复一遍）
      setTimeout(function () {
        timedOut = true;
        fin('ok');
      }, Math.max(2500, (dur(kind, id) || 900) * (opt.slow ? 1.8 : 1.2) + 1500));
    });
  }

  function stop() {
    if (playing) { try { playing.pause(); } catch (e) { } playing = null; }
  }

  function preload(kind, ids) {
    (ids || []).forEach(function (id) { if (has(kind, id)) el(kind, id).load(); });
  }

  /** 实际有内置语音吗（防止只拷了一半的仓库） */
  function available(kind) {
    var m = list(kind);
    return !!(m && Object.keys(m).length > 20);
  }

  global.VOICE = {
    has: has,
    dur: dur,
    url: url,
    play: play,
    stop: stop,
    preload: preload,
    available: available,
    list: list,
    stats: function () { return { ok: stats.ok, miss: stats.miss, err: stats.err }; },
    setEnabled: function (v) { enabled = !!v; if (!v) stop(); },
    enabled: function () { return enabled; }
  };
})(window);
