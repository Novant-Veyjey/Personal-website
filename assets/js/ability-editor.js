(function () {
  'use strict';

  var dialog = document.getElementById('ability-editor');
  var form = document.getElementById('ability-editor-form');
  var close = document.getElementById('ability-editor-close');
  var reset = document.getElementById('ability-editor-reset');
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-ability-edit]'));
  var storageKey = 'upsideDownAbilities.v1';
  if (!dialog || !form || !cards.length) return;

  var defaults = cards.map(function (card) {
    return {
      title: (card.querySelector('[data-ability-field="title"]') || {}).textContent || '',
      description: (card.querySelector('[data-ability-field="description"]') || {}).textContent || '',
      tags: Array.prototype.map.call(card.querySelectorAll('[data-ability-field="tags"] span'), function (tag) { return tag.textContent.trim(); }),
      icon: (card.querySelector('.ability__icon') || {}).textContent || ''
    };
  });

  function readStore() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (error) { return {}; }
  }
  function writeStore(data) {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (error) {}
  }
  function clean(data, fallback) {
    return {
      title: String(data.title || fallback.title).trim(),
      description: String(data.description || fallback.description).trim(),
      tags: Array.isArray(data.tags) ? data.tags.filter(Boolean).slice(0, 4) : fallback.tags.slice(),
      icon: String(data.icon || fallback.icon).trim().slice(0, 3)
    };
  }
  function apply(index, raw) {
    var card = cards[index];
    if (!card) return;
    var data = clean(raw, defaults[index]);
    var title = card.querySelector('[data-ability-field="title"]');
    var description = card.querySelector('[data-ability-field="description"]');
    var tags = card.querySelector('[data-ability-field="tags"]');
    var icon = card.querySelector('.ability__icon');
    if (title) title.textContent = data.title;
    if (description) description.textContent = data.description;
    if (icon) icon.textContent = data.icon || defaults[index].icon;
    if (tags) {
      tags.innerHTML = '';
      data.tags.forEach(function (tag) {
        var span = document.createElement('span');
        span.textContent = tag;
        tags.appendChild(span);
      });
    }
    card.setAttribute('aria-label', '编辑' + data.title + '能力');
  }
  function open(index) {
    var card = cards[index];
    if (!card) return;
    var tags = Array.prototype.map.call(card.querySelectorAll('[data-ability-field="tags"] span'), function (tag) { return tag.textContent.trim(); });
    form.elements.abilityKey.value = String(index);
    form.elements.title.value = (card.querySelector('[data-ability-field="title"]') || {}).textContent || '';
    form.elements.description.value = (card.querySelector('[data-ability-field="description"]') || {}).textContent || '';
    form.elements.tags.value = tags.join(', ');
    form.elements.icon.value = (card.querySelector('.ability__icon') || {}).textContent || '';
    document.getElementById('ability-editor-title').textContent = '编辑能力 ' + String(index + 1).padStart(2, '0');
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  var saved = readStore();
  Object.keys(saved).forEach(function (key) {
    var index = Number(key);
    if (Number.isInteger(index) && defaults[index]) apply(index, saved[key]);
  });

  cards.forEach(function (card, index) {
    card.addEventListener('click', function () { open(index); });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(index);
      }
    });
  });
  function hide() { if (dialog.open) dialog.close(); }
  if (close) close.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var index = Number(form.elements.abilityKey.value);
    if (!defaults[index]) return;
    var data = {
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      tags: form.elements.tags.value.split(',').map(function (tag) { return tag.trim().toUpperCase(); }).filter(Boolean),
      icon: form.elements.icon.value.trim()
    };
    if (!data.title || !data.description) return;
    var store = readStore();
    store[index] = data;
    writeStore(store);
    apply(index, data);
    hide();
    if (window.showSiteToast) window.showSiteToast('能力卡已更新');
  });
  if (reset) reset.addEventListener('click', function () {
    var index = Number(form.elements.abilityKey.value);
    var store = readStore();
    delete store[index];
    writeStore(store);
    apply(index, defaults[index]);
    open(index);
  });
}());
