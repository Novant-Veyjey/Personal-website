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
  var storageKey = 'upsideDownPosterImages.v1';
  if (!dialog || !list) return;
  var items = [];

  function load() {
    if (window.posterSphere && window.posterSphere.getImages) return window.posterSphere.getImages();
    try { var saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(saved) ? saved : []; } catch (error) { return []; }
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch (error) {}
    if (window.posterSphere && window.posterSphere.setImages) window.posterSphere.setImages(items, false);
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
  if (preview) preview.addEventListener('click', function (event) { if (event.target === preview) preview.close(); });
  if (previewEdit) previewEdit.addEventListener('click', function () {
    var index = Number(preview && preview.dataset.index);
    if (preview && preview.open) preview.close();
    open(index);
  });
}());
