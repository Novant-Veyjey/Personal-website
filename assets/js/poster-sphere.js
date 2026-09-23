(function swapStoryArt() {
  'use strict';
  var replacements = [
    ['.story-art--signal img', 'assets/art/other-side-echo.png?v=20260922'],
    ['.story-art--gate img', 'assets/art/portal-forest.jpg?v=20260922c'],
    ['.story-art--lab img', 'assets/art/hawkins-lab.jpg?v=20260922b'],
    ['.story-art--mind img', 'assets/art/mind-lair.jpg?v=20260922d']
  ];
  /* 必须用 querySelectorAll：联络海报被拆成上下两个裁切窗，
     每个窗里各有一份 <img>，只换第一份会让下半张留在旧图上
     （结果是下半窗显示另一张方图的边缘，看着像残留碎片）。 */
  replacements.forEach(function (entry) {
    document.querySelectorAll(entry[0]).forEach(function (image) {
      image.src = entry[1];
    });
  });
}());

function initPosterSphere() {
  'use strict';
  var stage = document.getElementById('poster-sphere-stage');
  var ball = document.getElementById('poster-sphere-ball');
  if (!stage || !ball || window.matchMedia('(max-width: 900px)').matches) return;

  var storageKey = 'upsideDownPosterImages.v1';
  var seedItems = Array.prototype.slice.call(ball.querySelectorAll('.poster')).map(function (image) {
    return { src: image.getAttribute('src'), alt: image.getAttribute('alt') || '科幻电影海报', landscape: image.classList.contains('poster--landscape') };
  });
  var items = loadItems() || seedItems;
  var posters = [];
  var points = [];
  var slots = [];
  var count = 0;
  var radius = { x: 350, y: 270, z: 280 };
  var state = { yaw: -0.28, pitch: 0.08, targetYaw: -0.28, targetPitch: 0.08 };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  var animating = false;
  var pointer = { active: false, x: 0, y: 0 };

  function loadItems() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return Array.isArray(saved) && saved.length ? saved.filter(function (item) { return item && item.src; }) : null;
    } catch (error) { return null; }
  }
  function saveItems(next) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (error) {}
  }
  function point(index) {
    var golden = Math.PI * (3 - Math.sqrt(5));
    var y = count < 2 ? 0 : 1 - (index / (count - 1)) * 2;
    var ring = Math.sqrt(Math.max(0, 1 - y * y));
    var theta = golden * index;
    return { x: Math.cos(theta) * ring, y: y, z: Math.sin(theta) * ring };
  }
  function project(p) {
    var cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    var x1 = p.x * cy - p.z * sy;
    var z1 = p.x * sy + p.z * cy;
    var y1 = p.y * cp - z1 * sp;
    var z2 = p.y * sp + z1 * cp;
    var depth = (z2 + 1) / 2;
    var front = 0.72 + depth * 0.44;
    return { x: x1 * radius.x, y: -y1 * radius.y, z: z2 * radius.z, scale: front, opacity: 0.66 + depth * 0.34, depth: z2 };
  }
  function stylePoster(poster, projected) {
    poster.style.transform = 'translate3d(' + projected.x.toFixed(1) + 'px,' + projected.y.toFixed(1) + 'px,' + projected.z.toFixed(1) + 'px) scale(' + projected.scale.toFixed(3) + ')';
    poster.style.opacity = projected.opacity.toFixed(3);
    poster.style.zIndex = String(Math.round((projected.depth + 1) * 100));
    poster.style.filter = 'none';
  }
  function render() {
    posters.forEach(function (poster, index) { stylePoster(poster, project(points[slots[index]])); });
  }
  function bindPoster(poster) {
    poster.addEventListener('click', function () {
      if (pointer.active || animating) return;
      var index = posters.indexOf(poster);
      if (window.openPosterPreview) window.openPosterPreview(index);
    });
  }
  function rebuild(nextItems) {
    items = nextItems.filter(function (item) { return item && item.src; });
    if (!items.length) items = seedItems.slice(0, 2);
    count = items.length;
    points = [];
    slots = [];
    posters = [];
    ball.innerHTML = '';
    items.forEach(function (item, index) {
      points.push(point(index));
      slots.push(index);
      var image = document.createElement('img');
      image.className = 'poster' + (item.landscape ? ' poster--landscape' : '');
      image.src = item.src;
      image.alt = item.alt || '科幻电影海报';
      image.dataset.poster = String(index);
      image.draggable = false;
      ball.appendChild(image);
      posters.push(image);
      bindPoster(image);
    });
    render();
  }

  rebuild(items);
  function tick() {
    state.yaw += (state.targetYaw - state.yaw) * 0.055;
    state.pitch += (state.targetPitch - state.pitch) * 0.055;
    render();
  }
  if (gsap && !reduced) gsap.ticker.add(tick); else setInterval(tick, 16);
  stage.addEventListener('pointermove', function (event) {
    var rect = stage.getBoundingClientRect();
    var nx = event.clientX / rect.width - .5;
    var ny = event.clientY / rect.height - .5;
    if (pointer.active) {
      state.targetYaw += (event.clientX - pointer.x) * 0.0032;
      state.targetPitch += (event.clientY - pointer.y) * 0.0022;
    } else {
      state.targetYaw = -0.28 + nx * .16;
      state.targetPitch = .08 + ny * .12;
    }
    pointer.x = event.clientX; pointer.y = event.clientY;
  }, { passive: true });
  stage.addEventListener('pointerdown', function (event) { pointer.active = true; pointer.x = event.clientX; pointer.y = event.clientY; stage.classList.add('is-dragging'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
    stage.addEventListener(name, function () { pointer.active = false; stage.classList.remove('is-dragging'); });
  });
  if (gsap && window.ScrollTrigger && !reduced) {
    gsap.registerPlugin(window.ScrollTrigger);
    gsap.fromTo(ball, { scale: .88, autoAlpha: .3 }, { scale: 1, autoAlpha: 1, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: stage, start: 'top 75%', end: 'top 30%', scrub: 1 } });
  }
  window.posterSphere = {
    ready: true,
    getImages: function () { return items.slice(); },
    setImages: function (nextItems, persist) { rebuild(nextItems.slice()); if (persist) saveItems(items); }
  };
}
window.addEventListener('load', initPosterSphere, { once: true });
