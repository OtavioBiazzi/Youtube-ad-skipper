(function() {
  const originalAddEventListener = HTMLElement.prototype.addEventListener;
  const originalRemoveEventListener = HTMLElement.prototype.removeEventListener;
  const nativeCurrentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
  const nativePlaybackRate = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate");
  const wrappedListeners = new WeakMap();
  const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
  const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";

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

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect && el.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function getClickTarget(el) {
    if (!el) return null;
    return el.closest?.(
      'button, [role="button"], .ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .videoAdUiSkipButton'
    ) || el;
  }

  function clickSkipButton() {
    const selectors = [
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      ".ytp-ad-skip-button-slot button",
      ".ytp-ad-skip-button-container button",
      ".videoAdUiSkipButton",
      '[aria-label*="Skip" i]',
      '[aria-label*="Pular" i]',
      '[title*="Skip" i]',
      '[title*="Pular" i]',
      '[class*="skip"][class*="ad" i]',
    ];

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const target = getClickTarget(el);
        if (!target || typeof target.click !== "function" || !isVisible(target)) continue;
        target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
        target.click();
        return true;
      }
    }

    return false;
  }

  function getFinitePositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function setNativeMediaValue(descriptor, video, value) {
    if (descriptor && typeof descriptor.set === "function") {
      descriptor.set.call(video, value);
      return true;
    }
    return false;
  }

  function getPlayer() {
    return document.getElementById("movie_player") || document.querySelector(".html5-video-player");
  }

  function forceSkipFromMainWorld() {
    if (clickSkipButton()) {
      return { ok: true, method: "click" };
    }

    const player: any = getPlayer();
    const video = document.querySelector("video");
    let attempted = false;

    if (video) {
      const duration = getFinitePositiveNumber(video.duration);
      const currentTime = getFinitePositiveNumber(video.currentTime);
      const target = duration > 0
        ? Math.max(duration - 0.05, currentTime + 0.25)
        : currentTime + 600;

      try {
        attempted = setNativeMediaValue(nativePlaybackRate, video, 16) || attempted;
        video.playbackRate = 16;
        attempted = true;
      } catch (err) {}

      try {
        if (typeof video.fastSeek === "function") {
          video.fastSeek(target);
        }
        attempted = setNativeMediaValue(nativeCurrentTime, video, target) || attempted;
        video.currentTime = target;
        attempted = true;
      } catch (err) {
        try {
          attempted = setNativeMediaValue(nativeCurrentTime, video, currentTime + 30) || attempted;
          video.currentTime = currentTime + 30;
          attempted = true;
        } catch (innerErr) {}
      }

      try {
        if (player && typeof player.seekTo === "function" && duration > 0) {
          player.seekTo(target, true);
          attempted = true;
        }
      } catch (err) {}
    }

    try {
      if (player && typeof player.setPlaybackRate === "function") {
        player.setPlaybackRate(16);
        attempted = true;
      }
    } catch (err) {}

    return { ok: attempted, method: attempted ? "seek" : "none" };
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== MAIN_FORCE_SKIP_MESSAGE) return;
    const result = forceSkipFromMainWorld();
    window.postMessage({ source: MAIN_FORCE_SKIP_RESULT, ...result }, "*");
  });

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
