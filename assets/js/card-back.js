(function () {
  'use strict';

  var fallbackUrl = new URL('../../../../main.html#holo-vault', window.location.href).href;

  function closeCardOverlayOrReturn() {
    var parentWindow = window.parent;

    if (parentWindow && parentWindow !== window) {
      try {
        if (typeof parentWindow.holoOverlayClose === 'function') {
          parentWindow.holoOverlayClose();
          return;
        }
      } catch (error) {}

      try {
        parentWindow.postMessage('holo-card:back', '*');
        return;
      } catch (error) {}
    }

    window.location.replace(fallbackUrl);
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var backLink = target && target.closest ? target.closest('.card-back') : null;
    if (!backLink) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeCardOverlayOrReturn();
  }, true);
})();
