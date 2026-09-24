/* ============================================================
   登录 / 注册 —— 本站自带后端
   ------------------------------------------------------------
   · 账号＝昵称（唯一）＋ 密码；不发验证邮件、不需要邮箱
   · 接口：POST /api/auth/register | login | logout，GET /api/auth/session
   · 会话：HttpOnly 签名 Cookie，前端拿不到也改不了；30 天有效
   · 全部请求同源，不依赖任何第三方服务，国内网络也能正常注册登录
   · 对外暴露 window.SiteAuth，留言板靠它判断登录态、唤起登录窗
   ============================================================ */
(function () {
  'use strict';

  var dialog = document.getElementById('auth-dialog');
  var form = document.getElementById('auth-form');
  if (!dialog || !form) return;

  var titleEl = document.getElementById('auth-title');
  var submitBtn = document.getElementById('auth-submit');
  var messageEl = document.getElementById('auth-message');
  var closeBtn = document.getElementById('auth-close');
  var trigger = document.getElementById('auth-trigger');
  var accountEl = document.getElementById('header-account');
  var nameInput = form.elements.name;
  var passwordInput = form.elements.password;
  var tabs = Array.prototype.slice.call(dialog.querySelectorAll('[data-auth-tab]'));

  var mode = 'login';
  var user = null;
  var listeners = [];
  var forced = false;     /* 强制登录门禁：未登录时打开，且禁止关闭直到登录成功 */

  /* 接口地址：优先 /api/xxx（本地 server.mjs 与生效的重写都吃这个），
     若返回 404（这个站点的 Netlify 重写一直没生效，见仓库里 /api/profile 那次修复）
     就自动改走 Netlify 函数的直连路径 /.netlify/functions/xxx。 */
  function functionPath(path) {
    return String(path).replace(/^\/api\//, '/.netlify/functions/');
  }
  function rawFetch(path, options) {
    return fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    }, options || {}));
  }
  function api(path, options) {
    return rawFetch(path, options).then(function (res) {
      if (res.status === 404) {
        var alt = functionPath(path);
        if (alt !== path) return rawFetch(alt, options);
      }
      return res;
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }
  function post(path, body) {
    return api(path, { method: 'POST', body: JSON.stringify(body || {}) });
  }
  /* 网络层失败（例如本地没起后端、线上没部署函数）给一句明确的话 */
  function networkMessage(error) {
    var raw = (error && error.message) || '未知错误';
    return '连不上本站后端（' + raw + '）。线上请确认 Netlify Functions 已部署，本地请确认 server.mjs 正在运行。';
  }
  function showMessage(text) { messageEl.textContent = text || ''; }
  function toast(text) { if (window.showSiteToast) window.showSiteToast(text); }

  function openDialog() {
    if (closeBtn) closeBtn.hidden = forced;   /* 强制登录模式下不给关闭键 */
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeDialog() {
    if (forced) return;                       /* 强制登录模式：不允许关闭，必须先登录 */
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  function setMode(next) {
    mode = next === 'register' ? 'register' : 'login';
    var isRegister = mode === 'register';
    titleEl.textContent = isRegister ? '注册' : '登录';
    submitBtn.innerHTML = (isRegister ? '创建账户 <span>↗</span>' : '登录 <span>↗</span>');
    nameInput.placeholder = isRegister ? '想用的昵称，例如：小明' : '你的昵称';
    passwordInput.setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');
    tabs.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-auth-tab') === mode);
    });
    showMessage('');
  }

  function renderAccount() {
    if (accountEl) {
      if (!user) {
        accountEl.hidden = true;
        accountEl.innerHTML = '';
      } else {
        accountEl.hidden = false;
        accountEl.innerHTML = '';
        var chip = document.createElement('span');
        chip.className = 'account-chip';
        chip.textContent = user.name || '已登录';
        chip.title = user.name || '';
        var out = document.createElement('button');
        out.type = 'button';
        out.className = 'account-out';
        out.textContent = '退出';
        out.addEventListener('click', function () {
          out.disabled = true;
          post('/api/auth/logout').then(function () {
            setUser(null);
            toast('已退出登录');
          }).catch(function (error) {
            out.disabled = false;
            toast(networkMessage(error));
          });
        });
        /* 退出键套一层等权占位：与左侧时钟各占一半，用户名因此恰好居中 */
        var outSlot = document.createElement('span');
        outSlot.className = 'account-out-slot';
        outSlot.appendChild(out);
        accountEl.append(chip, outSlot);
      }
    }
    if (trigger) trigger.hidden = !!user;
  }

  function setUser(next) {
    user = next || null;
    renderAccount();
    listeners.slice().forEach(function (cb) {
      try { cb(user); } catch (error) { console.error('[auth] 监听回调出错：', error); }
    });
  }

  function refresh() {
    return api('/api/auth/session').then(function (res) {
      setUser(res.data && res.data.user);
      return user;
    }).catch(function (error) {
      /* 后端暂时不可用时不要把页面搞崩，维持“未登录”即可 */
      console.warn('[auth] 读取登录态失败：', error && error.message);
      setUser(null);
      return null;
    });
  }

  /* ---------- 交互 ---------- */
  if (trigger) trigger.addEventListener('click', openDialog);
  if (closeBtn) closeBtn.addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && dialog.open) closeDialog();
  });
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () { setMode(btn.getAttribute('data-auth-tab')); });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    showMessage('');
    var name = (nameInput.value || '').trim();
    var password = passwordInput.value || '';

    if (!name || !password) { showMessage('请填写昵称和密码。'); return; }
    if (mode === 'register' && name.length < 2) { showMessage('昵称至少 2 个字。'); return; }
    if (password.length < 6) { showMessage('密码至少需要 6 位。'); return; }

    submitBtn.disabled = true;

    var request = mode === 'register'
      ? post('/api/auth/register', { name: name, password: password })
      : post('/api/auth/login', { name: name, password: password });

    request.then(function (res) {
      if (!res.ok) {
        showMessage((res.data && res.data.error) || '操作失败，请稍后再试。');
        return;
      }
      var name = (res.data.user && res.data.user.name) || '';
      setUser(res.data.user);
      form.reset();
      if (forced) {
        forced = false;
        document.body.classList.remove('login-locked');
        closeDialog();
        toast(mode === 'register' ? ('欢迎，' + name + '！') : ('已登录：' + name));
      } else if (mode === 'register') {
        showMessage('注册成功，已自动登录。');
        toast('欢迎，' + name + '！');
        window.setTimeout(closeDialog, 900);
      } else {
        closeDialog();
        toast('已登录：' + name);
      }
    }).catch(function (error) {
      /* 后端连不上且处于强制登录墙：放行进入，避免卡死（无法校验登录态） */
      if (forced) {
        forced = false;
        document.body.classList.remove('login-locked');
        closeDialog();
        toast('后端连接失败，已放行（未登录）');
      } else {
        showMessage(networkMessage(error));
      }
    }).finally(function () {
      submitBtn.disabled = false;
    });
  });

  /* 不再「进站强制登录」：只同步登录态。
     登录注册弹窗改为「用户要修改内容时」才弹出 —— 由各功能自行调用
     window.SiteAuth.open()（如留言板的发布 / 回复，见 contact-message.js） */
  setMode('login');
  refresh();

  /* 给留言板用的公开接口（含同一套接口地址回退逻辑） */
  window.SiteAuth = {
    getUser: function () { return user; },
    refresh: refresh,
    onChange: function (cb) { if (typeof cb === 'function') listeners.push(cb); },
    open: openDialog,
    networkMessage: networkMessage,
    api: api
  };
})();
