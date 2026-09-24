(function () {
  'use strict';

  var dialog = document.getElementById('poster-manager');
  var input = document.getElementById('poster-manager-input');
  var list = document.getElementById('poster-manager-list');
  var close = document.getElementById('poster-manager-close');
  var done = document.getElementById('poster-manager-done');
  var preview = document.getElementById('poster-preview');
  var previewImage = document.getElementById('poster-preview-image');
  var previewTitle = document.getElementById('poster-preview-title');
  var previewClose = document.getElementById('poster-preview-close');
  var previewEdit = document.getElementById('poster-preview-edit');
  var previewSurface = preview ? preview.querySelector('.poster-preview__surface') : null;
  var previewBack = null;
  var storageKey = 'upsideDownPosterImages.v1';
  if (!dialog || !list) return;
  var items = [];

  if (previewSurface) {
    previewBack = document.createElement('button');
    previewBack.type = 'button';
    previewBack.className = 'poster-preview__back';
    previewBack.textContent = '← 返回选择图片';
    previewBack.setAttribute('aria-label', '返回选择图片');
    previewBack.style.cssText = 'position:absolute;left:18px;top:18px;z-index:3;display:inline-flex;align-items:center;min-height:38px;padding:0 13px;border:1px solid rgba(229,35,45,.62);background:rgba(9,8,12,.88);color:#f2eee6;font:700 9px/1 "Cascadia Mono",Consolas,monospace;letter-spacing:.12em;cursor:pointer;';
    previewSurface.insertBefore(previewBack, previewSurface.firstChild);
  }

  function load() {
    if (window.posterSphere && window.posterSphere.getImages) return window.posterSphere.getImages();
    try { var saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(saved) ? saved : []; } catch (error) { return []; }
  }

  /* ---------------- 按账号云端同步（/api/posters，存 EdgeOne KV） ----------------
     · 登录后：拉取云端列表，云端有数据就用它覆盖本机（跨设备保留）；
     · 每次本地改动（增删替换）：本地照存，同时静默推送到云端；
     · 未登录：维持纯本机行为。 */
  var cloudDirty = false;   /* 本机刚改过还没推完时，别让迟到的云端拉取覆盖掉 */

  function pushCloud() {
    if (!(window.SiteAuth && window.SiteAuth.getUser())) return;
    window.SiteAuth.api('/api/posters', { method: 'POST', body: JSON.stringify({ posters: items }) })
      .then(function (res) {
        if (!res.ok) console.warn('[posters] 云端保存失败：', res.data && res.data.error);
      })
      .catch(function (error) { console.warn('[posters] 云端保存失败：', error); });
  }
  function applyCloud(list) {
    items = list.slice();
    cloudDirty = false;
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch (error) {}
    if (window.posterSphere && window.posterSphere.setImages) window.posterSphere.setImages(items, false);
    if (dialog.open) render();
  }
  function pullCloud() {
    if (!(window.SiteAuth && window.SiteAuth.getUser())) return;
    window.SiteAuth.api('/api/posters').then(function (res) {
      var list = res && res.data && res.data.posters;
      if (!res.ok || !Array.isArray(list)) return;
      /* 云端还没存过（空列表）时不动本机数据；本机刚改过时也别覆盖 */
      if (list.length && !cloudDirty) applyCloud(list);
    }).catch(function (error) { console.warn('[posters] 云端拉取失败：', error); });
  }

  function persist() {
    cloudDirty = true;
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch (error) {}
    if (window.posterSphere && window.posterSphere.setImages) window.posterSphere.setImages(items, false);
    pushCloud();
  }
  var focusedIndex = -1;
  function open(index) { focusedIndex = typeof index === 'number' ? index : -1; items = load(); render(); if (typeof dialog.showModal === 'function') dialog.showModal(); }
  function hide() { if (dialog.open) dialog.close(); }
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          var max = 1300, scale = Math.min(1, max / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ src: canvas.toDataURL('image/jpeg', .84), landscape: canvas.width / canvas.height > 1.18, alt: file.name.replace(/\.[^.]+$/, '') || '自定义科幻海报' });
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function render() {
    list.innerHTML = '';
    items.forEach(function (item, index) {
      var row = document.createElement('div');
      row.className = 'poster-manager__item';
      if (index === focusedIndex) row.classList.add('is-focused');
      row.innerHTML = '<img alt=""><div><strong></strong><small>' + (item.landscape ? 'LANDSCAPE' : 'PORTRAIT') + '</small></div><label class="poster-manager__replace">替换<input type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" data-remove="' + index + '" aria-label="删除海报">×</button>';
      row.querySelector('img').src = item.src;
      row.querySelector('strong').textContent = item.alt || '科幻海报 ' + (index + 1);
      row.querySelector('[data-remove]').addEventListener('click', function () {
        if (items.length <= 2) return;
        items.splice(index, 1); persist(); render();
      });
      row.querySelector('input').addEventListener('change', function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        compress(file).then(function (next) { items[index] = next; persist(); render(); });
      });
      list.appendChild(row);
      if (index === focusedIndex) window.setTimeout(function () { row.scrollIntoView({ block: 'nearest' }); }, 0);
    });
  }
  function openPreview(index) {
    items = load();
    var item = items[index];
    if (!preview || !previewImage || !item) return open();
    previewImage.src = item.src;
    previewImage.alt = item.alt || '科幻海报预览';
    if (previewTitle) previewTitle.textContent = item.alt || '科幻海报';
    preview.dataset.index = String(index);
    if (typeof preview.showModal === 'function') preview.showModal();
  }
  window.openPosterPreview = openPreview;
  document.querySelectorAll('[data-poster-manager]').forEach(function (trigger) {
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
  if (input) input.addEventListener('change', function (event) {
    Array.prototype.slice.call(event.target.files || []).reduce(function (chain, file) { return chain.then(function () { return compress(file).then(function (item) { items.push(item); }); }); }, Promise.resolve()).then(function () { persist(); render(); input.value = ''; });
  });
  if (close) close.addEventListener('click', hide);
  if (done) done.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });
  if (previewClose) previewClose.addEventListener('click', function () { if (preview.open) preview.close(); });
  if (previewBack) previewBack.addEventListener('click', function () { if (preview.open) preview.close(); });
  if (preview) preview.addEventListener('click', function (event) { if (event.target === preview) preview.close(); });
  if (previewEdit) previewEdit.addEventListener('click', function () {
    var index = Number(preview && preview.dataset.index);
    if (preview && preview.open) preview.close();
    open(index);
  });

  /* 登录态变化（含进站自动刷新）：登录后拉取该账号的云端照片；登出不动本机缓存 */
  if (window.SiteAuth && window.SiteAuth.onChange) {
    window.SiteAuth.onChange(function (user) { if (user) pullCloud(); });
  }
  if (window.SiteAuth && window.SiteAuth.getUser()) pullCloud();
}());

(function ensureWelcomeTitle() {
  'use strict';
  var element = document.getElementById('hero-title');
  if (!element) return;

  function profileName() {
    try {
      var data = JSON.parse(localStorage.getItem('upsideDownProfile.v1') || '{}');
      var en = String(data.enName || '').trim();
      var cn = String(data.cnName || '').trim();
      if (en && en.toUpperCase() !== 'YOUR NAME') return en;
      if (cn && cn !== '你的名字') return cn;
    } catch (error) {}
    return '';
  }

  function apply() {
    if (!element || element.querySelector('.hero-title__welcome')) return;
    var name = profileName();
    if (!name) return;
    var welcome = document.createElement('span');
    var nameLine = document.createElement('span');
    var suffix = document.createElement('span');
    welcome.className = 'hero-title__welcome';
    nameLine.className = 'hero-title__name';
    suffix.className = 'hero-title__suffix';
    welcome.textContent = 'WELCOME';
    nameLine.textContent = name;
    suffix.textContent = 'TO THE UPSIDE DOWN';
    element.replaceChildren(welcome, nameLine, suffix);
    element.setAttribute('data-text', 'WELCOME ' + name + ' TO THE UPSIDE DOWN');
    document.title = 'WELCOME ' + name + ' TO THE UPSIDE DOWN';
  }

  new MutationObserver(apply).observe(element, { childList: true, subtree: true, characterData: true });
  apply();
}());