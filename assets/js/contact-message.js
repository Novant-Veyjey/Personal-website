(function () {
  'use strict';

  var dialog = document.getElementById('message-dialog');
  var form = document.getElementById('message-form');
  var close = document.getElementById('message-close');
  var cancel = document.getElementById('message-cancel');
  var recent = document.getElementById('message-recent');
  var title = document.getElementById('message-dialog-title');
  var hint = dialog ? dialog.querySelector('.message-dialog__hint') : null;
  var storageKey = 'upsideDownSharedMessages.v2';
  var apiUrl = window.MESSAGE_API_BASE || '/api/messages';
  var messages = [];
  var mode = 'local';
  var currentMode = 'message';
  var activeReplyId = null;
  var busy = false;
  if (!dialog || !form || !recent) return;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function normalize(item) {
    return {
      id: item.id || String(Date.now()) + Math.random().toString(16).slice(2),
      name: String(item.name || '匿名信号').slice(0, 40),
      message: String(item.message || '').slice(0, 500),
      createdAt: item.createdAt || new Date().toISOString(),
      replies: Array.isArray(item.replies) ? item.replies.map(function (reply) {
        return {
          id: reply.id || String(Date.now()) + Math.random().toString(16).slice(2),
          name: String(reply.name || '匿名信号').slice(0, 40),
          message: String(reply.message || '').slice(0, 500),
          createdAt: reply.createdAt || new Date().toISOString()
        };
      }) : []
    };
  }
  function readLocal() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.map(normalize) : [];
    } catch (error) {
      return [];
    }
  }
  function writeLocal(next) {
    try { localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 50))); } catch (error) {}
  }
  function request(url, options) {
    return fetch(url, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    }, options || {})).then(function (response) {
      if (!response.ok) throw new Error('Message API ' + response.status);
      return response.json();
    });
  }
  function setBusy(value) {
    busy = value;
    form.querySelectorAll('button, input, textarea').forEach(function (control) { control.disabled = value; });
  }
  function setMode(nextMode) {
    currentMode = nextMode === 'reply' ? 'reply' : 'message';
    form.classList.toggle('is-reply-mode', currentMode === 'reply');
    if (title) title.textContent = currentMode === 'reply' ? '回复另一端' : '写一条留言';
    if (!hint) return;
    if (currentMode === 'reply') {
      hint.textContent = mode === 'cloud'
        ? '选择一条留言，写下你的回复。所有访客都能看到这条回应。'
        : '共享频道暂不可用，回复会先保存在这台设备中。';
    } else {
      hint.textContent = mode === 'cloud'
        ? '留言与回复会同步到共享频道，所有访客都能看到。'
        : '共享频道暂不可用，当前留言会先保存在这台设备中。';
    }
  }
  function render() {
    if (!messages.length) {
      recent.hidden = false;
      recent.innerHTML = '<p class="message-board__empty">频道里还没有留言，写下第一条信号。</p>';
      return;
    }
    recent.hidden = false;
    recent.innerHTML = messages.slice(0, 30).map(function (item) {
      var replies = item.replies.length ? '<div class="message-board__replies">' + item.replies.map(function (reply) {
        return '<article class="message-board__reply"><header><b>' + escapeHtml(reply.name) + '</b><time>' + escapeHtml(new Date(reply.createdAt).toLocaleString()) + '</time></header><p>' + escapeHtml(reply.message) + '</p></article>';
      }).join('') + '</div>' : '';
      var editorHidden = activeReplyId === item.id ? '' : ' hidden';
      return '<article class="message-board__item" id="message-thread-' + escapeHtml(item.id) + '">' +
        '<header><b>' + escapeHtml(item.name) + '</b><time>' + escapeHtml(new Date(item.createdAt).toLocaleString()) + '</time></header>' +
        '<p>' + escapeHtml(item.message) + '</p>' + replies +
        '<button class="message-board__reply-toggle" type="button" data-reply-toggle="' + escapeHtml(item.id) + '">' + (activeReplyId === item.id ? '收起回复' : '回复') + '</button>' +
        '<div class="message-board__reply-editor" data-reply-editor="' + escapeHtml(item.id) + '"' + editorHidden + '>' +
          '<input class="message-board__reply-name" maxlength="40" placeholder="你的名字" />' +
          '<textarea class="message-board__reply-text" rows="2" maxlength="500" placeholder="回复这条留言"></textarea>' +
          '<button class="message-board__reply-send" type="button" data-reply-send="' + escapeHtml(item.id) + '">发送回复 ↗</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }
  function applyResult(result) {
    if (result && Array.isArray(result.messages)) messages = result.messages.map(normalize);
    render();
  }
  function load() {
    return request(apiUrl).then(function (result) {
      mode = 'cloud';
      applyResult(result);
      setMode(currentMode);
    }).catch(function () {
      mode = 'local';
      messages = readLocal();
      render();
      setMode(currentMode);
    });
  }
  function postMessage(data) {
    setBusy(true);
    return request(apiUrl, { method: 'POST', body: JSON.stringify(data) }).then(function (result) {
      mode = 'cloud';
      applyResult(result);
      setMode('message');
    }).catch(function () {
      var item = normalize(data);
      messages = [item].concat(messages);
      writeLocal(messages);
      render();
      setMode('message');
      if (window.showSiteToast) window.showSiteToast('云端暂不可用，留言已保存在本机');
    }).finally(function () { setBusy(false); });
  }
  function postReply(id, data) {
    setBusy(true);
    return request(apiUrl + '/' + encodeURIComponent(id) + '/replies', { method: 'POST', body: JSON.stringify(data) }).then(function (result) {
      mode = 'cloud';
      activeReplyId = null;
      applyResult(result);
      setMode('reply');
    }).catch(function () {
      messages = messages.map(function (item) {
        if (item.id === id) item.replies = item.replies.concat([normalize(data)]);
        return item;
      });
      activeReplyId = null;
      writeLocal(messages);
      render();
      setMode('reply');
      if (window.showSiteToast) window.showSiteToast('云端暂不可用，回复已保存在本机');
    }).finally(function () { setBusy(false); });
  }
  function focusReply(id) {
    activeReplyId = id;
    render();
    window.setTimeout(function () {
      var editor = recent.querySelector('[data-reply-editor="' + id + '"]');
      if (!editor) return;
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = editor.querySelector('.message-board__reply-name');
      if (input) input.focus();
    }, 80);
  }
  function open(nextMode) {
    setMode(nextMode);
    activeReplyId = null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    load().then(function () {
      if (currentMode === 'reply' && messages.length) {
        focusReply(messages[0].id);
      } else if (currentMode === 'message') {
        window.setTimeout(function () {
          var name = form.elements.name;
          if (name) name.focus();
        }, 80);
      }
    });
  }
  function hide() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    activeReplyId = null;
  }

  document.querySelectorAll('[data-message-trigger]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      var rect = trigger.getBoundingClientRect();
      var isBottomHalf = event.clientY > rect.top + rect.height / 2;
      open(isBottomHalf ? 'reply' : 'message');
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open('message');
      }
    });
  });
  if (close) close.addEventListener('click', hide);
  if (cancel) cancel.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy || currentMode !== 'message') return;
    var data = new FormData(form);
    var item = { name: String(data.get('name') || '').trim(), message: String(data.get('message') || '').trim() };
    if (!item.name || !item.message) return;
    postMessage(item).then(function () {
      form.reset();
      if (window.showSiteToast) window.showSiteToast(mode === 'cloud' ? '留言已同步到共享频道' : '留言已保存到本机');
    });
  });
  recent.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-reply-toggle]');
    if (toggle) {
      activeReplyId = activeReplyId === toggle.dataset.replyToggle ? null : toggle.dataset.replyToggle;
      render();
      if (activeReplyId) focusReply(activeReplyId);
      return;
    }
    var send = event.target.closest('[data-reply-send]');
    if (!send || busy) return;
    var id = send.dataset.replySend;
    var box = recent.querySelector('[data-reply-editor="' + id + '"]');
    if (!box) return;
    var name = box.querySelector('.message-board__reply-name').value.trim();
    var message = box.querySelector('.message-board__reply-text').value.trim();
    if (!name || !message) return;
    postReply(id, { name: name, message: message }).then(function () {
      if (window.showSiteToast) window.showSiteToast(mode === 'cloud' ? '回复已同步到共享频道' : '回复已保存到本机');
    });
  });
  load();
}());
