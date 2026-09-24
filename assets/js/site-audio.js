/* ============================================================
   头部背景音乐
   ------------------------------------------------------------
   控制条：当前曲名 · 随机 · 上一首 · 播放/暂停 · 下一首 · 播放列表 · 静音
   · 曲名显示在控件最左侧，切歌（手动 / 播完自动）都会同步更新
   · 音量条紧挨静音键：拖动即调，拖到 0 等于静音；音量记在本机
     默认满音量，所以整体响度仍由设备音量决定
   · 播放列表弹层里可直接选曲，当前曲目标红
   · 进站默认曲目：Kids（不记忆上次听的歌，每次进站都回到它）
   · 自动播放触发：用户登录后，或开始滑动页面时，自动开播
   · 除非用户自己关闭（暂停）或静音过，否则保持自动开播；
     手动开播 / 取消静音会重新允许自动播放
   · 被浏览器自动播放策略拦下时退一步静音开播，并在首次交互时取消静音
   · 上一首在播满 3 秒后先回到本曲开头（与主流播放器一致）
   · 随机开着时，上一首/下一首/播完自动切歌都走随机
   · preload="none"：没真正播放前不下载，省流量
   ============================================================ */
(function () {
  'use strict';

  var audio = document.getElementById('site-audio');
  var toggle = document.getElementById('audio-toggle');
  var muteBtn = document.getElementById('audio-mute');
  var prevBtn = document.getElementById('audio-prev');
  var nextBtn = document.getElementById('audio-next');
  var shuffleBtn = document.getElementById('audio-shuffle');
  var listBtn = document.getElementById('audio-playlist-button');
  var panel = document.getElementById('audio-playlist');
  var listEl = document.getElementById('audio-track-list');
  var indexEl = document.getElementById('audio-track-index');
  var nowEl = document.getElementById('audio-now');
  var nowTitle = document.getElementById('audio-now-title');
  var volumeInput = document.getElementById('audio-volume');
  var importBtn = document.getElementById('audio-import');
  var importInput = document.getElementById('audio-import-input');
  if (!audio || !toggle || !muteBtn || !prevBtn || !nextBtn) return;

  var TRACKS = [
    { title: 'Running Up That Hill', src: 'assets/audio/up-that-hill.mp3' },
    { title: 'Kids', src: 'assets/audio/kids.mp3' }
  ];
  var STORAGE_KEY = 'upsideDownAudio.v1';
  var DEFAULT_INDEX = 1;      /* Kids（TRACKS 第 2 首）——进站默认就是它 */
  var DEFAULT_VOLUME = 1;     /* 满音量起步，整体响度再交给设备音量 */
  var state = { index: DEFAULT_INDEX, muted: false, shuffle: false, volume: DEFAULT_VOLUME, autoplay: true };

  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object') {
      /* 曲目不记忆：每次进站都回到默认那首，不沿用上次听到的歌 */
      /* 静音也不记忆：每次进站默认不静音（本次会话内仍可手动静音） */
      if (typeof saved.shuffle === 'boolean') state.shuffle = saved.shuffle;
      if (typeof saved.volume === 'number' && isFinite(saved.volume)) {
        state.volume = Math.min(1, Math.max(0, saved.volume));
      }
      /* 用户曾手动关闭 / 静音过 → 记下来，不再自动开播 */
      if (typeof saved.autoplay === 'boolean') state.autoplay = saved.autoplay;
    }
  } catch (error) { /* 忽略坏数据 */ }
  if (!TRACKS[state.index]) state.index = 0;

  audio.volume = state.volume; /* 不做额外衰减：整体响度跟随设备音量，细调交给音量条 */
  audio.muted = state.muted;
  audio.src = TRACKS[state.index].src;

  /* 与开场过场音乐互通：带 index.html#t=秒数 时，从该进度接着播，
     避免「开场放了一段、进站后又从头开始」 */
  (function () {
    var raw = (location.hash || '') + '&' + (location.search || '');
    var m = /[#&?]t=([\d.]+)/.exec(raw);
    var seek = m ? Number(m[1]) : NaN;
    if (!isFinite(seek) || seek <= 0) return;
    var apply = function () { try { audio.currentTime = seek; } catch (error) {} };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener('loadedmetadata', apply, { once: true });
  })();

  function save() {
    /* 记静音、随机、音量，以及“是否允许自动播放”（用户手动关/静音后置否） */
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: state.muted, shuffle: state.shuffle, volume: state.volume, autoplay: state.autoplay }));
    } catch (error) {}
  }

  /* 播放列表弹层 */
  function buildList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    TRACKS.forEach(function (track, i) {
      var item = document.createElement('li');
      item.className = 'audio-playlist__row';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'audio-playlist__item';
      btn.setAttribute('role', 'menuitemradio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('data-track', String(i));
      btn.innerHTML =
        '<span class="audio-playlist__no">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
        '<span class="audio-playlist__title"></span>' +
        '<span class="audio-playlist__state"></span>';
      btn.querySelector('.audio-playlist__title').textContent = track.title;
      item.appendChild(btn);
      if (track.user) {
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'audio-playlist__del';
        del.setAttribute('data-track-del', String(i));
        del.setAttribute('aria-label', '移除 ' + track.title);
        del.setAttribute('title', '移除');
        del.textContent = '✕';
        item.appendChild(del);
      }
      listEl.appendChild(item);
    });
  }
  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (listBtn) listBtn.setAttribute('aria-expanded', 'false');
  }

  /* ---------- 图标形变（▶↔❚❚、声波↔✕）----------
     原理与 MorphIcon 相同：把同一个图标的两套形状写成结构完全一致的路径
     （命令序列相同、数字个数相同），运行时逐数字插值就能平滑变形。
     这里是零依赖的原生实现，不需要 React / Vue，也不需要打包工具。 */
  /* 暂停的两条竖条之间留足缝隙：路径描边 1.2px 会把缝隙两侧各扩 0.6，
     缝隙太小就会糊成一条（之前 1.4px 缝隙 + 1.5px 描边就是这个毛病） */
  var PLAY_SHAPE = 'M9.6 6.4L18.8 12L9.6 17.6L9.6 12ZM12.1 12L12.1 12L12.1 12L12.1 12Z';
  var PAUSE_SHAPE = 'M8 6.4L10 6.4L10 17.6L8 17.6ZM14.2 6.4L16.2 6.4L16.2 17.6L14.2 17.6Z';
  var SPEAK_ON = 'M14.2 9.6C15.53 10.93 15.53 13.07 14.2 14.4M17 7.4C19.54 10.17 19.54 13.83 17 16.6';
  var SPEAK_OFF = 'M14.4 9.7C15.87 11.23 17.33 12.77 18.8 14.3M18.8 9.7C17.33 11.23 15.87 12.77 14.4 14.3';

  var NUMBER = /-?\d+(?:\.\d+)?/g;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var firstPaint = true;      /* 首帧直接就位，不做动画 */

  function shapeNumbers(d) { return (d.match(NUMBER) || []).map(Number); }

  function makeMorph(selector, shapeA, shapeB) {
    var el = document.querySelector(selector);
    if (!el) return null;
    var a = shapeNumbers(shapeA);
    var b = shapeNumbers(shapeB);
    var cur = shapeNumbers(el.getAttribute('d') || shapeA);
    if (a.length !== b.length || cur.length !== a.length) return null;   /* 结构不一致就不硬来 */
    return { el: el, tpl: shapeA.replace(NUMBER, '\u0001'), a: a, b: b, cur: cur, raf: 0 };
  }

  function writeShape(morph, values) {
    var i = 0;
    morph.el.setAttribute('d', morph.tpl.replace(/\u0001/g, function () {
      return String(Math.round(values[i++] * 100) / 100);
    }));
  }

  /* 轻微回弹收尾，和主流播放器的手感一致 */
  function easeOutBack(t) {
    var c1 = 1.1;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function morphTo(morph, target, instant) {
    if (!morph) return;
    var next = target ? morph.b : morph.a;
    var same = true;
    for (var i = 0; i < next.length; i++) {
      if (Math.abs(next[i] - morph.cur[i]) > 0.01) { same = false; break; }
    }
    if (same) return;
    if (morph.raf) { cancelAnimationFrame(morph.raf); morph.raf = 0; }
    if (instant || reduceMotion) {
      morph.cur = next.slice();
      writeShape(morph, morph.cur);
      return;
    }
    var from = morph.cur.slice();
    var t0 = performance.now();
    var DURATION = 260;
    (function frame(now) {
      var t = Math.min(1, (now - t0) / DURATION);
      var k = easeOutBack(t);
      for (var j = 0; j < from.length; j++) morph.cur[j] = from[j] + (next[j] - from[j]) * k;
      writeShape(morph, morph.cur);
      if (t < 1) {
        morph.raf = requestAnimationFrame(frame);
      } else {
        morph.raf = 0;
        morph.cur = next.slice();
        writeShape(morph, morph.cur);
      }
    }(performance.now()));
  }

  var playMorph = makeMorph('#audio-icon-play', PLAY_SHAPE, PAUSE_SHAPE);
  var muteMorph = makeMorph('#audio-icon-waves', SPEAK_ON, SPEAK_OFF);

  function render() {
    var playing = !audio.paused;
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
    toggle.setAttribute('title', playing ? '暂停' : '播放');

    muteBtn.setAttribute('aria-pressed', String(audio.muted));
    muteBtn.setAttribute('aria-label', audio.muted ? '取消静音' : '静音');
    muteBtn.setAttribute('title', audio.muted ? '取消静音' : '静音');

    /* 音量条：位置始终代表记住的音量（没额外衰减），静音时只把整条压暗，
       这样既能一眼看出「静音」，也不会把滑块重置成 0 而丢掉音量 */
    if (volumeInput) {
      var percent = Math.round(state.volume * 100);
      volumeInput.value = String(percent);
      volumeInput.style.setProperty('--volume', percent + '%');
      volumeInput.setAttribute('aria-valuetext', percent + '%');
      volumeInput.title = audio.muted ? '已静音：拖动即可恢复声音（音量 ' + percent + '%）' : '音量 ' + percent + '%';
    }

    /* 图标形状跟着状态形变：▶↔❚❚、声波↔✕ */
    morphTo(playMorph, playing ? 1 : 0, firstPaint);
    morphTo(muteMorph, audio.muted ? 1 : 0, firstPaint);

    if (shuffleBtn) {
      shuffleBtn.setAttribute('aria-pressed', String(state.shuffle));
      shuffleBtn.setAttribute('title', state.shuffle ? '随机播放：已开启' : '随机播放：已关闭');
    }

    var current = TRACKS[state.index];
    if (indexEl) indexEl.textContent = (state.index + 1) + '/' + TRACKS.length;
    /* 控件最左侧的当前曲名：切歌时跟着换 */
    if (nowTitle) nowTitle.textContent = current.title;
    if (nowEl) {
      nowEl.setAttribute('data-playing', String(playing));
      nowEl.setAttribute('title', (playing ? '正在播放：' : '已暂停：') + current.title + '（点击打开播放列表）');
      nowEl.setAttribute('aria-label', (playing ? '正在播放：' : '已暂停：') + current.title);
    }
    if (listBtn) {
      listBtn.setAttribute('title', '播放列表 · 当前：' + current.title);
      listBtn.setAttribute('aria-label', '播放列表，当前曲目 ' + current.title);
    }
    if (listEl) {
      Array.prototype.forEach.call(listEl.querySelectorAll('[data-track]'), function (btn) {
        var isCurrent = Number(btn.getAttribute('data-track')) === state.index;
        btn.setAttribute('aria-checked', String(isCurrent));
        var stateEl = btn.querySelector('.audio-playlist__state');
        if (stateEl) stateEl.textContent = isCurrent ? (playing ? '播放中' : '已选') : '';
      });
    }
  }

  function resume() {
    var attempt = audio.play();
    if (attempt && attempt.catch) {
      attempt.catch(function (error) {
        console.warn('[audio] 播放被阻止：', error && error.message);
        render();
      });
    }
  }
  function unmute() {
    if (!audio.muted) return;
    audio.muted = false;
    state.muted = false;
    save();
  }
  /* 随机开着时取另一首，否则按方向前后走 */
  function stepIndex(dir) {
    if (state.shuffle && TRACKS.length > 1) {
      var pool = [];
      for (var i = 0; i < TRACKS.length; i++) { if (i !== state.index) pool.push(i); }
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return (state.index + dir + TRACKS.length) % TRACKS.length;
  }
  function load(index, autoplay, withSound) {
    state.index = index;
    audio.src = TRACKS[index].src;
    save();
    if (autoplay) {
      if (withSound) unmute();
      resume();
    }
    if (window.showSiteToast) window.showSiteToast('背景音乐 · ' + TRACKS[index].title);
    render();
  }

  /* 播放 / 暂停 */
  toggle.addEventListener('click', function () {
    if (audio.paused) {
      unmute();       /* 点播放＝想听，顺手取消静音，避免「点了没声音」 */
      resume();
      state.autoplay = true;     /* 用户手动开播 → 重新允许自动播放 */
      save();
    } else {
      audio.pause();
      state.autoplay = false;    /* 用户手动关闭 → 不再自动开播 */
      save();
    }
  });

  /* 上一首：播满 3 秒先回本曲开头 */
  prevBtn.addEventListener('click', function () {
    var wasPlaying = !audio.paused;
    if (!state.shuffle && audio.currentTime > 3) {
      audio.currentTime = 0;
      render();
      return;
    }
    load(stepIndex(-1), wasPlaying, false);
  });

  /* 下一首 */
  nextBtn.addEventListener('click', function () {
    load(stepIndex(1), !audio.paused, false);
  });

  /* 静音 / 取消静音 */
  muteBtn.addEventListener('click', function () {
    audio.muted = !audio.muted;
    /* 音量条曾在 0 上（等于静音过）时，取消静音给一个听得见的音量 */
    if (!audio.muted && state.volume === 0) state.volume = 0.6;
    audio.volume = state.volume;
    state.muted = audio.muted;
    state.autoplay = !audio.muted;   /* 静音 → 禁止自动播放；取消静音 → 允许 */
    save();
    render();
  });

  /* 音量条：拖动即调；拖到 0 就是静音，从 0 拖起来自动解除静音 */
  if (volumeInput) {
    volumeInput.addEventListener('input', function () {
      var level = Math.min(1, Math.max(0, Number(volumeInput.value) / 100));
      state.volume = level;
      audio.volume = level;
      audio.muted = level === 0;
      state.muted = audio.muted;
      state.autoplay = !audio.muted;  /* 拖到 0 静音 → 禁止自动播放；拖起 → 允许 */
      save();
      render();
    });
  }

  /* 随机播放开关 */
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', function () {
      state.shuffle = !state.shuffle;
      save();
      render();
      if (window.showSiteToast) window.showSiteToast(state.shuffle ? '随机播放：已开启' : '随机播放：已关闭');
    });
  }

  /* 播放列表弹层：打开、选曲、点外面或 Esc 收起 */
  function togglePanel() {
    if (!panel) return;
    if (panel.hidden) {
      panel.hidden = false;
      if (listBtn) listBtn.setAttribute('aria-expanded', 'true');
    } else {
      closePanel();
    }
  }

  if (panel) {
    /* 播放列表键和左侧曲名都能开合弹层 */
    [listBtn, nowEl].forEach(function (trigger) {
      if (!trigger) return;
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        togglePanel();
      });
    });
    panel.addEventListener('click', function (event) {
      var del = event.target.closest('[data-track-del]');
      if (del) { removeUserTrack(Number(del.getAttribute('data-track-del'))); return; }
      var item = event.target.closest('[data-track]');
      if (!item) return;
      var index = Number(item.getAttribute('data-track'));
      if (index === state.index) {
        if (audio.paused) { unmute(); resume(); state.autoplay = true; } else { audio.pause(); state.autoplay = false; }
        save();
      } else {
        state.autoplay = true;
        load(index, true, true);
      }
      closePanel();
    });
    document.addEventListener('click', function (event) {
      if (panel.hidden) return;
      if (panel.contains(event.target)) return;
      if (listBtn && listBtn.contains(event.target)) return;
      if (nowEl && nowEl.contains(event.target)) return;
      closePanel();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closePanel();
    });
  }

  /* ---------- 本地音乐：持久化到 IndexedDB（存 blob，刷新 / 重开仍在，不上传服务器） ---------- */
  var DB_NAME = 'upsideDownAudio', DB_VERSION = 1, DB_STORE = 'userTracks';
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('indexedDB 不支持')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function dbPut(rec) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(rec);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function dbGetAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var tx = db.transaction(DB_STORE, 'readonly');
        var cur = tx.objectStore(DB_STORE).openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { out.push(c.value); c.continue(); } else { resolve(out); }
        };
        cur.onerror = function () { reject(cur.error); };
      });
    });
  }
  function dbDelete(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function isAudioFile(file) {
    if (file.type && /^audio\//.test(file.type)) return true;
    return /\.(mp3|wav|ogg|m4a|aac|flac|webm|oga|opus)$/i.test(file.name || '');
  }
  /* 导入：入内存播放列表 + 落地到 IndexedDB（存原始 blob） */
  function addUserTracks(files) {
    if (!files || !files.length) return;
    var added = 0;
    Array.prototype.forEach.call(files, function (file) {
      if (!isAudioFile(file)) return;
      var id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      var name = (file.name || '未命名音频').replace(/\.[^.]+$/, '');
      TRACKS.push({ id: id, title: name, src: URL.createObjectURL(file), user: true });
      dbPut({ id: id, title: name, blob: file }).catch(function () {});
      added++;
    });
    if (!added) {
      if (window.showSiteToast) window.showSiteToast('没有识别到音频文件');
      return;
    }
    buildList();
    render();
    if (window.showSiteToast) window.showSiteToast('已导入 ' + added + ' 首本地音乐');
  }
  /* 移除导入曲目：从内存与 IndexedDB 一并删除 */
  function removeUserTrack(index) {
    var track = TRACKS[index];
    if (!track || !track.user) return;
    var wasCurrent = state.index === index;
    if (track.id) dbDelete(track.id).catch(function () {});
    TRACKS.splice(index, 1);
    if (state.index > index) {
      state.index -= 1;
    } else if (wasCurrent) {
      if (state.index >= TRACKS.length) state.index = TRACKS.length - 1;
      if (state.index < 0) state.index = 0;
    }
    if (!TRACKS[state.index]) state.index = 0;
    if (wasCurrent && TRACKS[state.index]) {
      audio.pause();
      audio.src = TRACKS[state.index].src;   /* 同步源，避免播放源与高亮错位 */
    }
    buildList();
    render();
  }
  /* 进站时把已保存的本地音乐读回播放列表 */
  function loadUserTracks() {
    if (!window.indexedDB) return Promise.resolve();
    return dbGetAll().then(function (records) {
      records.forEach(function (rec) {
        if (!rec || !rec.blob) return;
        TRACKS.push({ id: rec.id, title: rec.title || '未命名音频', src: URL.createObjectURL(rec.blob), user: true });
      });
    }).catch(function () {});
  }
  if (importBtn && importInput) {
    importBtn.addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function () {
      addUserTracks(importInput.files);
      importInput.value = '';   /* 允许重复选择同一文件 */
    });
  }

  /* 一曲放完自动接下一首（随机开着就走随机） */
  audio.addEventListener('ended', function () {
    load(stepIndex(1), true, false);
  });

  ['play', 'pause', 'volumechange'].forEach(function (event) {
    audio.addEventListener(event, render);
  });

  audio.addEventListener('error', function () {
    if (window.showSiteToast) window.showSiteToast('背景音乐加载失败，检查 assets/audio/ 里的音频文件');
    render();
  });

  /* 进站先把 IndexedDB 里已保存的本地音乐读回，再首次渲染 */
  loadUserTracks().then(initRender, initRender);
  function initRender() {
    buildList();
    render();
    firstPaint = false;
  }

  /* 自动播放触发条件：
     · 用户登录后：订阅 SiteAuth，登录态出现即开播（已登录访客在 refresh 解析后也会触发）
     · 用户开始滑动页面（scroll / wheel / touchmove 任一）即开播
     · 除非用户自己关闭（暂停）或静音过（autoplay=false），否则保持自动开播
     被自动播放策略拦下时退一步静音开播，并在首次交互时取消静音。 */
  var autoMuted = false;
  function startIfAllowed() {
    if (state.autoplay === false || !audio.paused) return;
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        /* 出声自动播放被拦：静音兜底，保证“登录 / 滑动后即播放” */
        autoMuted = true;
        audio.muted = true;
        audio.play().catch(function () {});
      });
    }
  }
  function unmuteFallback() {
    if (!autoMuted) return;
    audio.muted = false;
    state.muted = false;
    autoMuted = false;
    save();
    render();
    window.removeEventListener('pointerdown', unmuteFallback);
  }
  /* 登录后开播：订阅 SiteAuth 登录态；注册用户凭 Cookie 自动登录也会触发。
     每次注册 / 登录成功都重新允许自动播放（state.autoplay=true），
     满足「登录后就开始播」；会话内手动暂停 / 静音置否后保持不播，
     直到下次登录再开。若本脚本先于 auth.js 执行（window.SiteAuth 尚未就绪），
     等 window load 再绑定，避免顺序变化导致订阅被跳过、自动登录后不播音乐。 */
  function bindAuthAutoplay() {
    if (!window.SiteAuth || typeof window.SiteAuth.onChange !== 'function') return false;
    window.SiteAuth.onChange(function (user) {
      if (user) {
        state.autoplay = true;          /* 登录＝明确进入，重新允许自动播放 */
        save();
        startIfAllowed();
      }
    });
    if (window.SiteAuth.getUser && window.SiteAuth.getUser()) startIfAllowed();
    return true;
  }
  if (!bindAuthAutoplay()) {
    window.addEventListener('load', bindAuthAutoplay, { once: true });
  }
  /* 开始滑动即开播（任一触发一次即可，触发后统一解绑） */
  function onFirstScroll() {
    startIfAllowed();
    window.removeEventListener('scroll', onFirstScroll);
    window.removeEventListener('wheel', onFirstScroll);
    window.removeEventListener('touchmove', onFirstScroll);
  }
  window.addEventListener('scroll', onFirstScroll, { passive: true });
  window.addEventListener('wheel', onFirstScroll, { passive: true });
  window.addEventListener('touchmove', onFirstScroll, { passive: true });
  /* 若被静音兜底拦下，首次点击取消静音 */
  window.addEventListener('pointerdown', unmuteFallback);
})();
