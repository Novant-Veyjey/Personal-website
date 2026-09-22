(function () {
  'use strict';

  var dialog = document.getElementById('archive-preview');
  var image = document.getElementById('archive-preview-image');
  var title = document.getElementById('archive-preview-title');
  var close = document.getElementById('archive-preview-close');
  if (!dialog || !image) return;

  function hide() {
    if (dialog.open) dialog.close();
  }
  document.querySelectorAll('[data-photo-preview]').forEach(function (card) {
    card.addEventListener('click', function (event) {
      event.preventDefault();
      image.src = card.href;
      image.alt = card.dataset.photoPreview || '照片预览';
      if (title) title.textContent = 'PHOTO ARCHIVE / ' + (card.dataset.photoPreview || 'IMAGE');
      if (typeof dialog.showModal === 'function') dialog.showModal();
    });
  });
  if (close) close.addEventListener('click', hide);
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) hide();
  });
}());
