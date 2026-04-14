(function () {
  "use strict";

  // ── Classes do botão de pular (usadas para detecção) ────
  const _skipClasses = [
    "videoAdUiSkipButton",
    "ytp-ad-skip-button ytp-button",
    "ytp-ad-skip-button-modern ytp-button",
    "ytp-skip-ad-button",
  ];

  // NOTA: O bypass de isTrusted fica APENAS no override.js (world: MAIN).
  // Colocar aqui no content script (mundo isolado) não afeta o YouTube
  // e ainda cria uma assinatura detectável por fingerprinting de prototypes.

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
    skipTargetTime: null,
    warningCount: 0,   // conta quantas vezes o popup anti-adblock apareceu
  };

  // ── Humanização — jitter Gaussiano ────────────────────
  // Humanos reais têm tempo de reação que segue uma curva
  // normal (Gaussiana), não linear. Isso é muito mais
  // difícil de detectar como comportamento automático.

  function gaussianRandom() {
    // Box-Muller transform para gerar distribuição normal
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function humanDelay(baseMs) {
    // Centro no baseMs, desvio padrão de 15% do base
    // Resultado: 85% das vezes fica entre ±15% do valor configurado
    const stdDev = baseMs * 0.15;
    const delay = baseMs + gaussianRandom() * stdDev;
    // Mínimo de 300ms (ninguém reage em menos que isso)
    return Math.max(300, Math.round(delay));
  }

  // ── Carregar configurações ────────────────────────────

  function loadSettings() {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(
        { enabled: true, skipDelay: 1, muteAds: true, showOverlay: true, aggressiveSkip: true, warningCount: 0 },
        (s) => {
          config.enabled = s.enabled;
          config.skipDelay = s.skipDelay;
          config.muteAds = s.muteAds;
          config.showOverlay = s.showOverlay;
          config.aggressiveSkip = s.aggressiveSkip;
          adState.warningCount = s.warningCount || 0;
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

  // ── Detectar anúncio (método combinado) ───────────────
  // Usa AMBOS os métodos: classe no player + elementos de UI do anúncio
  // Isso é mais robusto e menos dependente de uma única classe CSS

  function getAdPlaying() {
    // Método 1: classe no player (original e mais confiável)
    const player = document.querySelector(".html5-video-player");
    if (player && player.classList.contains("ad-showing")) return true;

    // Método 2: elementos de UI do anúncio com verificação real de visibilidade
    const badges = document.querySelectorAll(".ytp-ad-badge, .ytp-ad-visit-advertiser-button, .ytp-visit-advertiser-link");
    for (const badge of badges) {
      // Se possui dimensões reais, está visível na tela
      if (badge && (badge.offsetWidth > 0 || badge.offsetHeight > 0)) {
        return true;
      }
    }

    return false;
  }

  // ── Clicar no botão de pular ──────────────────────────

  function clickSkipAdBtn() {
    // Método 1: classNames exatos
    for (const className of _skipClasses) {
      const elems = document.getElementsByClassName(className);
      for (const el of elems) {
        if (el && (el.offsetParent !== null || el.offsetWidth > 0)) {
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

  // ── Anti-Adblock: SISTEMA TRIPLO ────────────────────────
  // Camada 1: CSS injection — esconde o dialog ANTES de renderizar
  // Camada 2: MutationObserver — remove do DOM no instante que aparece (0ms)
  // Camada 3: Polling fallback — varredura a cada 200ms como rede de segurança

  const _abTagNames = [
    'YTD-ENFORCEMENT-MESSAGE-VIEW-MODEL',
  ];

  // ── Camada 1: CSS Preemptivo ──────────────────────────
  // ID dinâmico para evitar fingerprinting por ID fixo
  const _cssId = 'ytp-' + Math.random().toString(36).slice(2, 10);

  function injectAntiAdblockCSS() {
    if (document.getElementById(_cssId)) return;
    const s = document.createElement('style');
    s.id = _cssId;
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

  injectAntiAdblockCSS();

  // ── Camada 2: MutationObserver (instantâneo) ──────────
  function nukeAdblockElement(el) {
    if (!el) return;
    el.remove();
    const backdrops = document.querySelectorAll('iron-overlay-backdrop, tp-yt-paper-dialog-backdrop');
    backdrops.forEach(b => b.remove());
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    // Incrementar contador de avisos e salvar
    adState.warningCount++;
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ warningCount: adState.warningCount });
    }
  }

  function checkAndNukeNode(node) {
    if (!node || node.nodeType !== 1) return;

    if (_abTagNames.includes(node.tagName)) {
      nukeAdblockElement(node);
      return;
    }

    if (node.tagName === 'TP-YT-PAPER-DIALOG') {
      const inner = node.querySelector('ytd-enforcement-message-view-model');
      if (inner) { nukeAdblockElement(node); return; }
      const text = (node.textContent || '').toLowerCase();
      if (text.includes('bloqueador') || text.includes('ad blocker') ||
          text.includes('proibidos') || text.includes('not allowed')) {
        nukeAdblockElement(node);
        return;
      }
    }

    // Check filhos
    const found = node.querySelector && node.querySelector('ytd-enforcement-message-view-model');
    if (found) {
      nukeAdblockElement(found.closest('tp-yt-paper-dialog') || found);
    }
  }

  function startAdblockObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          checkAndNukeNode(node);
        }
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.body) {
    startAdblockObserver();
  } else {
    const bodyWait = new MutationObserver(() => {
      if (document.body) {
        bodyWait.disconnect();
        startAdblockObserver();
      }
    });
    bodyWait.observe(document.documentElement, { childList: true });
  }

  // ── Camada 3: Polling fallback ────────────────────────
  function dismissAdblockWarning() {
    const enforcement = document.querySelector('ytd-enforcement-message-view-model');
    if (enforcement) {
      const dialog = enforcement.closest('tp-yt-paper-dialog') || enforcement;
      nukeAdblockElement(dialog);
      return true;
    }
    const dialogs = document.querySelectorAll('tp-yt-paper-dialog');
    for (const dialog of dialogs) {
      if (dialog.offsetParent === null && dialog.style.display === 'none') continue;
      const text = (dialog.textContent || '').toLowerCase();
      if (text.includes('bloqueador') || text.includes('ad blocker') ||
          text.includes('proibidos') || text.includes('not allowed') ||
          text.includes('adblock')) {
        nukeAdblockElement(dialog);
        return true;
      }
    }
    const mealbar = document.querySelector('ytd-mealbar-promo-renderer #dismiss-button');
    if (mealbar && mealbar.offsetParent !== null) {
      mealbar.click();
      return true;
    }
    return false;
  }

  // ── Overlay (com IDs ofuscados) ───────────────────────

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

    const delay = config.skipDelay;

    overlay.innerHTML = `
      <div class="ytp-ad-text">Auto Pular Anuncio</div>
      <div class="ytp-ad-timer-text" id="${TIMER_ID}">${delay}s</div>
      <button class="ytp-ad-watch">Assistir Anuncio</button>
    `;

    player.style.position = "relative";
    player.appendChild(overlay);
    adState.overlayEl = overlay;

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

    // Leitura FRESCA do storage para garantir que o valor
    // do slider é respeitado, mesmo sem F5.
    if (chrome?.storage?.local) {
      chrome.storage.local.get({ skipDelay: 1 }, (s) => {
        config.skipDelay = s.skipDelay;
        _startSkipTimer();
      });
    } else {
      _startSkipTimer();
    }
  }

  function _startSkipTimer() {
    const actualDelay = humanDelay(config.skipDelay * 1000);
    adState.skipTargetTime = Date.now() + actualDelay;
    adState.skipTimer = setTimeout(() => {
      adState.targetSkipReached = true;
    }, actualDelay);
  }

  // ── Mute/unmute ───────────────────────────────────────
  // Método do yt-ad-autoskipper: simula clique no botão de mute do YouTube
  // em vez de manipular video.muted diretamente (menos detectável)

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
      adState._speedRamp = 0; // contador para aceleração progressiva

      muteVideo();
      scheduleSkip();
      if (config.showOverlay) createOverlay();

    } else if (adPlaying && adState.active) {
      // ── Anúncio ainda ativo — tick ───
      if (adState.targetSkipReached && !adState.watching) {
        
        // 1. Tentar clicar no botão nativamente (Stealth) se estiver visível
        const skipped = clickSkipAdBtn();
        
        if (!skipped && config.aggressiveSkip) {
          // 2. Forçar Pulo: Estratégia de 3 camadas (da mais stealth pra menos)
          forceSkipAd();
        } else if (skipped) {
          // Se pulou na maciota (clique)
          removeOverlay();
          adState.targetSkipReached = false;
        }
      }
    } else if (!adPlaying && adState.active) {
      // ── Anúncio ACABOU ───
      adState.active = false;
      adState.currentAd = undefined;
      adState._speedRamp = 0;
      adState.targetSkipReached = false;
      clearTimeout(adState.skipTimer);
      removeOverlay();
      unmuteVideo();

      const video = document.querySelector("video");
      if (video && video.playbackRate !== 1) {
        video.playbackRate = 1;
      }
    } else if (!adPlaying && !adState.active) {
      const orphans = document.querySelectorAll("#" + OVERLAY_ID);
      if (orphans.length > 0) orphans.forEach(el => el.remove());
    }
  }

  // ── Forçar pulo do anúncio (3 camadas stealth) ──────────
  //
  // Camada A: YouTube Player API (.seekTo) — usa o método interno que o
  //           próprio YouTube usa quando VOCÊ arrasta a barra de progresso.
  //           É o mais indetectável porque é o mesmo código nativo.
  //
  // Camada B: Aceleração Progressiva — em vez de pular pra 16x de uma vez
  //           (que grita "robô"), sobe a velocidade aos poucos: 2→4→8.
  //           Velocidade 2x é algo que o próprio usuário pode configurar
  //           no YouTube, então é invisível. 4x e 8x são mais rápidas
  //           mas ainda dentro do que extensões de velocidade fazem.
  //
  // Camada C: Seek direto — só se as outras falharem, pula pro final.

  function forceSkipAd() {
    const video = document.querySelector("video");
    if (!video || !video.duration || video.duration <= 0) return;

    // ── Camada A: YouTube Player API ──
    const player = document.querySelector("#movie_player");
    if (player && typeof player.seekTo === "function") {
      // Pula pro último segundo do ad usando a API nativa do YouTube
      player.seekTo(video.duration - 0.1, true);
      return;
    }

    // ── Camada B: Aceleração Progressiva ──
    // Sobe a velocidade gradualmente a cada tick (200ms)
    adState._speedRamp = (adState._speedRamp || 0) + 1;

    if (adState._speedRamp <= 2) {
      // Primeiros 400ms: velocidade 2x (normal humano)
      video.playbackRate = 2;
    } else if (adState._speedRamp <= 4) {
      // 400-800ms: velocidade 4x
      video.playbackRate = 4;
    } else {
      // Depois de 800ms tentando: velocidade 8x
      video.playbackRate = 8;
    }

    // ── Camada C: Seek se o ad for muito longo (>15s restando) ──
    // Se depois de 1.2 segundos acelerando ainda sobra muito ad...
    if (adState._speedRamp > 6 && video.currentTime < video.duration - 2) {
      video.currentTime = video.duration - 0.1;
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
