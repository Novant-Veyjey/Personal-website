/* ============================================================
   THE UPSIDE DOWN · interactions
   ============================================================ */
document.documentElement.classList.add('js');

(function () {
  'use strict';

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = $('#site-header');
  var nav = $('#main-nav');
  var navToggle = $('#nav-toggle');
  var progressBar = $('#scroll-progress-bar');
  var flash = $('#flash');
  var toastEl = $('#toast');
  var toastTimer;

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setNav(!nav.classList.contains('is-open'));
    });
  }
  $$('#main-nav a').forEach(function (link) {
    link.addEventListener('click', function () { setNav(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setNav(false);
  });

  function updateScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progressBar) progressBar.style.width = Math.min(100, y / max * 100) + '%';
    if (header) header.classList.toggle('is-scrolled', y > 36);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  var sections = $$('main section[id]');
  var navLinks = $$('#main-nav a[href^="#"]');
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-34% 0px -58% 0px', threshold: 0 });
    sections.forEach(function (section) { sectionObserver.observe(section); });
  }

  var revealItems = $$('.reveal');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    revealItems.forEach(function (item) { revealObserver.observe(item); });
  } else {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  }

  function tickClock() {
    var now = new Date();
    var text = [now.getHours(), now.getMinutes(), now.getSeconds()].map(function (n) {
      return String(n).padStart(2, '0');
    }).join(':');
    $$('[data-clock]').forEach(function (el) { el.textContent = text; });
  }
  tickClock();
  window.setInterval(tickClock, 1000);
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  function strike() {
    if (!flash || reducedMotion) return;
    flash.classList.remove('is-striking');
    void flash.offsetWidth;
    flash.classList.add('is-striking');
    window.setTimeout(function () { flash.classList.remove('is-striking'); }, 620);
  }
  function scheduleLightning(delay) {
    window.setTimeout(function () {
      if (!document.hidden) strike();
      scheduleLightning(3200 + Math.random() * 7600);
    }, delay);
  }
  if (!reducedMotion) scheduleLightning(1400);

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }
  window.showSiteToast = showToast;

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('信号已复制：' + text);
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try { document.execCommand('copy'); showToast('信号已复制：' + text); }
    catch (error) { showToast('复制失败，请手动选择邮箱'); }
    document.body.removeChild(input);
  }

  var copyMail = $('#copy-mail');
  if (copyMail) {
    copyMail.addEventListener('click', function () {
      copyText(copyMail.getAttribute('data-mail') || 'you@example.com');
    });
  }

  $$('a[href="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (link.id === 'contact-wechat' && link.dataset.wechat) {
        copyText(link.dataset.wechat);
        showToast('微信号已复制：' + link.dataset.wechat);
        return;
      }
      showToast('这里可以放你的微信二维码或主页链接');
    });
  });

  var heroContent = $('.hero__content');
  if (heroContent && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    var tiltX = 0, tiltY = 0, targetX = 0, targetY = 0, raf = 0;
    var renderTilt = function () {
      tiltX += (targetX - tiltX) * 0.07;
      tiltY += (targetY - tiltY) * 0.07;
      heroContent.style.transform = 'translate3d(' + tiltX.toFixed(2) + 'px,' + tiltY.toFixed(2) + 'px,0)';
      if (Math.abs(targetX - tiltX) > 0.05 || Math.abs(targetY - tiltY) > 0.05) {
        raf = requestAnimationFrame(renderTilt);
      } else {
        raf = 0;
      }
    };
    window.addEventListener('pointermove', function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 12;
      targetY = (e.clientY / window.innerHeight - 0.5) * 8;
      if (!raf) raf = requestAnimationFrame(renderTilt);
    }, { passive: true });
  }

  if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    $$('.holo-card').forEach(function (card) {
      var frame = 0;
      card.addEventListener('pointermove', function (event) {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          var rect = card.getBoundingClientRect();
          var x = (event.clientX - rect.left) / rect.width - .5;
          var y = (event.clientY - rect.top) / rect.height - .5;
          card.style.transform = 'translateY(-9px) rotateX(' + (-y * 10).toFixed(2) + 'deg) rotateY(' + (x * 12).toFixed(2) + 'deg)';
          card.style.setProperty('--foil-x', ((x + .5) * 100).toFixed(1) + '%');
          card.style.setProperty('--px', x.toFixed(3));
          card.style.setProperty('--py', y.toFixed(3));
          frame = 0;
        });
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        card.style.transform = '';
      });
    });
  }
  var canvas = $('#spore-canvas');
  if (canvas && !reducedMotion) {
    var ctx = canvas.getContext('2d');
    var width = 0, height = 0, dpr = 1, spores = [], lastTime = performance.now();
    function resizeCanvas() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = width < 700 ? 54 : 112;
      spores = Array.from({ length: count }, function () { return createSpore(true); });
    }
    function createSpore(randomY) {
      var kinds = [
        { color: 'rgba(239,224,201,', glow: 'rgba(239,224,201,.42)', blur: 6 },
        { color: 'rgba(174,190,202,', glow: 'rgba(174,190,202,.32)', blur: 5 },
        { color: 'rgba(229,35,45,', glow: 'rgba(229,35,45,.5)', blur: 10 }
      ];
      var roll = Math.random();
      var kind = roll < .66 ? kinds[0] : (roll < .86 ? kinds[1] : kinds[2]);
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : height + 12,
        r: 0.35 + Math.random() * 1.45,
        vx: -0.06 + Math.random() * 0.12,
        vy: -(0.06 + Math.random() * 0.26),
        phase: Math.random() * Math.PI * 2,
        drift: 0.08 + Math.random() * 0.24,
        alpha: 0.1 + Math.random() * 0.36,
        color: kind.color,
        glow: kind.glow,
        blur: kind.blur
      };
    }
    function drawSpores(now) {
      var delta = Math.min(2.6, (now - lastTime) / 16.67);
      lastTime = now;
      ctx.clearRect(0, 0, width, height);
      spores.forEach(function (p, index) {
        p.phase += 0.01 * delta;
        p.x += (p.vx + Math.sin(p.phase) * p.drift) * delta;
        p.y += p.vy * delta;
        if (p.y < -18 || p.x < -24 || p.x > width + 24) spores[index] = createSpore(false);
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = p.blur;
        var twinkle = .78 + .22 * Math.sin(p.phase * 1.7);
        ctx.fillStyle = p.color + (p.alpha * twinkle).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      requestAnimationFrame(drawSpores);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    document.addEventListener('visibilitychange', function () { lastTime = performance.now(); });
    requestAnimationFrame(drawSpores);
  }
})();
