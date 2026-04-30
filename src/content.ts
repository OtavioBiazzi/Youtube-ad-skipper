declare global {
  interface Element {
    offsetParent: Element | null;
    offsetWidth: number;
    offsetHeight: number;
    click(): void;
    style: CSSStyleDeclaration;
    href: string;
  }
}

(function () {
  "use strict";
  const _skipClasses = [
    "videoAdUiSkipButton",
    "ytp-ad-skip-button ytp-button",
    "ytp-ad-skip-button-modern ytp-button",
    "ytp-skip-ad-button",
  ];

  // ── Configurações ─────────────────────────────────────

  let config: any = {
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
    pipEnabled: false,
    adSpeedRate: 3,
    customSpeedEnabled: false,
    adaptiveSpeedEnabled: false,
    playerSpeedEnabled: false,
    playerSpeedDefault: 1,
    playerSpeedStep: 0.25,
    playerSpeedWheel: false,
    playerSpeedWheelRightButton: false,
    playerVolumeEnabled: false,
    playerVolumeDefault: 50,
    playerVolumeStep: 5,
    playerVolumeWheel: false,
    playerVolumeWheelRightButton: false,
    playerWheelInvert: false,
    autoplayBlockBackground: false,
    autoplayBlockForeground: false,
    autoplayAllowPlaylists: true,
    pauseBackgroundTabs: false,
    qualityEnabled: false,
    qualityVideo: "hd720",
    qualityPlaylist: "hd720",
    qualityFullscreenEnabled: false,
    qualityFullscreenVideo: "hd1080",
    qualityFullscreenPlaylist: "hd1080",
    qualityRestoreOnExit: true,
    appearanceConvertShorts: false,
    appearanceHideShorts: false,
    appearanceHideRelated: false,
    appearanceHideChat: false,
    appearanceHideComments: false,
    appearanceHideEndcards: false,
  };

  const CHECK_INTERVAL = 500;
  const FORCE_SKIP_RETRY_MS = 120;
  const FORCE_SKIP_WINDOW_MS = 6000;
  const DEFAULT_SPEED_THROUGH_RATE = 3;
  const MIN_SPEED_THROUGH_RATE = 1;
  const MAX_SPEED_THROUGH_RATE = 8;
  const SAFE_SPEED_THROUGH_RATE = 3;
  const INSTANT_SPEED_THROUGH_RATE = 16;
  const MIN_PLAYBACK_RATE = 0.0625;
  const MAX_PLAYBACK_RATE = 16;
  const SPEED_THROUGH_RETRY_MS = 250;
  const PLAYBACK_RESTORE_RETRY_MS = 150;
  const PLAYBACK_RESTORE_WINDOW_MS = 2400;
  const POST_SKIP_RESTORE_DELAYS_MS = [180, 450, 900, 1500];
  const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
  const MAIN_SPEED_THROUGH_MESSAGE = "yt-ad-skipper:speed-through";
  const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";

  let adState: any = {
    active: false,
    currentAd: undefined,
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
    skipTimeout: null,
    speedThroughInterval: null,
    playbackRestoreInterval: null,
    playbackRestoreStartedAt: null,
    postSkipRestoreTimeouts: [],
    lastObserverSkipAttempt: 0,
    preAdPlaybackRate: null,
    playerVideoKey: "",
    defaultSpeedAppliedKey: "",
    defaultVolumeAppliedKey: "",
    rightMouseDown: false,
    lastUserPlaybackIntentAt: 0,
    autoplayVideo: null,
    tabPlaybackToken: Date.now() + "-" + Math.random().toString(36).slice(2),
    qualityVideoKey: "",
    qualityRequestKey: "",
    qualityRequestStartedAt: 0,
    qualityLastAttemptAt: 0,
    qualityAppliedKey: "",
    fullscreenQualityMode: false,
    preFullscreenQuality: null,
  };

  let adblockObserver: MutationObserver | null = null;
  let adblockBodyWaitObserver: MutationObserver | null = null;
  let skipButtonObserver: MutationObserver | null = null;
  let appearanceSignature = "";

  // ── Humanização — jitter aleatório ────────────────────

  function humanDelay(baseMs) {
    if (baseMs <= 0) return 0;
    // ±15 % de variação para parecer humano
    const jitter = baseMs * (0.85 + Math.random() * 0.3);
    return Math.round(jitter);
  }

  // ── Carregar configurações ────────────────────────────

  function loadSettings() {
    return new Promise<void>((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(
          {
            enabled: true, skipDelay: 1, muteAds: true, showOverlay: true,
            aggressiveSkip: true, instantSkip: false, showToast: false,
            shortcutEnabled: false, listMode: "whitelist", whitelist: [], warningCount: 0,
            totalAdsSkipped: 0, adsSkippedToday: 0, todayDate: null, pipEnabled: false,
            adSpeedRate: DEFAULT_SPEED_THROUGH_RATE, customSpeedEnabled: false, adaptiveSpeedEnabled: false,
            playerSpeedEnabled: false, playerSpeedDefault: 1, playerSpeedStep: 0.25,
            playerSpeedWheel: false, playerSpeedWheelRightButton: false,
            playerVolumeEnabled: false, playerVolumeDefault: 50, playerVolumeStep: 5,
            playerVolumeWheel: false, playerVolumeWheelRightButton: false, playerWheelInvert: false,
            autoplayBlockBackground: false, autoplayBlockForeground: false,
            autoplayAllowPlaylists: true, pauseBackgroundTabs: false,
            qualityEnabled: false, qualityVideo: "hd720", qualityPlaylist: "hd720",
            qualityFullscreenEnabled: false, qualityFullscreenVideo: "hd1080",
            qualityFullscreenPlaylist: "hd1080", qualityRestoreOnExit: true,
            appearanceConvertShorts: false, appearanceHideShorts: false,
            appearanceHideRelated: false, appearanceHideChat: false,
            appearanceHideComments: false, appearanceHideEndcards: false,
          },
          (s) => {
            config.enabled = !!s.enabled;
            config.skipDelay = normalizeSkipDelay(s.skipDelay);
            config.muteAds = !!s.muteAds;
            config.showOverlay = !!s.showOverlay;
            config.aggressiveSkip = !!s.aggressiveSkip;
            config.instantSkip = !!s.instantSkip;
            config.showToast = !!s.showToast;
            config.shortcutEnabled = !!s.shortcutEnabled;
            config.listMode = s.listMode === "blacklist" ? "blacklist" : "whitelist";
            config.whitelist = Array.isArray(s.whitelist) ? s.whitelist : [];
            config.pipEnabled = !!s.pipEnabled;
            config.adSpeedRate = normalizeSpeedRate(s.adSpeedRate);
            config.customSpeedEnabled = !!s.customSpeedEnabled;
            config.adaptiveSpeedEnabled = !!s.adaptiveSpeedEnabled;
            config.playerSpeedEnabled = !!s.playerSpeedEnabled;
            config.playerSpeedDefault = normalizeUserPlaybackRate(s.playerSpeedDefault, 1);
            config.playerSpeedStep = normalizePlayerSpeedStep(s.playerSpeedStep);
            config.playerSpeedWheel = !!s.playerSpeedWheel;
            config.playerSpeedWheelRightButton = !!s.playerSpeedWheelRightButton;
            config.playerVolumeEnabled = !!s.playerVolumeEnabled;
            config.playerVolumeDefault = normalizeVolumePercent(s.playerVolumeDefault);
            config.playerVolumeStep = normalizeVolumeStep(s.playerVolumeStep);
            config.playerVolumeWheel = !!s.playerVolumeWheel;
            config.playerVolumeWheelRightButton = !!s.playerVolumeWheelRightButton;
            config.playerWheelInvert = !!s.playerWheelInvert;
            config.autoplayBlockBackground = !!s.autoplayBlockBackground;
            config.autoplayBlockForeground = !!s.autoplayBlockForeground;
            config.autoplayAllowPlaylists = s.autoplayAllowPlaylists !== false;
            config.pauseBackgroundTabs = !!s.pauseBackgroundTabs;
            config.qualityEnabled = !!s.qualityEnabled;
            config.qualityVideo = normalizeQualityLevel(s.qualityVideo, "hd720");
            config.qualityPlaylist = normalizeQualityLevel(s.qualityPlaylist, "hd720");
            config.qualityFullscreenEnabled = !!s.qualityFullscreenEnabled;
            config.qualityFullscreenVideo = normalizeQualityLevel(s.qualityFullscreenVideo, "hd1080");
            config.qualityFullscreenPlaylist = normalizeQualityLevel(s.qualityFullscreenPlaylist, "hd1080");
            config.qualityRestoreOnExit = s.qualityRestoreOnExit !== false;
            config.appearanceConvertShorts = !!s.appearanceConvertShorts;
            config.appearanceHideShorts = !!s.appearanceHideShorts;
            config.appearanceHideRelated = !!s.appearanceHideRelated;
            config.appearanceHideChat = !!s.appearanceHideChat;
            config.appearanceHideComments = !!s.appearanceHideComments;
            config.appearanceHideEndcards = !!s.appearanceHideEndcards;
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
        applyAppearanceFilters();
      }
      if (changes.skipDelay) {
        config.skipDelay = normalizeSkipDelay(changes.skipDelay.newValue);
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
        if (config.enabled && config.pipEnabled) { injectPipButton(); } else { removePipButton(); }
      }
      if (changes.adSpeedRate) config.adSpeedRate = normalizeSpeedRate(changes.adSpeedRate.newValue);
      if (changes.customSpeedEnabled) config.customSpeedEnabled = !!changes.customSpeedEnabled.newValue;
      if (changes.adaptiveSpeedEnabled) config.adaptiveSpeedEnabled = !!changes.adaptiveSpeedEnabled.newValue;
      if (changes.playerSpeedEnabled) {
        config.playerSpeedEnabled = !!changes.playerSpeedEnabled.newValue;
        if (config.playerSpeedEnabled) adState.defaultSpeedAppliedKey = "";
      }
      if (changes.playerSpeedDefault) {
        config.playerSpeedDefault = normalizeUserPlaybackRate(changes.playerSpeedDefault.newValue, 1);
        adState.defaultSpeedAppliedKey = "";
      }
      if (changes.playerSpeedStep) config.playerSpeedStep = normalizePlayerSpeedStep(changes.playerSpeedStep.newValue);
      if (changes.playerSpeedWheel) config.playerSpeedWheel = !!changes.playerSpeedWheel.newValue;
      if (changes.playerSpeedWheelRightButton) config.playerSpeedWheelRightButton = !!changes.playerSpeedWheelRightButton.newValue;
      if (changes.playerVolumeEnabled) {
        config.playerVolumeEnabled = !!changes.playerVolumeEnabled.newValue;
        if (config.playerVolumeEnabled) adState.defaultVolumeAppliedKey = "";
      }
      if (changes.playerVolumeDefault) {
        config.playerVolumeDefault = normalizeVolumePercent(changes.playerVolumeDefault.newValue);
        adState.defaultVolumeAppliedKey = "";
      }
      if (changes.playerVolumeStep) config.playerVolumeStep = normalizeVolumeStep(changes.playerVolumeStep.newValue);
      if (changes.playerVolumeWheel) config.playerVolumeWheel = !!changes.playerVolumeWheel.newValue;
      if (changes.playerVolumeWheelRightButton) config.playerVolumeWheelRightButton = !!changes.playerVolumeWheelRightButton.newValue;
      if (changes.playerWheelInvert) config.playerWheelInvert = !!changes.playerWheelInvert.newValue;
      if (changes.autoplayBlockBackground) config.autoplayBlockBackground = !!changes.autoplayBlockBackground.newValue;
      if (changes.autoplayBlockForeground) config.autoplayBlockForeground = !!changes.autoplayBlockForeground.newValue;
      if (changes.autoplayAllowPlaylists) config.autoplayAllowPlaylists = changes.autoplayAllowPlaylists.newValue !== false;
      if (changes.pauseBackgroundTabs) config.pauseBackgroundTabs = !!changes.pauseBackgroundTabs.newValue;
      if (changes.qualityEnabled) {
        config.qualityEnabled = !!changes.qualityEnabled.newValue;
        resetQualityState();
      }
      if (changes.qualityVideo) {
        config.qualityVideo = normalizeQualityLevel(changes.qualityVideo.newValue, "hd720");
        resetQualityState();
      }
      if (changes.qualityPlaylist) {
        config.qualityPlaylist = normalizeQualityLevel(changes.qualityPlaylist.newValue, "hd720");
        resetQualityState();
      }
      if (changes.qualityFullscreenEnabled) {
        config.qualityFullscreenEnabled = !!changes.qualityFullscreenEnabled.newValue;
        resetQualityState();
      }
      if (changes.qualityFullscreenVideo) {
        config.qualityFullscreenVideo = normalizeQualityLevel(changes.qualityFullscreenVideo.newValue, "hd1080");
        resetQualityState();
      }
      if (changes.qualityFullscreenPlaylist) {
        config.qualityFullscreenPlaylist = normalizeQualityLevel(changes.qualityFullscreenPlaylist.newValue, "hd1080");
        resetQualityState();
      }
      if (changes.qualityRestoreOnExit) config.qualityRestoreOnExit = changes.qualityRestoreOnExit.newValue !== false;
      if (changes.appearanceConvertShorts) {
        config.appearanceConvertShorts = !!changes.appearanceConvertShorts.newValue;
        convertShortsUrlIfNeeded();
      }
      if (changes.appearanceHideShorts) {
        config.appearanceHideShorts = !!changes.appearanceHideShorts.newValue;
        applyAppearanceFilters();
      }
      if (changes.appearanceHideRelated) {
        config.appearanceHideRelated = !!changes.appearanceHideRelated.newValue;
        applyAppearanceFilters();
      }
      if (changes.appearanceHideChat) {
        config.appearanceHideChat = !!changes.appearanceHideChat.newValue;
        applyAppearanceFilters();
      }
      if (changes.appearanceHideComments) {
        config.appearanceHideComments = !!changes.appearanceHideComments.newValue;
        applyAppearanceFilters();
      }
      if (changes.appearanceHideEndcards) {
        config.appearanceHideEndcards = !!changes.appearanceHideEndcards.newValue;
        applyAppearanceFilters();
      }
      if (changes.tubeShieldActivePlayback) {
        handleExternalPlaybackSignal(changes.tubeShieldActivePlayback.newValue);
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

  // ── Detectar anúncio (método combinado) ───────────────
  // Usa AMBOS os métodos: classe no player + elementos de UI do anúncio
  // Isso é mais robusto e menos dependente de uma única classe CSS

  function getAdPlaying() {
    // Método 1: classe no player (original e mais confiável)
    const player = getYouTubePlayer();
    if (
      player &&
      (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting"))
    ) {
      return true;
    }

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
    // Método 1: classNames exatos
    for (const className of _skipClasses) {
      const elems = document.getElementsByClassName(className);
      for (const el of elems) {
        if (clickElement(el)) return true;
      }
    }

    // Método 2: seletores CSS adicionais
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
      '[class*="skip"][class*="ad" i]',
    ];

    for (const sel of extraSelectors) {
      const candidates = document.querySelectorAll(sel);
      for (const btn of candidates) {
        if (clickElement(btn)) return true;
      }
    }

    // Método 3: procurar por texto
    const allBtns = document.querySelectorAll("button, a, .ytp-ad-overlay-close-button");
    for (const btn of allBtns) {
      const text = (btn.textContent || "").toLowerCase().trim();
      if (
        (text.includes("pular") || text.includes("skip") || text.includes("ignorar")) &&
        clickElement(btn)
      ) {
        return true;
      }
    }

    // Método 4: fechar surveys/dialogs genéricos
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

  function normalizeSpeedRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n)) return DEFAULT_SPEED_THROUGH_RATE;
    return Math.min(MAX_SPEED_THROUGH_RATE, Math.max(MIN_SPEED_THROUGH_RATE, n));
  }

  function normalizeSkipDelay(delay = config.skipDelay) {
    const n = Number(delay);
    if (!Number.isFinite(n)) return 1;
    return Math.min(30, Math.max(1, n));
  }

  function getSafeAdaptiveSpeed(delay = config.skipDelay) {
    const d = normalizeSkipDelay(delay);
    if (d <= 3) return SAFE_SPEED_THROUGH_RATE;
    if (d <= 6) return 2.5;
    if (d <= 10) return 2;
    if (d <= 20) return 1.5;
    return 1.25;
  }

  function getRiskAdaptiveSpeed(delay = config.skipDelay) {
    const d = normalizeSkipDelay(delay);
    if (d <= 1) return 8;
    if (d <= 2) return 6;
    if (d <= 3) return 5;
    if (d <= 5) return 4;
    if (d <= 10) return 3;
    if (d <= 20) return 2;
    return 1.5;
  }

  function isInstantSkipEnabled() {
    return config.aggressiveSkip && config.instantSkip;
  }

  function normalizePlaybackRate(rate, fallback = 1) {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, n));
  }

  function normalizeUserPlaybackRate(rate, fallback = 1) {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(MAX_PLAYBACK_RATE, Math.max(0.25, n));
  }

  function normalizePlayerSpeedStep(step) {
    const n = Number(step);
    if (!Number.isFinite(n) || n <= 0) return 0.25;
    return Math.min(2, Math.max(0.05, n));
  }

  function normalizeVolumePercent(volume) {
    const n = Number(volume);
    if (!Number.isFinite(n)) return 50;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function normalizeVolumeStep(step) {
    const n = Number(step);
    if (!Number.isFinite(n) || n <= 0) return 5;
    return Math.min(25, Math.max(1, Math.round(n)));
  }

  function getActiveVideo() {
    return document.querySelector("video") as HTMLVideoElement | null;
  }

  function getCurrentVideoKey() {
    try {
      const url = new URL(location.href);
      const videoId = url.searchParams.get("v");
      if (videoId) return "watch:" + videoId;
    } catch (err) {}
    return location.pathname + location.search;
  }

  function setUserPlaybackRate(rate, video = getActiveVideo()) {
    const targetRate = normalizeUserPlaybackRate(rate, 1);

    if (video) {
      try {
        if (video.playbackRate !== targetRate) video.playbackRate = targetRate;
      } catch (err) {}
    }

    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.setPlaybackRate === "function") {
        player.setPlaybackRate(targetRate);
      }
    } catch (err) {}

    requestMainWorldSpeedThrough(targetRate);
    return targetRate;
  }

  function setUserVolume(percent, unmute = false, video = getActiveVideo()) {
    const target = normalizeVolumePercent(percent);
    const normalized = target / 100;

    if (video) {
      try {
        video.volume = normalized;
        if (unmute && target > 0) video.muted = false;
      } catch (err) {}
    }

    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.setVolume === "function") {
        player.setVolume(target);
      }
      if (unmute && target > 0 && player && typeof player.unMute === "function") {
        player.unMute();
      }
    } catch (err) {}

    return target;
  }

  const QUALITY_ORDER = ["tiny", "small", "medium", "large", "hd720", "hd1080", "hd1440", "hd2160", "hd2880", "highres"];
  const QUALITY_ALLOWED = ["auto", ...QUALITY_ORDER];

  function normalizeQualityLevel(level, fallback = "hd720") {
    const value = String(level || "");
    return QUALITY_ALLOWED.includes(value) ? value : fallback;
  }

  function resetQualityState() {
    adState.qualityRequestKey = "";
    adState.qualityRequestStartedAt = 0;
    adState.qualityLastAttemptAt = 0;
    adState.qualityAppliedKey = "";
  }

  function getCurrentQualityLevel() {
    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.getPlaybackQuality === "function") {
        return normalizeQualityLevel(player.getPlaybackQuality(), "");
      }
    } catch (err) {}
    return "";
  }

  function getAvailableQualityLevels() {
    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.getAvailableQualityLevels === "function") {
        const levels = player.getAvailableQualityLevels();
        if (Array.isArray(levels)) {
          return levels
            .map(level => normalizeQualityLevel(level, ""))
            .filter(level => level && level !== "auto");
        }
      }
    } catch (err) {}
    return [];
  }

  function pickAvailableQuality(target) {
    const normalizedTarget = normalizeQualityLevel(target);
    if (normalizedTarget === "auto") return "auto";

    const available = getAvailableQualityLevels();
    if (available.length === 0) return normalizedTarget;
    if (available.includes(normalizedTarget)) return normalizedTarget;

    const targetRank = QUALITY_ORDER.indexOf(normalizedTarget);
    let best = "";
    let bestRank = -1;

    for (const level of available) {
      const rank = QUALITY_ORDER.indexOf(level);
      if (rank >= 0 && rank <= targetRank && rank > bestRank) {
        best = level;
        bestRank = rank;
      }
    }

    if (best) return best;

    return available
      .slice()
      .sort((a, b) => QUALITY_ORDER.indexOf(b) - QUALITY_ORDER.indexOf(a))[0] || normalizedTarget;
  }

  function setPlaybackQuality(target) {
    const player: any = getYouTubePlayer();
    if (!player) return false;

    const level = pickAvailableQuality(target);
    let attempted = false;

    try {
      if (typeof player.setPlaybackQualityRange === "function") {
        if (level === "auto") {
          player.setPlaybackQualityRange("auto");
        } else {
          player.setPlaybackQualityRange(level, level);
        }
        attempted = true;
      }
    } catch (err) {}

    try {
      if (typeof player.setPlaybackQuality === "function") {
        player.setPlaybackQuality(level);
        attempted = true;
      }
    } catch (err) {}

    return attempted;
  }

  function isFullscreenMode() {
    const player = getYouTubePlayer();
    return !!document.fullscreenElement || !!player?.classList?.contains("ytp-fullscreen");
  }

  function getQualityTarget(fullscreen = isFullscreenMode()) {
    const playlist = isPlaylistContext();
    if (fullscreen && config.qualityFullscreenEnabled) {
      return playlist ? config.qualityFullscreenPlaylist : config.qualityFullscreenVideo;
    }
    if (config.qualityEnabled) {
      return playlist ? config.qualityPlaylist : config.qualityVideo;
    }
    return "";
  }

  function applyQualityTarget(target, contextKey) {
    if (!target) return;

    const requestKey = contextKey + ":" + target;
    const now = Date.now();
    if (adState.qualityAppliedKey === requestKey) return;

    if (adState.qualityRequestKey !== requestKey) {
      adState.qualityRequestKey = requestKey;
      adState.qualityRequestStartedAt = now;
      adState.qualityLastAttemptAt = 0;
    }

    if (now - adState.qualityLastAttemptAt < 900) return;
    adState.qualityLastAttemptAt = now;

    const attempted = setPlaybackQuality(target);
    const current = getCurrentQualityLevel();
    const picked = pickAvailableQuality(target);
    const matched = target === "auto" || current === picked || current === target;

    if (matched || (attempted && now - adState.qualityRequestStartedAt > 2400) || now - adState.qualityRequestStartedAt > 8000) {
      adState.qualityAppliedKey = requestKey;
    }
  }

  function applyQualityPreferences() {
    if (!config.enabled || adState.active || getAdPlaying()) return;

    const video = getActiveVideo();
    if (!video) return;

    const key = getCurrentVideoKey();
    const fullscreen = isFullscreenMode();

    if (key !== adState.qualityVideoKey) {
      adState.qualityVideoKey = key;
      adState.fullscreenQualityMode = false;
      adState.preFullscreenQuality = null;
      resetQualityState();
    }

    if (fullscreen && config.qualityFullscreenEnabled) {
      if (!adState.fullscreenQualityMode) {
        adState.fullscreenQualityMode = true;
        adState.preFullscreenQuality = getCurrentQualityLevel();
        resetQualityState();
      }

      applyQualityTarget(getQualityTarget(true), key + ":fullscreen");
      return;
    }

    if (adState.fullscreenQualityMode) {
      const restoreLevel = config.qualityRestoreOnExit ? adState.preFullscreenQuality : "";
      adState.fullscreenQualityMode = false;
      adState.preFullscreenQuality = null;
      resetQualityState();
      if (restoreLevel) {
        applyQualityTarget(restoreLevel, key + ":restore");
        return;
      }
    }

    applyQualityTarget(getQualityTarget(false), key + ":normal");
  }

  const APPEARANCE_STYLE_ID = "tube-shield-appearance-style";

  function buildAppearanceCss() {
    const blocks: string[] = [];

    if (config.appearanceHideShorts) {
      blocks.push(`
        ytd-reel-shelf-renderer,
        ytd-rich-section-renderer:has(a[href^="/shorts/"]),
        ytd-rich-item-renderer:has(a[href^="/shorts/"]),
        ytd-video-renderer:has(a[href^="/shorts/"]),
        ytd-grid-video-renderer:has(a[href^="/shorts/"]),
        ytd-compact-video-renderer:has(a[href^="/shorts/"]),
        ytd-guide-entry-renderer:has(a[href^="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),
        ytd-browse[page-subtype="shorts"] {
          display: none !important;
        }
      `);
    }

    if (config.appearanceHideRelated) {
      blocks.push(`
        ytd-watch-flexy #related,
        ytd-watch-flexy ytd-watch-next-secondary-results-renderer {
          display: none !important;
        }
        ytd-watch-flexy #primary.ytd-watch-flexy {
          max-width: min(100%, 1200px) !important;
        }
      `);
    }

    if (config.appearanceHideChat) {
      blocks.push(`
        ytd-live-chat-frame,
        #chat,
        #chat-container,
        ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-live-chat"] {
          display: none !important;
        }
      `);
    }

    if (config.appearanceHideComments) {
      blocks.push(`
        #comments,
        ytd-comments,
        ytd-item-section-renderer#comments {
          display: none !important;
        }
      `);
    }

    if (config.appearanceHideEndcards) {
      blocks.push(`
        .ytp-ce-element,
        .ytp-ce-covering-overlay,
        .ytp-ce-expanding-overlay,
        .ytp-cards-teaser,
        .ytp-cards-button,
        .ytp-endscreen-content,
        .ytp-endscreen-previous,
        .ytp-endscreen-next {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `);
    }

    return blocks.join("\n");
  }

  function applyAppearanceFilters() {
    const signature = [
      config.enabled,
      config.appearanceHideShorts,
      config.appearanceHideRelated,
      config.appearanceHideChat,
      config.appearanceHideComments,
      config.appearanceHideEndcards,
    ].join(":");

    if (signature === appearanceSignature) return;
    appearanceSignature = signature;

    const css = config.enabled ? buildAppearanceCss() : "";
    const existing = document.getElementById(APPEARANCE_STYLE_ID);
    if (!css) {
      existing?.remove();
      return;
    }

    const style = existing || document.createElement("style");
    style.id = APPEARANCE_STYLE_ID;
    style.textContent = css;
    if (!existing) (document.head || document.documentElement).appendChild(style);
  }

  function convertShortsUrlIfNeeded() {
    if (!config.enabled || !config.appearanceConvertShorts) return;
    const match = location.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (!match?.[1]) return;

    const videoId = decodeURIComponent(match[1]);
    const target = location.origin + "/watch?v=" + encodeURIComponent(videoId);
    if (location.href !== target) {
      location.replace(target);
    }
  }

  function runAppearanceTasks() {
    applyAppearanceFilters();
    convertShortsUrlIfNeeded();
  }

  function applyPlayerPreferences() {
    if (!config.enabled || adState.active || getAdPlaying()) return;

    const video = getActiveVideo();
    if (!video) return;

    const key = getCurrentVideoKey();
    if (key !== adState.playerVideoKey) {
      adState.playerVideoKey = key;
      adState.defaultSpeedAppliedKey = "";
      adState.defaultVolumeAppliedKey = "";
    }

    if (config.playerSpeedEnabled && adState.defaultSpeedAppliedKey !== key) {
      setUserPlaybackRate(config.playerSpeedDefault, video);
      adState.defaultSpeedAppliedKey = key;
    }

    if (config.playerVolumeEnabled && adState.defaultVolumeAppliedKey !== key) {
      setUserVolume(config.playerVolumeDefault, false, video);
      adState.defaultVolumeAppliedKey = key;
    }

    applyQualityPreferences();
  }

  function isPointerInsidePlayer(target) {
    if (!target || !(target instanceof Element)) return false;
    const player = getYouTubePlayer();
    if (player && player.contains(target)) return true;
    return !!target.closest("#movie_player, .html5-video-player");
  }

  function getWheelDirection(event) {
    const direction = event.deltaY < 0 ? 1 : -1;
    return config.playerWheelInvert ? -direction : direction;
  }

  function handlePlayerWheel(event) {
    if (!config.enabled || adState.active || getAdPlaying()) return;
    if (!isPointerInsidePlayer(event.target)) return;

    const rightButtonHeld = adState.rightMouseDown || (event.buttons & 2) === 2;
    const direction = getWheelDirection(event);
    const video = getActiveVideo();

    if (
      config.playerSpeedWheel &&
      event.ctrlKey &&
      (!config.playerSpeedWheelRightButton || rightButtonHeld)
    ) {
      event.preventDefault();
      event.stopPropagation();
      const current = getCurrentPlaybackRate(video);
      const next = normalizeUserPlaybackRate(current + direction * normalizePlayerSpeedStep(config.playerSpeedStep), current);
      setUserPlaybackRate(next, video);
      return;
    }

    if (
      config.playerVolumeWheel &&
      !event.ctrlKey &&
      (!config.playerVolumeWheelRightButton || rightButtonHeld)
    ) {
      event.preventDefault();
      event.stopPropagation();
      const current = video ? Math.round(video.volume * 100) : 50;
      const next = normalizeVolumePercent(current + direction * normalizeVolumeStep(config.playerVolumeStep));
      setUserVolume(next, true, video);
    }
  }

  function isPlaylistContext() {
    try {
      const url = new URL(location.href);
      if (url.searchParams.has("list")) return true;
    } catch (err) {}

    return !!document.querySelector("ytd-playlist-panel-renderer, ytd-playlist-video-list-renderer");
  }

  function markUserPlaybackIntent() {
    adState.lastUserPlaybackIntentAt = Date.now();
  }

  function hasRecentPlaybackIntent() {
    return Date.now() - (adState.lastUserPlaybackIntentAt || 0) < 2600;
  }

  function isNearVideoStart(video) {
    const current = Number(video?.currentTime || 0);
    return !Number.isFinite(current) || current < 4;
  }

  function shouldBlockAutoplay(video = getActiveVideo()) {
    if (!video || !config.enabled || adState.active || getAdPlaying()) return false;
    if (!isNearVideoStart(video)) return false;
    if (config.autoplayAllowPlaylists && isPlaylistContext()) return false;
    if (document.hidden) return !!config.autoplayBlockBackground;
    return !!config.autoplayBlockForeground && !hasRecentPlaybackIntent();
  }

  function pauseVideo(video = getActiveVideo()) {
    if (!video) return false;
    let paused = false;

    try {
      video.pause();
      paused = true;
    } catch (err) {}

    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.pauseVideo === "function") {
        player.pauseVideo();
        paused = true;
      }
    } catch (err) {}

    return paused;
  }

  function announceForegroundPlayback() {
    if (!config.enabled || !config.pauseBackgroundTabs || document.hidden || adState.active || getAdPlaying()) return;
    if (!chrome?.storage?.local) return;
    chrome.storage.local.set({
      tubeShieldActivePlayback: {
        token: adState.tabPlaybackToken,
        time: Date.now(),
        url: location.href,
      },
    });
  }

  function handleVideoPlayEvent() {
    const video = getActiveVideo();
    if (!video) return;

    if (shouldBlockAutoplay(video)) {
      pauseVideo(video);
      return;
    }

    announceForegroundPlayback();
  }

  function handleExternalPlaybackSignal(signal) {
    if (!config.enabled || !config.pauseBackgroundTabs || !document.hidden) return;
    if (!signal || signal.token === adState.tabPlaybackToken) return;

    const video = getActiveVideo();
    if (video && !video.paused && !adState.active && !getAdPlaying()) {
      pauseVideo(video);
    }
  }

  function bindAutoplayGuards() {
    const video = getActiveVideo();
    if (!video || adState.autoplayVideo === video) return;

    adState.autoplayVideo = video;
    video.addEventListener("play", handleVideoPlayEvent, true);
    video.addEventListener("playing", handleVideoPlayEvent, true);

    if (!video.paused && shouldBlockAutoplay(video)) {
      pauseVideo(video);
    }
  }

  function enforceAutoplayGuards() {
    bindAutoplayGuards();

    const video = getActiveVideo();
    if (!video || video.paused) return;

    if (shouldBlockAutoplay(video)) {
      pauseVideo(video);
    } else {
      announceForegroundPlayback();
    }
  }

  function getSpeedThroughRate() {
    if (isInstantSkipEnabled()) return INSTANT_SPEED_THROUGH_RATE;
    if (config.customSpeedEnabled && config.adaptiveSpeedEnabled) return getRiskAdaptiveSpeed();
    if (config.customSpeedEnabled) return normalizeSpeedRate(config.adSpeedRate);
    return getSafeAdaptiveSpeed();
  }

  function requestMainWorldSkip() {
    window.postMessage({
      source: MAIN_FORCE_SKIP_MESSAGE,
      targetTime: adState.skipTargetTime || Date.now(),
      rate: getSpeedThroughRate(),
    }, "*");
  }

  function requestMainWorldSpeedThrough(rate = getSpeedThroughRate()) {
    window.postMessage({
      source: MAIN_SPEED_THROUGH_MESSAGE,
      rate,
    }, "*");
  }

  function forceSkipAd(video = document.querySelector("video")) {
    if (!config.enabled || !config.aggressiveSkip || adState.watching) return false;

    requestMainWorldSkip();

    const player: any = getYouTubePlayer();
    let attempted = false;

    if (video) {
      const duration = getFinitePositiveNumber(video.duration);
      const currentTime = getFinitePositiveNumber(video.currentTime);
      const target = duration > 0
        ? Math.max(duration - 0.05, currentTime + 0.25)
        : currentTime + 600;

      try {
        video.playbackRate = getSpeedThroughRate();
        attempted = true;
      } catch (err) {}

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
        player.setPlaybackRate(getSpeedThroughRate());
        attempted = true;
      }
    } catch (err) {}

    return attempted;
  }

  function stopForceSkipBurst() {
    if (adState.forceSkipInterval) {
      clearInterval(adState.forceSkipInterval);
      adState.forceSkipInterval = null;
    }
    adState.forceSkipStartedAt = null;
  }

  function getCurrentPlaybackRate(video = document.querySelector("video")) {
    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.getPlaybackRate === "function") {
        return normalizePlaybackRate(player.getPlaybackRate());
      }
    } catch (err) {}

    if (video && Number.isFinite(video.playbackRate)) {
      return normalizePlaybackRate(video.playbackRate);
    }

    return 1;
  }

  function stopPlaybackRateRestore() {
    if (adState.playbackRestoreInterval) {
      clearInterval(adState.playbackRestoreInterval);
      adState.playbackRestoreInterval = null;
    }
    adState.playbackRestoreStartedAt = null;
  }

  function capturePlaybackRate() {
    adState.preAdPlaybackRate = getCurrentPlaybackRate();
    stopPlaybackRateRestore();
  }

  function applySpeedThrough(video = document.querySelector("video")) {
    if (!config.enabled || !config.aggressiveSkip || adState.watching) return false;

    const rate = getSpeedThroughRate();
    requestMainWorldSpeedThrough(rate);

    let attempted = false;
    if (video) {
      try {
        if (video.playbackRate !== rate) {
          video.playbackRate = rate;
        }
        attempted = true;
      } catch (err) {}
    }

    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.setPlaybackRate === "function") {
        player.setPlaybackRate(rate);
        attempted = true;
      }
    } catch (err) {}

    return attempted;
  }

  function startSpeedThrough() {
    if (!config.aggressiveSkip || adState.speedThroughInterval) return;
    applySpeedThrough();
    adState.speedThroughInterval = setInterval(() => {
      if (!config.enabled || !adState.active || adState.watching || !getAdPlaying()) {
        stopSpeedThrough();
        return;
      }
      applySpeedThrough();
    }, SPEED_THROUGH_RETRY_MS);
  }

  function stopSpeedThrough() {
    if (adState.speedThroughInterval) {
      clearInterval(adState.speedThroughInterval);
      adState.speedThroughInterval = null;
    }
  }

  function restorePlaybackRate(rate = adState.preAdPlaybackRate || 1) {
    const targetRate = normalizePlaybackRate(rate || 1);
    const video = document.querySelector("video");
    if (video) {
      try {
        if (video.playbackRate !== targetRate) video.playbackRate = targetRate;
      } catch (err) {}
    }

    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.setPlaybackRate === "function") {
        player.setPlaybackRate(targetRate);
      }
    } catch (err) {}

    requestMainWorldSpeedThrough(targetRate);
  }

  function startPlaybackRateRestore(rate = adState.preAdPlaybackRate || 1) {
    stopPlaybackRateRestore();
    const targetRate = normalizePlaybackRate(rate || 1);
    adState.playbackRestoreStartedAt = Date.now();
    restorePlaybackRate(targetRate);
    adState.playbackRestoreInterval = setInterval(() => {
      restorePlaybackRate(targetRate);
      if (Date.now() - adState.playbackRestoreStartedAt >= PLAYBACK_RESTORE_WINDOW_MS) {
        stopPlaybackRateRestore();
        adState.preAdPlaybackRate = null;
      }
    }, PLAYBACK_RESTORE_RETRY_MS);
  }

  function clearPostSkipRestoreChecks() {
    for (const timeoutId of adState.postSkipRestoreTimeouts || []) {
      clearTimeout(timeoutId);
    }
    adState.postSkipRestoreTimeouts = [];
  }

  function queuePlaybackRateRestoreAfterSkip() {
    clearPostSkipRestoreChecks();
    const targetRate = adState.preAdPlaybackRate || 1;

    adState.postSkipRestoreTimeouts = POST_SKIP_RESTORE_DELAYS_MS.map((delay) => setTimeout(() => {
      if (!config.enabled || adState.watching || !getAdPlaying()) {
        stopSpeedThrough();
        startPlaybackRateRestore(targetRate);
        clearPostSkipRestoreChecks();
      }
    }, delay));
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
    stopSkipButtonObserver();
    adState.skipTargetTime = Date.now() + 1000;
    removeOverlay();
    queuePlaybackRateRestoreAfterSkip();
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

  function stopSkipButtonObserver() {
    if (skipButtonObserver) {
      skipButtonObserver.disconnect();
      skipButtonObserver = null;
    }
    adState.lastObserverSkipAttempt = 0;
  }

  function startSkipButtonObserver() {
    if (skipButtonObserver) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    skipButtonObserver = new MutationObserver(() => {
      if (!config.enabled || !adState.active || adState.watching || !adState.skipTargetTime) return;
      if (Date.now() < adState.skipTargetTime) return;
      if (Date.now() - adState.lastObserverSkipAttempt < 90) return;

      adState.lastObserverSkipAttempt = Date.now();
      attemptScheduledSkip();
    });

    skipButtonObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-label", "title"],
    });
  }

  // ── Anti-Adblock: SISTEMA TRIPLO ────────────────────────
  // Camada 1: CSS injection — esconde o dialog ANTES de renderizar
  // Camada 2: MutationObserver — remove do DOM no instante que aparece (0ms)
  // Camada 3: Polling fallback — varredura no loop principal como rede de segurança

  const _abTagNames = [
    'YTD-ENFORCEMENT-MESSAGE-VIEW-MODEL',
  ];

  const ANTI_ADBLOCK_STYLE_ID = 'ytp-css-patch-ab';

  // ── Camada 1: CSS Preemptivo ──────────────────────────
  function injectAntiAdblockCSS() {
    if (!config.enabled) return;
    if (document.getElementById(ANTI_ADBLOCK_STYLE_ID)) return;
    const s = document.createElement('style');
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

  // ── Camada 2: MutationObserver (instantâneo) ──────────
  function nukeAdblockElement(el) {
    if (!config.enabled || !el) return;
    const shouldCount = el.isConnected !== false;
    el.remove();
    const backdrops = document.querySelectorAll('iron-overlay-backdrop, tp-yt-paper-dialog-backdrop');
    backdrops.forEach(b => b.remove());
    if (document.body) document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    // Incrementar contador de avisos e salvar
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
      subtree: true,
    });
  }

  // ── Camada 3: Polling fallback ────────────────────────
  function dismissAdblockWarning() {
    if (!config.enabled) return false;
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

    const delay = getEffectiveDelay();
    const initialRemaining = adState.skipTargetTime ? Math.max(0, Math.ceil((adState.skipTargetTime - Date.now()) / 1000)) : delay;

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
        stopForceSkipBurst();
        stopSpeedThrough();
        clearSkipTimeout();
        clearInterval(adState.countdownInterval);
        removeOverlay();
        unmuteVideo();
        resetPlaybackRate();
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

  // ── Delay efetivo ─────────────────────────────────────

  function getEffectiveDelay() {
    return isInstantSkipEnabled() ? 0 : config.skipDelay;
  }

  // ── Agendar skip (para countdown do overlay) ──────────

  function scheduleSkip() {
    clearInterval(adState.countdownInterval);
    stopForceSkipBurst();
    clearSkipTimeout();
    stopSkipButtonObserver();
    const delayMs = getEffectiveDelay() * 1000;
    const actualDelayMs = config.aggressiveSkip ? delayMs : humanDelay(delayMs);
    adState.skipTargetTime = Date.now() + actualDelayMs;
    adState.skipTimeout = setTimeout(attemptScheduledSkip, actualDelayMs);
    startSkipButtonObserver();
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

  // ── Whitelist de canais ───────────────────────────────

  function getCurrentChannel() {
    const sels = [
      '#channel-name yt-formatted-string a',
      '#channel-name a',
      'ytd-video-owner-renderer #channel-name a',
      '#owner-name a',
      '#upload-info #channel-name a',
      'ytd-channel-name yt-formatted-string',
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
      return config.listMode === 'blacklist' ? true : false;
    }
    
    const ch = getCurrentChannel();
    if (!ch) return false;
    
    const matched = config.whitelist.some(w => {
      const wLower = w.toLowerCase().trim();
      if (!wLower) return false;
      
      // Match by name
      if (ch.name.includes(wLower) || wLower.includes(ch.name)) return true;
      
      // Match by link 
      if (ch.link && wLower.length > 3) {
        if (ch.link.includes(wLower) || wLower.includes(ch.link)) return true;
      }
      
      return false;
    });

    if (config.listMode === 'blacklist') {
      // Modo Blacklist (Pular só nestes)
      // Se deu match, queremos pular (aborta whitelist protection -> return false)
      // Se NÃO deu match, NÃO queremos pular (ativa protection -> return true)
      return !matched;
    } else {
      // Modo Whitelist (Apoiar estes, pular no resto)
      // Se deu match, queremos apoiar (ativa protection -> return true)
      // Se NÃO deu match, queremos pular (aborta protection -> return false)
      return matched;
    }
  }

  // ── Toast notification ────────────────────────────────

  function showToastNotification() {
    if (!config.showToast) return;
    const existing = document.getElementById('ytp-skipper-toast');
    if (existing) existing.remove();

    if (!document.getElementById('ytp-toast-style')) {
      const style = document.createElement('style');
      style.id = 'ytp-toast-style';
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

    const toast = document.createElement('div');
    toast.id = 'ytp-skipper-toast';
    toast.textContent = 'Anúncio pulado ✓';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { toast.classList.add('show'); });
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ── Contador de anúncios ──────────────────────────────

  function incrementAdCounter() {
    if (adState.alreadyCounted) return false;
    adState.alreadyCounted = true;

    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
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
        todayDate: adState.todayDate,
      });
    }
    return true;
  }

  function resetPlaybackRate() {
    startPlaybackRateRestore(adState.preAdPlaybackRate || 1);
  }

  function cleanupRuntimeState() {
    stopForceSkipBurst();
    stopSpeedThrough();
    stopSkipButtonObserver();
    clearPostSkipRestoreChecks();
    clearSkipTimeout();
    removeOverlay();
    unmuteVideo();
    resetPlaybackRate();

    adState.active = false;
    adState.currentAd = undefined;
    adState.startTime = null;
    adState.watching = false;
    adState.skipTargetTime = null;
    adState.lastVideoTime = -1;
    adState.alreadyCounted = false;
    adState.forceSkipInterval = null;
    adState.forceSkipStartedAt = null;
    adState.skipTimeout = null;
    adState.speedThroughInterval = null;
  }

  // ── Main loop ─────────────────────────────────────────

  function mainLoop() {
    runAppearanceTasks();

    if (!config.enabled) {
      if (adState.active || adState.overlayEl) cleanupRuntimeState();
      return;
    }

    // Sempre tentar fechar popup anti-adblock
    dismissAdblockWarning();

    const adPlaying = getAdPlaying();
    if (!adPlaying) enforceAutoplayGuards();

    if (adPlaying && !adState.active) {
      // ── Anúncio COMEÇOU ───

      // Verificar whitelist — se canal está na lista branca, não mexer
      if (isChannelWhitelisted()) return;

      adState.active = true;
      adState.watching = false;
      adState.startTime = Date.now();
      adState.lastVideoTime = -1;
      adState.alreadyCounted = false;

      capturePlaybackRate();
      muteVideo();
      startSpeedThrough();
      scheduleSkip();
      if (config.showOverlay) createOverlay();

    } else if (adPlaying && adState.active) {
      // ── Anúncio ainda ativo — tick ───

      if (adState.watching) return;

      const video = document.querySelector("video");

      // Detectar novo anúncio em sequência (posição do vídeo voltou ao início)
      if (video) {
        const ct = video.currentTime;
        if (adState.lastVideoTime > 2 && ct < adState.lastVideoTime - 2) {
          // Contar o anúncio anterior como pulado
          if (incrementAdCounter()) showToastNotification();
          // Resetar para o novo anúncio
          adState.startTime = Date.now();
          adState.alreadyCounted = false;
          adState.lastVideoTime = ct;
          scheduleSkip();
          if (config.showOverlay) createOverlay();
          return;
        }
        adState.lastVideoTime = ct;
      }

      // Verificar se o delay passou (comparação DIRETA de timestamp)
      if (adState.skipTargetTime && Date.now() >= adState.skipTargetTime) {
        attemptScheduledSkip();
      }
    } else if (!adPlaying && adState.active) {
      // ── Anúncio ACABOU ───

      // Contar como pulado se não estava assistindo
      if (!adState.watching) {
        if (incrementAdCounter()) showToastNotification();
      }

      cleanupRuntimeState();
    } else if (!adPlaying && !adState.active) {
      applyPlayerPreferences();
      const orphans = document.querySelectorAll("#" + OVERLAY_ID);
      if (orphans.length > 0) orphans.forEach(el => el.remove());
    }
  }

  // ── Atalho de teclado ─────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (!config.enabled || !config.shortcutEnabled || !config.aggressiveSkip) return;
    if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
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

  // ── Picture-in-Picture (PiP) — Player Flutuante ───────

  document.addEventListener("mousedown", (event) => {
    if (event.button === 2) adState.rightMouseDown = true;
  }, true);

  document.addEventListener("mouseup", (event) => {
    if (event.button === 2) adState.rightMouseDown = false;
  }, true);

  document.addEventListener("contextmenu", () => {
    adState.rightMouseDown = false;
  }, true);

  window.addEventListener("blur", () => {
    adState.rightMouseDown = false;
  });

  document.addEventListener("wheel", handlePlayerWheel, { capture: true, passive: false });

  document.addEventListener("pointerdown", () => {
    markUserPlaybackIntent();
  }, true);

  document.addEventListener("keydown", (event) => {
    const playbackKeys = [" ", "Enter", "k", "K", "MediaPlayPause", "MediaPlay"];
    if (playbackKeys.includes(event.key)) markUserPlaybackIntent();
  }, true);

  document.addEventListener("visibilitychange", () => {
    enforceAutoplayGuards();
  });

  const PIP_BTN_ID = 'ytp-pip-float-btn';
  const PIP_STYLE_ID = 'ytp-pip-style';

  function injectPipStyles() {
    if (document.getElementById(PIP_STYLE_ID)) return;
    const style = document.createElement('style');
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

    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (!player) return;

    const btn = document.createElement('button');
    btn.id = PIP_BTN_ID;
    btn.title = 'Player Flutuante (PiP)';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <rect x="12" y="10" width="8" height="6" rx="1" ry="1" fill="currentColor" opacity="0.4"/>
      </svg>
    `;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const video = document.querySelector('video');
      if (!video) return;

      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          btn.classList.remove('pip-active');
        } else {
          await video.requestPictureInPicture();
          btn.classList.add('pip-active');
        }
      } catch (err) {
        console.warn('[Tube Shield] PiP error:', err);
      }
    });

    player.style.position = 'relative';
    player.appendChild(btn);

    // Listen for PiP state changes to update button
    const video = document.querySelector('video');
    if (video) {
      video.addEventListener('enterpictureinpicture', () => {
        const b = document.getElementById(PIP_BTN_ID);
        if (b) b.classList.add('pip-active');
      });
      video.addEventListener('leavepictureinpicture', () => {
        const b = document.getElementById(PIP_BTN_ID);
        if (b) b.classList.remove('pip-active');
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
    // Wait for the player to be ready
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (player) {
      createPipButton();
    } else {
      // Retry after a short delay
      setTimeout(() => { if (config.enabled && config.pipEnabled) createPipButton(); }, 2000);
    }
  }

  // Re-inject PiP button on YouTube SPA navigation
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

  // ── Init ──────────────────────────────────────────────

  function isInIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  function init() {
    if (isInIframe()) return;
    loadSettings().then(() => {
      // garantir que as configurações foram carregadas antes de iniciar o loop
      startAdblockProtection();
      try { mainLoop(); } catch (e) {}
      setInterval(mainLoop, CHECK_INTERVAL);
      // Inject PiP button if enabled
      injectPipButton();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

export {};
