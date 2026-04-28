(function() {
  const originalAddEventListener = HTMLElement.prototype.addEventListener;
  const originalRemoveEventListener = HTMLElement.prototype.removeEventListener;
  const wrappedListeners = new WeakMap();

  function getCapture(options) {
    return typeof options === "boolean" ? options : !!(options && options.capture);
  }

  function canTrackListener(listener) {
    return typeof listener === "function" || (listener && typeof listener === "object");
  }

  function getListenerMap(target, type, capture, create) {
    let byType = wrappedListeners.get(target);
    if (!byType && create) {
      byType = new Map();
      wrappedListeners.set(target, byType);
    }
    if (!byType) return null;

    const key = type + ":" + capture;
    let byListener = byType.get(key);
    if (!byListener && create) {
      byListener = new WeakMap();
      byType.set(key, byListener);
    }
    return byListener || null;
  }

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

    if (type === "click" && isSkipButton && canTrackListener(listener)) {
      const wrappedListener = function(e) {
        const handler = {
          get(target, prop) {
            if (prop === "isTrusted") return true;
            if (typeof target[prop] === "function") {
              return function(...args) { return target[prop](...args); };
            }
            return target[prop];
          },
        };
        const trustedEvent = new Proxy(e, handler);
        if (typeof listener === "function") {
          return listener.call(this, trustedEvent);
        }
        if (listener && typeof listener.handleEvent === "function") {
          return listener.handleEvent(trustedEvent);
        }
      };
      const listenerMap = getListenerMap(this, type, getCapture(options), true);
      listenerMap.set(listener, wrappedListener);
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  HTMLElement.prototype.removeEventListener = function(type, listener, options) {
    if (!canTrackListener(listener)) {
      return originalRemoveEventListener.call(this, type, listener, options);
    }
    const listenerMap = getListenerMap(this, type, getCapture(options), false);
    const wrappedListener = listenerMap ? listenerMap.get(listener) : null;
    if (wrappedListener) {
      listenerMap.delete(listener);
      return originalRemoveEventListener.call(this, type, wrappedListener, options);
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };
})();

export {};
