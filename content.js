(function() {
  "use strict";
  (function() {
    const _skipClasses = [
      "videoAdUiSkipButton",
      "ytp-ad-skip-button ytp-button",
      "ytp-ad-skip-button-modern ytp-button",
      "ytp-skip-ad-button"
    ];
    let config = {
      enabled: true,
      skipDelay: 1,
      muteAds: true,
      showOverlay: true,
      aggressiveSkip: true,
      instantSkip: false,
      showToast: false,
      shortcutEnabled: false,
      listMode: "whitelist",
      whitelist: [],
      pipEnabled: false
    };
    const CHECK_INTERVAL = 500;
    const FORCE_SKIP_RETRY_MS = 120;
    const FORCE_SKIP_WINDOW_MS = 6e3;
    const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
    const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";
    let adState = {
      active: false,
      currentAd: void 0,
      startTime: null,
      watching: false,
      overlayEl: null,
      countdownInterval: null,
      skipTargetTime: null,
      warningCount: 0,
      totalSkipped: 0,
      adsSkippedToday: 0,
      todayDate: null,
      lastVideoTime: -1,
      alreadyCounted: false,
      forceSkipInterval: null,
      forceSkipStartedAt: null,
      skipTimeout: null
    };
    let adblockObserver = null;
    let adblockBodyWaitObserver = null;
    function humanDelay(baseMs) {
      if (baseMs <= 0) return 0;
      const jitter = baseMs * (0.85 + Math.random() * 0.3);
      return Math.round(jitter);
    }
    function loadSettings() {
      return new Promise((resolve) => {
        if (chrome?.storage?.local) {
          chrome.storage.local.get(
            {
              enabled: true,
              skipDelay: 1,
              muteAds: true,
              showOverlay: true,
              aggressiveSkip: true,
              instantSkip: false,
              showToast: false,
              shortcutEnabled: false,
              listMode: "whitelist",
              whitelist: [],
              warningCount: 0,
              totalAdsSkipped: 0,
              adsSkippedToday: 0,
              todayDate: null,
              pipEnabled: false
            },
            (s) => {
              config.enabled = !!s.enabled;
              const d = Number(s.skipDelay);
              config.skipDelay = isNaN(d) || d < 0 ? 1 : d;
              config.muteAds = !!s.muteAds;
              config.showOverlay = !!s.showOverlay;
              config.aggressiveSkip = !!s.aggressiveSkip;
              config.instantSkip = !!s.instantSkip;
              config.showToast = !!s.showToast;
              config.shortcutEnabled = !!s.shortcutEnabled;
              config.listMode = s.listMode === "blacklist" ? "blacklist" : "whitelist";
              config.whitelist = Array.isArray(s.whitelist) ? s.whitelist : [];
              config.pipEnabled = !!s.pipEnabled;
              adState.warningCount = s.warningCount || 0;
              adState.totalSkipped = s.totalAdsSkipped || 0;
              adState.adsSkippedToday = s.adsSkippedToday || 0;
              adState.todayDate = s.todayDate || null;
              resolve();
            }
          );
        } else {
          resolve();
        }
      });
    }
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.enabled) {
          config.enabled = !!changes.enabled.newValue;
          if (config.enabled) {
            startAdblockProtection();
            if (config.pipEnabled) injectPipButton();
          } else {
            cleanupRuntimeState();
            stopAdblockProtection();
            removePipButton();
          }
        }
        if (changes.skipDelay) {
          const v = Number(changes.skipDelay.newValue);
          if (!isNaN(v) && v >= 0) config.skipDelay = v;
        }
        if (changes.muteAds) config.muteAds = !!changes.muteAds.newValue;
        if (changes.showOverlay) {
          config.showOverlay = !!changes.showOverlay.newValue;
          if (!config.showOverlay) removeOverlay();
        }
        if (changes.aggressiveSkip) config.aggressiveSkip = !!changes.aggressiveSkip.newValue;
        if (changes.instantSkip) config.instantSkip = !!changes.instantSkip.newValue;
        if (changes.showToast) config.showToast = !!changes.showToast.newValue;
        if (changes.shortcutEnabled) config.shortcutEnabled = !!changes.shortcutEnabled.newValue;
        if (changes.listMode) config.listMode = changes.listMode.newValue === "blacklist" ? "blacklist" : "whitelist";
        if (changes.whitelist) config.whitelist = Array.isArray(changes.whitelist.newValue) ? changes.whitelist.newValue : [];
        if (changes.pipEnabled) {
          config.pipEnabled = !!changes.pipEnabled.newValue;
          if (config.enabled && config.pipEnabled) {
            injectPipButton();
          } else {
            removePipButton();
          }
        }
      });
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.source !== MAIN_FORCE_SKIP_RESULT || !data.ok) return;
      if (data.method === "click") {
        finishSkipClick();
      }
    });
    function getAdPlaying() {
      const player = document.querySelector(".html5-video-player");
      if (player && player.classList.contains("ad-showing")) return true;
      const badges = document.querySelectorAll(".ytp-ad-badge, .ytp-ad-visit-advertiser-button, .ytp-visit-advertiser-link");
      for (const badge of badges) {
        if (badge && (badge.offsetWidth > 0 || badge.offsetHeight > 0)) {
          return true;
        }
      }
      return false;
    }
    function getClickableTarget(el) {
      if (!el) return null;
      return el.closest?.(
        'button, [role="button"], .ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .videoAdUiSkipButton'
      ) || el;
    }
    function isClickableVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && style.pointerEvents !== "none";
    }
    function clickElement(el) {
      const target = getClickableTarget(el);
      if (!target || !isClickableVisible(target)) return false;
      if (typeof target.click !== "function") return false;
      target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      target.click();
      return true;
    }
    function clickSkipAdBtn() {
      for (const className of _skipClasses) {
        const elems = document.getElementsByClassName(className);
        for (const el of elems) {
          if (clickElement(el)) return true;
        }
      }
      const extraSelectors = [
        ".ytp-skip-ad-button",
        ".ytp-ad-skip-button",
        ".ytp-ad-skip-button-modern",
        ".ytp-ad-skip-button-slot button",
        ".ytp-ad-skip-button-container button",
        'button[id^="skip-button"]',
        "div.ytp-ad-skip-button-slot button",
        '[aria-label*="Skip" i]',
        '[aria-label*="Pular" i]',
        '[title*="Skip" i]',
        '[title*="Pular" i]',
        '[class*="skip"][class*="ad" i]'
      ];
      for (const sel of extraSelectors) {
        const candidates = document.querySelectorAll(sel);
        for (const btn of candidates) {
          if (clickElement(btn)) return true;
        }
      }
      const allBtns = document.querySelectorAll("button, a, .ytp-ad-overlay-close-button");
      for (const btn of allBtns) {
        const text = (btn.textContent || "").toLowerCase().trim();
        if ((text.includes("pular") || text.includes("skip") || text.includes("ignorar")) && clickElement(btn)) {
          return true;
        }
      }
      const dismiss = document.querySelector(
        'button[id="dismiss-button"], tp-yt-paper-button#dismiss-button'
      );
      if (clickElement(dismiss)) return true;
      return false;
    }
    function getYouTubePlayer() {
      const player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
      return player || null;
    }
    function getFinitePositiveNumber(value) {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    function requestMainWorldSkip() {
      window.postMessage({
        source: MAIN_FORCE_SKIP_MESSAGE,
        targetTime: adState.skipTargetTime || Date.now()
      }, "*");
    }
    function forceSkipAd(video = document.querySelector("video")) {
      if (!config.enabled || !config.aggressiveSkip || adState.watching) return false;
      requestMainWorldSkip();
      const player = getYouTubePlayer();
      let attempted = false;
      if (video) {
        const duration = getFinitePositiveNumber(video.duration);
        const currentTime = getFinitePositiveNumber(video.currentTime);
        const target = duration > 0 ? Math.max(duration - 0.05, currentTime + 0.25) : currentTime + 600;
        try {
          video.playbackRate = 16;
          attempted = true;
        } catch (err) {
        }
        try {
          if (typeof video.fastSeek === "function") {
            video.fastSeek(target);
          }
          video.currentTime = target;
          attempted = true;
        } catch (err) {
          try {
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
          player.setPlaybackRate(16);
          attempted = true;
        }
      } catch (err) {
      }
      return attempted;
    }
    function stopForceSkipBurst() {
      if (adState.forceSkipInterval) {
        clearInterval(adState.forceSkipInterval);
        adState.forceSkipInterval = null;
      }
      adState.forceSkipStartedAt = null;
    }
    function clearSkipTimeout() {
      if (adState.skipTimeout) {
        clearTimeout(adState.skipTimeout);
        adState.skipTimeout = null;
      }
    }
    function finishSkipClick() {
      stopForceSkipBurst();
      clearSkipTimeout();
      adState.skipTargetTime = Date.now() + 1e3;
      removeOverlay();
      if (incrementAdCounter()) showToastNotification();
    }
    function attemptScheduledSkip() {
      if (!config.enabled || !adState.active || adState.watching) return false;
      const video = document.querySelector("video");
      if (clickSkipAdBtn()) {
        finishSkipClick();
        return true;
      }
      if (config.aggressiveSkip) {
        forceSkipAd(video);
        startForceSkipBurst(video);
      }
      return false;
    }
    function startForceSkipBurst(video = document.querySelector("video")) {
      if (!config.aggressiveSkip || adState.forceSkipInterval) return;
      adState.forceSkipStartedAt = Date.now();
      const tick = () => {
        if (!config.enabled || adState.watching || !getAdPlaying()) {
          stopForceSkipBurst();
          return;
        }
        if (clickSkipAdBtn()) {
          finishSkipClick();
          return;
        }
        forceSkipAd(video);
        if (Date.now() - adState.forceSkipStartedAt >= FORCE_SKIP_WINDOW_MS) {
          stopForceSkipBurst();
        }
      };
      tick();
      adState.forceSkipInterval = setInterval(tick, FORCE_SKIP_RETRY_MS);
    }
    const _abTagNames = [
      "YTD-ENFORCEMENT-MESSAGE-VIEW-MODEL"
    ];
    const ANTI_ADBLOCK_STYLE_ID = "ytp-css-patch-ab";
    function injectAntiAdblockCSS() {
      if (!config.enabled) return;
      if (document.getElementById(ANTI_ADBLOCK_STYLE_ID)) return;
      const s = document.createElement("style");
      s.id = ANTI_ADBLOCK_STYLE_ID;
      s.textContent = `
      ytd-enforcement-message-view-model,
      tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),
      tp-yt-paper-dialog.ytd-enforcement-message-view-model,
      ytd-popup-container tp-yt-paper-dialog:has(#enforcement-message-view-model),
      iron-overlay-backdrop {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        position: fixed !important;
        top: -9999px !important;
        left: -9999px !important;
      }
    `;
      (document.head || document.documentElement).appendChild(s);
    }
    function removeAntiAdblockCSS() {
      const style = document.getElementById(ANTI_ADBLOCK_STYLE_ID);
      if (style) style.remove();
    }
    function startAdblockProtection() {
      if (!config.enabled) return;
      injectAntiAdblockCSS();
      startAdblockObserver();
      dismissAdblockWarning();
    }
    function stopAdblockProtection() {
      if (adblockObserver) {
        adblockObserver.disconnect();
        adblockObserver = null;
      }
      if (adblockBodyWaitObserver) {
        adblockBodyWaitObserver.disconnect();
        adblockBodyWaitObserver = null;
      }
      removeAntiAdblockCSS();
    }
    function nukeAdblockElement(el) {
      if (!config.enabled || !el) return;
      const shouldCount = el.isConnected !== false;
      el.remove();
      const backdrops = document.querySelectorAll("iron-overlay-backdrop, tp-yt-paper-dialog-backdrop");
      backdrops.forEach((b) => b.remove());
      if (document.body) document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      if (!shouldCount) return;
      adState.warningCount++;
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ warningCount: adState.warningCount });
      }
    }
    function checkAndNukeNode(node) {
      if (!config.enabled) return;
      if (!node || node.nodeType !== 1) return;
      if (_abTagNames.includes(node.tagName)) {
        nukeAdblockElement(node);
        return;
      }
      if (node.tagName === "TP-YT-PAPER-DIALOG") {
        const inner = node.querySelector("ytd-enforcement-message-view-model");
        if (inner) {
          nukeAdblockElement(node);
          return;
        }
        const text = (node.textContent || "").toLowerCase();
        if (text.includes("bloqueador") || text.includes("ad blocker") || text.includes("proibidos") || text.includes("not allowed")) {
          nukeAdblockElement(node);
          return;
        }
      }
      const found = node.querySelector && node.querySelector("ytd-enforcement-message-view-model");
      if (found) {
        nukeAdblockElement(found.closest("tp-yt-paper-dialog") || found);
      }
    }
    function startAdblockObserver() {
      if (!config.enabled || adblockObserver || adblockBodyWaitObserver) return;
      const root = document.body || document.documentElement;
      if (!document.body) {
        adblockBodyWaitObserver = new MutationObserver(() => {
          if (document.body) {
            adblockBodyWaitObserver.disconnect();
            adblockBodyWaitObserver = null;
            startAdblockObserver();
          }
        });
        adblockBodyWaitObserver.observe(document.documentElement, { childList: true });
        return;
      }
      adblockObserver = new MutationObserver((mutations) => {
        if (!config.enabled) return;
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            checkAndNukeNode(node);
          }
        }
      });
      adblockObserver.observe(root, {
        childList: true,
        subtree: true
      });
    }
    function dismissAdblockWarning() {
      if (!config.enabled) return false;
      const enforcement = document.querySelector("ytd-enforcement-message-view-model");
      if (enforcement) {
        const dialog = enforcement.closest("tp-yt-paper-dialog") || enforcement;
        nukeAdblockElement(dialog);
        return true;
      }
      const dialogs = document.querySelectorAll("tp-yt-paper-dialog");
      for (const dialog of dialogs) {
        if (dialog.offsetParent === null && dialog.style.display === "none") continue;
        const text = (dialog.textContent || "").toLowerCase();
        if (text.includes("bloqueador") || text.includes("ad blocker") || text.includes("proibidos") || text.includes("not allowed") || text.includes("adblock")) {
          nukeAdblockElement(dialog);
          return true;
        }
      }
      const mealbar = document.querySelector("ytd-mealbar-promo-renderer #dismiss-button");
      if (mealbar && mealbar.offsetParent !== null) {
        mealbar.click();
        return true;
      }
      return false;
    }
    const OVERLAY_ID = "ytp-iv-player-content";
    const TIMER_ID = "ytp-tooltip-duration";
    const STYLE_ID = "ytp-style-corrections";
    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
      #${OVERLAY_ID} {
        position: absolute;
        top: 24px;
        right: 24px;
        z-index: 99999;
        background: rgba(0, 0, 0, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-family: "Roboto", "Arial", sans-serif;
        color: #fff;
        min-width: 140px;
        pointer-events: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      #${OVERLAY_ID} .ytp-ad-text {
        font-size: 13px; font-weight: 500; text-align: center;
        opacity: 0.9; margin-bottom: 2px;
      }

      #${OVERLAY_ID} .ytp-ad-timer-text {
        font-size: 16px; font-weight: 600; text-align: center;
      }

      #${OVERLAY_ID} button {
        border: none; border-radius: 4px; padding: 6px 12px;
        font-size: 12px; font-weight: 500; cursor: pointer;
        font-family: inherit; width: 100%;
        background: rgba(255,255,255,0.15); color: #fff;
        transition: background 0.2s;
      }

      #${OVERLAY_ID} button:hover {
        background: rgba(255,255,255,0.25);
      }
    `;
      document.head.appendChild(style);
    }
    function createOverlay() {
      removeOverlay();
      injectStyles();
      const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
      if (!player) return;
      const overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      const delay = getEffectiveDelay();
      const initialRemaining = adState.skipTargetTime ? Math.max(0, Math.ceil((adState.skipTargetTime - Date.now()) / 1e3)) : delay;
      overlay.innerHTML = `
      <div class="ytp-ad-text">Auto Pular Anuncio</div>
      <div class="ytp-ad-timer-text" id="${TIMER_ID}">${initialRemaining}s</div>
      <button class="ytp-ad-watch">Assistir Anuncio</button>
    `;
      player.style.position = "relative";
      player.appendChild(overlay);
      adState.overlayEl = overlay;
      const watchBtn = overlay.querySelector(".ytp-ad-watch");
      if (watchBtn) {
        watchBtn.addEventListener("click", () => {
          adState.watching = true;
          clearInterval(adState.countdownInterval);
          removeOverlay();
          unmuteVideo();
        });
      }
      adState.countdownInterval = setInterval(() => {
        if (!adState.skipTargetTime) return;
        let remaining = Math.ceil((adState.skipTargetTime - Date.now()) / 1e3);
        if (remaining < 0) remaining = 0;
        const timerEl = document.getElementById(TIMER_ID);
        if (timerEl) timerEl.textContent = remaining + "s";
        if (remaining <= 0) clearInterval(adState.countdownInterval);
      }, 200);
    }
    function removeOverlay() {
      document.querySelectorAll("#" + OVERLAY_ID).forEach((el) => el.remove());
      adState.overlayEl = null;
      clearInterval(adState.countdownInterval);
    }
    function getEffectiveDelay() {
      return config.instantSkip ? 0 : config.skipDelay;
    }
    function scheduleSkip() {
      clearInterval(adState.countdownInterval);
      stopForceSkipBurst();
      clearSkipTimeout();
      const delayMs = getEffectiveDelay() * 1e3;
      const actualDelayMs = config.aggressiveSkip ? delayMs : humanDelay(delayMs);
      adState.skipTargetTime = Date.now() + actualDelayMs;
      adState.skipTimeout = setTimeout(attemptScheduledSkip, actualDelayMs);
    }
    function muteVideo() {
      if (!config.muteAds || adState.watching) return;
      const muteBtn = document.querySelector(".ytp-mute-button");
      const volumeSlider = document.querySelector(".ytp-volume-slider-handle");
      const isMuted = volumeSlider ? parseInt(volumeSlider.style.left || "0") === 0 : false;
      if (muteBtn && !isMuted) {
        muteBtn.click();
        adState._wasMuted = true;
      }
    }
    function unmuteVideo() {
      if (!adState._wasMuted) return;
      const muteBtn = document.querySelector(".ytp-mute-button");
      const volumeSlider = document.querySelector(".ytp-volume-slider-handle");
      const isMuted = volumeSlider ? parseInt(volumeSlider.style.left || "0") === 0 : false;
      if (muteBtn && isMuted) {
        muteBtn.click();
      }
      adState._wasMuted = false;
    }
    function getCurrentChannel() {
      const sels = [
        "#channel-name yt-formatted-string a",
        "#channel-name a",
        "ytd-video-owner-renderer #channel-name a",
        "#owner-name a",
        "#upload-info #channel-name a",
        "ytd-channel-name yt-formatted-string"
      ];
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el && el.textContent.trim()) {
          return {
            name: el.textContent.trim().toLowerCase(),
            link: (el.href || "").toLowerCase()
          };
        }
      }
      return null;
    }
    function isChannelWhitelisted() {
      if (!config.whitelist || config.whitelist.length === 0) {
        return config.listMode === "blacklist" ? true : false;
      }
      const ch = getCurrentChannel();
      if (!ch) return false;
      const matched = config.whitelist.some((w) => {
        const wLower = w.toLowerCase().trim();
        if (!wLower) return false;
        if (ch.name.includes(wLower) || wLower.includes(ch.name)) return true;
        if (ch.link && wLower.length > 3) {
          if (ch.link.includes(wLower) || wLower.includes(ch.link)) return true;
        }
        return false;
      });
      if (config.listMode === "blacklist") {
        return !matched;
      } else {
        return matched;
      }
    }
    function showToastNotification() {
      if (!config.showToast) return;
      const existing = document.getElementById("ytp-skipper-toast");
      if (existing) existing.remove();
      if (!document.getElementById("ytp-toast-style")) {
        const style = document.createElement("style");
        style.id = "ytp-toast-style";
        style.textContent = `
        #ytp-skipper-toast {
          position: fixed; bottom: 24px; right: 24px;
          padding: 10px 20px; background: rgba(0, 0, 0, 0.85);
          color: #fff; font-family: 'Roboto', 'Arial', sans-serif;
          font-size: 13px; font-weight: 500; border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 999999; opacity: 0; transform: translateY(10px);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        #ytp-skipper-toast.show { opacity: 1; transform: translateY(0); }
      `;
        (document.head || document.documentElement).appendChild(style);
      }
      const toast = document.createElement("div");
      toast.id = "ytp-skipper-toast";
      toast.textContent = "Anúncio pulado ✓";
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add("show");
        });
      });
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 2e3);
    }
    function incrementAdCounter() {
      if (adState.alreadyCounted) return false;
      adState.alreadyCounted = true;
      const now = /* @__PURE__ */ new Date();
      const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      if (adState.todayDate !== today) {
        adState.todayDate = today;
        adState.adsSkippedToday = 0;
      }
      adState.totalSkipped++;
      adState.adsSkippedToday++;
      if (chrome?.storage?.local) {
        chrome.storage.local.set({
          totalAdsSkipped: adState.totalSkipped,
          adsSkippedToday: adState.adsSkippedToday,
          todayDate: adState.todayDate
        });
      }
      return true;
    }
    function resetPlaybackRate() {
      const video = document.querySelector("video");
      if (video && video.playbackRate !== 1) {
        video.playbackRate = 1;
      }
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(1);
        }
      } catch (err) {
      }
    }
    function cleanupRuntimeState() {
      stopForceSkipBurst();
      clearSkipTimeout();
      removeOverlay();
      unmuteVideo();
      resetPlaybackRate();
      adState.active = false;
      adState.currentAd = void 0;
      adState.startTime = null;
      adState.watching = false;
      adState.skipTargetTime = null;
      adState.lastVideoTime = -1;
      adState.alreadyCounted = false;
      adState.forceSkipInterval = null;
      adState.forceSkipStartedAt = null;
      adState.skipTimeout = null;
    }
    function mainLoop() {
      if (!config.enabled) {
        if (adState.active || adState.overlayEl) cleanupRuntimeState();
        return;
      }
      dismissAdblockWarning();
      const adPlaying = getAdPlaying();
      if (adPlaying && !adState.active) {
        if (isChannelWhitelisted()) return;
        adState.active = true;
        adState.watching = false;
        adState.startTime = Date.now();
        adState.lastVideoTime = -1;
        adState.alreadyCounted = false;
        muteVideo();
        scheduleSkip();
        if (config.showOverlay) createOverlay();
      } else if (adPlaying && adState.active) {
        if (adState.watching) return;
        const video = document.querySelector("video");
        if (video) {
          const ct = video.currentTime;
          if (adState.lastVideoTime > 2 && ct < adState.lastVideoTime - 2) {
            if (incrementAdCounter()) showToastNotification();
            adState.startTime = Date.now();
            adState.alreadyCounted = false;
            adState.lastVideoTime = ct;
            scheduleSkip();
            if (config.showOverlay) createOverlay();
            return;
          }
          adState.lastVideoTime = ct;
        }
        if (adState.skipTargetTime && Date.now() >= adState.skipTargetTime) {
          attemptScheduledSkip();
        }
      } else if (!adPlaying && adState.active) {
        if (!adState.watching) {
          if (incrementAdCounter()) showToastNotification();
        }
        cleanupRuntimeState();
      } else if (!adPlaying && !adState.active) {
        const orphans = document.querySelectorAll("#" + OVERLAY_ID);
        if (orphans.length > 0) orphans.forEach((el) => el.remove());
      }
    }
    document.addEventListener("keydown", (e) => {
      if (!config.enabled || !config.shortcutEnabled) return;
      if (e.shiftKey && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        if (adState.active && !adState.watching) {
          const skipped = clickSkipAdBtn();
          if (skipped) {
            removeOverlay();
            if (incrementAdCounter()) showToastNotification();
          }
        }
      }
    });
    const PIP_BTN_ID = "ytp-pip-float-btn";
    const PIP_STYLE_ID = "ytp-pip-style";
    function injectPipStyles() {
      if (document.getElementById(PIP_STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = PIP_STYLE_ID;
      style.textContent = `
      #${PIP_BTN_ID} {
        position: absolute;
        bottom: 60px;
        right: 16px;
        z-index: 99998;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.7);
        border: 1.5px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.2s ease, background 0.2s ease;
        pointer-events: auto;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
      }
      .html5-video-player:hover #${PIP_BTN_ID},
      #${PIP_BTN_ID}:focus {
        opacity: 1;
      }
      #${PIP_BTN_ID}:hover {
        background: rgba(200, 60, 60, 0.85);
        border-color: rgba(255, 255, 255, 0.35);
        transform: scale(1.1);
      }
      #${PIP_BTN_ID}:active {
        transform: scale(0.95);
      }
      #${PIP_BTN_ID} svg {
        width: 20px;
        height: 20px;
        pointer-events: none;
      }
      #${PIP_BTN_ID}.pip-active {
        background: rgba(200, 60, 60, 0.9);
        border-color: rgba(200, 60, 60, 0.6);
        box-shadow: 0 0 12px rgba(200, 60, 60, 0.4);
      }
      .html5-video-player:hover #${PIP_BTN_ID}.pip-active {
        opacity: 1;
      }
    `;
      (document.head || document.documentElement).appendChild(style);
    }
    function createPipButton() {
      if (document.getElementById(PIP_BTN_ID)) return;
      injectPipStyles();
      const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
      if (!player) return;
      const btn = document.createElement("button");
      btn.id = PIP_BTN_ID;
      btn.title = "Player Flutuante (PiP)";
      btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <rect x="12" y="10" width="8" height="6" rx="1" ry="1" fill="currentColor" opacity="0.4"/>
      </svg>
    `;
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const video2 = document.querySelector("video");
        if (!video2) return;
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            btn.classList.remove("pip-active");
          } else {
            await video2.requestPictureInPicture();
            btn.classList.add("pip-active");
          }
        } catch (err) {
          console.warn("[YouTube Ad Skipper] PiP error:", err);
        }
      });
      player.style.position = "relative";
      player.appendChild(btn);
      const video = document.querySelector("video");
      if (video) {
        video.addEventListener("enterpictureinpicture", () => {
          const b = document.getElementById(PIP_BTN_ID);
          if (b) b.classList.add("pip-active");
        });
        video.addEventListener("leavepictureinpicture", () => {
          const b = document.getElementById(PIP_BTN_ID);
          if (b) b.classList.remove("pip-active");
        });
      }
    }
    function removePipButton() {
      const btn = document.getElementById(PIP_BTN_ID);
      if (btn) btn.remove();
      const style = document.getElementById(PIP_STYLE_ID);
      if (style) style.remove();
    }
    function injectPipButton() {
      if (!config.enabled || !config.pipEnabled) return;
      const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
      if (player) {
        createPipButton();
      } else {
        setTimeout(() => {
          if (config.enabled && config.pipEnabled) createPipButton();
        }, 2e3);
      }
    }
    let _pipLastUrl = location.href;
    const _pipNavObserver = new MutationObserver(() => {
      if (location.href !== _pipLastUrl) {
        _pipLastUrl = location.href;
        if (config.enabled && config.pipEnabled) {
          setTimeout(injectPipButton, 1500);
        }
      }
    });
    _pipNavObserver.observe(document.documentElement, { childList: true, subtree: true });
    function isInIframe() {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    }
    function init() {
      if (isInIframe()) return;
      loadSettings().then(() => {
        startAdblockProtection();
        try {
          mainLoop();
        } catch (e) {
        }
        setInterval(mainLoop, CHECK_INTERVAL);
        injectPipButton();
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
