(function () {
  'use strict';

  var dialog = document.getElementById('project-editor');
  var form = document.getElementById('project-editor-form');
  var close = document.getElementById('project-editor-close');
  var reset = document.getElementById('project-editor-reset');
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-project-edit]'));
  var storageKey = 'upsideDownProjects.v1';
  if (!dialog || !form || !cards.length) return;

  function readStore() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (error) { return {}; }
  }
  function writeStore(data) {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (error) {}
  }
  function readCard(card) {
    return {
      type: (card.querySelector('[data-project-field="type"]') || {}).textContent || '',
      title: (card.querySelector('[data-project-field="title"]') || {}).textContent || '',
      description: (card.querySelector('[data-project-field="description"]') || {}).textContent || '',
      linkText: ((card.querySelector('[data-project-field="linkText"]') || {}).textContent || '').replace(/↗/g, '').trim()
    };
  }
  var defaults = cards.map(readCard);
  function apply(index, raw) {
    var card = cards[index];
    var data = Object.assign({}, defaults[index], raw || {});
    if (!card) return;
    var type = card.querySelector('[data-project-field="type"]');
    var title = card.querySelector('[data-project-field="title"]');
    var description = card.querySelector('[data-project-field="description"]');
    var link = card.querySelector('[data-project-field="linkText"]');
    if (type) type.textContent = data.type;
    if (title) title.textContent = data.title;
    if (description) description.textContent = data.description;
    if (link) {
      link.childNodes[0].nodeValue = data.linkText + ' ';
      link.setAttribute('aria-label', '查看' + data.title);
    }
    card.setAttribute('aria-label', '编辑' + data.title);
  }
  function open(index) {
    var data = readCard(cards[index]);
    form.elements.projectKey.value = String(index);
    form.elements.type.value = data.type;
    form.elements.title.value = data.title;
    form.elements.description.value = data.description;
    form.elements.linkText.value = data.linkText;
    document.getElementById('project-editor-title').textContent = '编辑项目 ' + String(index + 1).padStart(2, '0');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  var saved = readStore();
  Object.keys(saved).forEach(function (key) {
    var index = Number(key);
    if (Number.isInteger(index) && defaults[index]) apply(index, saved[key]);
  });
  cards.forEach(function (card, index) {
    card.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('a')) return;
      open(index);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(index);
      }
    });
  });
  function hide() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  if (close) close.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var index = Number(form.elements.projectKey.value);
    if (!defaults[index]) return;
    var data = {
      type: form.elements.type.value.trim(),
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      linkText: form.elements.linkText.value.trim() || '查看案例'
    };
    if (!data.type || !data.title || !data.description) return;
    var store = readStore();
    store[index] = data;
    writeStore(store);
    apply(index, data);
    hide();
    if (window.showSiteToast) window.showSiteToast('项目内容已更新');
  });
  if (reset) reset.addEventListener('click', function () {
    var index = Number(form.elements.projectKey.value);
    var store = readStore();
    delete store[index];
    writeStore(store);
    apply(index, defaults[index]);
    open(index);
  });
}());
