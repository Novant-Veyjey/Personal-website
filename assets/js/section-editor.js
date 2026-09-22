(function () {
  'use strict';

  var dialog = document.getElementById('section-editor');
  var form = document.getElementById('section-editor-form');
  var close = document.getElementById('section-editor-close');
  var reset = document.getElementById('section-editor-reset');
  var storageKey = 'upsideDownSections.v1';
  var configs = {
    // 首页大标题由 profile-editor 统一按「WELCOME 名字 TO THE UPSIDE DOWN」生成，
    // 这里不再接管 hero-title，否则会把它的三段结构用纯文本覆盖掉。
    hero: { section: '#top', title: null, subtitle: '[data-edit-field="hero-kicker"]', lead: '[data-edit-field="hero-lead"]', name: '首页' },
    profile: { section: '#profile', title: '[data-edit-field="profile-title"]', subtitle: '[data-edit-field="profile-subtitle"]', lead: '[data-edit-field="profile-lead"]', name: '关于我' },
    works: { section: '#works', title: '[data-edit-field="works-title"]', subtitle: '[data-edit-field="works-subtitle"]', lead: '[data-edit-field="works-lead"]', name: '作品' },
    abilities: { section: '#abilities', title: '[data-edit-field="abilities-title"]', subtitle: '[data-edit-field="abilities-subtitle"]', lead: '[data-edit-field="abilities-lead"]', name: '能力' },
    contact: { section: '#contact', title: '[data-edit-field="contact-title"]', subtitle: '[data-edit-field="contact-subtitle"]', lead: '[data-edit-field="contact-lead"]', name: '联络' }
  };
  if (!dialog || !form) return;

  function readStore() { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (error) { return {}; } }
  function writeStore(data) { try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (error) {} }
  function field(section, selector) { return document.querySelector(section + ' ' + selector); }
  function value(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function note(section) { return document.querySelector(section + ' .section-user-note'); }
  function setField(el, next) {
    if (!el) return;
    el.textContent = next;
    if (el.dataset.editField === 'hero-title') el.dataset.text = next;
  }
  function apply(key, data) {
    var config = configs[key];
    if (!config) return;
    var section = document.querySelector(config.section);
    if (!section) return;
    if (config.title) setField(field(config.section, config.title), data.title);
    if (config.subtitle) setField(field(config.section, config.subtitle), data.subtitle);
    if (config.lead) setField(field(config.section, config.lead), data.lead);
    var currentNote = note(config.section);
    if (data.extra) {
      if (!currentNote) {
        currentNote = document.createElement('p');
        currentNote.className = 'section-user-note';
        (section.querySelector('.hero__content') || section.querySelector('.container') || section).appendChild(currentNote);
      }
      currentNote.textContent = data.extra;
    } else if (currentNote) currentNote.remove();
  }
  var defaults = {};
  Object.keys(configs).forEach(function (key) {
    var config = configs[key];
    defaults[key] = { title: value(field(config.section, config.title)), subtitle: value(field(config.section, config.subtitle)), lead: value(field(config.section, config.lead)), extra: '' };
  });
  var saved = readStore();
  Object.keys(saved).forEach(function (key) { if (configs[key]) apply(key, Object.assign({}, defaults[key], saved[key])); });

  var titleInput = form.elements.title;
  var titleRow = titleInput ? titleInput.closest('label') : null;

  function open(key) {
    var config = configs[key];
    if (!config) return;
    // 没有主标题字段的区块（首页大标题由档案姓名驱动），把这一栏藏起来，
    // 免得用户填了却看不到任何变化
    if (titleRow) titleRow.hidden = !config.title;
    if (titleInput) titleInput.required = !!config.title;
    var current = { title: value(field(config.section, config.title)), subtitle: value(field(config.section, config.subtitle)), lead: value(field(config.section, config.lead)), extra: value(note(config.section)) };
    form.elements.sectionKey.value = key;
    form.elements.title.value = current.title;
    form.elements.subtitle.value = current.subtitle;
    form.elements.lead.value = current.lead;
    form.elements.extra.value = current.extra;
    document.getElementById('section-editor-title').textContent = '编辑' + config.name;
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }
  document.querySelectorAll('[data-section-edit]').forEach(function (button) { button.addEventListener('click', function () { open(button.dataset.sectionEdit); }); });
  function hide() { if (dialog.open) dialog.close(); }
  if (close) close.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var key = form.elements.sectionKey.value;
    var data = { title: form.elements.title.value.trim(), subtitle: form.elements.subtitle.value.trim(), lead: form.elements.lead.value.trim(), extra: form.elements.extra.value.trim() };
    if (configs[key] && configs[key].title && !data.title) return;
    var store = readStore();
    store[key] = data;
    writeStore(store);
    apply(key, data);
    hide();
    if (window.showSiteToast) window.showSiteToast('区块内容已更新');
  });
  if (reset) reset.addEventListener('click', function () {
    var key = form.elements.sectionKey.value;
    var store = readStore();
    delete store[key];
    writeStore(store);
    apply(key, defaults[key]);
    open(key);
  });
}());
