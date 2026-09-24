/* ============================================================
   留言板（联络区海报的上半＝发布 / 下半＝回复）
   ------------------------------------------------------------
   后端：本站自带的 /api/messages（Netlify Function，本地由 server.mjs 提供）
     GET  /api/messages                所有人可读（含未登录访客）
     POST /api/messages                登录后才能发
     POST /api/messages/:id/replies    登录后才能回复
   · 作者名一律由服务端按登录账号写入，前端传什么都不作数（防冒充）
   · 未登录点「发布 / 回复」→ 自动弹出登录窗
   · 云端读不到时如实报错，不会偷偷存到本机骗人
   ============================================================ */
(function () {
  'use strict';

  var dialog = document.getElementById('message-dialog');
  var form = document.getElementById('message-form');
  var close = document.getElementById('message-close');
  var cancel = document.getElementById('message-cancel');
  var recent = document.getElementById('message-recent');
  var title = document.getElementById('message-dialog-title');
  var hint = dialog ? dialog.querySelector('.message-dialog__hint') : null;
  if (!dialog || !form || !recent) return;

  var messages = [];
  var view = 'publish';   // publish（只发布）/ reply（只回复）
  var activeReplyId = null;
  var busy = false;
  var backendDown = '';

  /* ---------- 工具 ---------- */
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function auth() { return window.SiteAuth || null; }
  function currentUser() { var a = auth(); return a ? a.getUser() : null; }
  function openAuth() { var a = auth(); if (a) a.open(); }
  function toast(text) { if (window.showSiteToast) window.showSiteToast(text); }
  /* 接口调用统一走 auth.js 暴露的方法：它会先试 /api/xxx，
     404 时自动改走 /.netlify/functions/xxx（函数直连路径）。 */
  function api(path, options) {
    var a = auth();
    if (a && a.api) return a.api(path, options);
    return fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }
  function networkMessage(error) {
    var a = auth();
    return a && a.networkMessage ? a.networkMessage(error) : ('连不上服务器（' + ((error && error.message) || '未知错误') + '）');
  }

  /* ---------- 发布区（随登录态变化） ---------- */
  function syncHint() {
    if (!hint) return;
    if (view === 'reply') {
      hint.textContent = currentUser()
        ? '点任意留言下的「回复」跟帖，所有访客都能看到。'
        : '留言和回复对所有人公开；登录后才能跟帖。';
    } else {
      hint.textContent = currentUser()
        ? '以「' + (currentUser().name || '账号') + '」身份发布，所有访客都能看到。'
        : '留言和回复对所有人公开；登录后才能发布。';
    }
  }
  function syncIdentity() {
    /* 作者由账号决定，所以「你的称呼」这一行直接隐藏 */
    var nameLabel = null;
    form.querySelectorAll('label').forEach(function (label) {
      if (label.querySelector('input[name="name"]')) nameLabel = label;
    });
    if (nameLabel) nameLabel.style.display = 'none';
    var nameInput = form.elements.name;
    if (nameInput) { nameInput.disabled = true; nameInput.required = false; }
    var submit = form.querySelector('.message-dialog__save');
    if (submit) submit.disabled = busy;
    syncHint();
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (backendDown) {
      recent.innerHTML = '<p class="message-board__empty">' + escapeHtml(backendDown) + '<br />请确认后端可用（本地：node server.mjs；线上：已部署 Netlify Functions）。</p>';
      return;
    }
    if (!messages.length) {
      recent.innerHTML = '<p class="message-board__empty">频道里还没有留言，登录后发出第一条信号。</p>';
      return;
    }
    recent.innerHTML = messages.slice(0, 30).map(function (item) {
      var replies = item.replies && item.replies.length ? '<div class="message-board__replies">' + item.replies.map(function (reply) {
        return '<article class="message-board__reply"><header><b>' + escapeHtml(reply.name) + '</b><time>' + escapeHtml(new Date(reply.createdAt).toLocaleString()) + '</time></header><p>' + escapeHtml(reply.message) + '</p></article>';
      }).join('') + '</div>' : '';
      var editorHidden = activeReplyId === item.id ? '' : ' hidden';
      return '<article class="message-board__item" id="message-thread-' + escapeHtml(item.id) + '">' +
        '<header><b>' + escapeHtml(item.name) + '</b><time>' + escapeHtml(new Date(item.createdAt).toLocaleString()) + '</time></header>' +
        '<p>' + escapeHtml(item.message) + '</p>' + replies +
        '<button class="message-board__reply-toggle" type="button" data-reply-toggle="' + escapeHtml(item.id) + '">' + (activeReplyId === item.id ? '收起回复' : '回复') + '</button>' +
        '<div class="message-board__reply-editor" data-reply-editor="' + escapeHtml(item.id) + '"' + editorHidden + '>' +
          '<textarea class="message-board__reply-text" rows="2" maxlength="500" placeholder="回复这条留言"></textarea>' +
          '<button class="message-board__reply-send" type="button" data-reply-send="' + escapeHtml(item.id) + '">发送回复 ↗</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }
  function setBusy(value) {
    busy = value;
    form.querySelectorAll('button, input, textarea').forEach(function (control) { control.disabled = value; });
    recent.querySelectorAll('button, input, textarea').forEach(function (control) { control.disabled = value; });
    syncIdentity();
  }

  /* ---------- 拉取 / 发布 / 回复 ---------- */
  function load() {
    return api('/api/messages').then(function (res) {
      if (!res.ok) throw new Error((res.data && res.data.error) || ('HTTP ' + res.status));
      backendDown = '';
      messages = Array.isArray(res.data.messages) ? res.data.messages : [];
      render();
    }).catch(function (error) {
      backendDown = '留言板暂时读不到：' + networkMessage(error);
      messages = [];
      render();
    });
  }
  function postMessage(content) {
    if (!currentUser()) { openAuth(); return Promise.resolve(); }
    setBusy(true);
    return api('/api/messages', { method: 'POST', body: JSON.stringify({ message: content }) }).then(function (res) {
      if (!res.ok) throw new Error((res.data && res.data.error) || '发布失败');
      backendDown = '';
      messages = res.data.messages || messages;
      render();
      toast('留言已发布，所有访客可见');
    }).catch(function (error) {
      toast('发布失败：' + ((error && error.message) || '未知错误'));
    }).finally(function () { setBusy(false); });
  }
  function postReply(id, content) {
    if (!currentUser()) { openAuth(); return Promise.resolve(); }
    setBusy(true);
    return api('/api/messages/' + encodeURIComponent(id) + '/replies', {
      method: 'POST',
      body: JSON.stringify({ message: content })
    }).then(function (res) {
      if (!res.ok) throw new Error((res.data && res.data.error) || '回复失败');
      backendDown = '';
      messages = res.data.messages || messages;
      activeReplyId = null;
      render();
      toast('回复已发布，所有访客可见');
    }).catch(function (error) {
      toast('回复失败：' + ((error && error.message) || '未知错误'));
    }).finally(function () { setBusy(false); });
  }
  function focusReply(id) {
    activeReplyId = id;
    render();
    window.setTimeout(function () {
      var editor = recent.querySelector('[data-reply-editor="' + id + '"]');
      if (!editor) return;
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var box = editor.querySelector('.message-board__reply-text');
      if (box) box.focus();
    }, 80);
  }

  /* ---------- 视图切换 ---------- */
  function setView(next) {
    view = next === 'reply' ? 'reply' : 'publish';
    var isReply = view === 'reply';
    form.classList.toggle('is-reply-mode', isReply);
    if (title) title.textContent = isReply ? '来自颠倒世界的回应' : '来自霍金斯的呼喊';
    recent.hidden = !isReply;
    syncIdentity();
    render();
  }
  function open(next) {
    setView(next);
    activeReplyId = null;
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    load().then(function () {
      if (view !== 'publish') return;
      window.setTimeout(function () { form.elements.message.focus(); }, 80);
    });
  }
  function hide() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    activeReplyId = null;
  }

  /* 点图片上半部分＝发布，下半部分＝回复 */
  document.querySelectorAll('[data-message-trigger]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      var rect = trigger.getBoundingClientRect();
      var isBottomHalf = event.clientY > rect.top + rect.height / 2;
      open(isBottomHalf ? 'reply' : 'publish');
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open('publish');
      }
    });
  });
  if (close) close.addEventListener('click', hide);
  if (cancel) cancel.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) hide(); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy || view !== 'publish') return;
    if (!currentUser()) { openAuth(); return; }
    var content = String(form.elements.message.value || '').trim();
    if (!content) { form.elements.message.focus(); return; }
    postMessage(content).then(function () { form.reset(); });
  });

  recent.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-reply-toggle]');
    if (toggle) {
      if (!currentUser()) { openAuth(); return; }
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
    var content = String(box.querySelector('.message-board__reply-text').value || '').trim();
    if (!content) return;
    postReply(id, content);
  });

  /* 登录态变化：更新提示与作者身份，并顺手刷新一次列表 */
  if (auth()) {
    auth().onChange(function () {
      syncIdentity();
      if (dialog.open) load();
    });
    if (auth().getUser()) load();
  }
  setView('publish');
}());
