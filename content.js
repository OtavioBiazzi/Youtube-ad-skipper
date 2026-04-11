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
    theme: "dark",
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
        { enabled: true, skipDelay: 0, muteAds: true, showOverlay: true, theme: "dark" },
        (s) => {
          config.enabled = s.enabled;
          config.skipDelay = s.skipDelay;
          config.muteAds = s.muteAds;
          config.showOverlay = s.showOverlay;
          config.theme = s.theme;
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
      if (changes.theme) config.theme = changes.theme.newValue;
    });
  }

  // ── Detectar anúncio (método da referência) ───────────

  function isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function getAdPlaying() {
    // Procurar elementos específicos de anúncio, validando visibilidade real no DOM
    const advertiserBtn = document.querySelector(".ytp-ad-visit-advertiser-button");
    if (isVisible(advertiserBtn)) return advertiserBtn.getAttribute("aria-label") || "ad";

    const advertiserLink = document.querySelector(".ytp-visit-advertiser-link");
    if (isVisible(advertiserLink)) return advertiserLink.getAttribute("aria-label") || "ad";

    const adBadge = document.querySelector(".ytp-ad-badge");
    if (isVisible(adBadge) && adBadge.textContent) return adBadge.textContent;

    // Fallback: classe ad-showing no player
    const player = document.querySelector(".html5-video-player");
    if (player && player.classList.contains("ad-showing")) return "ad-showing";

    return undefined;
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
        const realTime = adState.startTime
          ? Math.round((Date.now() - adState.startTime) / 1000)
          : 0;
        chrome.storage.local.set({
          adsSkipped: data.adsSkipped + 1,
          timeSaved: data.timeSaved + realTime,
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
        bottom: 60px;
        right: 12px;
        z-index: 99999;
        background: rgba(0, 0, 0, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
        color: #fff;
        min-width: 180px;
        pointer-events: all;
      }
      #yt-adskip-overlay.yt-adskip-light {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(0, 0, 0, 0.1);
        color: #0f0f0f;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      #yt-adskip-overlay .adskip-title {
        font-size: 11px; font-weight: 500;
        display: flex; align-items: center; gap: 4px;
        opacity: 0.8;
      }
      #yt-adskip-overlay .adskip-countdown {
        font-size: 14px; font-weight: 500; text-align: center; padding: 2px 0;
      }
      #yt-adskip-overlay .adskip-label {
        font-size: 10px; text-align: center; opacity: 0.6;
      }
      #yt-adskip-overlay .adskip-buttons { display: flex; gap: 6px; margin-top: 4px; }
      
      #yt-adskip-overlay button {
        flex: 1; border: none; border-radius: 18px; padding: 6px 12px;
        font-size: 12px; font-weight: 500; cursor: pointer;
        font-family: inherit;
      }
      
      #yt-adskip-overlay .adskip-btn-skip {
        background: #f1f1f1; color: #0f0f0f;
      }
      #yt-adskip-overlay .adskip-btn-skip:hover { background: #d9d9d9; }
      #yt-adskip-overlay.yt-adskip-light .adskip-btn-skip {
        background: #0f0f0f; color: #fff;
      }
      #yt-adskip-overlay.yt-adskip-light .adskip-btn-skip:hover { background: #272727; }
      
      #yt-adskip-overlay .adskip-btn-watch {
        background: rgba(255,255,255,0.1); color: #f1f1f1;
      }
      #yt-adskip-overlay .adskip-btn-watch:hover { background: rgba(255,255,255,0.2); }
      #yt-adskip-overlay.yt-adskip-light .adskip-btn-watch {
        background: rgba(0,0,0,0.05); color: #0f0f0f;
      }
      #yt-adskip-overlay.yt-adskip-light .adskip-btn-watch:hover { background: rgba(0,0,0,0.1); }
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
    if (config.theme === "light") {
      overlay.classList.add("yt-adskip-light");
    }

    const delay = config.skipDelay;
    const isInstant = delay === 0;

    overlay.innerHTML = `
      <div class="adskip-title">⚡ Ad Skipper</div>
      ${
        isInstant
          ? '<div class="adskip-countdown">Pulando...</div><div class="adskip-label">instantâneo</div>'
          : `<div class="adskip-countdown" id="adskip-timer">${delay}s</div><div class="adskip-label">pulando em</div>`
      }
      <div class="adskip-buttons">
        <button class="adskip-btn-skip" id="adskip-btn-skip">⏭ Pular Agora</button>
        <button class="adskip-btn-watch" id="adskip-btn-watch">👁 Assistir</button>
      </div>
    `;

    player.style.position = "relative";
    player.appendChild(overlay);
    adState.overlayEl = overlay;

    overlay.querySelector("#adskip-btn-skip").addEventListener("click", () => forceSkip());

    overlay.querySelector("#adskip-btn-watch").addEventListener("click", () => {
      adState.watching = true;
      clearTimeout(adState.skipTimer);
      clearInterval(adState.countdownInterval);

      const video = document.querySelector("video");
      if (video && video.__adSkipperMuted) {
        video.muted = false;
        video.__adSkipperMuted = false;
      }

      overlay.innerHTML = `
        <div class="adskip-title">👁 Assistindo Anúncio</div>
        <div class="adskip-label" style="color: #22c55e;">você escolheu assistir</div>
        <div class="adskip-buttons">
          <button class="adskip-btn-skip" id="adskip-btn-skip2">⏭ Mudei de ideia, pular</button>
        </div>
      `;
      overlay.querySelector("#adskip-btn-skip2").addEventListener("click", () => {
        adState.watching = false;
        forceSkip();
      });
    });

    if (!isInstant) {
      let remaining = delay;
      const timerEl = overlay.querySelector("#adskip-timer");
      adState.countdownInterval = setInterval(() => {
        remaining--;
        if (timerEl) timerEl.textContent = remaining + "s";
        if (remaining <= 0) clearInterval(adState.countdownInterval);
      }, 1000);
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
      adState.targetSkipReached = true;
    } else {
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
      adState.currentAd = adPlaying;
      adState.watching = false;
      adState.hasSkippedStats = false;
      adState.startTime = Date.now();
      console.log("[YT Ad Skipper] 🎯 Anúncio detectado:", adPlaying);

      muteVideo();
      if (config.showOverlay) createOverlay();
      scheduleSkip();

    } else if (adPlaying && adState.active && adPlaying !== adState.currentAd) {
      // ── Anúncio MUDOU (segundo anúncio) ───
      adState.currentAd = adPlaying;
      adState.watching = false;
      adState.hasSkippedStats = false;
      console.log("[YT Ad Skipper] 🔄 Novo anúncio:", adPlaying);

      muteVideo();
      if (config.showOverlay) createOverlay();
      scheduleSkip();

    } else if (adPlaying && adState.active) {
      // ── Anúncio ainda ativo — tick ───
      if (adState.targetSkipReached && !adState.watching) {
        const skipped = clickSkipAdBtn();
        if (skipped) {
          if (!adState.hasSkippedStats) { incrementStats(); adState.hasSkippedStats = true; }
          removeOverlay();
          adState.targetSkipReached = false;
        } else {
          // Se o botão não estiver lá ou falhar, força o fim avançando o tempo (muito mais seguro)
          const video = document.querySelector("video");
          if (video && isFinite(video.duration) && video.duration > 0.5) {
            video.playbackRate = 16;
            const targetTime = video.duration - 0.1;
            if (video.currentTime < targetTime) {
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
