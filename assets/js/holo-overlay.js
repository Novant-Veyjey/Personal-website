/* ============================================================
   全息卡片浮层：拦截首页 .holo-card 的整页跳转，改为在页内
   iframe 浮层打开。页面不卸载，背景音乐持续播放。
   ============================================================ */
(function () {
  'use strict';

  var overlay = document.getElementById('holo-overlay');
  var frame = document.getElementById('holo-overlay-frame');
  if (!overlay || !frame) return;

  var lastFocus = null;

  function openCard(url) {
    lastFocus = document.activeElement;
    frame.src = url;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('holo-overlay-open');
    var closeBtn = overlay.querySelector('.holo-overlay__close');
    if (closeBtn) closeBtn.focus();
  }

  function closeCard() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('holo-overlay-open');
    /* 清空源，停掉卡片甲的 Three.js 动画 / 媒体，避免后台空转 */
    frame.src = 'about:blank';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  /* 点遮罩或关闭键收起浮层 */
  overlay.addEventListener('click', function (event) {
    if (event.target.closest('[data-holo-close]')) closeCard();
  });

  /* Esc 关闭 */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !overlay.hidden) closeCard();
  });

  /* 卡片详情页点「← 返回选择卡片」：等价于点 ×，直接收起浮层 */
  window.addEventListener('message', function (event) {
    if (event.source === frame.contentWindow && event.data === 'holo-card:back') closeCard();
  });

  /* 拦截首页全息卡片的跳转：整页跳走会让音频停止，改成浮层内打开 */
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a.holo-card');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    /* 仅拦相对路径（指向本站卡片甲板），外链 / 锚点不拦 */
    if (!href || /^(https?:)?\/\//i.test(href) || href.charAt(0) === '#') return;
    event.preventDefault();
    openCard(href);
  });
})();
