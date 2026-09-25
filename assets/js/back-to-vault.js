/* ============================================================
   从卡片详情页返回时，把「全息收藏档案」滚到视口中间
   ------------------------------------------------------------
   卡片页的返回链接是 ../../../../main.html#holo-vault（直接打开卡片页时的兜底；
   从卡片集合页或主站点进来时，卡片页会优先 history.back() 返回原页面）。

   浏览器处理锚点的默认行为是：把目标元素顶到视口最上沿。
   而这个区块很高（标题 + 说明 + 五张卡片），顶到最上面之后，
   卡片会被挤到下半屏甚至屏幕外 —— 所以看起来"回到了顶端"。

   这里接管滚动：先抹掉 hash（否则浏览器会先跳一次再被我们拉回来，
   画面会闪一下），再把整个区块按视口高度居中。
   ============================================================ */
(function () {
  'use strict';

  if (location.hash !== '#holo-vault') return;

  function centerVault() {
    // 要对准的是「五张卡那一行」，不是整个区块。
    // 区块里还有标题和说明（.holo-vault__head），拿整块居中会把卡片挤到下半屏。
    var el = document.querySelector('#holo-vault .holo-grid') ||
             document.getElementById('holo-vault');
    if (!el) return;

    // 去掉 hash，避免浏览器的默认锚点跳转抢先执行
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }

    var rect = el.getBoundingClientRect();
    var top = window.pageYOffset + rect.top -
              Math.max(24, (window.innerHeight - rect.height) / 2);

    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  if (document.readyState === 'complete') {
    setTimeout(centerVault, 80);
  } else {
    window.addEventListener('load', function () { setTimeout(centerVault, 80); });
  }
})();
