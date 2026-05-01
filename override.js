(function() {
  "use strict";
  (function() {
    function isInIframe() {
      try {
        return window.self !== window.top;
      } catch (err) {
        return true;
      }
    }
    if (isInIframe() && !/^\/embed\//.test(location.pathname)) return;
    const MAX_AD_RATE = 16;
    const originalAddEventListener = HTMLElement.prototype.addEventListener;
    const originalRemoveEventListener = HTMLElement.prototype.removeEventListener;
    const originalJsonParse = JSON.parse.bind(JSON);
    const originalResponseJson = typeof Response !== "undefined" ? Response.prototype.json : null;
    const nativeCurrentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime");
    const nativePlaybackRate = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate");
    const wrappedListeners = /* @__PURE__ */ new WeakMap();
    const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
    const MAIN_SPEED_THROUGH_MESSAGE = "yt-ad-skipper:speed-through";
    const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";
    const CODEC_SETTINGS_MESSAGE = "youtube-extension:codec-settings";
    const CODEC_SETTINGS_STORAGE_KEY = "youtubeExtensionCodecSettings";
    let codecSettings = readCodecSettings();
    function normalizeCodecSettings(settings = {}) {
      return {
        forceStandardFps: !!settings.forceStandardFps,
        forceAvc: !!settings.forceAvc
      };
    }
    function readCodecSettings() {
      try {
        return normalizeCodecSettings(originalJsonParse(localStorage.getItem(CODEC_SETTINGS_STORAGE_KEY) || "{}"));
      } catch (err) {
        return normalizeCodecSettings();
      }
    }
    function hasCodecFilters() {
      return !!codecSettings.forceStandardFps || !!codecSettings.forceAvc;
    }
    function isAudioFormat(format) {
      const mime = String(format?.mimeType || "").toLowerCase();
      return mime.startsWith("audio/") || !format?.width && !format?.height && !mime.startsWith("video/");
    }
    function isAvcFormat(format) {
      const mime = String(format?.mimeType || "").toLowerCase();
      return mime.includes("video/mp4") && mime.includes("avc1");
    }
    function hasStandardFps(format) {
      const fps = Number(format?.fps || 0);
      return !Number.isFinite(fps) || fps <= 0 || fps <= 30;
    }
    function formatAllowed(format) {
      if (!format || isAudioFormat(format)) return true;
      if (codecSettings.forceAvc && !isAvcFormat(format)) return false;
      if (codecSettings.forceStandardFps && !hasStandardFps(format)) return false;
      return true;
    }
    function filterFormatList(list) {
      if (!Array.isArray(list) || !hasCodecFilters()) return list;
      const filtered = list.filter(formatAllowed);
      const keptVideo = filtered.some((format) => !isAudioFormat(format));
      const hadVideo = list.some((format) => !isAudioFormat(format));
      return hadVideo && !keptVideo ? list : filtered;
    }
    function filterStreamingData(streamingData) {
      if (!streamingData || typeof streamingData !== "object" || !hasCodecFilters()) return streamingData;
      if (Array.isArray(streamingData.formats)) {
        streamingData.formats = filterFormatList(streamingData.formats);
      }
      if (Array.isArray(streamingData.adaptiveFormats)) {
        streamingData.adaptiveFormats = filterFormatList(streamingData.adaptiveFormats);
      }
      if (codecSettings.forceAvc || codecSettings.forceStandardFps) {
        delete streamingData.dashManifestUrl;
        delete streamingData.hlsManifestUrl;
      }
      return streamingData;
    }
    function filterPlayerResponse(response, depth = 0) {
      if (!response || typeof response !== "object" || !hasCodecFilters() || depth > 4) return response;
      if (response.streamingData) {
        filterStreamingData(response.streamingData);
      }
      if (response.playerResponse && typeof response.playerResponse === "string") {
        try {
          const parsed = originalJsonParse(response.playerResponse);
          filterPlayerResponse(parsed, depth + 1);
          response.playerResponse = JSON.stringify(parsed);
        } catch (err) {
        }
      }
      const keys = ["playerResponse", "response", "data"];
      for (const key of keys) {
        if (response[key] && typeof response[key] === "object" && response[key] !== response) {
          filterPlayerResponse(response[key], depth + 1);
        }
      }
      return response;
    }
    function applyCodecFiltersToKnownGlobals() {
      if (!hasCodecFilters()) return;
      try {
        const pageWindow = window;
        if (pageWindow.ytInitialPlayerResponse) filterPlayerResponse(pageWindow.ytInitialPlayerResponse);
      } catch (err) {
      }
      try {
        const pageWindow = window;
        const args = pageWindow.ytplayer?.config?.args;
        if (args?.raw_player_response) {
          if (typeof args.raw_player_response === "string") {
            const parsed = originalJsonParse(args.raw_player_response);
            filterPlayerResponse(parsed);
            args.raw_player_response = JSON.stringify(parsed);
          } else {
            filterPlayerResponse(args.raw_player_response);
          }
        }
      } catch (err) {
      }
    }
    function installPlayerResponseSetter() {
      try {
        const pageWindow = window;
        let currentValue = pageWindow.ytInitialPlayerResponse;
        Object.defineProperty(pageWindow, "ytInitialPlayerResponse", {
          configurable: true,
          get() {
            return currentValue;
          },
          set(value) {
            currentValue = filterPlayerResponse(value);
          }
        });
        if (currentValue) currentValue = filterPlayerResponse(currentValue);
      } catch (err) {
      }
    }
    function updateCodecSettings(settings) {
      codecSettings = normalizeCodecSettings(settings);
      try {
        localStorage.setItem(CODEC_SETTINGS_STORAGE_KEY, JSON.stringify(codecSettings));
      } catch (err) {
      }
      applyCodecFiltersToKnownGlobals();
    }
    function textLooksLikePlayerResponse(text) {
      return typeof text === "string" && (text.includes('"streamingData"') || text.includes('"adaptiveFormats"') || text.includes('"playerResponse"'));
    }
    function responseLooksLikePlayerEndpoint(response) {
      const url = String(response?.url || "");
      return url.includes("/youtubei/v1/player") || url.includes("/get_video_info") || url.includes("/player?");
    }
    function resultLooksLikePlayerResponse(result) {
      return !!result && typeof result === "object" && (!!result.streamingData || !!result.playerResponse || !!result.response?.streamingData || !!result.data?.streamingData);
    }
    JSON.parse = function(text, reviver) {
      const parsed = originalJsonParse(text, reviver);
      return textLooksLikePlayerResponse(text) ? filterPlayerResponse(parsed) : parsed;
    };
    if (originalResponseJson) {
      Response.prototype.json = function(...args) {
        return originalResponseJson.apply(this, args).then((result) => {
          if (responseLooksLikePlayerEndpoint(this) || resultLooksLikePlayerResponse(result)) {
            return filterPlayerResponse(result);
          }
          return result;
        });
      };
    }
    function getCapture(options) {
      return typeof options === "boolean" ? options : !!(options && options.capture);
    }
    function canTrackListener(listener) {
      return typeof listener === "function" || listener && typeof listener === "object";
    }
    function getListenerMap(target, type, capture, create) {
      let byType = wrappedListeners.get(target);
      if (!byType && create) {
        byType = /* @__PURE__ */ new Map();
        wrappedListeners.set(target, byType);
      }
      if (!byType) return null;
      const key = type + ":" + capture;
      let byListener = byType.get(key);
      if (!byListener && create) {
        byListener = /* @__PURE__ */ new WeakMap();
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
        '[class*="skip"][class*="ad" i]'
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
    function normalizeAdRate(rate) {
      const n = Number(rate);
      if (!Number.isFinite(n)) return 3;
      return Math.min(MAX_AD_RATE, Math.max(1, n));
    }
    function normalizePlaybackRate(rate) {
      const n = Number(rate);
      if (!Number.isFinite(n) || n <= 0) return 1;
      return Math.min(16, Math.max(0.0625, n));
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
    function forceSkipFromMainWorld(rate = 3) {
      const speedRate = normalizeAdRate(rate);
      if (clickSkipButton()) {
        return { ok: true, method: "click" };
      }
      const player = getPlayer();
      const video = document.querySelector("video");
      let attempted = false;
      if (video) {
        const duration = getFinitePositiveNumber(video.duration);
        const currentTime = getFinitePositiveNumber(video.currentTime);
        const target = duration > 0 ? Math.max(duration - 0.05, currentTime + 0.25) : currentTime + 600;
        try {
          attempted = setNativeMediaValue(nativePlaybackRate, video, speedRate) || attempted;
          video.playbackRate = speedRate;
          attempted = true;
        } catch (err) {
        }
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
          } catch (innerErr) {
          }
        }
        try {
          if (player && typeof player.seekTo === "function" && duration > 0) {
            player.seekTo(target, true);
            attempted = true;
          }
        } catch (err) {
        }
      }
      try {
        if (player && typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(speedRate);
          attempted = true;
        }
      } catch (err) {
      }
      return { ok: attempted, method: attempted ? "seek" : "none" };
    }
    function setSpeedThrough(rate) {
      const player = getPlayer();
      const video = document.querySelector("video");
      let attempted = false;
      if (video) {
        try {
          attempted = setNativeMediaValue(nativePlaybackRate, video, rate) || attempted;
          video.playbackRate = rate;
          attempted = true;
        } catch (err) {
        }
      }
      try {
        if (player && typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(rate);
          attempted = true;
        }
      } catch (err) {
      }
      return attempted;
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.source === CODEC_SETTINGS_MESSAGE) {
        updateCodecSettings(data.settings || {});
        return;
      }
      if (data.source === MAIN_FORCE_SKIP_MESSAGE) {
        const result = forceSkipFromMainWorld(data.rate);
        window.postMessage({ source: MAIN_FORCE_SKIP_RESULT, ...result }, "*");
        return;
      }
      if (data.source === MAIN_SPEED_THROUGH_MESSAGE) {
        setSpeedThrough(normalizePlaybackRate(data.rate));
      }
    });
    installPlayerResponseSetter();
    applyCodecFiltersToKnownGlobals();
    document.addEventListener("yt-navigate-start", applyCodecFiltersToKnownGlobals, true);
    document.addEventListener("yt-navigate-finish", applyCodecFiltersToKnownGlobals, true);
    let codecGlobalChecks = 0;
    const codecGlobalTimer = window.setInterval(() => {
      codecGlobalChecks += 1;
      applyCodecFiltersToKnownGlobals();
      if (codecGlobalChecks >= 40) window.clearInterval(codecGlobalTimer);
    }, 250);
    HTMLElement.prototype.addEventListener = function(type, listener, options) {
      let isSkipButton = false;
      try {
        const cls = typeof this.className === "string" ? this.className : this.getAttribute && this.getAttribute("class") || "";
        if (cls && (cls.includes("skip-ad") || cls.includes("ad-skip") || cls.includes("videoAdUiSkipButton"))) {
          isSkipButton = true;
        }
      } catch (e) {
      }
      if (type === "click" && isSkipButton && canTrackListener(listener)) {
        const wrappedListener = function(e) {
          const handler = {
            get(target, prop) {
              if (prop === "isTrusted") return true;
              if (typeof target[prop] === "function") {
                return function(...args) {
                  return target[prop](...args);
                };
              }
              return target[prop];
            }
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
})();
