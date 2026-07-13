(function() {
  "use strict";
  const PLAYER_DEFAULTS_PROFILE_VERSION = 2;
  const PLAYER_DEFAULTS_PROFILE = {
    playerSpeedEnabled: true,
    playerSpeedStep: 0.02,
    playerSpeedWheel: true,
    autoplayBlockBackground: true,
    autoplayAllowPlaylists: true,
    miniplayerEnabled: true,
    miniplayerSize: "480x270",
    miniplayerPosition: "top-left",
    playerPopupSize: "640x360",
    toolbarEnabled: true,
    toolbarPosition: "below",
    toolbarCenter: true,
    toolbarLoop: true,
    toolbarSpeed: true,
    toolbarPopup: true,
    toolbarPip: true,
    toolbarScreenshot: true,
    toolbarTheater: true,
    toolbarSettings: true,
    toolbarVolumeBoost: true,
    toolbarFilters: true,
    appearanceLayoutRowsEnabled: false,
    appearanceSortNewestComments: false,
    appearanceAutoApplyFilters: false,
    shortcutEnabled: false,
    cinemaUseYouTubeTheater: false,
    ultrawideEnabled: false,
    toolbarAlwaysVisible: true,
    themeEngine: "youtube",
    shortcutSkipAd: "Alt+Shift+S",
    shortcutSpeedDown: "Alt+Shift+,",
    shortcutSpeedUp: "Alt+Shift+.",
    shortcutVolumeDown: "Alt+Shift+ArrowDown",
    shortcutVolumeUp: "Alt+Shift+ArrowUp",
    shortcutCinema: "Alt+Shift+C",
    shortcutScreenshot: "Alt+Shift+P",
    shortcutPopup: "Alt+Shift+O",
    shortcutLoop: "Alt+Shift+L"
  };
  const DEFAULT_SETTINGS = {
    enabled: true,
    adSkipperEnabled: true,
    skipDelay: 1,
    muteAds: true,
    showOverlay: true,
    aggressiveSkip: true,
    warningCount: 0,
    theme: "dark",
    totalAdsSkipped: 0,
    adsSkippedToday: 0,
    todayDate: null,
    playerDefaultsProfileVersion: 0,
    whitelist: [],
    listMode: "whitelist",
    showToast: false,
    shortcutEnabled: false,
    instantSkip: false,
    pipEnabled: false,
    adSpeedRate: 3,
    customSpeedEnabled: false,
    adaptiveSpeedEnabled: false,
    playerSpeedEnabled: true,
    playerSpeedDefault: 1,
    playerSpeedStep: 0.02,
    playerSpeedWheel: true,
    playerSpeedWheelRightButton: false,
    playerVolumeEnabled: false,
    playerVolumeDefault: 50,
    playerVolumeStep: 5,
    playerVolumeWheel: false,
    playerVolumeWheelRightButton: false,
    volumeBoostEnabled: false,
    volumeBoostLevel: 2,
    volumeBoostAuto: false,
    playerWheelInvert: false,
    autoplayBlockBackground: true,
    autoplayBlockForeground: false,
    autoplayAllowPlaylists: true,
    pauseBackgroundTabs: false,
    qualityEnabled: false,
    qualityVideo: "hd720",
    qualityPlaylist: "hd720",
    qualityFullscreenEnabled: false,
    qualityFullscreenVideo: "hd1080",
    qualityFullscreenPlaylist: "hd1080",
    qualityPopup: "medium",
    qualityFullscreenPopup: "hd1080",
    qualityRestoreOnExit: true,
    appearanceConvertShorts: false,
    appearanceHideShorts: false,
    appearanceHideRelated: false,
    appearanceHideChat: false,
    appearanceHideComments: false,
    appearanceHideEndcards: false,
    appearanceLayoutRowsEnabled: false,
    appearanceSortNewestComments: false,
    appearanceAutoApplyFilters: false,
    miniplayerEnabled: true,
    miniplayerSize: "480x270",
    miniplayerCustomSize: "480x270",
    miniplayerPosition: "top-left",
    playerPopupSize: "640x360",
    playerPopupEmbeds: false,
    toolbarEnabled: true,
    toolbarPosition: "below",
    toolbarCenter: true,
    toolbarLoop: true,
    toolbarSpeed: true,
    toolbarPopup: true,
    toolbarPip: true,
    toolbarScreenshot: true,
    toolbarTheater: true,
    toolbarSettings: true,
    toolbarVolumeBoost: true,
    toolbarFilters: true,
    playerSpeedReplaceMenu: true,
    playerSpeedMenuList: "0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4",
    playerSpeedButtonsEnabled: true,
    playerPopupEnabled: true,
    shortcutSkipAd: "Alt+Shift+S",
    shortcutSpeedDown: "Alt+Shift+,",
    shortcutSpeedUp: "Alt+Shift+.",
    shortcutVolumeDown: "Alt+Shift+ArrowDown",
    shortcutVolumeUp: "Alt+Shift+ArrowUp",
    shortcutCinema: "Alt+Shift+C",
    shortcutScreenshot: "Alt+Shift+P",
    shortcutPopup: "Alt+Shift+O",
    shortcutLoop: "Alt+Shift+L",
    autoplayDisableAll: false,
    autoplayStopPreload: false,
    autoplayIgnorePopup: true,
    layoutVideosPerRow: 4,
    layoutChannelVideosPerRow: 4,
    layoutShortsPerRow: 8,
    layoutChannelShortsPerRow: 5,
    layoutPostsPerRow: 4,
    appearanceKeepBlackBars: false,
    appearanceAutoTheater: false,
    appearanceAutoExpandPlayer: false,
    appearanceUseViewportPlayer: false,
    cinemaColor: "#000000",
    cinemaOpacity: 85,
    cinemaDefault: false,
    cinemaAutoResize: false,
    cinemaUseYouTubeTheater: false,
    ultrawideEnabled: false,
    ultrawideFit: "smart-crop",
    toolbarInsidePlayer: false,
    toolbarAlwaysVisible: true,
    themeEngine: "youtube",
    themeVariant: "red",
    themeDeepDarkCustom: false,
    themeCustomAccent: "#ff334b",
    themeCustomBackground: "#0f0f0f",
    themeCustomSurface: "#17191f",
    themeCustomSurfaceRaised: "#20232b",
    themeCustomText: "#f4f5f7",
    themeCustomMuted: "#a9adb8",
    themeCustomBorder: "#343741",
    themeCustomCss: "body {\n  --yt-spec-base-background: #0f0f0f;\n}",
    codecForceStandardFps: false,
    codecForceAvc: false,
    videoFiltersEnabled: false,
    videoFilterBrightness: 100,
    videoFilterContrast: 100,
    videoFilterSaturate: 100,
    videoFilterGrayscale: 0,
    videoFilterSepia: 0,
    language: "pt-BR"
  };
  const SETTINGS_EXPORT_KEYS = Object.keys(DEFAULT_SETTINGS);
  function normalizeSettings(raw = {}) {
    const normalized = { ...DEFAULT_SETTINGS };
    for (const key of SETTINGS_EXPORT_KEYS) {
      if (!(key in raw)) continue;
      const value = raw[key];
      const fallback = normalized[key];
      if (Array.isArray(fallback)) {
        if (Array.isArray(value)) normalized[key] = value.filter((item) => typeof item === "string");
        continue;
      }
      if (fallback === null) {
        if (value === null || typeof value === "string") normalized[key] = value;
        continue;
      }
      if (typeof fallback === "number") {
        if (typeof value === "number" && Number.isFinite(value)) normalized[key] = value;
        continue;
      }
      if (typeof value === typeof fallback) normalized[key] = value;
    }
    return normalized;
  }
  function migrateSettings(raw = {}) {
    const settings = normalizeSettings(raw);
    if ((Number(settings.playerDefaultsProfileVersion) || 0) < PLAYER_DEFAULTS_PROFILE_VERSION) {
      Object.assign(settings, PLAYER_DEFAULTS_PROFILE, {
        playerDefaultsProfileVersion: PLAYER_DEFAULTS_PROFILE_VERSION
      });
    }
    return settings;
  }
  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing popup element: #${id}`);
    return element;
  }
  const elements = {
    enabled: byId("toggle-enabled"),
    skipper: byId("toggle-ad-skipper"),
    aggressive: byId("toggle-aggressive"),
    mute: byId("toggle-mute"),
    overlay: byId("toggle-overlay"),
    delay: byId("skip-delay"),
    delayDisplay: byId("delay-display"),
    delayHint: byId("delay-hint"),
    modeDescription: byId("mode-description"),
    statusText: byId("status-text"),
    statusPip: document.querySelector(".status-pip"),
    metricTotal: byId("metric-total"),
    metricToday: byId("metric-today"),
    metricWarnings: byId("metric-warnings"),
    warningText: byId("warning-text"),
    changeNote: byId("change-note"),
    version: byId("version-tag"),
    stateIcons: Array.from(document.querySelectorAll("[data-state-icon]"))
  };
  let noteTimer = null;
  function announceChange(message = "Configuração aplicada ao YouTube.") {
    elements.changeNote.textContent = message;
    elements.changeNote.classList.add("is-visible");
    if (noteTimer) window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => elements.changeNote.classList.remove("is-visible"), 1800);
  }
  function applyTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
  }
  function renderDelay(seconds) {
    const value = Math.min(30, Math.max(1, Number(seconds) || 1));
    elements.delay.value = String(value);
    elements.delayDisplay.value = `${value}s`;
    elements.delayHint.textContent = value <= 3 ? "Rápido" : value <= 10 ? "Equilibrado" : "Conservador";
    const percentage = (value - 1) / 29 * 100;
    elements.delay.style.setProperty("--range-progress", `${percentage}%`);
  }
  function renderStatus(enabled, skipperEnabled = elements.skipper.checked) {
    const active = enabled && skipperEnabled;
    elements.statusPip.classList.toggle("active", active);
    elements.statusText.textContent = !enabled ? "Extensão pausada" : skipperEnabled ? "Monitorando o YouTube" : "Player ativo · skipper pausado";
    document.body.classList.toggle("extension-disabled", !enabled);
    const icon = !enabled ? "icon48_off.png" : elements.aggressive.checked ? "icon48.png" : "icon48_stealth.png";
    elements.stateIcons.forEach((image) => {
      image.src = icon;
    });
  }
  function renderMode(aggressive) {
    elements.modeDescription.textContent = aggressive ? "Botão nativo primeiro, aceleração como fallback" : "Aguarda apenas o botão nativo do YouTube";
    renderStatus(elements.enabled.checked, elements.skipper.checked);
  }
  function renderStats(total, today, warnings) {
    elements.metricTotal.textContent = String(Math.max(0, Number(total) || 0));
    elements.metricToday.textContent = String(Math.max(0, Number(today) || 0));
    elements.metricWarnings.textContent = String(Math.max(0, Number(warnings) || 0));
    elements.warningText.textContent = warnings > 0 ? `${warnings} aviso${warnings === 1 ? "" : "s"} do YouTube tratado${warnings === 1 ? "" : "s"}.` : "Nenhum aviso interceptado.";
  }
  try {
    elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    elements.version.textContent = "v-";
  }
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
    settings = migrateSettings(settings);
    elements.enabled.checked = settings.enabled;
    elements.skipper.checked = settings.adSkipperEnabled !== false;
    elements.aggressive.checked = settings.aggressiveSkip;
    elements.mute.checked = settings.muteAds;
    elements.overlay.checked = settings.showOverlay;
    applyTheme(settings.theme);
    renderDelay(settings.skipDelay);
    renderMode(settings.aggressiveSkip);
    renderStatus(settings.enabled, settings.adSkipperEnabled !== false);
    renderStats(settings.totalAdsSkipped, settings.adsSkippedToday, settings.warningCount);
  });
  elements.enabled.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: elements.enabled.checked });
    renderStatus(elements.enabled.checked);
    announceChange(elements.enabled.checked ? "Extensão ativada." : "Extensão pausada.");
  });
  elements.skipper.addEventListener("change", () => {
    chrome.storage.local.set({ adSkipperEnabled: elements.skipper.checked });
    renderStatus(elements.enabled.checked, elements.skipper.checked);
    announceChange(elements.skipper.checked ? "Ad Skipper ativado." : "Ad Skipper pausado.");
  });
  elements.aggressive.addEventListener("change", () => {
    const aggressiveSkip = elements.aggressive.checked;
    const updates = aggressiveSkip ? { aggressiveSkip } : { aggressiveSkip, instantSkip: false };
    chrome.storage.local.set(updates);
    renderMode(aggressiveSkip);
    announceChange(aggressiveSkip ? "Modo acelerado ativado." : "Modo seguro ativado.");
  });
  elements.mute.addEventListener("change", () => {
    chrome.storage.local.set({ muteAds: elements.mute.checked });
    announceChange();
  });
  elements.overlay.addEventListener("change", () => {
    chrome.storage.local.set({ showOverlay: elements.overlay.checked });
    announceChange();
  });
  elements.delay.addEventListener("input", () => {
    const skipDelay = Number(elements.delay.value);
    renderDelay(skipDelay);
    chrome.storage.local.set({ skipDelay });
  });
  elements.delay.addEventListener("change", () => announceChange(`Tempo para pular: ${elements.delay.value}s.`));
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) elements.enabled.checked = !!changes.enabled.newValue;
    if (changes.adSkipperEnabled) elements.skipper.checked = changes.adSkipperEnabled.newValue !== false;
    if (changes.aggressiveSkip) {
      elements.aggressive.checked = !!changes.aggressiveSkip.newValue;
      renderMode(elements.aggressive.checked);
    }
    if (changes.muteAds) elements.mute.checked = !!changes.muteAds.newValue;
    if (changes.showOverlay) elements.overlay.checked = !!changes.showOverlay.newValue;
    if (changes.skipDelay) renderDelay(Number(changes.skipDelay.newValue));
    if (changes.theme) applyTheme(String(changes.theme.newValue));
    renderStatus(elements.enabled.checked, elements.skipper.checked);
    if (changes.totalAdsSkipped || changes.adsSkippedToday || changes.warningCount) {
      chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
        renderStats(settings.totalAdsSkipped, settings.adsSkippedToday, settings.warningCount);
      });
    }
  });
  for (const id of ["btn-open-settings", "btn-open-settings-main"]) {
    byId(id).addEventListener("click", () => chrome.runtime.openOptionsPage());
  }
})();
