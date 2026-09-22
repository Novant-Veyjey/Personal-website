/* ============================================================
   Local profile editor · saved in browser localStorage
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var KEY = 'upsideDownProfile.v1';
  var form = $('#profile-form');
  if (!form) return;

  var DEFAULTS = {
    cnName: '你的名字',
    enName: 'YOUR NAME',
    initials: 'YN',
    oneLine: '把脑海里的世界带到现实中来',
    role: '职业 / 身份',
    location: '城市 · 时区',
    statement: '我把复杂的问题拆开，再重新组装成清晰、有趣、有温度的体验。',
    bio0: '这里可以写你现在正在做什么、为什么做，以及你最在意的事情。建议写具体一点，让读者在十秒内记住你。',
    bio1: '第二段可以写你的经历、代表项目与擅长领域。不要堆砌标签，讲一个能证明能力的细节。',
    bio2: '第三段留给未来：你正在学习什么，下一步想去哪里，希望与怎样的人合作。',
    tags: 'CREATIVE, CODE, DESIGN, STORY',
    email: 'you@example.com',
    github: 'https://github.com/yourname',
    wechat: 'your_wechat',
    note: '好奇心不是弱点，它是通向我们世界的那道裂缝。',
    avatar: '',
    extras: []
  };

  var state = loadState();
  var modal = $('#profile-modal');
  var avatarPreview = $('#profile-avatar-preview');
  var avatarInput = $('#profile-avatar-input');
  var extraFields = $('#profile-extra-fields');
  var toastEl = $('#toast');
  var toastTimer;

  function clean(value, fallback) {
    value = String(value == null ? '' : value).trim();
    return value || (fallback == null ? '' : fallback);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function normalize(data) {
    var next = Object.assign({}, DEFAULTS, data || {});
    next.tags = clean(next.tags, DEFAULTS.tags);
    next.extras = Array.isArray(next.extras) ? next.extras.filter(function (item) {
      return item && clean(item.label) && clean(item.value);
    }).slice(0, 10) : [];
    return next;
  }

  function loadState() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (error) { return normalize({}); }
  }

  function saveState() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      showToast('资料已保存，并同步到页面');
    } catch (error) {
      showToast('保存失败：头像图片可能过大');
    }
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2400);
  }

  function heroTitleText(data) {
    var en = clean(data.enName, '');
    var cn = clean(data.cnName, '');
    var hasEnglish = en && en.toUpperCase() !== 'YOUR NAME';
    var hasChinese = cn && cn !== '你的名字';
    if (!hasEnglish && !hasChinese) return 'YOUR NAME';
    var name = hasEnglish ? en : cn;
    return /[\u3400-\u9fff]/.test(name) ? name + ' 的颠倒世界' : name + "'s Inverted Universe";
  }

  function renderHeroTitle(element, data) {
    if (!element) return;
    var text = heroTitleText(data);
    if (text === 'YOUR NAME') {
      element.textContent = text;
      element.setAttribute('data-text', text);
      return;
    }
    var name = text.replace(/(?:'s Inverted Universe|\s的颠倒世界)$/, '');
    var suffix = text.slice(name.length);
    element.innerHTML = '<span class="hero-title__name">' + escapeHtml(name) + '</span><span class="hero-title__suffix">' + escapeHtml(suffix) + '</span>';
    element.setAttribute('data-text', name);
  }

  function applyProfile(data) {
    data = normalize(data);
    $$('[data-profile-en]').forEach(function (el) {
      if (el.id === 'hero-title') return;
      el.textContent = data.enName;
    });
    renderHeroTitle($('#hero-title'), data);
    $$('[data-profile-cn]').forEach(function (el) { el.textContent = data.cnName; });
    $$('[data-profile-role]').forEach(function (el) { el.textContent = data.role; });
    $$('[data-profile-location]').forEach(function (el) { el.textContent = data.location; });
    $$('[data-profile-initials]').forEach(function (el) { el.textContent = data.initials || makeInitials(data); });
    $$('[data-profile-one-line]').forEach(function (el) { el.textContent = data.cnName + ' · ' + data.oneLine; });
    $$('[data-profile-statement]').forEach(function (el) { el.textContent = data.statement; });
    $$('[data-profile-note]').forEach(function (el) { el.textContent = '“' + data.note.replace(/^“|”$/g, '') + '”'; });
    $$('[data-profile-bio]').forEach(function (el) { el.textContent = data['bio' + el.dataset.profileBio] || ''; });

    var tags = $('#profile-tags');
    if (tags) {
      tags.innerHTML = '';
      data.tags.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean).slice(0, 8).forEach(function (tag) {
        var span = document.createElement('span');
        span.textContent = tag;
        tags.appendChild(span);
      });
    }

    var portrait = $('.subject-card__portrait');
    var avatar = $('#subject-avatar');
    if (portrait && avatar) {
      if (data.avatar) {
        avatar.src = data.avatar;
        avatar.hidden = false;
        portrait.classList.add('is-avatar');
      } else {
        avatar.removeAttribute('src');
        avatar.hidden = true;
        portrait.classList.remove('is-avatar');
      }
    }

    var extras = $('#profile-extra-data');
    if (extras) {
      extras.innerHTML = '';
      data.extras.forEach(function (item) {
        var row = document.createElement('div');
        var dt = document.createElement('dt');
        var dd = document.createElement('dd');
        dt.textContent = item.label;
        dd.textContent = item.value;
        row.append(dt, dd);
        extras.appendChild(row);
      });
    }

    var mail = $('#copy-mail');
    var email = $('#contact-email');
    if (mail) mail.setAttribute('data-mail', data.email);
    if (email) email.textContent = data.email;
    var github = $('#contact-github');
    if (github) {
      github.href = data.github || '#contact';
      github.toggleAttribute('aria-disabled', !data.github);
    }
    var wechat = $('#contact-wechat');
    if (wechat) {
      wechat.dataset.wechat = data.wechat;
      wechat.setAttribute('aria-label', '复制微信号 ' + data.wechat);
      wechat.title = '微信号：' + data.wechat;
    }

    document.title = heroTitleText(data) + ' · THE UPSIDE DOWN';
    if (avatarPreview) {
      avatarPreview.textContent = data.initials || makeInitials(data);
      avatarPreview.style.backgroundImage = data.avatar ? 'url("' + data.avatar + '")' : '';
    }
  }

  function makeInitials(data) {
    var source = clean(data.enName).replace(/[^a-z0-9 ]/gi, ' ').split(/\s+/).filter(Boolean);
    if (source.length >= 2) return (source[0][0] + source[1][0]).toUpperCase();
    return (clean(data.cnName, 'YN').slice(0, 2)).toUpperCase();
  }

  function fillForm() {
    Object.keys(DEFAULTS).forEach(function (key) {
      var field = form.elements.namedItem(key);
      if (field && key !== 'extras') field.value = state[key] == null ? '' : state[key];
    });
    renderExtras(state.extras);
    if (avatarPreview) {
      avatarPreview.textContent = state.initials || makeInitials(state);
      avatarPreview.style.backgroundImage = state.avatar ? 'url("' + state.avatar + '")' : '';
    }
  }

  function renderExtras(items) {
    if (!extraFields) return;
    extraFields.innerHTML = '';
    (items || []).forEach(addExtraRow);
  }

  function addExtraRow(item) {
    if (!extraFields) return;
    item = item || { label: '', value: '' };
    var row = document.createElement('div');
    row.className = 'profile-extra-row';
    var label = document.createElement('input');
    var value = document.createElement('input');
    var remove = document.createElement('button');
    label.type = value.type = 'text';
    label.placeholder = '名称';
    value.placeholder = '内容';
    label.maxLength = 16;
    value.maxLength = 60;
    label.value = item.label || '';
    value.value = item.value || '';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', '删除这项资料');
    remove.addEventListener('click', function () { row.remove(); });
    row.append(label, value, remove);
    extraFields.appendChild(row);
  }

  function collectForm() {
    var next = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      if (key === 'extras') return;
      var field = form.elements.namedItem(key);
      next[key] = field ? field.value : DEFAULTS[key];
    });
    next.extras = extraFields ? $$('.profile-extra-row', extraFields).map(function (row) {
      return { label: row.children[0].value.trim(), value: row.children[1].value.trim() };
    }).filter(function (item) { return item.label && item.value; }) : [];
    next.avatar = state.avatar || '';
    next.initials = clean(next.initials) || makeInitials(next);
    return normalize(next);
  }

  function openEditor() {
    fillForm();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('profile-modal-open');
    setTimeout(function () { var first = form.querySelector('input:not([type=file])'); if (first) first.focus(); }, 80);
  }

  function closeEditor() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('profile-modal-open');
  }

  $$('#open-profile-editor, #open-profile-editor-fab, [data-profile-edit]').forEach(function (trigger) {
    trigger.addEventListener('click', openEditor);
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(); }
    });
  });
  $$('[data-profile-close]').forEach(function (el) { el.addEventListener('click', closeEditor); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeEditor();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    state = collectForm();
    saveState();
    applyProfile(state);
    closeEditor();
  });

  $('#profile-add-extra').addEventListener('click', function () {
    if ($$('.profile-extra-row', extraFields).length >= 10) return showToast('最多添加 10 项');
    addExtraRow();
  });

  $('#profile-reset').addEventListener('click', function () {
    if (!window.confirm('确定恢复默认资料吗？当前保存在浏览器中的修改会被清除。')) return;
    try { localStorage.removeItem(KEY); } catch (error) {}
    state = normalize({});
    applyProfile(state);
    fillForm();
    showToast('已恢复默认资料');
  });

  $('#profile-avatar-remove').addEventListener('click', function () {
    state.avatar = '';
    if (avatarInput) avatarInput.value = '';
    if (avatarPreview) avatarPreview.style.backgroundImage = '';
    showToast('头像已移除，保存后生效');
  });

  avatarInput.addEventListener('change', function () {
    var file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return showToast('请选择图片文件');
    if (file.size > 10 * 1024 * 1024) return showToast('图片不能超过 10 MB');
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        var size = Math.min(image.width, image.height);
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = 640;
        var context = canvas.getContext('2d');
        context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 640, 640);
        state.avatar = canvas.toDataURL('image/jpeg', .86);
        if (avatarPreview) avatarPreview.style.backgroundImage = 'url("' + state.avatar + '")';
        showToast('头像已准备好，保存后生效');
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  applyProfile(state);
})();
