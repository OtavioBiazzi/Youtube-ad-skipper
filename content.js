(function () {
  "use strict";

  // ── Override addEventListener para bypass do isTrusted ────
  const _skipClasses = [
    "videoAdUiSkipButton",
    "ytp-ad-skip-button ytp-button",
    "ytp-ad-skip-button-modern ytp-button",
    "ytp-skip-ad-button",
  ];

  const _origAEL = HTMLElement.prototype.addEventListener;

  HTMLElement.prototype.addEventListener = function (type, listener, options) {
    if (type === "click" && _skipClasses.includes(this.className)) {
      const wrapped = function (e) {
        const h = {
          get(_, prop) {
            if (prop === "isTrusted") return true;
            if (typeof e[prop] === "function") {
              return function (...args) { return e[prop](...args); };
            }
            return e[prop];
          },
        };
        return listener(new Proxy({}, h));
      };
      return _origAEL.call(this, type, wrapped, options);
    }
    return _origAEL.call(this, type, listener, options);
  };

  // ── Configurações ─────────────────────────────────────

  let config = {
    enabled: true,
    skipDelay: 1,
    muteAds: true,
    showOverlay: true,
    aggressiveSkip: true,
  };

  const CHECK_INTERVAL = 200;

  let adState = {
    active: false,
    currentAd: undefined,
    startTime: null,
    skipTimer: null,
    targetSkipReached: false,
    watching: false,
    overlayEl: null,
    countdownInterval: null,
  };

  // ── Humanização — jitter aleatório ────────────────────

  function humanDelay(baseMs) {
    // ±30% de variação para parecer humano
    const jitter = baseMs * (0.7 + Math.random() * 0.6);
    return Math.round(jitter);
  }

  // ── Carregar configurações ────────────────────────────

  function loadSettings() {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(
        { enabled: true, skipDelay: 1, muteAds: true, showOverlay: true, aggressiveSkip: true },
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

  // ── Detectar anúncio ──────────────────────────────────

  function getAdPlaying() {
    const player = document.querySelector(".html5-video-player");
    return player && player.classList.contains("ad-showing");
  }

  // ── Clicar no botão de pular ──────────────────────────

  function clickSkipAdBtn() {
    // Método 1: classNames exatos
    for (const className of _skipClasses) {
      const elems = document.getElementsByClassName(className);
      for (const el of elems) {
        if (el) {
          el.click();
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
        return true;
      }
    }

    // Método 4: fechar surveys/dialogs genéricos
    const dismiss = document.querySelector(
      'button[id="dismiss-button"], tp-yt-paper-button#dismiss-button'
    );
    if (dismiss && dismiss.offsetParent !== null) {
      dismiss.click();
      return true;
    }

    return false;
  }

  // ── Anti-Adblock: fechar popup do YouTube ─────────────
  // O YouTube mostra um dialog pedindo pra desativar adblock.
  // Essa função detecta e fecha silenciosamente.

  function dismissAdblockWarning() {
    // Dialog principal do YouTube anti-adblock
    const selectors = [
      // Popup "Ad blockers are not allowed on YouTube"
      'ytd-enforcement-message-view-model',
      'tp-yt-paper-dialog.ytd-enforcement-message-view-model',
      '#dismiss-button',
      // Overlay de bloqueio
      'ytd-popup-container tp-yt-paper-dialog',
      // Botão "Allow YouTube Ads" / dismiss
      '.yt-adblocker-dialog-renderer button',
      'ytd-mealbar-promo-renderer #dismiss-button',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        // Tentar fechar via botão dismiss dentro do dialog
        const dismissBtn = el.querySelector('#dismiss-button') ||
                          el.querySelector('button[aria-label="Close"]') ||
                          el.querySelector('.dismiss-button') ||
                          el.querySelector('tp-yt-paper-button#dismiss-button');
        if (dismissBtn && dismissBtn.offsetParent !== null) {
          dismissBtn.click();
          return true;
        }
        // Se o próprio elemento for um botão dismiss
        if (el.tagName === 'BUTTON' || el.tagName === 'TP-YT-PAPER-BUTTON') {
          if (el.offsetParent !== null) {
            el.click();
            return true;
          }
        }
      }
    }

    // Fallback: procurar por texto nos dialogs
    const dialogs = document.querySelectorAll('tp-yt-paper-dialog, ytd-popup-container');
    for (const dialog of dialogs) {
      const text = (dialog.textContent || '').toLowerCase();
      if (text.includes('ad blocker') || text.includes('bloqueador') || 
          text.includes('adblock') || text.includes('anúncio bloqueado')) {
        const closeBtn = dialog.querySelector('#dismiss-button, button.dismiss, [aria-label="Close"]');
        if (closeBtn) {
          closeBtn.click();
          return true;
        }
        // Último recurso: remover o dialog do DOM
        dialog.remove();
        return true;
      }
    }

    return false;
  }

  // ── Overlay (com IDs ofuscados) ───────────────────────
  // Usa nomes que parecem nativos do YouTube para não serem detectados

  const OVERLAY_ID = "ytp-iv-player-content";     // parece nativo do YT
  const TIMER_ID = "ytp-tooltip-duration";         // parece nativo do YT
  const STYLE_ID = "ytp-style-corrections";        // parece nativo do YT

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

    const delay = config.skipDelay;

    overlay.innerHTML = `
      <div class="ytp-ad-text">Auto Pular Anúncio</div>
      <div class="ytp-ad-timer-text" id="${TIMER_ID}">${delay}s</div>
      <button class="ytp-ad-watch">Assistir Anúncio</button>
    `;

    player.style.position = "relative";
    player.appendChild(overlay);
    adState.overlayEl = overlay;

    // Assistir
    const watchBtn = overlay.querySelector(".ytp-ad-watch");
    if (watchBtn) {
      watchBtn.addEventListener("click", () => {
        adState.watching = true;
        clearTimeout(adState.skipTimer);
        clearInterval(adState.countdownInterval);
        removeOverlay();
        unmuteVideo();
      });
    }

    adState.countdownInterval = setInterval(() => {
      if (!adState.skipTargetTime) return;
      let remaining = Math.ceil((adState.skipTargetTime - Date.now()) / 1000);
      if (remaining < 0) remaining = 0;

      const timerEl = document.getElementById(TIMER_ID);
      if (timerEl) timerEl.textContent = remaining + "s";

      if (remaining <= 0) clearInterval(adState.countdownInterval);
    }, 200);
  }

  function removeOverlay() {
    document.querySelectorAll("#" + OVERLAY_ID).forEach(el => el.remove());
    adState.overlayEl = null;
    clearInterval(adState.countdownInterval);
  }

  // ── Agendar skip (com randomização) ───────────────────

  function scheduleSkip() {
    clearTimeout(adState.skipTimer);
    clearInterval(adState.countdownInterval);

    adState.targetSkipReached = false;

    const actualDelay = humanDelay(config.skipDelay * 1000);
    adState.skipTargetTime = Date.now() + actualDelay;
    adState.skipTimer = setTimeout(() => {
      adState.targetSkipReached = true;
    }, actualDelay);
  }

  // ── Mute/unmute ───────────────────────────────────────

  function muteVideo() {
    if (!config.muteAds || adState.watching) return;
    const video = document.querySelector("video");
    if (video && !video.muted) {
      video.muted = true;
      video.__ytpMuted = true;
    }
  }

  function unmuteVideo() {
    const video = document.querySelector("video");
    if (video && video.__ytpMuted) {
      video.muted = false;
      video.__ytpMuted = false;
    }
  }

  // ── Main loop ─────────────────────────────────────────

  function mainLoop() {
    if (!config.enabled) return;

    // Sempre tentar fechar popup anti-adblock
    dismissAdblockWarning();

    const adPlaying = getAdPlaying();

    if (adPlaying && !adState.active) {
      // ── Anúncio COMEÇOU ───
      adState.active = true;
      adState.watching = false;
      adState.startTime = Date.now();

      muteVideo();
      scheduleSkip();
      if (config.showOverlay) createOverlay();

    } else if (adPlaying && adState.active) {
      // ── Anúncio ainda ativo — tick ───
      if (adState.targetSkipReached && !adState.watching) {
        // Acelera moderadamente (2x em vez de 16x para não disparar alertas)
        const video = document.querySelector("video");
        if (config.aggressiveSkip && video) {
          video.playbackRate = 2;
        }

        const skipped = clickSkipAdBtn();
        if (skipped) {
          removeOverlay();
          adState.targetSkipReached = false;
        }
        // REMOVIDO: seek agressivo para o final do anúncio (video.currentTime = targetTime)
        // Isso era muito detectável pelo YouTube
      }
    } else if (!adPlaying && adState.active) {
      // ── Anúncio ACABOU ───
      adState.active = false;
      adState.currentAd = undefined;
      clearTimeout(adState.skipTimer);
      removeOverlay();
      unmuteVideo();

      // Restaurar playbackRate normal
      const video = document.querySelector("video");
      if (video && video.playbackRate !== 1) {
        video.playbackRate = 1;
      }
    } else if (!adPlaying && !adState.active) {
      // Fallback: limpar overlays órfãos
      const orphans = document.querySelectorAll("#" + OVERLAY_ID);
      if (orphans.length > 0) orphans.forEach(el => el.remove());
    }
  }

  // ── Init ──────────────────────────────────────────────

  function isInIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  function init() {
    if (isInIframe()) return;
    setInterval(mainLoop, CHECK_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
