(function () {
  'use strict';

  var dialog = document.getElementById('message-dialog');
  var form = document.getElementById('message-form');
  var close = document.getElementById('message-close');
  var cancel = document.getElementById('message-cancel');
  var recent = document.getElementById('message-recent');
  var storageKey = 'upsideDownMessages.v1';
  if (!dialog || !form) return;

  function getMessages() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (error) { return []; }
  }
  function renderRecent() {
    var messages = getMessages();
    var item = messages[messages.length - 1];
    if (!recent || !item) return;
    recent.hidden = false;
    recent.innerHTML = '<strong>最近一条留言 · ' + escapeHtml(item.name) + '</strong>' + escapeHtml(item.message);
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]; });
  }
  function open() {
    renderRecent();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }
  function hide() { if (dialog.open) dialog.close(); }

  document.querySelectorAll('[data-message-trigger]').forEach(function (trigger) {
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
  });
  if (close) close.addEventListener('click', hide);
  if (cancel) cancel.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var item = { name: String(data.get('name') || '').trim(), message: String(data.get('message') || '').trim(), createdAt: new Date().toISOString() };
    if (!item.name || !item.message) return;
    var messages = getMessages();
    messages.push(item);
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-12))); } catch (error) {}
    form.reset();
    renderRecent();
    if (window.showSiteToast) window.showSiteToast('留言已保存在本地频道');
  });
}());
