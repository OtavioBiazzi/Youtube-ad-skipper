(function() {
  const originalAddEventListener = HTMLElement.prototype.addEventListener;

  HTMLElement.prototype.addEventListener = function(type, listener, options) {
    let isSkipButton = false;
    try {
      const cls = typeof this.className === "string" 
                  ? this.className 
                  : (this.getAttribute && this.getAttribute("class") || "");
      if (cls && (cls.includes("skip-ad") || cls.includes("ad-skip") || cls.includes("videoAdUiSkipButton"))) {
        isSkipButton = true;
      }
    } catch(e) {}

    if (type === "click" && isSkipButton) {
      const wrappedListener = function(e) {
        const handler = {
          get(target, prop) {
            if (prop === "isTrusted") return true;
            if (typeof e[prop] === "function") {
              return function(...args) { return e[prop](...args); };
            }
            return e[prop];
          },
        };
        return listener(new Proxy(e, handler));
      };
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
})();
