(function() {
  "use strict";
  const PLAYER_DEFAULTS_PROFILE_VERSION = 6;
  const PLAYER_DEFAULTS_PROFILE = {
    playerSpeedEnabled: true,
    playerSpeedStep: 0.25,
    playerSpeedWheel: true,
    autoplayBlockBackground: false,
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
    resumePlaybackEnabled: false,
    playerControlsEnabled: true,
    playerControlsStyle: "pill",
    settingsMenuItemsEnabled: true,
    skipSurveysEnabled: true,
    playerEndTimeEnabled: false,
    liveCatchUpEnabled: false,
    liveCatchUpTarget: 3,
    liveCatchUpMode: "balanced",
    liveJumpEnabled: true,
    liveCatchUpMaxRate: 1.25,
    videoFilterHue: 0
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
  const SETTINGS_MIGRATIONS = {
    2: PLAYER_DEFAULTS_PROFILE,
    // v3: stability overhaul. These defaults caused surprise pauses and comment
    // menus opening on their own.
    3: {
      autoplayBlockBackground: false,
      appearanceSortNewestComments: false
    },
    // v4: controls moved inside YouTube's own control bar; the separate bar
    // below the video becomes optional.
    4: {
      playerControlsEnabled: true,
      toolbarEnabled: false
    },
    // v5: the "termina às" clock is opt-in; buttons default to their own pill.
    5: {
      playerEndTimeEnabled: false,
      playerControlsStyle: "pill"
    },
    // v6: live catch-up is opt-in (configured from the button next to
    // YouTube's "AO VIVO"); Ctrl+wheel moves in YouTube-sized speed steps.
    6: {
      liveCatchUpEnabled: false,
      playerSpeedStep: 0.25
    }
  };
  function getSettingsMigrationPatch(storedVersion) {
    const version = Number(storedVersion) || 0;
    if (version >= PLAYER_DEFAULTS_PROFILE_VERSION) return null;
    const patch = {};
    for (let next = version + 1; next <= PLAYER_DEFAULTS_PROFILE_VERSION; next += 1) {
      Object.assign(patch, SETTINGS_MIGRATIONS[next] || {});
    }
    patch.playerDefaultsProfileVersion = PLAYER_DEFAULTS_PROFILE_VERSION;
    return patch;
  }
  function migrateSettings(raw = {}) {
    const settings = normalizeSettings(raw);
    const patch = getSettingsMigrationPatch(raw.playerDefaultsProfileVersion);
    if (patch) Object.assign(settings, patch);
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
    statusTitle: byId("extension-status-title"),
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
    elements.statusTitle.textContent = enabled ? "Extensão ativa" : "Extensão pausada";
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
    const migrationPatch = getSettingsMigrationPatch(settings.playerDefaultsProfileVersion);
    if (migrationPatch) chrome.storage.local.set(migrationPatch);
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
  const POPUP_SETTING_MESSAGES = {
    miniplayerEnabled: ["Miniplayer ativado.", "Miniplayer desativado."],
    resumePlaybackEnabled: ["Vídeos vão continuar de onde pararam.", "Continuar de onde parou desativado."],
    liveCatchUpEnabled: ["Lives sem atraso: acelera de leve quando atrasar.", "Lives no ritmo normal."],
    skipSurveysEnabled: ["Pesquisas serão puladas automaticamente.", "Pesquisas não serão puladas."]
  };
  const popupSettingInputs = Array.from(document.querySelectorAll("[data-popup-setting]"));
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
    const migrated = migrateSettings(settings);
    popupSettingInputs.forEach((input) => {
      const key = input.dataset.popupSetting || "";
      input.checked = migrated[key] !== false && !!migrated[key];
    });
  });
  popupSettingInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.popupSetting || "";
      if (!key) return;
      chrome.storage.local.set({ [key]: input.checked });
      const [on, off] = POPUP_SETTING_MESSAGES[key] || ["Configuração aplicada.", "Configuração aplicada."];
      announceChange(input.checked ? on : off);
    });
  });
  const placementButtons = Array.from(document.querySelectorAll("[data-placement]"));
  function renderPlacement(inside, below) {
    const current = inside ? "inside" : below ? "below" : "off";
    placementButtons.forEach((button) => button.setAttribute("aria-checked", String(button.dataset.placement === current)));
  }
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
    const migrated = migrateSettings(settings);
    renderPlacement(migrated.playerControlsEnabled !== false, migrated.toolbarEnabled !== false);
  });
  placementButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.placement;
      const inside = value === "inside";
      const below = value === "below";
      chrome.storage.local.set({ playerControlsEnabled: inside, toolbarEnabled: below });
      renderPlacement(inside, below);
      announceChange(inside ? "Botões dentro do player." : below ? "Botões numa barra abaixo do vídeo." : "Botões escondidos.");
    });
  });
  const styleButtons = Array.from(document.querySelectorAll("[data-controls-style]"));
  const styleRow = document.getElementById("style-row");
  function renderControlsStyle(style, inside) {
    const current = style === "divider" ? "divider" : "pill";
    styleButtons.forEach((button) => button.setAttribute("aria-checked", String(button.dataset.controlsStyle === current)));
    if (styleRow) styleRow.hidden = !inside;
  }
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
    const migrated = migrateSettings(settings);
    renderControlsStyle(String(migrated.playerControlsStyle), migrated.playerControlsEnabled !== false);
  });
  styleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const style = button.dataset.controlsStyle === "divider" ? "divider" : "pill";
      chrome.storage.local.set({ playerControlsStyle: style });
      renderControlsStyle(style, true);
      announceChange(style === "pill" ? "Botões numa caixa própria." : "Botões junto com os do YouTube.");
    });
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.playerControlsEnabled && !changes.playerControlsStyle) return;
    chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
      const migrated = migrateSettings(settings);
      renderControlsStyle(String(migrated.playerControlsStyle), migrated.playerControlsEnabled !== false);
    });
  });
  const RELEASES_API = "https://api.github.com/repos/OtavioBiazzi/Youtube-ad-skipper/releases/latest";
  function isNewerVersion(latest, current) {
    const a = latest.replace(/^v/, "").split(".").map(Number);
    const b = current.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i += 1) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return false;
  }
  (async () => {
    try {
      const current = chrome.runtime.getManifest().version;
      const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) return;
      const release = await response.json();
      const tag = String(release.tag_name || "");
      if (!tag || !isNewerVersion(tag, current)) return;
      const asset = Array.isArray(release.assets) ? release.assets.find((a) => String(a.name).endsWith(".zip")) : null;
      const banner = document.getElementById("update-banner");
      const label = document.getElementById("update-version");
      if (!banner || !label) return;
      banner.href = asset?.browser_download_url || release.html_url;
      label.textContent = tag + " ↓";
      banner.hidden = false;
    } catch (err) {
    }
  })();
})();
