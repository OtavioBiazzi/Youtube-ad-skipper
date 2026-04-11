// Esse script é injetado na página para interceptar os event listeners
// dos botões de pular anúncio do YouTube e fazer o isTrusted retornar true.
(function() {
  const skipButtonClasses = [
    "videoAdUiSkipButton",
    "ytp-ad-skip-button ytp-button",
    "ytp-ad-skip-button-modern ytp-button",
    "ytp-skip-ad-button",
  ];

  const originalAddEventListener = HTMLElement.prototype.addEventListener;

  HTMLElement.prototype.addEventListener = function(type, listener, options) {
    if (type === "click" && skipButtonClasses.includes(this.className)) {
      const wrappedListener = function(e) {
        const handler = {
          get(_, prop) {
            if (prop === "isTrusted") return true;
            if (typeof e[prop] === "function") {
              return function(...args) { return e[prop](...args); };
            }
            return e[prop];
          },
        };
        return listener(new Proxy({}, handler));
      };
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
})();
