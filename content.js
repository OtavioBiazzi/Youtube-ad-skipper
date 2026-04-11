(function () {
  "use strict";

  // ── Override addEventListener para bypass do isTrusted ────
  // O YouTube verifica se o clique é "isTrusted" (feito pelo usuário).
  // Esse override faz com que cliques programáticos pareçam confiáveis
  // apenas nos botões de pular anúncio.

  const skipButtonClasses = [
    "videoAdUiSkipButton",
    "ytp-ad-skip-button ytp-button",
    "ytp-ad-skip-button-modern ytp-button",
    "ytp-skip-ad-button",
  ];

  const originalAddEventListener = HTMLElement.prototype.addEventListener;

  HTMLElement.prototype.addEventListener = function (type, listener, options) {
    if (type === "click" && skipButtonClasses.includes(this.className)) {
      const wrappedListener = function (e) {
        const handler = {
          get(_, prop) {
            if (prop === "isTrusted") return true;
            if (typeof e[prop] === "function") {
              return function (...args) { return e[prop](...args); };
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

  // ── Configurações ─────────────────────────────────────

  let config = {
    enabled: true,
    skipDelay: 0,
    muteAds: true,
    showOverlay: true,
    aggressiveSkip: true,
  };

  const CHECK_INTERVAL = 200; // mesma velocidade da referência

  let adState = {
    active: false,
    currentAd: undefined,
    startTime: null,
    skipTimer: null,
    targetSkipReached: false,
    hasSkippedStats: false,
    watching: false,
    overlayEl: null,
    countdownInterval: null,
  };

  // ── Carregar configurações ────────────────────────────

  function loadSettings() {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(
        { enabled: true, skipDelay: 0, muteAds: true, showOverlay: true, aggressiveSkip: true },
        (s) => {
          config.enabled = s.enabled;
          config.skipDelay = s.skipDelay;
          config.muteAds = s.muteAds;
          config.showOverlay = s.showOverlay;
          config.aggressiveSkip = s.aggressiveSkip;
        }
      );
    }
  }

  loadSettings();

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) config.enabled = changes.enabled.newValue;
      if (changes.skipDelay) config.skipDelay = changes.skipDelay.newValue;
      if (changes.muteAds) config.muteAds = changes.muteAds.newValue;
      if (changes.showOverlay) config.showOverlay = changes.showOverlay.newValue;
      if (changes.aggressiveSkip) config.aggressiveSkip = changes.aggressiveSkip.newValue;
    });
  }

  // ── Detectar anúncio (método da referência) ───────────

  function isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function getAdPlaying() {
    const player = document.querySelector(".html5-video-player");
    return player && player.classList.contains("ad-showing");
  }

  // ── Clicar no botão de pular ──────────────────────────

  function clickSkipAdBtn() {
    // Método 1: procurar pelos classNames exatos (como a referência)
    for (const className of skipButtonClasses) {
      const elems = document.getElementsByClassName(className);
      for (const el of elems) {
        if (el) {
          el.click();
          console.log("[YT Ad Skipper] ⏭️ Clicou no skip (class):", className);
          return true;
        }
      }
    }

    // Método 2: seletores CSS adicionais
    const extraSelectors = [
      ".ytp-ad-skip-button-slot button",
      ".ytp-ad-skip-button-container button",
      'button[id^="skip-button"]',
      "div.ytp-ad-skip-button-slot button",
    ];

    for (const sel of extraSelectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        console.log("[YT Ad Skipper] ⏭️ Clicou no skip (selector):", sel);
        return true;
      }
    }

    // Método 3: procurar por texto
    const allBtns = document.querySelectorAll("button, a, .ytp-ad-overlay-close-button");
    for (const btn of allBtns) {
      const text = (btn.textContent || "").toLowerCase().trim();
      if (
        (text.includes("pular") || text.includes("skip") || text.includes("ignorar")) &&
        (btn.offsetParent !== null || btn.offsetWidth > 0)
      ) {
        btn.click();
        console.log("[YT Ad Skipper] ⏭️ Clicou no skip (texto):", text);
        return true;
      }
    }

    // Método 4: fechar surveys/dialogs
    const dismiss = document.querySelector(
      'button[id="dismiss-button"], tp-yt-paper-button#dismiss-button'
    );
    if (dismiss && dismiss.offsetParent !== null) {
      dismiss.click();
      console.log("[YT Ad Skipper] ⏭️ Dialog fechado");
      return true;
    }

    return false;
  }

  // ── Stats ─────────────────────────────────────────────

  function incrementStats() {
    if (chrome?.storage?.local) {
      chrome.storage.local.get({ adsSkipped: 0, timeSaved: 0 }, (data) => {
        let saved = 0;
        const video = document.querySelector("video");
        if (video && isFinite(video.duration) && video.duration > 0) {
           saved = Math.round(video.duration);
        } else {
           saved = adState.startTime ? Math.round((Date.now() - adState.startTime) / 1000) : 0;
        }

        chrome.storage.local.set({
          adsSkipped: data.adsSkipped + 1,
          timeSaved: data.timeSaved + saved,
        });
      });
    }
  }

  // ── Overlay ───────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("yt-adskip-styles")) return;
    const style = document.createElement("style");
    style.id = "yt-adskip-styles";
    style.textContent = `
      #yt-adskip-overlay {
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
      
      #yt-adskip-overlay .adskip-title {
        font-size: 13px; font-weight: 500; text-align: center;
        opacity: 0.9; margin-bottom: 2px;
      }
      
      #yt-adskip-overlay .adskip-countdown {
        font-size: 16px; font-weight: 600; text-align: center;
      }
      
      #yt-adskip-overlay .adskip-label {
        font-size: 10px; text-align: center; opacity: 0.7; margin-bottom: 5px;
      }
      
      #yt-adskip-overlay button {
        border: none; border-radius: 4px; padding: 6px 12px;
        font-size: 12px; font-weight: 500; cursor: pointer;
        font-family: inherit; width: 100%;
        background: rgba(255,255,255,0.15); color: #fff;
        transition: background 0.2s;
      }
      
      #yt-adskip-overlay button:hover {
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
    overlay.id = "yt-adskip-overlay";

    const delay = config.skipDelay;
    const isInstant = delay === 0;

    overlay.innerHTML = `
      <div class="adskip-title">Auto Pular Anúncio</div>
      ${
        isInstant
          ? '<div class="adskip-countdown">Pulando...</div>'
          : `<div class="adskip-countdown" id="adskip-timer">${delay}s</div>`
      }
      <button class="adskip-btn-watch">Assistir Anúncio</button>
    `;

    player.style.position = "relative";
    player.appendChild(overlay);
    adState.overlayEl = overlay;

    // Assistir
    const watchBtn = overlay.querySelector(".adskip-btn-watch");
    if (watchBtn) {
      watchBtn.addEventListener("click", () => {
        adState.watching = true;
        clearTimeout(adState.skipTimer);
        clearInterval(adState.countdownInterval);
        removeOverlay();
        unmuteVideo();
      });
    }

    if (!isInstant) {
      adState.countdownInterval = setInterval(() => {
        if (!adState.skipTargetTime) return;
        let remaining = Math.ceil((adState.skipTargetTime - Date.now()) / 1000);
        if (remaining < 0) remaining = 0;
        
        const timerEl = document.querySelector("#adskip-timer");
        if (timerEl) timerEl.textContent = remaining + "s";
        
        if (remaining <= 0) clearInterval(adState.countdownInterval);
      }, 200);
    }
  }

  function removeOverlay() {
    if (adState.overlayEl) {
      adState.overlayEl.remove();
      adState.overlayEl = null;
    }
    clearInterval(adState.countdownInterval);
  }

  // ── Agendar skip ──────────────────────────────────────

  function scheduleSkip() {
    clearTimeout(adState.skipTimer);
    clearInterval(adState.countdownInterval);

    adState.targetSkipReached = false;
    
    if (config.skipDelay === 0) {
      adState.skipTargetTime = Date.now();
      adState.targetSkipReached = true;
    } else {
      adState.skipTargetTime = Date.now() + (config.skipDelay * 1000);
      adState.skipTimer = setTimeout(() => {
        adState.targetSkipReached = true;
      }, config.skipDelay * 1000);
    }
  }

  // ── Mute/unmute ───────────────────────────────────────

  function muteVideo() {
    if (!config.muteAds || adState.watching) return;
    const video = document.querySelector("video");
    if (video && !video.muted) {
      video.muted = true;
      video.__adSkipperMuted = true;
    }
  }

  function unmuteVideo() {
    const video = document.querySelector("video");
    if (video && video.__adSkipperMuted) {
      video.muted = false;
      video.__adSkipperMuted = false;
    }
  }

  // ── Main loop ─────────────────────────────────────────

  function mainLoop() {
    if (!config.enabled) return;

    const adPlaying = getAdPlaying();

    if (adPlaying && !adState.active) {
      // ── Anúncio COMEÇOU ───
      adState.active = true;
      adState.watching = false;
      adState.hasSkippedStats = false;
      adState.startTime = Date.now();
      console.log("[YT Ad Skipper] 🎯 Anúncio de vídeo ativo");

      muteVideo();
      scheduleSkip();
      if (config.showOverlay) createOverlay();

    } else if (adPlaying && adState.active) {
      // ── Anúncio ainda ativo — tick ───
      if (adState.targetSkipReached && !adState.watching) {
        // Acelera o vídeo no máximo para estourar o limite se Aggressive Mode estiver ligado
        const video = document.querySelector("video");
        if (config.aggressiveSkip && video) {
          video.playbackRate = 16;
        }

        const skipped = clickSkipAdBtn();
        if (skipped) {
          if (!adState.hasSkippedStats) { incrementStats(); adState.hasSkippedStats = true; }
          removeOverlay();
          adState.targetSkipReached = false;
        } else {
          // Avança para o fim do anúncio progressivamente se agressivo
          if (config.aggressiveSkip && video && isFinite(video.duration) && video.duration > 0) {
            const targetTime = video.duration - 0.5;
            if (video.currentTime < targetTime - 1) {
              video.currentTime = targetTime;
            }
          }
        }
      }
    } else if (!adPlaying && adState.active) {
      // ── Anúncio ACABOU ───
      if (adState.targetSkipReached && !adState.hasSkippedStats && !adState.watching) {
          incrementStats();
          adState.hasSkippedStats = true;
      }
      adState.active = false;
      adState.currentAd = undefined;
      clearTimeout(adState.skipTimer);
      removeOverlay();
      unmuteVideo();
      console.log("[YT Ad Skipper] ✅ Anúncio finalizado");
    }
  }

  // ── Init ──────────────────────────────────────────────

  // Não rodar dentro de iframes (YouTube tem vários)
  function isInIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  function init() {
    if (isInIframe()) return;

    console.log("[YT Ad Skipper] 🚀 v2.1 — Extensão iniciada!");
    setInterval(mainLoop, CHECK_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
