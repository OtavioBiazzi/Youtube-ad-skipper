import {
  INSTANT_SPEED_THROUGH_RATE,
  getRiskAdaptiveSpeed as getRiskAdaptiveSpeedForDelay,
  getSafeAdaptiveSpeed as getSafeAdaptiveSpeedForDelay,
  normalizeSkipDelay as normalizeSkipDelayValue,
  normalizeSpeedRate as normalizeSpeedRateValue,
} from "./shared/adTiming";
import { shouldProtectChannel } from "./shared/channelList";
import {
  chooseAdSkipAction,
  getAdSeekTarget,
} from "./shared/adStrategy";
import { looksLikeAdblockWarningText } from "./shared/adblockWarning";
import {
  clickElement,
  clickSkipAdBtn,
  findSkipAdButton,
  getAdPlaying,
  getMainVideo,
  getYouTubePlayer,
  setSurveySkipEnabled,
} from "./content/adDom";
import {
  CODEC_SETTINGS_MESSAGE,
  CODEC_SETTINGS_STORAGE_KEY,
  MAIN_FORCE_SKIP_MESSAGE,
  MAIN_FORCE_SKIP_RESULT,
  MAIN_PLAYER_RESIZE_MESSAGE,
  MAIN_LIVE_QUERY,
  MAIN_LIVE_STATS,
  MAIN_PLAYER_COMMAND,
  MAIN_QUALITY_MESSAGE,
  MAIN_QUALITY_RESULT,
  MAIN_SESSION_MESSAGE,
  MAIN_SPEED_THROUGH_MESSAGE,
  createBridgeSessionToken,
  isBridgeMessage,
} from "./shared/messages";
import {
  eventToShortcutCombo,
  normalizeShortcutSetting,
  normalizeShortcutText,
  shortcutMatches,
} from "./shared/shortcuts";
import {
  DEFAULT_SETTINGS,
  getSettingsMigrationPatch,
  migrateSettings,
} from "./shared/settings";
import { normalizeQualityLevel, pickBestQualityLevel } from "./shared/quality";
import { getAutoplayBlockReason as decideAutoplayBlock } from "./shared/autoplay";
import {
  PLAYER_CONTROLS_ID,
  FILTER_PANEL_ID,
  END_TIME_ID,
  PLAYER_TOOLBAR_ID,
  MINIPLAYER_ACTIVE_CLASS,
  MINIPLAYER_CLOSE_ID,
  MINIPLAYER_SLOT_ATTR,
  buildMiniplayerCss,
  buildPlayerToolbarCss,
  buildPlayerUiCss,
} from "./content/styles";
import { shouldFloatPlayer, shouldResetMiniplayerDismissal } from "./shared/miniplayer";
import { LIVE_MAX_RATES, LIVE_MODES, decideLiveRate, normalizeLiveMode } from "./shared/liveLatency";
import {
  VIDEO_FILTER_DEFAULTS,
  VIDEO_FILTER_LIMITS,
  VIDEO_FILTER_PRESETS,
  VideoFilterValues,
  buildFilterCss,
  findPresetId,
  isNeutralFilter,
  normalizeVideoFilters,
} from "./shared/videoFilters";
import { getYouTubeVideoIdFromUrl, getYouTubeVideoKeyFromUrl } from "./shared/youtube";

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
  // Listeners below are registered at module level, so bail out before any of
  // them in iframes that are not YouTube embeds (all_frames is on).
  try {
    if (window.self !== window.top && !/^\/embed\//.test(location.pathname)) return;
  } catch (err) {
    return;
  }
  // ── Configurações ─────────────────────────────────────

  let config: any = { ...DEFAULT_SETTINGS };

  const CHECK_INTERVAL = 500;
  const FORCE_SKIP_RETRY_MS = 250;
  const FORCE_SKIP_WINDOW_MS = 4000;
  const MIN_PLAYBACK_RATE = 0.0625;
  const MAX_PLAYBACK_RATE = 16;
  const MIN_USER_PLAYBACK_RATE = 0.1;
  const MAX_USER_PLAYBACK_RATE = 100;
  const SPEED_THROUGH_RETRY_MS = 250;
  const PLAYBACK_RESTORE_RETRY_MS = 150;
  const PLAYBACK_RESTORE_WINDOW_MS = 2400;
  const POST_SKIP_RESTORE_DELAYS_MS = [180, 450, 900, 1500];
  const USER_PLAYBACK_INTENT_WINDOW_MS = 12000;
  const BACKGROUND_PLAYBACK_INTENT_WINDOW_MS = 20000;
  const APPEARANCE_TASK_INTERVAL_MS = 1200;
  const PLAYER_UI_TASK_INTERVAL_MS = 650;
  const MAIN_LOOP_SLOW_THRESHOLD_MS = 16;
  const DIAGNOSTIC_STORAGE_KEY = "youtubeExtensionDiagnostics";

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
    lastUserPlaybackIntentReason: "",
    lastPlaybackPauseReason: "",
    lastPlaybackPauseAt: 0,
    autoplayVideo: null,
    tabPlaybackToken: Date.now() + "-" + Math.random().toString(36).slice(2),
    qualityVideoKey: "",
    qualityRequestKey: "",
    qualityRequestStartedAt: 0,
    qualityLastAttemptAt: 0,
    qualityAppliedKey: "",
    fullscreenQualityMode: false,
    preFullscreenQuality: null,
    autoTheaterAppliedKey: "",
    autoExpandAppliedKey: "",
    commentsSortKey: "",
    commentsSortAttemptAt: 0,
    loopVideoKey: "",
    loopEnabled: false,
    videoFiltersSessionKey: "",
    videoFiltersSessionEnabled: false,
  };

  let adblockObserver: MutationObserver | null = null;
  let adblockBodyWaitObserver: MutationObserver | null = null;
  let skipButtonObserver: MutationObserver | null = null;
  let appearanceSignature = "";
  let videoFilterSignature = "";
  let miniplayerSignature = "";
  let miniplayerUpdateRaf = 0;
  let playerToolbarUpdateRaf = 0;
  let visualMaintenanceRaf = 0;
  let visualMaintenanceTimeout: number | null = null;
  let visualMaintenanceForcePending = false;
  let appearanceTasksLastRunAt = 0;
  let playerUiTasksLastRunAt = 0;
  let adWatchdogVideo: HTMLVideoElement | null = null;
  let playerStateVideo: HTMLVideoElement | null = null;
  let playerStateCleanup: (() => void) | null = null;
  let adWatchdogTimeout: number | null = null;
  const mainWorldSessionToken = createBridgeSessionToken();
  let mainWorldSessionLastSyncAt = 0;
  const volumeBoostGraphs = new WeakMap<HTMLMediaElement, { context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode }>();
  let playerFeedbackTimer: number | null = null;

  // ── Humanização — jitter aleatório ────────────────────

  function humanDelay(baseMs) {
    if (baseMs <= 0) return 0;
    // ±15 % de variação para parecer humano
    const jitter = baseMs * (0.85 + Math.random() * 0.3);
    return Math.round(jitter);
  }

  // ── Carregar configurações ────────────────────────────

  let rawSettings: Record<string, any> = { ...DEFAULT_SETTINGS };

  // Single place that turns stored settings into the runtime config.
  function applySettingsToConfig(s: any) {
    config.enabled = !!s.enabled;
    config.adSkipperEnabled = s.adSkipperEnabled !== false;
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
    config.volumeBoostEnabled = !!s.volumeBoostEnabled;
    config.volumeBoostLevel = normalizeVolumeBoostLevel(s.volumeBoostLevel);
    config.volumeBoostAuto = !!s.volumeBoostAuto;
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
    config.qualityPopup = normalizeQualityLevel(s.qualityPopup, "medium");
    config.qualityFullscreenPopup = normalizeQualityLevel(s.qualityFullscreenPopup, "hd1080");
    config.qualityRestoreOnExit = s.qualityRestoreOnExit !== false;
    config.appearanceConvertShorts = !!s.appearanceConvertShorts;
    config.appearanceHideShorts = !!s.appearanceHideShorts;
    config.appearanceHideRelated = !!s.appearanceHideRelated;
    config.appearanceHideChat = !!s.appearanceHideChat;
    config.appearanceHideComments = !!s.appearanceHideComments;
    config.appearanceHideEndcards = !!s.appearanceHideEndcards;
    config.appearanceLayoutRowsEnabled = !!s.appearanceLayoutRowsEnabled;
    config.appearanceSortNewestComments = !!s.appearanceSortNewestComments;
    config.appearanceAutoApplyFilters = !!s.appearanceAutoApplyFilters;
    config.miniplayerEnabled = s.miniplayerEnabled !== false;
    config.miniplayerSize = normalizeMiniplayerSize(s.miniplayerSize);
    config.miniplayerPosition = normalizeMiniplayerPosition(s.miniplayerPosition);
    config.playerPopupSize = normalizePlayerPopupSize(s.playerPopupSize);
    config.toolbarEnabled = s.toolbarEnabled !== false;
    config.toolbarPosition = normalizeToolbarPosition(s.toolbarPosition);
    config.toolbarCenter = s.toolbarCenter !== false;
    config.toolbarLoop = s.toolbarLoop !== false;
    config.toolbarSpeed = s.toolbarSpeed !== false;
    config.toolbarPopup = s.toolbarPopup !== false;
    config.toolbarPip = s.toolbarPip !== false;
    config.toolbarScreenshot = s.toolbarScreenshot !== false;
    config.toolbarTheater = s.toolbarTheater !== false;
    config.toolbarSettings = s.toolbarSettings !== false;
    config.toolbarVolumeBoost = s.toolbarVolumeBoost !== false;
    config.toolbarFilters = s.toolbarFilters !== false;
    config.playerSpeedButtonsEnabled = s.playerSpeedButtonsEnabled !== false;
    config.shortcutSkipAd = normalizeShortcutSetting(s.shortcutSkipAd, "Alt+Shift+S");
    config.shortcutSpeedDown = normalizeShortcutSetting(s.shortcutSpeedDown, "Alt+Shift+,");
    config.shortcutSpeedUp = normalizeShortcutSetting(s.shortcutSpeedUp, "Alt+Shift+.");
    config.shortcutVolumeDown = normalizeShortcutSetting(s.shortcutVolumeDown, "Alt+Shift+ArrowDown");
    config.shortcutVolumeUp = normalizeShortcutSetting(s.shortcutVolumeUp, "Alt+Shift+ArrowUp");
    config.shortcutScreenshot = normalizeShortcutSetting(s.shortcutScreenshot, "Alt+Shift+P");
    config.shortcutPopup = normalizeShortcutSetting(s.shortcutPopup, "Alt+Shift+O");
    config.shortcutLoop = normalizeShortcutSetting(s.shortcutLoop, "Alt+Shift+L");
    config.autoplayDisableAll = !!s.autoplayDisableAll;
    config.autoplayStopPreload = !!s.autoplayStopPreload;
    config.autoplayIgnorePopup = s.autoplayIgnorePopup !== false;
    config.playerPopupEnabled = s.playerPopupEnabled !== false;
    config.layoutVideosPerRow = normalizeGridCount(s.layoutVideosPerRow, 4, 1, 8);
    config.layoutChannelVideosPerRow = normalizeGridCount(s.layoutChannelVideosPerRow, 4, 1, 8);
    config.layoutShortsPerRow = normalizeGridCount(s.layoutShortsPerRow, 8, 1, 12);
    config.layoutChannelShortsPerRow = normalizeGridCount(s.layoutChannelShortsPerRow, 5, 1, 12);
    config.layoutPostsPerRow = normalizeGridCount(s.layoutPostsPerRow, 4, 1, 8);
    config.appearanceAutoTheater = !!s.appearanceAutoTheater;
    config.appearanceAutoExpandPlayer = !!s.appearanceAutoExpandPlayer;
    config.appearanceUseViewportPlayer = !!s.appearanceUseViewportPlayer;
    config.ultrawideEnabled = !!s.ultrawideEnabled;
    config.ultrawideFit = normalizeUltrawideFit(s.ultrawideFit);
    config.toolbarInsidePlayer = !!s.toolbarInsidePlayer;
    config.toolbarAlwaysVisible = !!s.toolbarAlwaysVisible;
    config.themeEngine = normalizeThemeEngine(s.themeEngine);
    config.themeVariant = normalizeThemeVariant(s.themeVariant);
    config.themeDeepDarkCustom = !!s.themeDeepDarkCustom;
    config.themeCustomAccent = normalizeHexColor(s.themeCustomAccent, "#ff334b");
    config.themeCustomBackground = normalizeHexColor(s.themeCustomBackground, "#0f0f0f");
    config.themeCustomSurface = normalizeHexColor(s.themeCustomSurface, "#17191f");
    config.themeCustomSurfaceRaised = normalizeHexColor(s.themeCustomSurfaceRaised, "#20232b");
    config.themeCustomText = normalizeHexColor(s.themeCustomText, "#f4f5f7");
    config.themeCustomMuted = normalizeHexColor(s.themeCustomMuted, "#a9adb8");
    config.themeCustomBorder = normalizeHexColor(s.themeCustomBorder, "#343741");
    config.themeCustomCss = String(s.themeCustomCss || "");
    config.videoFiltersEnabled = !!s.videoFiltersEnabled;
    // Filter ranges go above 100% (e.g. saturation 135%): normalizePercent
    // capped them at 100, silently turning presets like "Vívido" off.
    const filters = normalizeVideoFilters({
      brightness: s.videoFilterBrightness,
      contrast: s.videoFilterContrast,
      saturate: s.videoFilterSaturate,
      grayscale: s.videoFilterGrayscale,
      sepia: s.videoFilterSepia,
      hue: s.videoFilterHue,
    });
    config.videoFilterBrightness = filters.brightness;
    config.videoFilterContrast = filters.contrast;
    config.videoFilterSaturate = filters.saturate;
    config.videoFilterGrayscale = filters.grayscale;
    config.videoFilterSepia = filters.sepia;
    config.codecForceStandardFps = !!s.codecForceStandardFps;
    config.codecForceAvc = !!s.codecForceAvc;
    config.playerControlsEnabled = s.playerControlsEnabled !== false;
    config.playerControlsStyle = s.playerControlsStyle === "divider" ? "divider" : "pill";
    config.settingsMenuItemsEnabled = s.settingsMenuItemsEnabled !== false;
    config.skipSurveysEnabled = s.skipSurveysEnabled !== false;
    setSurveySkipEnabled(config.skipSurveysEnabled);
    config.playerEndTimeEnabled = s.playerEndTimeEnabled === true;
    config.liveCatchUpEnabled = s.liveCatchUpEnabled === true;
    config.liveCatchUpMode = normalizeLiveMode(s.liveCatchUpMode);
    config.liveJumpEnabled = s.liveJumpEnabled !== false;
    config.liveCatchUpMaxRate = Math.min(1.5, Math.max(1.05, Number(s.liveCatchUpMaxRate) || 1.25));
    config.videoFilterHue = filters.hue;
    adState.warningCount = s.warningCount || 0;
    adState.totalSkipped = s.totalAdsSkipped || 0;
    adState.adsSkippedToday = s.adsSkippedToday || 0;
    adState.todayDate = s.todayDate || null;
  }


  function loadSettings() {
    return new Promise<void>((resolve) => {
      if (chrome?.storage?.local) {
        chrome.storage.local.get(
          DEFAULT_SETTINGS,
          (s) => {
            const migrationPatch = getSettingsMigrationPatch(s.playerDefaultsProfileVersion);
            s = migrateSettings(s);
            if (migrationPatch) chrome.storage.local.set(migrationPatch);

            rawSettings = { ...s };
            applySettingsToConfig(s);
            resolve();
          }
        );
      } else {
        resolve();
      }
    });
  }

  const has = (changes: Record<string, unknown>, ...keys: string[]) => keys.some((key) => key in changes);
  const hasPrefix = (changes: Record<string, unknown>, ...prefixes: string[]) =>
    Object.keys(changes).some((key) => prefixes.some((prefix) => key.startsWith(prefix)));

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName && areaName !== "local") return;

      if (changes.tubeShieldActivePlayback) {
        handleExternalPlaybackSignal(changes.tubeShieldActivePlayback.newValue);
      }

      const settingChanges: Record<string, unknown> = {};
      for (const [key, change] of Object.entries(changes)) {
        if (key in DEFAULT_SETTINGS) settingChanges[key] = (change as chrome.storage.StorageChange).newValue;
      }
      if (!Object.keys(settingChanges).length) return;

      const wasEnabled = !!config.enabled;
      const wasSkipperActive = isAdSkipperActive();
      for (const [key, value] of Object.entries(settingChanges)) {
        rawSettings[key] = value === undefined ? (DEFAULT_SETTINGS as any)[key] : value;
      }
      applySettingsToConfig(rawSettings);

      if (config.enabled !== wasEnabled || isAdSkipperActive() !== wasSkipperActive) {
        if (isAdSkipperActive()) {
          startAdblockProtection();
          scheduleAdWatchdogTick();
        } else {
          cleanupRuntimeState();
          stopAdblockProtection();
        }
      }
      if (config.enabled !== wasEnabled) {
        if (config.enabled && config.pipEnabled) injectPipButton();
        if (!config.enabled) removePipButton();
        scheduleVisualMaintenanceTasks(true);
      }

      if (has(settingChanges, "showOverlay") && !config.showOverlay) removeOverlay();
      if (has(settingChanges, "pipEnabled")) {
        if (config.enabled && config.pipEnabled) injectPipButton(); else removePipButton();
      }
      if (has(settingChanges, "playerSpeedEnabled", "playerSpeedDefault")) adState.defaultSpeedAppliedKey = "";
      if (has(settingChanges, "playerVolumeEnabled", "playerVolumeDefault")) adState.defaultVolumeAppliedKey = "";
      if (hasPrefix(settingChanges, "volumeBoost")) applyVolumeBoost();
      if (hasPrefix(settingChanges, "quality")) resetQualityState();
      if (has(settingChanges, "appearanceConvertShorts")) convertShortsUrlIfNeeded();
      if (hasPrefix(settingChanges, "appearanceHide", "layout", "theme", "ultrawide", "skipSurveys") ||
          has(settingChanges, "appearanceLayoutRowsEnabled", "appearanceUseViewportPlayer")) {
        applyAppearanceFilters();
      }
      if (has(settingChanges, "appearanceLayoutRowsEnabled")) scheduleYouTubeLayoutRefresh();
      if (has(settingChanges, "appearanceSortNewestComments")) {
        adState.commentsSortKey = "";
        adState.commentsSortAttemptAt = 0;
      }
      if (hasPrefix(settingChanges, "videoFilter") || has(settingChanges, "appearanceAutoApplyFilters")) {
        applyVideoFilters();
        syncFilterPanel();
      }
      if (hasPrefix(settingChanges, "liveCatchUp", "liveJump")) {
        adState.liveEngaged = false;
        if (!config.liveCatchUpEnabled) restoreLiveRate();
        updateLiveButton();
        syncLivePanel();
      }
      if (hasPrefix(settingChanges, "toolbar", "playerControls", "playerEndTime", "settingsMenu") ||
          has(settingChanges, "playerSpeedButtonsEnabled", "playerPopupEnabled")) {
        updatePlayerControls();
      }
      if (hasPrefix(settingChanges, "miniplayer")) scheduleMiniplayerUpdate();
      if (hasPrefix(settingChanges, "toolbar", "volumeBoost") || has(settingChanges, "playerSpeedButtonsEnabled", "playerPopupEnabled")) {
        schedulePlayerToolbarUpdate();
      }
      if (hasPrefix(settingChanges, "codec")) syncCodecSettingsToMainWorld();
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (!isBridgeMessage(data)) return;
    if (data.source === MAIN_LIVE_STATS && data.token === mainWorldSessionToken) {
      adState.liveStats = {
        latency: Number(data.latency),
        health: Number(data.health),
        atLiveHead: data.atLiveHead !== false,
        at: Date.now(),
      };
      return;
    }
    if (data.source === MAIN_QUALITY_RESULT && data.token === mainWorldSessionToken) {
      adState.qualityCurrent = typeof data.current === "string" ? data.current : "";
      if (Array.isArray(data.available)) adState.qualityAvailable = data.available.filter((level) => typeof level === "string");
      if (data.query && adState.fullscreenQualityMode && adState.preFullscreenQuality === null) {
        adState.preFullscreenQuality = adState.qualityCurrent || "";
      }
      return;
    }
    if (data.source !== MAIN_FORCE_SKIP_RESULT || data.token !== mainWorldSessionToken || !data.ok) return;
    if (data.method === "click") {
      finishSkipClick();
    }
  });

  function isAdSkipperActive() {
    return !!config.enabled && config.adSkipperEnabled !== false;
  }

  function getFinitePositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function normalizeSpeedRate(rate) {
    return normalizeSpeedRateValue(rate);
  }

  function normalizeSkipDelay(delay = config.skipDelay) {
    return normalizeSkipDelayValue(delay);
  }

  function getSafeAdaptiveSpeed(delay = config.skipDelay) {
    return getSafeAdaptiveSpeedForDelay(delay);
  }

  function getRiskAdaptiveSpeed(delay = config.skipDelay) {
    return getRiskAdaptiveSpeedForDelay(delay);
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
    return Math.min(MAX_USER_PLAYBACK_RATE, Math.max(MIN_USER_PLAYBACK_RATE, Math.round(n * 100) / 100));
  }

  function normalizePlayerSpeedStep(step) {
    const n = Number(step);
    if (!Number.isFinite(n) || n <= 0) return 0.02;
    return Math.min(2, Math.max(0.01, n));
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

  function normalizeVolumeBoostLevel(level) {
    const n = Number(level);
    if (!Number.isFinite(n) || n < 1) return 2;
    return Math.min(6, Math.max(1, Math.round(n * 4) / 4));
  }

  function normalizeMiniplayerSize(size) {
    const value = String(size || "");
    return ["360x203", "480x270", "640x360"].includes(value) ? value : "480x270";
  }

  function normalizeMiniplayerPosition(position) {
    const value = String(position || "");
    return ["top-left", "top-right", "bottom-left", "bottom-right"].includes(value) ? value : "top-left";
  }

  function normalizePlayerPopupSize(size) {
    const value = String(size || "");
    return ["480x270", "640x360", "960x540"].includes(value) ? value : "640x360";
  }

  function normalizeToolbarPosition(position) {
    const value = String(position || "");
    return ["below", "above"].includes(value) ? value : "below";
  }

  function normalizeGridCount(value, fallback, min, max) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normalizePercent(value, fallback = 85) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function normalizeHexColor(value, fallback = "#000000") {
    const text = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
  }

  function normalizeUltrawideFit(value) {
    const text = String(value || "");
    return ["smart-crop", "contain", "stretch"].includes(text) ? text : "smart-crop";
  }

  function normalizeThemeEngine(value) {
    const text = String(value || "");
    return ["youtube", "tube-shield", "enhancer", "deepdark", "custom"].includes(text) ? text : "youtube";
  }

  function normalizeThemeVariant(value) {
    const text = String(value || "");
    return ["red", "deep-dark", "gray", "blue", "warm"].includes(text) ? text : "red";
  }

  function isEditableTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    const element = target as HTMLElement;
    const tag = element.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
  }

  function getCodecSettings() {
    return {
      forceStandardFps: !!config.codecForceStandardFps,
      forceAvc: !!config.codecForceAvc,
    };
  }

  function syncMainWorldSession(force = false) {
    const now = Date.now();
    if (!force && now - mainWorldSessionLastSyncAt < 2000) return;
    mainWorldSessionLastSyncAt = now;
    window.postMessage({
      source: MAIN_SESSION_MESSAGE,
      token: mainWorldSessionToken,
    }, "*");
  }

  function postMainWorldMessage(message: Record<string, unknown>) {
    syncMainWorldSession();
    window.postMessage({
      ...message,
      token: mainWorldSessionToken,
    }, "*");
  }

  function syncCodecSettingsToMainWorld() {
    const settings = getCodecSettings();
    try {
      localStorage.setItem(CODEC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {}
    postMainWorldMessage({ source: CODEC_SETTINGS_MESSAGE, settings });
  }

  function requestMainWorldQuality(level) {
    try {
      postMainWorldMessage({ source: MAIN_QUALITY_MESSAGE, level });
    } catch (err) {}
  }

  function parseMiniplayerSize(size = config.miniplayerSize) {
    const [width, height] = normalizeMiniplayerSize(size).split("x").map(part => parseInt(part, 10));
    return {
      width: Number.isFinite(width) ? width : 480,
      height: Number.isFinite(height) ? height : 270,
    };
  }

  function parsePlayerPopupSize(size = config.playerPopupSize) {
    const [width, height] = normalizePlayerPopupSize(size).split("x").map(part => parseInt(part, 10));
    return {
      width: Number.isFinite(width) ? width : 640,
      height: Number.isFinite(height) ? height : 360,
    };
  }

  function getActiveVideo() {
    return getMainVideo();
  }

  function getCurrentVideoKey() {
    return getYouTubeVideoKeyFromUrl(location.href);
  }

  function getCurrentVideoId() {
    return getYouTubeVideoIdFromUrl(location.href);
  }

  function syncLoopState(video = getActiveVideo()) {
    if (!video || !isWatchPage()) return;
    const key = getCurrentVideoKey();
    if (adState.loopVideoKey && adState.loopVideoKey !== key) {
      adState.loopVideoKey = "";
      adState.loopEnabled = false;
    }

    if (!adState.loopEnabled || adState.loopVideoKey !== key) return;

    try {
      if (!video.loop) video.loop = true;
      video.setAttribute("loop", "");
    } catch (err) {}
  }

  function bindPersistentVideoState() {
    const video = getActiveVideo();
    if (!video || playerStateVideo === video) return;

    if (playerStateCleanup) {
      playerStateCleanup();
      playerStateCleanup = null;
    }

    playerStateVideo = video;
    const reapply = () => {
      syncLoopState(video);
      if (config.volumeBoostEnabled) applyVolumeBoost(video);
      applyVideoFilters();
    };
    const handleEnded = () => {
      syncLoopState(video);
      if (adState.loopEnabled && adState.loopVideoKey === getCurrentVideoKey()) {
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch (err) {}
      }
    };

    const handlePause = () => {
      adState.lastNativePauseAt = Date.now();
      adState.lastNativePauseWasUser = hasRecentPlaybackIntent(1500);
    };

    video.addEventListener("pause", handlePause, true);
    video.addEventListener("loadedmetadata", reapply, true);
    video.addEventListener("durationchange", reapply, true);
    video.addEventListener("emptied", reapply, true);
    video.addEventListener("ended", handleEnded, true);

    playerStateCleanup = () => {
      video.removeEventListener("pause", handlePause, true);
      video.removeEventListener("loadedmetadata", reapply, true);
      video.removeEventListener("durationchange", reapply, true);
      video.removeEventListener("emptied", reapply, true);
      video.removeEventListener("ended", handleEnded, true);
    };
  }

  function setUserPlaybackRate(rate, video = getActiveVideo()) {
    const targetRate = normalizeUserPlaybackRate(rate, 1);

    if (video) {
      try {
        if (video.playbackRate !== targetRate) video.playbackRate = targetRate;
      } catch (err) {}
    }

    // YouTube's API caps non-Premium speed at 2x (and would pull the video
    // back to 2x), so faster rates are applied to the <video> only and kept
    // there by a sticky override until the user picks another speed.
    if (targetRate <= YOUTUBE_API_MAX_RATE) {
      adState.stickyRate = null;
      requestMainWorldSpeedThrough(targetRate);
    } else {
      adState.stickyRate = { key: getCurrentVideoKey(), rate: targetRate };
      bindStickyRate(video);
    }
    return targetRate;
  }

  const YOUTUBE_API_MAX_RATE = 2;
  let stickyRateVideo: HTMLVideoElement | null = null;

  function bindStickyRate(video: HTMLVideoElement | null) {
    if (!video || stickyRateVideo === video) return;
    stickyRateVideo?.removeEventListener("ratechange", enforceStickyRate);
    stickyRateVideo = video;
    video.addEventListener("ratechange", enforceStickyRate);
  }

  function enforceStickyRate() {
    const sticky = adState.stickyRate;
    const video = getActiveVideo();
    if (!sticky || !video || adState.active || getAdPlaying()) return;
    if (sticky.key !== getCurrentVideoKey()) {
      adState.stickyRate = null;
      return;
    }
    if (Math.abs(video.playbackRate - sticky.rate) < 0.001) return;
    // A change right after a click/key is the user's own choice: let it be.
    if (hasRecentPlaybackIntent(700)) {
      adState.stickyRate = null;
      return;
    }
    window.setTimeout(() => {
      if (adState.stickyRate === sticky && Math.abs(video.playbackRate - sticky.rate) > 0.001) {
        try { video.playbackRate = sticky.rate; } catch (err) {}
      }
    }, 0);
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

    // Keep YouTube's own volume state (slider, saved volume) in sync.
    postMainWorldMessage({ source: MAIN_PLAYER_COMMAND, command: "setVolume", value: target });
    if (unmute && target > 0) postMainWorldMessage({ source: MAIN_PLAYER_COMMAND, command: "unMute" });

    return target;
  }

  function shouldUseVolumeBoost() {
    return !!config.enabled && !!config.volumeBoostEnabled && normalizeVolumeBoostLevel(config.volumeBoostLevel) > 1;
  }

  // Routing the video through an AudioContext created before any user
  // gesture leaves it "suspended" and the video silent. Only build the graph
  // once the page has had user activation.
  function hasUserActivation() {
    try {
      const activation = (navigator as any).userActivation;
      if (activation && typeof activation.hasBeenActive === "boolean") return activation.hasBeenActive;
    } catch (err) {}
    return !!adState.lastUserPlaybackIntentAt;
  }

  function resumeSuspendedBoost() {
    const graph = volumeBoostGraphs.get(getActiveVideo() as HTMLMediaElement);
    if (graph && graph.context.state === "suspended") graph.context.resume().catch(() => {});
  }

  function ensureVolumeBoostGraph(video: HTMLMediaElement | null) {
    if (!video) return null;
    const existing = volumeBoostGraphs.get(video);
    if (existing) return existing;
    if (!hasUserActivation()) return null;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;

    const context = new AudioContextCtor();
    const source = context.createMediaElementSource(video);
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);

    const graph = { context, source, gain };
    volumeBoostGraphs.set(video, graph);
    return graph;
  }

  function applyVolumeBoost(video: HTMLMediaElement | null = getActiveVideo(), showFeedback = false) {
    if (!video) return false;
    const enabled = shouldUseVolumeBoost();
    const level = enabled ? normalizeVolumeBoostLevel(config.volumeBoostLevel) : 1;

    try {
      const graph = enabled ? ensureVolumeBoostGraph(video) : volumeBoostGraphs.get(video);
      if (!graph) return false;
      graph.gain.gain.value = level;
      if (enabled && graph.context.state === "suspended") {
        graph.context.resume().catch(() => {});
      }
      if (showFeedback) {
        showPlayerFeedback("volume", enabled ? "Boost " + level + "x" : "Boost off", enabled ? "Volume acima de 100%" : "Volume normal");
      }
      updatePlayerToolbarStates();
      return enabled;
    } catch (err) {
      console.warn("[YouTube Extension] Volume boost unavailable:", err);
      if (showFeedback) showPlayerFeedback("volume", "Boost indisponível", "O navegador bloqueou o processamento de áudio");
      return false;
    }
  }

  function setVolumeBoostEnabled(enabled, video = getActiveVideo()) {
    config.volumeBoostEnabled = !!enabled;
    try {
      chrome.storage.local.set({ volumeBoostEnabled: config.volumeBoostEnabled });
    } catch (err) {}
    return applyVolumeBoost(video, true);
  }

  const VIDEO_FILTER_STYLE_ID = "youtube-extension-video-filter-style";

  // Filters are one global, persistent state (the old per-video "session"
  // mode reset them on every navigation, which looked broken).
  function shouldUseVideoFilters() {
    return !!config.enabled && !!config.videoFiltersEnabled && !isNeutralFilter(getVideoFilterValues());
  }

  function applyVideoFilters() {
    const existing = document.getElementById(VIDEO_FILTER_STYLE_ID);
    if (!shouldUseVideoFilters()) {
      existing?.remove();
      videoFilterSignature = "";
      updatePlayerToolbarStates();
      refreshPlayerControlStates();
      return;
    }

    const filterValue = buildFilterCss(getVideoFilterValues());
    if (existing && videoFilterSignature === filterValue) return;

    const style = existing || document.createElement("style");
    style.id = VIDEO_FILTER_STYLE_ID;
    style.textContent = `
      #movie_player video.html5-main-video {
        filter: ${filterValue} !important;
      }
    `;
    if (!existing) (document.head || document.documentElement).appendChild(style);
    videoFilterSignature = filterValue;
    updatePlayerToolbarStates();
    refreshPlayerControlStates();
  }

  function setVideoFiltersEnabled(enabled) {
    config.videoFiltersEnabled = !!enabled;
    try { chrome.storage.local.set({ videoFiltersEnabled: config.videoFiltersEnabled }); } catch (err) {}
    applyVideoFilters();
    syncFilterPanel();
    showPlayerFeedback("filters", enabled ? "Filtros ligados" : "Filtros desligados");
  }

  function resetQualityState() {
    adState.qualityRequestKey = "";
    adState.qualityRequestStartedAt = 0;
    adState.qualityLastAttemptAt = 0;
    adState.qualityAppliedKey = "";
  }

  // Filled by MAIN_QUALITY_RESULT from the page (the player API is not
  // reachable from the content script's isolated world).
  function getCurrentQualityLevel() {
    return normalizeQualityLevel(adState.qualityCurrent, "");
  }

  function getAvailableQualityLevels() {
    const levels = Array.isArray(adState.qualityAvailable) ? adState.qualityAvailable : [];
    return levels.map((level) => normalizeQualityLevel(level, "")).filter((level) => level && level !== "auto");
  }

  function pickAvailableQuality(target) {
    return pickBestQualityLevel(target, getAvailableQualityLevels());
  }

  function setPlaybackQuality(target) {
    if (!getYouTubePlayer()) return false;
    requestMainWorldQuality(target);
    return true;
  }

  function queryMainWorldQuality() {
    postMainWorldMessage({ source: MAIN_QUALITY_MESSAGE, level: "", query: true });
  }

  function isFullscreenMode() {
    const player = getYouTubePlayer();
    return !!document.fullscreenElement || !!player?.classList?.contains("ytp-fullscreen");
  }

  function getQualityTarget(fullscreen = isFullscreenMode()) {
    const playlist = isPlaylistContext();
    const popupLike = isPopupWindow() || window.self !== window.top;
    if (fullscreen && config.qualityFullscreenEnabled) {
      if (popupLike) return config.qualityFullscreenPopup;
      return playlist ? config.qualityFullscreenPlaylist : config.qualityFullscreenVideo;
    }
    if (config.qualityEnabled) {
      if (popupLike) return config.qualityPopup;
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
        // Filled by the page's reply, which arrives before the next apply.
        adState.preFullscreenQuality = null;
        queryMainWorldQuality();
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

  function getThemePalette() {
    const engine = normalizeThemeEngine(config.themeEngine);
    const variant = normalizeThemeVariant(config.themeVariant);

    const palettes = {
      red: {
        accent: "#ff334b",
        background: "#0f1014",
        surface: "#17191f",
        surfaceRaised: "#20232b",
        text: "#f4f5f7",
        muted: "#a9adb8",
        border: "#323642",
      },
      "deep-dark": {
        accent: "#e02f42",
        background: "#07080a",
        surface: "#101116",
        surfaceRaised: "#171a20",
        text: "#f5f5f6",
        muted: "#a3a6ad",
        border: "#292d35",
      },
      gray: {
        accent: "#d43f52",
        background: "#15161a",
        surface: "#202227",
        surfaceRaised: "#2a2d34",
        text: "#f0f2f5",
        muted: "#aeb3bd",
        border: "#393e47",
      },
      blue: {
        accent: "#4f7fc2",
        background: "#0e1117",
        surface: "#171d27",
        surfaceRaised: "#202838",
        text: "#f3f6fb",
        muted: "#aab4c3",
        border: "#313b4f",
      },
      warm: {
        accent: "#c38452",
        background: "#15120f",
        surface: "#201b17",
        surfaceRaised: "#2b241f",
        text: "#f4eee8",
        muted: "#b6a89d",
        border: "#41372f",
      },
    };

    if (engine === "custom") {
      const background = normalizeHexColor(config.themeCustomBackground, "#0f0f0f");
      return {
        accent: normalizeHexColor(config.themeCustomAccent, "#ff334b"),
        background,
        surface: normalizeHexColor(config.themeCustomSurface, "#17191f"),
        surfaceRaised: normalizeHexColor(config.themeCustomSurfaceRaised, "#20232b"),
        text: normalizeHexColor(config.themeCustomText, "#f4f5f7"),
        muted: normalizeHexColor(config.themeCustomMuted, "#a9adb8"),
        border: normalizeHexColor(config.themeCustomBorder, "#343741"),
      };
    }

    if (engine === "deepdark") return palettes["deep-dark"];
    if (engine === "enhancer") return palettes.red;
    return palettes[variant] || palettes.red;
  }

  function buildThemeCss() {
    const engine = normalizeThemeEngine(config.themeEngine);
    if (engine === "youtube") return "";

    const palette = getThemePalette();
    const customCss = String(config.themeCustomCss || "").trim();
    const allowCustomCss = engine === "custom" || (engine === "deepdark" && config.themeDeepDarkCustom);

    return `
      html,
      ytd-app,
      #content,
      #page-manager,
      ytd-browse,
      ytd-watch-flexy {
        --yt-spec-base-background: ${palette.background} !important;
        --yt-spec-raised-background: ${palette.surfaceRaised} !important;
        --yt-spec-menu-background: ${palette.surfaceRaised} !important;
        --yt-spec-brand-background-solid: ${palette.background} !important;
        --yt-spec-general-background-a: ${palette.background} !important;
        --yt-spec-general-background-b: ${palette.surface} !important;
        --yt-spec-general-background-c: ${palette.surfaceRaised} !important;
        --yt-spec-text-primary: ${palette.text} !important;
        --yt-spec-text-secondary: ${palette.muted} !important;
        --yt-spec-call-to-action: ${palette.accent} !important;
        --yt-spec-themed-blue: ${palette.accent} !important;
        --yt-spec-static-brand-red: ${palette.accent} !important;
        background: ${palette.background} !important;
        color: ${palette.text} !important;
      }

      ytd-masthead,
      #masthead-container,
      tp-yt-paper-dialog,
      ytd-popup-container,
      ytd-menu-popup-renderer,
      ytd-multi-page-menu-renderer,
      ytd-guide-renderer,
      ytd-mini-guide-renderer,
      ytd-watch-flexy #secondary-inner,
      ytd-live-chat-frame {
        background: ${palette.surface} !important;
        color: ${palette.text} !important;
      }

      ytd-video-renderer,
      ytd-rich-item-renderer,
      ytd-compact-video-renderer,
      ytd-grid-video-renderer,
      ytd-playlist-panel-video-renderer {
        color: ${palette.text} !important;
      }

      ytd-thumbnail-overlay-time-status-renderer,
      .ytp-chrome-bottom .ytp-progress-list,
      .ytp-volume-slider-handle,
      .ytp-play-progress,
      .ytp-swatch-background-color {
        background-color: ${palette.accent} !important;
      }

      #video-title:hover,
      ytd-toggle-button-renderer[is-icon-button][style-target="button"] yt-icon {
        color: ${palette.accent} !important;
      }

      ytd-rich-item-renderer,
      ytd-video-renderer,
      ytd-comment-thread-renderer,
      ytd-playlist-panel-video-renderer,
      #sections.ytd-guide-renderer > ytd-guide-section-renderer {
        border-color: ${palette.border} !important;
      }

      ${allowCustomCss && customCss ? customCss : ""}
    `;
  }

  function buildAppearanceCss() {
    const blocks: string[] = [];

    const themeCss = buildThemeCss();
    if (themeCss) blocks.push(themeCss);

    if (config.appearanceHideShorts) {
      blocks.push(`
        ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer[is-shorts],
        ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
        grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
        ytm-shorts-lockup-view-model,
        yt-tab-shape[tab-title="Shorts"],
        ytd-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-mini-guide-entry-renderer[aria-label="Shorts"],
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

    // YouTube's own opinion surveys ("Como você avalia este vídeo?") in the
    // feed, under the video and inside the player.
    if (config.skipSurveysEnabled !== false) {
      blocks.push(`
        ytd-inline-survey-renderer,
        ytd-single-option-survey-renderer,
        ytd-rich-section-renderer:has(ytd-inline-survey-renderer),
        ytd-item-section-renderer:has(> #contents > ytd-inline-survey-renderer),
        yt-survey-renderer,
        ytd-feedback-survey-renderer,
        .ytp-survey-container,
        .ytp-player-survey {
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

    if (config.appearanceLayoutRowsEnabled) {
      const videosPerRow = isChannelPage() ? config.layoutChannelVideosPerRow : config.layoutVideosPerRow;
      const shortsPerRow = isChannelPage() ? config.layoutChannelShortsPerRow : config.layoutShortsPerRow;
      blocks.push(`
        ytd-rich-grid-renderer {
          --ytd-rich-grid-items-per-row: ${normalizeGridCount(videosPerRow, 4, 1, 8)} !important;
          --ytd-rich-grid-posts-per-row: ${normalizeGridCount(config.layoutPostsPerRow, 4, 1, 8)} !important;
        }

        ytd-rich-shelf-renderer[is-shorts] #contents,
        ytd-reel-shelf-renderer #contents {
          --ytd-rich-grid-items-per-row: ${normalizeGridCount(shortsPerRow, 8, 1, 12)} !important;
        }
      `);
    }

    if (isPopupWindow()) {
      blocks.push(`
        ytd-masthead,
        #masthead-container,
        ytd-watch-flexy #secondary,
        ytd-watch-flexy #below,
        ytd-watch-flexy ytd-watch-metadata,
        ytd-comments,
        ytd-guide-renderer,
        ytd-mini-guide-renderer {
          display: none !important;
        }

        ytd-app,
        #page-manager,
        ytd-watch-flexy,
        ytd-watch-flexy #columns,
        ytd-watch-flexy #primary,
        ytd-watch-flexy #primary-inner,
        ytd-watch-flexy #player,
        ytd-watch-flexy #player-container-outer {
          width: 100vw !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        ytd-watch-flexy #player-container-outer,
        ytd-watch-flexy #player-theater-container,
        ytd-watch-flexy #player-full-bleed-container {
          min-height: 100vh !important;
          background: #0f0f0f !important;
        }
      `);
    }

    if (config.appearanceUseViewportPlayer) {
      blocks.push(`
        ytd-watch-flexy[theater] #player-theater-container,
        ytd-watch-flexy[full-bleed-player] #player-full-bleed-container {
          min-height: calc(100vh - 56px) !important;
        }
      `);
    }

    if (config.ultrawideEnabled) {
      const fit = normalizeUltrawideFit(config.ultrawideFit);
      const objectFit = fit === "stretch" ? "fill" : fit === "contain" ? "contain" : "cover";
      blocks.push(`
        ytd-watch-flexy #movie_player {
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          overflow: hidden !important;
        }

        ytd-watch-flexy #movie_player .html5-video-container,
        ytd-watch-flexy #movie_player video.html5-main-video,
        ytd-watch-flexy #movie_player video {
          width: 100% !important;
          height: 100% !important;
        }

        ytd-watch-flexy #movie_player video.html5-main-video,
        ytd-watch-flexy #movie_player video {
          object-fit: ${objectFit} !important;
          left: 0 !important;
          top: 0 !important;
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
      config.appearanceLayoutRowsEnabled,
      config.appearanceSortNewestComments,
      config.appearanceAutoApplyFilters,
      config.layoutVideosPerRow,
      config.layoutChannelVideosPerRow,
      config.layoutShortsPerRow,
      config.layoutChannelShortsPerRow,
      config.layoutPostsPerRow,
      config.appearanceUseViewportPlayer,
      config.ultrawideEnabled,
      config.ultrawideFit,
      config.themeEngine,
      config.themeVariant,
      config.themeDeepDarkCustom,
      config.themeCustomAccent,
      config.themeCustomBackground,
      config.themeCustomSurface,
      config.themeCustomSurfaceRaised,
      config.themeCustomText,
      config.themeCustomMuted,
      config.themeCustomBorder,
      config.themeCustomCss,
      config.skipSurveysEnabled,
      // Only what the CSS depends on; the full path rebuilt it (and fired
      // three layout refreshes) on every video navigation.
      isChannelPage(),
      isPopupWindow(),
    ].join(":");

    if (signature === appearanceSignature) return;
    const layoutKeyOf = (sig: string) => sig.split(":").slice(6, 15).join(":") + ":" + isChannelPage();
    const layoutChanged = !appearanceSignature || layoutKeyOf(appearanceSignature) !== layoutKeyOf(signature);
    appearanceSignature = signature;

    const css = config.enabled ? buildAppearanceCss() : "";
    const existing = document.getElementById(APPEARANCE_STYLE_ID);
    if (!css) {
      existing?.remove();
      if (layoutChanged) scheduleYouTubeLayoutRefresh();
      return;
    }

    const style = existing || document.createElement("style");
    style.id = APPEARANCE_STYLE_ID;
    if (style.textContent !== css) style.textContent = css;
    if (!existing) (document.head || document.documentElement).appendChild(style);
    if (layoutChanged) scheduleYouTubeLayoutRefresh();
  }

  function scheduleYouTubeLayoutRefresh() {
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new CustomEvent("yt-resize"));
    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.dispatchEvent === "function") {
        player.dispatchEvent(new Event("resize"));
      }
    } catch (err) {}
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 420);
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

  // Opt-in. Only touches YouTube's own sort dropdown inside #comments, once per
  // video, never while hidden, and restores the scroll position afterwards.
  function sortCommentsNewestIfNeeded() {
    if (!config.enabled || !config.appearanceSortNewestComments || config.appearanceHideComments || !isWatchPage()) return;
    if (document.hidden) return;
    const key = getCurrentVideoKey();
    if (!key || adState.commentsSortKey === key) return;
    const now = Date.now();
    if (now - adState.commentsSortAttemptAt < 2500) return;

    const sortMenu = document.querySelector("ytd-comments #sort-menu") as HTMLElement | null;
    const trigger = sortMenu?.querySelector("#trigger, tp-yt-paper-button, button") as HTMLElement | null;
    if (!sortMenu || !trigger || trigger.getBoundingClientRect().height <= 0) return;

    adState.commentsSortAttemptAt = now;
    adState.commentsSortAttempts = (adState.commentsSortKeyAttempts === key ? adState.commentsSortAttempts || 0 : 0) + 1;
    adState.commentsSortKeyAttempts = key;
    if (adState.commentsSortAttempts > 3) {
      adState.commentsSortKey = key;
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const restoreScroll = () => {
      if (Math.abs(window.scrollY - scrollY) > 2) window.scrollTo(scrollX, scrollY);
    };

    trigger.click();
    window.setTimeout(() => {
      // The menu items live inside the same yt-dropdown-menu; "Newest first"
      // is always the second entry regardless of UI language.
      const items = Array.from(sortMenu.querySelectorAll("tp-yt-paper-listbox a, tp-yt-paper-listbox tp-yt-paper-item")) as HTMLElement[];
      const newest = items[1] || null;
      if (newest) {
        newest.click();
        adState.commentsSortKey = key;
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    }, 200);
  }

  let theaterToggleAt = 0;

  // Returns true once the page is in the requested mode. Only ever uses
  // YouTube's own size button: forcing the [theater] attribute desynced the
  // player and could leave it collapsed/invisible. A cooldown prevents a
  // second click from undoing the first while YouTube is still updating.
  function ensureTheaterMode(active) {
    const watchFlexy = document.querySelector("ytd-watch-flexy") as HTMLElement | null;
    if (!watchFlexy || watchFlexy.hidden) return false;
    const currentlyTheater = watchFlexy.hasAttribute("theater");
    if (currentlyTheater === active) return true;
    if (document.fullscreenElement || miniplayerActive) return false;
    if (Date.now() - theaterToggleAt < 1500) return false;

    const player = getYouTubePlayer();
    const theaterButton = player?.querySelector(".ytp-size-button") as HTMLElement | null;
    if (!theaterButton || theaterButton.getBoundingClientRect().width <= 0) return false;

    theaterToggleAt = Date.now();
    theaterButton.click();
    return false;
  }

  function runAutoLayoutTasks() {
    if (!config.enabled || !isWatchPage()) return;

    const key = getCurrentVideoKey();
    if ((config.appearanceAutoTheater || config.appearanceAutoExpandPlayer) && key && adState.autoTheaterAppliedKey !== key) {
      // Retried by the maintenance loop until YouTube confirms the mode, so
      // a click sent before the page finished hydrating is not lost.
      if (ensureTheaterMode(true)) adState.autoTheaterAppliedKey = key;
    }


  }

  function runAppearanceTasks() {
    applyAppearanceFilters();
    convertShortsUrlIfNeeded();
    runAutoLayoutTasks();
  }

  function runVisualMaintenanceTasks(force = false) {
    const now = Date.now();

    if (force || now - appearanceTasksLastRunAt >= APPEARANCE_TASK_INTERVAL_MS) {
      appearanceTasksLastRunAt = now;
      runAppearanceTasks();
      applyVideoFilters();
      sortCommentsNewestIfNeeded();
    }

    if (force || now - playerUiTasksLastRunAt >= PLAYER_UI_TASK_INTERVAL_MS) {
      playerUiTasksLastRunAt = now;
      updateMiniplayer();
      updatePlayerToolbar();
      updatePlayerControls();
    }
  }

  function scheduleVisualMaintenanceTasks(force = false, delay = 0) {
    visualMaintenanceForcePending = visualMaintenanceForcePending || force;

    const run = () => {
      visualMaintenanceTimeout = null;
      visualMaintenanceRaf = 0;
      const shouldForce = visualMaintenanceForcePending;
      visualMaintenanceForcePending = false;
      runVisualMaintenanceTasks(shouldForce);
    };

    if (delay > 0) {
      if (visualMaintenanceTimeout !== null) window.clearTimeout(visualMaintenanceTimeout);
      visualMaintenanceTimeout = window.setTimeout(run, delay);
      return;
    }

    if (visualMaintenanceTimeout !== null) return;
    if (visualMaintenanceRaf) return;
    visualMaintenanceRaf = window.requestAnimationFrame(run);
  }

  const PLAYER_FEEDBACK_ID = "youtube-extension-player-feedback";
  const PLAYER_FEEDBACK_STYLE_ID = "youtube-extension-player-feedback-style";

  // Same look as YouTube's own speed/volume bezel: a translucent pill near
  // the top of the player, one line, Roboto.
  function ensurePlayerFeedbackStyle() {
    if (document.getElementById(PLAYER_FEEDBACK_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PLAYER_FEEDBACK_STYLE_ID;
    style.textContent = `
      #${PLAYER_FEEDBACK_ID} {
        position: fixed !important;
        z-index: 2147483600 !important;
        display: flex !important;
        align-items: baseline !important;
        gap: 8px !important;
        max-width: min(360px, calc(100vw - 32px)) !important;
        padding: 9px 16px !important;
        border-radius: 20px !important;
        background: rgba(0, 0, 0, 0.6) !important;
        color: #fff !important;
        font: 500 14px/1.2 Roboto, Arial, sans-serif !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transform: translate(-50%, -50%) !important;
        transition: opacity 120ms ease !important;
      }

      #${PLAYER_FEEDBACK_ID}.is-visible { opacity: 1 !important; }

      #${PLAYER_FEEDBACK_ID} .feedback-label {
        color: rgba(255, 255, 255, 0.7) !important;
        font-size: 13px !important;
        font-weight: 400 !important;
      }

      #${PLAYER_FEEDBACK_ID} .feedback-label:first-child { display: none !important; }

      #${PLAYER_FEEDBACK_ID} .feedback-value {
        font-size: 15px !important;
        font-weight: 500 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showPlayerFeedback(kind, value, label = "") {
    const player: any = getYouTubePlayer();
    const rect = player?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    ensurePlayerFeedbackStyle();
    let feedback = document.getElementById(PLAYER_FEEDBACK_ID);
    if (!feedback) {
      feedback = document.createElement("div");
      feedback.id = PLAYER_FEEDBACK_ID;
      document.body.appendChild(feedback);
    }

    const kindLabel = kind === "volume" ? "Volume"
      : kind === "filters" ? "Filtros"
      : kind === "settings" ? "Configurações"
      : kind === "popup" ? "Pop-up"
      : kind === "speed" ? "Velocidade"
      : "YouTube Extension";
    feedback.innerHTML = `
      <span class="feedback-label">${kindLabel}</span>
      <span class="feedback-value">${value}</span>
      ${label ? `<span class="feedback-label">${label}</span>` : ""}
    `;
    feedback.style.left = Math.round(rect.left + rect.width / 2) + "px";
    feedback.style.top = Math.round(rect.top + Math.min(64, rect.height * 0.12)) + "px";
    feedback.classList.add("is-visible");

    if (playerFeedbackTimer) window.clearTimeout(playerFeedbackTimer);
    playerFeedbackTimer = window.setTimeout(() => {
      feedback?.classList.remove("is-visible");
    }, 950);
  }

  const MINIPLAYER_STYLE_ID = "tube-shield-miniplayer-style";

  const MINIPLAYER_SLOT_SELECTORS = [
    "#player-full-bleed-container",
    "#full-bleed-container",
    "#player-theater-container",
    "#player-container-outer",
    "#player-container",
    "#player",
  ];
  let miniplayerActive = false;
  let miniplayerDismissedKey = "";
  let miniplayerSlot: HTMLElement | null = null;

  // The in-flow element that currently hosts #movie_player. In theater mode
  // YouTube moves the player into the full-bleed container, so the old
  // "#player-container-outer" anchor was empty and the miniplayer misfired.
  function getPlayerSlot(): HTMLElement | null {
    const flexy = document.querySelector("ytd-watch-flexy");
    const player = getYouTubePlayer();
    if (!flexy || !player) return null;
    for (const selector of MINIPLAYER_SLOT_SELECTORS) {
      const el = flexy.querySelector(selector) as HTMLElement | null;
      if (el && el.contains(player) && el.getBoundingClientRect().height > 0) return el;
    }
    return null;
  }

  function getMastheadHeight() {
    const masthead = document.querySelector("ytd-masthead, #masthead-container") as HTMLElement | null;
    const rect = masthead?.getBoundingClientRect?.();
    return rect && rect.height > 0 ? rect.height : 56;
  }

  function getMiniplayerPositionCss() {
    const margin = "18px";
    const topOffset = "calc(var(--ytd-masthead-height, 56px) + 16px)";
    switch (normalizeMiniplayerPosition(config.miniplayerPosition)) {
      case "top-right":
        return `top: ${topOffset}; right: ${margin};`;
      case "bottom-left":
        return `bottom: ${margin}; left: ${margin};`;
      case "bottom-right":
        return `bottom: ${margin}; right: ${margin};`;
      case "top-left":
      default:
        return `top: ${topOffset}; left: ${margin};`;
    }
  }


  function ensureMiniplayerStyle() {
    const signature = [
      normalizeMiniplayerSize(config.miniplayerSize),
      normalizeMiniplayerPosition(config.miniplayerPosition),
    ].join(":");

    const existing = document.getElementById(MINIPLAYER_STYLE_ID);
    if (existing && signature === miniplayerSignature) return;

    miniplayerSignature = signature;
    const style = existing || document.createElement("style");
    style.id = MINIPLAYER_STYLE_ID;
    style.textContent = buildMiniplayerCss(parseMiniplayerSize(), getMiniplayerPositionCss());
    if (!existing) (document.head || document.documentElement).appendChild(style);
  }

  function isWatchPage() {
    return location.pathname === "/watch" || location.pathname === "/live";
  }

  function isChannelPage() {
    return /^\/(@|channel\/|c\/|user\/)/.test(location.pathname);
  }

  function isMiniplayerEligible() {
    if (!config.enabled || !config.miniplayerEnabled || !isWatchPage()) return false;
    if (document.fullscreenElement || document.pictureInPictureElement) return false;
    if (isPopupWindow()) return false;
    return !!getYouTubePlayer() && !!getActiveVideo();
  }

  function ensureMiniplayerCloseButton() {
    const player = getYouTubePlayer();
    if (!player || player.querySelector("#" + MINIPLAYER_CLOSE_ID)) return;
    const button = document.createElement("button");
    button.id = MINIPLAYER_CLOSE_ID;
    button.type = "button";
    button.title = "Fechar miniplayer";
    button.setAttribute("aria-label", "Fechar miniplayer");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    const stop = (event: Event) => event.stopPropagation();
    button.addEventListener("mousedown", stop, true);
    button.addEventListener("pointerdown", stop, true);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      miniplayerDismissedKey = getCurrentVideoKey();
      updateMiniplayer();
    });
    player.appendChild(button);
  }

  function releaseMiniplayerSlot() {
    if (!miniplayerSlot) return;
    miniplayerSlot.removeAttribute(MINIPLAYER_SLOT_ATTR);
    miniplayerSlot.style.removeProperty("--yte-mini-slot-height");
    miniplayerSlot = null;
  }

  function requestMainWorldPlayerResize(floating: boolean) {
    const size = parseMiniplayerSize();
    postMainWorldMessage({
      source: MAIN_PLAYER_RESIZE_MESSAGE,
      floating,
      width: Math.min(size.width, window.innerWidth - 36),
      height: Math.min(size.height, window.innerHeight - 90),
    });
  }

  function setMiniplayerActive(active: boolean, slot: HTMLElement | null) {
    if (active === miniplayerActive && (!active || slot === miniplayerSlot)) return;

    if (active && slot) {
      // Reserve the slot's height so floating the player does not collapse
      // the layout and yank the scroll position (the old flicker loop).
      if (miniplayerSlot && miniplayerSlot !== slot) releaseMiniplayerSlot();
      const height = Math.round(slot.getBoundingClientRect().height);
      slot.style.setProperty("--yte-mini-slot-height", height + "px");
      slot.setAttribute(MINIPLAYER_SLOT_ATTR, "");
      miniplayerSlot = slot;
      ensureMiniplayerCloseButton();
    } else {
      releaseMiniplayerSlot();
    }

    const changed = active !== miniplayerActive;
    miniplayerActive = active;
    document.documentElement.classList.toggle(MINIPLAYER_ACTIVE_CLASS, active);
    if (changed) requestMainWorldPlayerResize(active);
  }

  function updateMiniplayer() {
    if (!config.enabled || !config.miniplayerEnabled) {
      setMiniplayerActive(false, null);
      document.getElementById(MINIPLAYER_STYLE_ID)?.remove();
      miniplayerSignature = "";
      return;
    }

    ensureMiniplayerStyle();

    const eligible = isMiniplayerEligible();
    // While floating, measure the reserved slot; otherwise find the live one.
    const slot = (miniplayerActive && miniplayerSlot?.isConnected) ? miniplayerSlot : getPlayerSlot();
    const slotBottom = slot ? slot.getBoundingClientRect().bottom : Number.NaN;
    const mastheadHeight = getMastheadHeight();
    const key = getCurrentVideoKey();

    if (miniplayerDismissedKey && (miniplayerDismissedKey !== key || shouldResetMiniplayerDismissal(slotBottom, mastheadHeight))) {
      miniplayerDismissedKey = "";
    }

    const active = !!slot && shouldFloatPlayer({
      eligible,
      currentlyActive: miniplayerActive,
      dismissed: !!key && miniplayerDismissedKey === key,
      slotBottom,
      mastheadHeight,
    });

    setMiniplayerActive(active, active ? slot : null);
  }

  function scheduleMiniplayerUpdate() {
    if (miniplayerUpdateRaf) return;
    miniplayerUpdateRaf = requestAnimationFrame(() => {
      miniplayerUpdateRaf = 0;
      updateMiniplayer();
    });
  }

  const PLAYER_TOOLBAR_STYLE_ID = "tube-shield-player-toolbar-style";
  let playerToolbarSignature = "";

  function getPlayerToolbarAnchor() {
    const watchFlexy = document.querySelector("ytd-watch-flexy");
    const theater = !!watchFlexy?.hasAttribute("theater");
    if (theater) {
      return document.querySelector("#player-theater-container")
        || document.querySelector("#player-full-bleed-container")
        || document.querySelector("#player-container-outer")
        || document.querySelector("#player")
        || document.querySelector("ytd-player")
        || getYouTubePlayer();
    }

    return document.querySelector("#player-container-outer")
      || document.querySelector("#player-theater-container")
      || document.querySelector("#player-full-bleed-container")
      || document.querySelector("#player")
      || document.querySelector("ytd-player")
      || getYouTubePlayer();
  }

  function getPlayerToolbarActions() {
    const actions: Array<{ action: string; title: string; icon: string }> = [];
    if (config.toolbarLoop) actions.push({ action: "loop", title: "Loop", icon: "loop" });
    if (config.toolbarSpeed && config.playerSpeedButtonsEnabled !== false) {
      actions.push({ action: "speed-control", title: "Velocidade: role a roda; clique para 1x", icon: "speed-control" });
    }
    if (config.toolbarVolumeBoost) actions.push({ action: "volume-boost", title: "Volume boost", icon: "volume-boost" });
    if (config.toolbarPopup && config.playerPopupEnabled !== false) actions.push({ action: "popup", title: "Abrir em pop-up", icon: "popup" });
    if (config.toolbarPip) actions.push({ action: "pip", title: "Picture-in-Picture", icon: "pip" });
    if (config.toolbarScreenshot) actions.push({ action: "screenshot", title: "Capturar frame", icon: "camera" });
    if (config.toolbarFilters) actions.push({ action: "filters", title: "Filtros de vídeo", icon: "filters" });
    if (config.toolbarSettings) actions.push({ action: "settings", title: "Configurações", icon: "settings" });
    return actions;
  }


  function ensurePlayerToolbarStyle() {
    if (document.getElementById(PLAYER_TOOLBAR_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PLAYER_TOOLBAR_STYLE_ID;
    style.textContent = buildPlayerToolbarCss();
    (document.head || document.documentElement).appendChild(style);
  }

  function toolbarIcon(name) {
    switch (name) {
      case "loop":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
      case "speed-down":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg>';
      case "speed-up":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>';
      case "speed-control":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a8 8 0 0 1 16 0"/><path d="M12 14l4-5"/><path d="M12 14h.01"/><path d="M6.5 18h11"/></svg>';
      case "volume-boost":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9.5a4 4 0 0 1 0 5"/><path d="M19 8v8"/><path d="M22 12h-6"/></svg>';
      case "popup":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M14 9h4v4"/><path d="M13 14l5-5"/></svg>';
      case "pip":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="13" y="11" width="6" height="4" rx="1" fill="currentColor" stroke="none"/></svg>';
      case "camera":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="14" r="3"/></svg>';
      case "filters":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>';
      case "theater":
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h10"/></svg>';
      case "settings":
      default:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/></svg>';
    }
  }

  function createPlayerToolbarButton(action, title, icon) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tube-shield-toolbar-btn";
    button.dataset.toolbarAction = action;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.innerHTML = toolbarIcon(icon);
    if (action === "speed-control") {
      button.addEventListener("wheel", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY < 0 ? 1 : -1;
        adjustToolbarSpeed(direction);
      }, { passive: false });
    }
    return button;
  }

  function getPlayerToolbarSignature() {
    return [
      config.enabled,
      config.toolbarEnabled,
      normalizeToolbarPosition(config.toolbarPosition),
      config.toolbarCenter,
      config.toolbarLoop,
      config.toolbarSpeed,
      config.toolbarPopup,
      config.toolbarPip,
      config.toolbarScreenshot,
      config.toolbarTheater,
      config.toolbarSettings,
      config.toolbarVolumeBoost,
      config.toolbarFilters,
      config.playerSpeedButtonsEnabled,
      config.playerPopupEnabled,
      config.toolbarInsidePlayer,
      config.toolbarAlwaysVisible,
      normalizePlayerPopupSize(config.playerPopupSize),
      location.pathname,
    ].join(":");
  }

  function removePlayerToolbar() {
    document.getElementById(PLAYER_TOOLBAR_ID)?.remove();
    document.getElementById(PLAYER_TOOLBAR_STYLE_ID)?.remove();
    playerToolbarSignature = "";
  }

  function updatePlayerToolbarStates() {
    const toolbar = document.getElementById(PLAYER_TOOLBAR_ID);
    if (!toolbar) return;

    const video = getActiveVideo();
    const loopButton = toolbar.querySelector('[data-toolbar-action="loop"]');
    loopButton?.classList.toggle("is-active", !!video?.loop || (adState.loopEnabled && adState.loopVideoKey === getCurrentVideoKey()));

    const pipButton = toolbar.querySelector('[data-toolbar-action="pip"]');
    pipButton?.classList.toggle("is-active", !!document.pictureInPictureElement);

    const theaterButton = toolbar.querySelector('[data-toolbar-action="theater"]');
    theaterButton?.classList.toggle("is-active", !!document.querySelector("ytd-watch-flexy")?.hasAttribute("theater"));

    const boostButton = toolbar.querySelector('[data-toolbar-action="volume-boost"]');
    boostButton?.classList.toggle("is-active", shouldUseVolumeBoost());

    const filterButton = toolbar.querySelector('[data-toolbar-action="filters"]');
    filterButton?.classList.toggle("is-active", shouldUseVideoFilters());
  }

  function updatePlayerToolbar() {
    if (!config.enabled || !config.toolbarEnabled || !isWatchPage()) {
      removePlayerToolbar();
      return;
    }

    const anchor: any = getPlayerToolbarAnchor();
    const parent = anchor?.parentElement;
    if (!anchor || !parent) {
      removePlayerToolbar();
      return;
    }

    const signature = getPlayerToolbarSignature();
    let toolbar = document.getElementById(PLAYER_TOOLBAR_ID);
    const insidePlayer = !!config.toolbarInsidePlayer && anchor instanceof HTMLElement;
    const expectedParent = insidePlayer ? anchor : parent;
    const expectedNext = normalizeToolbarPosition(config.toolbarPosition) === "above"
      ? anchor
      : (anchor.nextSibling === toolbar ? toolbar.nextSibling : anchor.nextSibling);

    if (toolbar && toolbar.parentElement === expectedParent && playerToolbarSignature === signature) {
      toolbar.classList.toggle("is-centered", config.toolbarCenter !== false);
      toolbar.classList.toggle("is-inside", insidePlayer);
      toolbar.classList.toggle("is-always-visible", !!config.toolbarAlwaysVisible);
      updatePlayerToolbarStates();
      return;
    }

    ensurePlayerToolbarStyle();
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = PLAYER_TOOLBAR_ID;
      toolbar.addEventListener("click", (event) => {
        const target = event.target as Element;
        const button = target.closest?.("[data-toolbar-action]") as HTMLElement | null;
        const action = button?.dataset.toolbarAction;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        handlePlayerToolbarAction(action);
      });
    } else {
      toolbar.innerHTML = "";
    }

    toolbar.className = [
      config.toolbarCenter !== false ? "is-centered" : "",
      config.toolbarInsidePlayer ? "is-inside" : "",
      config.toolbarAlwaysVisible ? "is-always-visible" : "",
    ].filter(Boolean).join(" ");
    for (const item of getPlayerToolbarActions()) {
      toolbar.appendChild(createPlayerToolbarButton(item.action, item.title, item.icon));
    }

    if (insidePlayer) {
      anchor.appendChild(toolbar);
    } else if (normalizeToolbarPosition(config.toolbarPosition) === "above") {
      parent.insertBefore(toolbar, anchor);
    } else {
      parent.insertBefore(toolbar, expectedNext);
    }

    playerToolbarSignature = signature;
    updatePlayerToolbarStates();
  }

  function schedulePlayerToolbarUpdate() {
    if (playerToolbarUpdateRaf) return;
    playerToolbarUpdateRaf = window.requestAnimationFrame(() => {
      playerToolbarUpdateRaf = 0;
      updatePlayerToolbar();
    });
  }

  function openPopupPlayer() {
    if (config.playerPopupEnabled === false) return;
    const videoId = getCurrentVideoId();
    if (!videoId) {
      showPlayerFeedback("popup", "Indisponível", "Não encontrei o ID do vídeo");
      return;
    }

    const size = parsePlayerPopupSize();
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - size.width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - size.height) / 2));
    const features = [
      "popup=yes",
      "noopener=yes",
      "width=" + size.width,
      "height=" + size.height,
      "left=" + left,
      "top=" + top,
    ].join(",");

    try {
      getActiveVideo()?.pause();
    } catch (err) {}

    const popupUrl = new URL("/watch", location.origin);
    popupUrl.searchParams.set("v", videoId);
    popupUrl.searchParams.set("yse_popup", "1");
    const current = getActiveVideo();
    if (current && Number.isFinite(current.currentTime) && current.currentTime > 5) {
      popupUrl.searchParams.set("t", Math.floor(current.currentTime) + "s");
    }
    try {
      const source = new URL(location.href);
      const list = source.searchParams.get("list");
      if (list) popupUrl.searchParams.set("list", list);
    } catch (err) {}

    window.open(popupUrl.toString(), "youtubeExtensionPlayerPopup", features);
  }

  async function togglePictureInPicture(video = getActiveVideo()) {
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[YouTube Extension] PiP error:", err);
    }
  }

  function captureVideoFrame(video = getActiveVideo()) {
    if (!video) return;
    const width = video.videoWidth || video.clientWidth || 1280;
    const height = video.videoHeight || video.clientHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    try {
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, width, height);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "youtube-extension-frame-" + Date.now() + ".png";
      link.click();
    } catch (err) {
      console.warn("[YouTube Extension] Screenshot blocked by the video source:", err);
    }
  }

  function toggleTheaterMode() {
    const theaterButton = document.querySelector(".ytp-size-button, button.ytp-size-button") as HTMLElement | null;
    if (theaterButton) {
      theaterButton.click();
      setTimeout(schedulePlayerToolbarUpdate, 300);
      return;
    }

    const watchFlexy = document.querySelector("ytd-watch-flexy");
    if (!watchFlexy) return;
    if (watchFlexy.hasAttribute("theater")) {
      watchFlexy.removeAttribute("theater");
    } else {
      watchFlexy.setAttribute("theater", "");
    }
    setTimeout(schedulePlayerToolbarUpdate, 300);
  }

  function formatPlaybackRate(rate) {
    const value = Number(rate);
    if (!Number.isFinite(value)) return "1x";
    return value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, "") + "x";
  }

  function adjustToolbarSpeed(direction, video = getActiveVideo()) {
    const current = getCurrentPlaybackRate(video);
    const baseStep = normalizePlayerSpeedStep(config.playerSpeedStep);
    const scaledStep = current >= 16 ? Math.max(1, baseStep * 10) : current >= 4 ? Math.max(0.25, baseStep * 4) : baseStep;
    const next = normalizeUserPlaybackRate(current + direction * scaledStep, current);
    setUserPlaybackRate(next, video);
    showPlayerFeedback("speed", formatPlaybackRate(next), "Clique para voltar a 1x");
    return next;
  }

  function resetToolbarSpeed(video = getActiveVideo()) {
    const next = setUserPlaybackRate(1, video);
    showPlayerFeedback("speed", formatPlaybackRate(next), "Restaurado");
  }

  function openOptionsPage() {
    try {
      chrome.runtime.sendMessage({ type: "youtube-extension:open-options" }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          showPlayerFeedback("settings", "Abra pelo icone", "O navegador bloqueou a aba de opcoes");
        }
      });
    } catch (err) {
      showPlayerFeedback("settings", "Abra pelo icone", "O navegador bloqueou a aba de opcoes");
    }
  }

  function handlePlayerToolbarAction(action) {
    const video = getActiveVideo();
    markUserPlaybackIntent("toolbar");

    if (action === "loop") {
      if (video) {
        const next = !(adState.loopEnabled && adState.loopVideoKey === getCurrentVideoKey());
        adState.loopEnabled = next;
        adState.loopVideoKey = next ? getCurrentVideoKey() : "";
        video.loop = next;
        video.toggleAttribute("loop", next);
        showPlayerFeedback("speed", next ? "Loop on" : "Loop off");
      }
      updatePlayerToolbarStates();
      return;
    }

    if (action === "speed-down" || action === "speed-up") {
      const direction = action === "speed-up" ? 1 : -1;
      adjustToolbarSpeed(direction, video);
      return;
    }

    if (action === "speed-control") {
      resetToolbarSpeed(video);
      return;
    }

    if (action === "volume-boost") {
      setVolumeBoostEnabled(!config.volumeBoostEnabled, video);
      return;
    }

    if (action === "popup") {
      openPopupPlayer();
      return;
    }

    if (action === "pip") {
      togglePictureInPicture(video).then(updatePlayerToolbarStates);
      return;
    }

    if (action === "screenshot") {
      captureVideoFrame(video);
      return;
    }

    if (action === "filters") {
      setVideoFiltersEnabled(!shouldUseVideoFilters());
      return;
    }

    if (action === "theater") {
      toggleTheaterMode();
      return;
    }

    if (action === "settings") {
      openOptionsPage();
    }
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

    // YouTube re-applies its own rate right after loading a video, so keep
    // re-asserting the default until it sticks (or give up after ~6s).
    // Skipped on lives, where it would fight the live catch-up.
    if (config.playerSpeedEnabled && adState.defaultSpeedAppliedKey !== key && !isLiveStream()) {
      if (adState.defaultSpeedPendingKey !== key) {
        adState.defaultSpeedPendingKey = key;
        adState.defaultSpeedPendingSince = Date.now();
        adState.defaultSpeedStableTicks = 0;
      }
      const target = normalizeUserPlaybackRate(config.playerSpeedDefault, 1);
      if (Math.abs(video.playbackRate - target) > 0.001) {
        adState.defaultSpeedStableTicks = 0;
        if (video.readyState >= 1) setUserPlaybackRate(target, video);
      } else {
        adState.defaultSpeedStableTicks = (adState.defaultSpeedStableTicks || 0) + 1;
      }
      if (adState.defaultSpeedStableTicks >= 3 || Date.now() - adState.defaultSpeedPendingSince > 6000) {
        adState.defaultSpeedAppliedKey = key;
      }
    }

    if (config.playerVolumeEnabled && adState.defaultVolumeAppliedKey !== key) {
      setUserVolume(config.playerVolumeDefault, false, video);
      adState.defaultVolumeAppliedKey = key;
    }

    if (config.volumeBoostEnabled) {
      applyVolumeBoost(video);
    }

    applyVideoFilters();
    applyQualityPreferences();
  }

  function isPointerInsidePlayer(target) {
    if (!target || !(target instanceof Element)) return false;
    // Menus and panels scroll normally; the speed button has its own wheel.
    if (target.closest(".ytp-popup, .ytp-settings-menu, #" + FILTER_PANEL_ID + ", #" + PLAYER_CONTROLS_ID)) return false;
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
      showPlayerFeedback("speed", next + "x");
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
      if (shouldUseVolumeBoost()) applyVolumeBoost(video);
      showPlayerFeedback("volume", next + "%", shouldUseVolumeBoost() ? "Boost " + normalizeVolumeBoostLevel(config.volumeBoostLevel) + "x" : "");
    }
  }

  function isPlaylistContext() {
    try {
      const url = new URL(location.href);
      if (url.searchParams.has("list")) return true;
    } catch (err) {}

    // YouTube keeps an empty, hidden playlist panel on every watch page, so
    // only a visible panel with items counts (otherwise every video looked
    // like a playlist: wrong quality target, autoplay guard disabled).
    const panel = document.querySelector("ytd-watch-flexy ytd-playlist-panel-renderer") as HTMLElement | null;
    if (!panel || panel.hidden || panel.hasAttribute("hidden")) return false;
    const rect = panel.getBoundingClientRect();
    return rect.height > 0 && !!panel.querySelector("ytd-playlist-panel-video-renderer");
  }

  function isDiagnosticsEnabled() {
    try {
      return localStorage.getItem(DIAGNOSTIC_STORAGE_KEY) === "1"
        || localStorage.getItem("tubeShieldDebug") === "1";
    } catch (err) {
      return false;
    }
  }

  function debugPlayback(message, data = {}) {
    if (!isDiagnosticsEnabled()) return;
    console.debug("[YouTube Extension][playback]", message, data);
  }

  const PLAYBACK_EVENT_LOG_KEY = "playbackEventLog";
  const PLAYBACK_EVENT_LOG_LIMIT = 30;

  // Every pause/seek the extension performs on the real video is recorded so
  // "it paused by itself" reports can be traced from the options page.
  function recordPlaybackEvent(kind: string, reason: string, currentTime = 0) {
    if (!chrome?.storage?.local) return;
    const entry = {
      at: Date.now(),
      kind,
      reason,
      time: Math.round(currentTime * 10) / 10,
      hidden: document.hidden,
      video: getCurrentVideoId() || "",
    };
    try {
      chrome.storage.local.get({ [PLAYBACK_EVENT_LOG_KEY]: [] }, (data) => {
        const log = Array.isArray(data[PLAYBACK_EVENT_LOG_KEY]) ? data[PLAYBACK_EVENT_LOG_KEY] : [];
        log.unshift(entry);
        chrome.storage.local.set({ [PLAYBACK_EVENT_LOG_KEY]: log.slice(0, PLAYBACK_EVENT_LOG_LIMIT) });
      });
    } catch (err) {}
  }

  function markUserPlaybackIntent(reason = "user") {
    adState.lastUserPlaybackIntentAt = Date.now();
    adState.lastUserPlaybackIntentReason = reason;
  }

  function hasRecentPlaybackIntent(windowMs = USER_PLAYBACK_INTENT_WINDOW_MS) {
    return Date.now() - (adState.lastUserPlaybackIntentAt || 0) < windowMs;
  }

  function isNearVideoStart(video) {
    const current = Number(video?.currentTime || 0);
    return !Number.isFinite(current) || current < 4;
  }

  function isPopupWindow() {
    try {
      if (new URL(location.href).searchParams.get("yse_popup") === "1") return true;
    } catch (err) {}
    return window.name === "youtubeExtensionPlayerPopup" || (!!window.opener && window.outerWidth <= 1040 && window.outerHeight <= 680);
  }

  function getAutoplayBlockReason(video = getActiveVideo()) {
    if (!video) return "";
    const key = getCurrentVideoKey();
    return decideAutoplayBlock({
      enabled: !!config.enabled,
      adActive: !!adState.active || getAdPlaying(),
      isMainVideo: video === getMainVideo(),
      currentTime: Number(video.currentTime || 0),
      hidden: document.hidden,
      isPopup: isPopupWindow(),
      ignorePopup: !!config.autoplayIgnorePopup,
      isPlaylist: isPlaylistContext(),
      allowPlaylists: !!config.autoplayAllowPlaylists,
      recentIntent: hasRecentPlaybackIntent(document.hidden ? BACKGROUND_PLAYBACK_INTENT_WINDOW_MS : USER_PLAYBACK_INTENT_WINDOW_MS),
      alreadyBlockedThisVideo: !!key && adState.autoplayBlockedKey === key,
      msSinceAdEnded: adState.lastAdEndedAt ? Date.now() - adState.lastAdEndedAt : Number.POSITIVE_INFINITY,
      disableAll: !!config.autoplayDisableAll,
      blockBackground: !!config.autoplayBlockBackground,
      blockForeground: !!config.autoplayBlockForeground,
    });
  }

  function blockAutoplay(video: HTMLVideoElement, reason: string) {
    adState.autoplayBlockedKey = getCurrentVideoKey();
    pauseVideo(video, reason);
  }

  function shouldBlockAutoplay(video = getActiveVideo()) {
    return !!getAutoplayBlockReason(video);
  }

  function resumeAdPlaybackIfNeeded() {
    if (!isAdSkipperActive() || !(adState.active || getAdPlaying())) return;
    const video = getActiveVideo();
    if (!video || !video.paused) return;
    try {
      video.play().catch(() => {});
    } catch (err) {}
  }

  function pauseVideo(video = getActiveVideo(), reason = "unknown") {
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

    if (paused) {
      recordPlaybackEvent("pause", reason, Number(video.currentTime || 0));
      adState.lastPlaybackPauseReason = reason;
      adState.lastPlaybackPauseAt = Date.now();
      debugPlayback("paused video", {
        reason,
        url: location.href,
        hidden: document.hidden,
        currentTime: Number(video.currentTime || 0),
        videoKey: getCurrentVideoKey(),
        recentIntent: hasRecentPlaybackIntent(document.hidden ? BACKGROUND_PLAYBACK_INTENT_WINDOW_MS : USER_PLAYBACK_INTENT_WINDOW_MS),
        intentReason: adState.lastUserPlaybackIntentReason,
      });
    }

    return paused;
  }

  function announceForegroundPlayback() {
    if (!config.enabled || !config.pauseBackgroundTabs || document.hidden || adState.active || getAdPlaying()) return;
    if (!chrome?.storage?.local) return;
    const now = Date.now();
    if (now - (adState.lastPlaybackAnnounceAt || 0) < 2000) return;
    adState.lastPlaybackAnnounceAt = now;
    chrome.storage.local.set({
      tubeShieldActivePlayback: {
        token: adState.tabPlaybackToken,
        time: Date.now(),
        url: location.href,
      },
    });
  }

  function handleVideoPlayEvent(event?: Event) {
    const video = getActiveVideo();
    if (!video || (event && event.target !== video)) return;

    const blockReason = getAutoplayBlockReason(video);
    if (blockReason) {
      blockAutoplay(video, blockReason);
      return;
    }

    announceForegroundPlayback();
  }

  function handleExternalPlaybackSignal(signal) {
    if (!config.enabled || !config.pauseBackgroundTabs || !document.hidden) return;
    if (!signal || signal.token === adState.tabPlaybackToken) return;

    const signalTime = Number(signal.time) || 0;
    if (!signalTime || Date.now() - signalTime > 5000) return;

    if (hasRecentPlaybackIntent(BACKGROUND_PLAYBACK_INTENT_WINDOW_MS)) {
      debugPlayback("ignored background pause due recent intent", {
        signalUrl: signal.url || "",
        intentReason: adState.lastUserPlaybackIntentReason,
      });
      return;
    }

    const video = getActiveVideo();
    if (video && !video.paused && !adState.active && !getAdPlaying()) {
      pauseVideo(video, "background-tab-playback-signal");
    }
  }

  function bindAutoplayGuards() {
    const video = getActiveVideo();
    if (!video || adState.autoplayVideo === video) return;

    if (adState.autoplayVideo) {
      try {
        adState.autoplayVideo.removeEventListener("play", handleVideoPlayEvent, true);
        adState.autoplayVideo.removeEventListener("playing", handleVideoPlayEvent, true);
      } catch (err) {}
    }

    adState.autoplayVideo = video;
    video.addEventListener("play", handleVideoPlayEvent, true);
    video.addEventListener("playing", handleVideoPlayEvent, true);

    const initialBlockReason = getAutoplayBlockReason(video);
    if (!video.paused && initialBlockReason) {
      blockAutoplay(video, initialBlockReason);
    }
  }

  function enforceAutoplayGuards() {
    bindAutoplayGuards();
    resumeAdPlaybackIfNeeded();

    const video = getActiveVideo();
    if (!video) return;

    const blockReason = getAutoplayBlockReason(video);

    if (config.autoplayStopPreload && blockReason) {
      try { video.preload = "none"; } catch (err) {}
    }

    // Pausing is driven only by the "play" event (and the one-off check when
    // the listener is bound). Polling here used to re-pause videos the user
    // had resumed with headphone buttons or the OS media controls.
    if (!video.paused && !blockReason) announceForegroundPlayback();
  }

  function getSpeedThroughRate() {
    if (isInstantSkipEnabled()) return INSTANT_SPEED_THROUGH_RATE;
    if (config.customSpeedEnabled && config.adaptiveSpeedEnabled) return getRiskAdaptiveSpeed();
    if (config.customSpeedEnabled) return normalizeSpeedRate(config.adSpeedRate);
    return getSafeAdaptiveSpeed();
  }

  function requestMainWorldSkip() {
    postMainWorldMessage({
      source: MAIN_FORCE_SKIP_MESSAGE,
      targetTime: adState.skipTargetTime || Date.now(),
      rate: getSpeedThroughRate(),
      adSrc: adState.adSrc || "",
      skipSurveys: config.skipSurveysEnabled !== false,
    });
  }

  function requestMainWorldSpeedThrough(rate = getSpeedThroughRate(), adOnly = false) {
    postMainWorldMessage({
      source: MAIN_SPEED_THROUGH_MESSAGE,
      rate,
      adOnly,
    });
  }

  // True when the element is still showing the ad we started handling. YouTube
  // reuses the same <video> for content, so a stale reference is not enough.
  function isSameAdSource(video: HTMLVideoElement | null) {
    if (!video) return false;
    if (!adState.adSrc || !video.currentSrc) return true;
    return video.currentSrc === adState.adSrc;
  }

  function forceSkipAd(video = getMainVideo()) {
    if (!isAdSkipperActive() || !config.aggressiveSkip || adState.watching) return false;
    if (!getAdPlaying() || !isSameAdSource(video)) return false;

    requestMainWorldSkip();

    const player: any = getYouTubePlayer();
    let attempted = false;

    if (video) {
      const duration = Number(video.duration);
      const currentTime = Number(video.currentTime);
      const target = getAdSeekTarget(duration, currentTime);

      try {
        video.playbackRate = getSpeedThroughRate();
        attempted = true;
      } catch (err) {}

      if (target !== null) try {
        if (typeof video.fastSeek === "function") video.fastSeek(target);
        video.currentTime = target;
        attempted = true;
      } catch (err) {
        try {
          video.currentTime = target;
          attempted = true;
        } catch (innerErr) {}
      }

      try {
        if (player && typeof player.seekTo === "function" && target !== null) {
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

  function getCurrentPlaybackRate(video = getMainVideo()) {
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

  function applySpeedThrough(video = getMainVideo()) {
    if (!isAdSkipperActive() || !config.aggressiveSkip || adState.watching) return false;
    if (!getAdPlaying() || !isSameAdSource(video)) return false;

    const rate = getSpeedThroughRate();
    requestMainWorldSpeedThrough(rate, true);

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
    if (!isAdSkipperActive() || !config.aggressiveSkip || adState.speedThroughInterval) return;
    applySpeedThrough();
    adState.speedThroughInterval = setInterval(() => {
      if (!isAdSkipperActive() || !adState.active || adState.watching || !getAdPlaying()) {
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
    const video = getMainVideo();
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

  function getCapturedPlaybackRate() {
    const rate = Number(adState.preAdPlaybackRate);
    return Number.isFinite(rate) && rate > 0 ? normalizePlaybackRate(rate) : null;
  }

  function clearPostSkipRestoreChecks() {
    for (const timeoutId of adState.postSkipRestoreTimeouts || []) {
      clearTimeout(timeoutId);
    }
    adState.postSkipRestoreTimeouts = [];
  }

  function queuePlaybackRateRestoreAfterSkip() {
    clearPostSkipRestoreChecks();
    const targetRate = getCapturedPlaybackRate();
    if (targetRate === null) return;

    adState.postSkipRestoreTimeouts = POST_SKIP_RESTORE_DELAYS_MS.map((delay) => setTimeout(() => {
      if (!isAdSkipperActive() || adState.watching || !getAdPlaying()) {
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
    if (incrementAdCounter("skip-click")) showToastNotification();
  }

  function attemptScheduledSkip() {
    if (!isAdSkipperActive() || !adState.active || adState.watching) return false;

    const video = getMainVideo();
    const skipButton = findSkipAdButton();
    const action = chooseAdSkipAction({
      adConfirmed: getAdPlaying(),
      aggressive: !!config.aggressiveSkip,
      delayElapsed: !adState.skipTargetTime || Date.now() >= adState.skipTargetTime,
      skipButtonAvailable: !!skipButton,
      watching: !!adState.watching,
      duration: Number(video?.duration),
      currentTime: Number(video?.currentTime),
    });

    if (action === "click" && clickSkipAdBtn(skipButton)) {
      finishSkipClick();
      return true;
    }

    if (action === "seek-end") {
      if (!adState.forceSkipInterval) recordPlaybackEvent("ad-seek", "skip-fallback", Number(video?.currentTime || 0));
      forceSkipAd(video);
      startForceSkipBurst(video);
    } else if (action === "speed-through") {
      applySpeedThrough(video);
    }

    return false;
  }

  function startForceSkipBurst(video = getMainVideo()) {
    if (!isAdSkipperActive() || !config.aggressiveSkip || adState.forceSkipInterval) return;
    adState.forceSkipStartedAt = Date.now();

    const tick = () => {
      if (!isAdSkipperActive() || adState.watching || !getAdPlaying()) {
        stopForceSkipBurst();
        return;
      }

      if (clickSkipAdBtn()) {
        finishSkipClick();
        return;
      }

      // Always re-resolve: the captured element may now be playing content.
      forceSkipAd(getMainVideo());

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
    const root = getYouTubePlayer() || document.documentElement;
    if (!root) return;

    skipButtonObserver = new MutationObserver(() => {
      if (!isAdSkipperActive() || !adState.active || adState.watching || !adState.skipTargetTime) return;
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
    if (!isAdSkipperActive()) return;
    if (document.getElementById(ANTI_ADBLOCK_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = ANTI_ADBLOCK_STYLE_ID;
    s.textContent = `
      ytd-enforcement-message-view-model,
      tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),
      tp-yt-paper-dialog.ytd-enforcement-message-view-model,
      ytd-popup-container tp-yt-paper-dialog:has(#enforcement-message-view-model) {
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
    if (!isAdSkipperActive()) return;
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
  function removeOrphanedAdblockBackdrops() {
    window.setTimeout(() => {
      const hasOpenDialog = Array.from(document.querySelectorAll("tp-yt-paper-dialog")).some((dialog: HTMLElement) => {
        if (!dialog.isConnected || dialog.getAttribute("aria-hidden") === "true") return false;
        return dialog.hasAttribute("opened") || dialog.offsetParent !== null;
      });
      if (hasOpenDialog) return;

      document.querySelectorAll(
        "iron-overlay-backdrop.opened, iron-overlay-backdrop[opened], tp-yt-paper-dialog-backdrop.opened, tp-yt-paper-dialog-backdrop[opened]"
      ).forEach((backdrop) => backdrop.remove());
      if (document.body) document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }, 0);
  }

  // YouTube pauses the video when it shows the anti-adblock modal. Removing
  // the modal left the video paused "for no reason"; resume it unless the
  // user paused it themselves.
  function resumeAfterAdblockWarning() {
    const video = getMainVideo();
    if (!video || !video.paused || video.ended) return;
    if (adState.lastNativePauseWasUser) return;
    if (Date.now() - (adState.lastNativePauseAt || 0) > 4000) return;
    window.setTimeout(() => {
      if (!video.paused || hasRecentPlaybackIntent(1500)) return;
      video.play().catch(() => {});
      recordPlaybackEvent("resume", "adblock-warning-removed", Number(video.currentTime || 0));
    }, 150);
  }

  function nukeAdblockElement(el) {
    if (!isAdSkipperActive() || !el) return;
    const target = el.closest?.("tp-yt-paper-dialog") || el;
    const shouldCount = target.isConnected !== false;
    target.remove();
    removeOrphanedAdblockBackdrops();
    resumeAfterAdblockWarning();

    // Incrementar contador de avisos e salvar
    if (!shouldCount) return;
    adState.warningCount++;
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ warningCount: adState.warningCount });
    }
  }

  function checkAndNukeNode(node) {
    if (!isAdSkipperActive()) return;
    if (!node || node.nodeType !== 1) return;

    if (_abTagNames.includes(node.tagName)) {
      nukeAdblockElement(node);
      return;
    }

    if (node.tagName === 'TP-YT-PAPER-DIALOG') {
      const inner = node.querySelector('ytd-enforcement-message-view-model');
      if (inner) { nukeAdblockElement(node); return; }
      if (looksLikeAdblockWarningText(node.textContent)) {
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
    if (!isAdSkipperActive() || adblockObserver || adblockBodyWaitObserver) return;
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
      if (!isAdSkipperActive()) return;
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
    if (!isAdSkipperActive()) return false;
    const enforcement = document.querySelector('ytd-enforcement-message-view-model');
    if (enforcement) {
      const dialog = enforcement.closest('tp-yt-paper-dialog') || enforcement;
      nukeAdblockElement(dialog);
      return true;
    }
    const dialogs = document.querySelectorAll('tp-yt-paper-dialog');
    for (const dialog of dialogs) {
      if (dialog.offsetParent === null && dialog.style.display === 'none') continue;
      if (looksLikeAdblockWarningText(dialog.textContent)) {
        nukeAdblockElement(dialog);
        return true;
      }
    }
    const mealbars = document.querySelectorAll('ytd-mealbar-promo-renderer');
    for (const mealbar of mealbars) {
      if (!looksLikeAdblockWarningText(mealbar.textContent)) continue;
      const dismiss = mealbar.querySelector<HTMLElement>('#dismiss-button');
      if (dismiss && dismiss.offsetParent !== null) {
        dismiss.click();
        return true;
      }
    }
    return false;
  }

  // ── Overlay (com IDs ofuscados) ───────────────────────

  const OVERLAY_ID = "ytp-iv-player-content";
  const TIMER_ID = "ytp-tooltip-duration";
  const STYLE_ID = "ytp-style-corrections";

  // Ad chip: a small pill in the player (same visual language as YouTube's
  // own ad buttons) that states what is really happening.
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 60;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 4px 4px 14px;
        border-radius: 18px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        font: 500 13px/1 Roboto, Arial, sans-serif;
        pointer-events: auto;
        text-shadow: none;
      }

      #${OVERLAY_ID} .yte-ad-text {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      #${OVERLAY_ID} .yte-ad-text::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #fc0;
      }

      #${OVERLAY_ID}[data-state="waiting"] .yte-ad-text::before { background: rgba(255, 255, 255, 0.6); }
      #${OVERLAY_ID}[data-state="skipping"] .yte-ad-text::before { background: #3ea6ff; }

      #${OVERLAY_ID} button {
        height: 28px;
        padding: 0 12px;
        border: 0;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
        font: 500 12px Roboto, Arial, sans-serif;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      #${OVERLAY_ID} button:hover { background: rgba(255, 255, 255, 0.28); }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function getOverlayState() {
    const remaining = adState.skipTargetTime ? Math.max(0, Math.ceil((adState.skipTargetTime - Date.now()) / 1000)) : 0;
    const skipButton = !!findSkipAdButton();
    if (remaining > 0) {
      return { state: "counting", text: "Pulando em " + remaining + "s" };
    }
    if (skipButton) return { state: "skipping", text: "Pulando…" };
    if (!config.aggressiveSkip) {
      // Safe mode only clicks YouTube's own button; never claim "0s".
      return { state: "waiting", text: "Esperando o botão Pular" };
    }
    return { state: "skipping", text: "Acelerando o anúncio…" };
  }

  function renderOverlayState() {
    const overlay = document.getElementById(OVERLAY_ID);
    const label = document.getElementById(TIMER_ID);
    if (!overlay || !label) return;
    const { state, text } = getOverlayState();
    if (overlay.dataset.state !== state) overlay.dataset.state = state;
    if (label.textContent !== text) label.textContent = text;
  }

  function createOverlay() {
    removeOverlay();
    injectStyles();

    const player = getYouTubePlayer();
    if (!player) return;

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("role", "status");

    const label = document.createElement("span");
    label.className = "yte-ad-text";
    label.id = TIMER_ID;
    const watchBtn = document.createElement("button");
    watchBtn.type = "button";
    watchBtn.className = "ytp-ad-watch";
    watchBtn.textContent = "Assistir";
    watchBtn.title = "Assistir este anúncio até o fim";
    overlay.append(label, watchBtn);

    for (const type of ["click", "mousedown", "pointerdown", "dblclick"]) {
      overlay.addEventListener(type, (event) => event.stopPropagation());
    }

    player.appendChild(overlay);
    adState.overlayEl = overlay;
    renderOverlayState();

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

    adState.countdownInterval = setInterval(renderOverlayState, 200);
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
    return shouldProtectChannel(getCurrentChannel(), config.whitelist, config.listMode);
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
          position: fixed; left: 24px; bottom: 24px;
          padding: 12px 16px; border-radius: 8px;
          background: var(--yt-spec-inverted-background, #f1f1f1);
          color: var(--yt-spec-text-primary-inverse, #0f0f0f);
          font: 500 14px/1.2 Roboto, Arial, sans-serif;
          z-index: 2200; opacity: 0; transform: translateY(8px);
          transition: opacity 0.2s ease, transform 0.2s ease;
          pointer-events: none; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        #ytp-skipper-toast.show { opacity: 1; transform: translateY(0); }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const toast = document.createElement('div');
    toast.id = 'ytp-skipper-toast';
    toast.textContent = 'Anúncio pulado';
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

  // One ad = one count. Guards against the double counts seen in practice:
  // when an ad ends, the video jumps back to 0 while YouTube still marks the
  // player as "ad-showing" for a moment, which looked like a second ad.
  const AD_COUNT_MIN_GAP_MS = 1200;
  const AD_MIN_DURATION_MS = 800;

  function incrementAdCounter(reason = "ad-end") {
    if (adState.alreadyCounted) return false;
    adState.alreadyCounted = true;
    const nowMs = Date.now();
    if (nowMs - (adState.lastAdCountedAt || 0) < AD_COUNT_MIN_GAP_MS) return false;
    if (reason !== "skip-click" && adState.startTime && nowMs - adState.startTime < AD_MIN_DURATION_MS) return false;
    adState.lastAdCountedAt = nowMs;
    recordPlaybackEvent("ad-counted", reason, Number(getMainVideo()?.currentTime || 0));

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
    const targetRate = getCapturedPlaybackRate();
    if (targetRate === null) {
      stopPlaybackRateRestore();
      return;
    }
    startPlaybackRateRestore(targetRate);
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
    adState.adSrc = "";
    adState.lastAdEndedAt = Date.now();
  }

  const AD_WATCHDOG_EVENTS = ["play", "playing", "timeupdate", "durationchange", "ratechange", "loadeddata"];

  function scheduleAdWatchdogTick() {
    if (!isAdSkipperActive() || adWatchdogTimeout !== null) return;

    adWatchdogTimeout = window.setTimeout(() => {
      adWatchdogTimeout = null;
      if (!isAdSkipperActive()) return;

      try {
        const adPlaying = getAdPlaying();
        if (adPlaying && adState.active && !adState.watching && adState.skipTargetTime && Date.now() >= adState.skipTargetTime) {
          attemptScheduledSkip();
          return;
        }

        mainLoop();
      } catch (err) {}
    }, document.hidden ? 250 : 90);
  }

  function bindAdSkipperWatchdog() {
    const video = getActiveVideo();
    if (!video || adWatchdogVideo === video) return;

    if (adWatchdogVideo) {
      AD_WATCHDOG_EVENTS.forEach((eventName) => {
        adWatchdogVideo?.removeEventListener(eventName, scheduleAdWatchdogTick, true);
      });
    }

    adWatchdogVideo = video;
    AD_WATCHDOG_EVENTS.forEach((eventName) => {
      video.addEventListener(eventName, scheduleAdWatchdogTick, true);
    });
  }

  // ── Controles dentro do player do YouTube ─────────────
  // Buttons live in YouTube's own control bar (.ytp-right-controls), styled
  // like native ones, plus an in-player filter panel, the "ends at" clock and
  // the live delay chip.

  const PLAYER_UI_STYLE_ID = "yte-player-ui-style";
  const SPEED_CYCLE = [1, 1.25, 1.5, 1.75, 2];
  let playerControlsVideo: HTMLVideoElement | null = null;
  let filterSaveTimer: number | null = null;

  // Filled 24px icons (Material Icons, Apache-2.0), the same visual language
  // as YouTube's own control bar, so the buttons read as native.
  const PLAYER_ICON_PATHS: Record<string, string> = {
    loop: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
    camera: "M12 17.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0-2a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM4 21a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.15L9 3h6l1.85 2H20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4zm0-2h16V7h-4.05l-1.82-2H9.88L8.05 7H4v12z",
    filters: "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
    pip: "M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z",
    popup: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
    boost: "M3 9v6h4l5 5V4L7 9H3zm15-5-4 8h3l-1 8 5-10h-3l2-6z",
  };

  function playerIcon(name: string) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (PLAYER_ICON_PATHS[name] || "") + '"/></svg>';
  }


  function ensurePlayerUiStyle() {
    if (document.getElementById(PLAYER_UI_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PLAYER_UI_STYLE_ID;
    style.textContent = buildPlayerUiCss();
    (document.head || document.documentElement).appendChild(style);
  }

  function isLiveStream() {
    const player = getYouTubePlayer();
    if (!player) return false;
    if (player.classList.contains("ytp-live")) return true;
    // At the live edge YouTube marks its badge as disabled (nothing to jump
    // to); it is still a live. VODs keep the badge hidden (no offsetParent).
    const badge = player.querySelector(".ytp-live-badge") as HTMLElement | null;
    return !!badge && badge.offsetParent !== null;
  }

  function getPlayerControlItems() {
    const items: Array<{ id: string; tip: string; icon?: string; text?: string; priority: "high" | "mid" | "low"; className?: string }> = [];
    if (config.toolbarSpeed !== false && config.playerSpeedButtonsEnabled !== false) {
      items.push({ id: "speed", tip: "Velocidade · clique para alternar, role para ajustar, botão direito volta a 1x", text: "1x", priority: "high", className: "yte-btn--text" });
    }
    // With the gear integration on, set-and-forget items (filters, loop)
    // live in YouTube's settings menu; the bar keeps quick actions.
    const inGear = config.settingsMenuItemsEnabled !== false;
    if (config.toolbarLoop !== false && !inGear) items.push({ id: "loop", tip: "Repetir vídeo", icon: "loop", priority: "mid" });
    if (config.toolbarFilters !== false && !inGear) items.push({ id: "filters", tip: "Filtros de imagem", icon: "filters", priority: "mid" });
    if (config.toolbarScreenshot !== false) items.push({ id: "screenshot", tip: "Salvar frame (PNG)", icon: "camera", priority: "low" });
    if (config.toolbarVolumeBoost !== false) items.push({ id: "boost", tip: "Volume boost", icon: "boost", priority: "low" });
    if (config.toolbarPopup !== false && config.playerPopupEnabled !== false) items.push({ id: "popup", tip: "Abrir em janela", icon: "popup", priority: "low" });
    if (config.toolbarPip !== false && document.pictureInPictureEnabled) items.push({ id: "pip", tip: "Picture-in-picture", icon: "pip", priority: "mid" });
    return items;
  }

  function getPlayerControlsStyle(): "pill" | "divider" {
    return config.playerControlsStyle === "divider" ? "divider" : "pill";
  }

  function getPlayerControlsSignature() {
    return getPlayerControlsStyle() + ":" + getPlayerControlItems().map((item) => item.id).join(",");
  }

  // Hide our lower-priority buttons (then the end-time clock) only while the
  // left side of YouTube's bar (play, volume, time) would be squeezed.
  // Order in which our buttons give up their place when space is short.
  const FIT_HIDE_ORDER = ["popup", "screenshot", "boost", "pip", "loop", "filters"];

  function fitPlayerControls(player: HTMLElement) {
    const controls = document.getElementById(PLAYER_CONTROLS_ID);
    const left = player.querySelector(".ytp-left-controls") as HTMLElement | null;
    const time = player.querySelector(".ytp-time-display") as HTMLElement | null;
    if (!controls) return;
    const overflowing = () => (!!left && left.scrollWidth > left.clientWidth + 1) || (!!time && time.scrollWidth > time.clientWidth + 1);

    controls.querySelectorAll<HTMLElement>("[data-fit-hidden]").forEach((button) => button.removeAttribute("data-fit-hidden"));
    player.classList.remove("yte-no-endtime");
    if (!overflowing()) return;

    for (const action of FIT_HIDE_ORDER) {
      const button = controls.querySelector<HTMLElement>(`[data-yte-action="${action}"]`);
      if (!button) continue;
      button.setAttribute("data-fit-hidden", "");
      if (!overflowing()) return;
    }
    player.classList.add("yte-no-endtime");
  }

  // Copy the look of YouTube's own control group so our pill always matches.
  function syncPillStyle(controls: HTMLElement, rightControls: HTMLElement) {
    if (getPlayerControlsStyle() !== "pill") return;
    const style = getComputedStyle(rightControls);
    const bg = style.backgroundColor;
    const transparent = !bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)";
    const height = Math.round(rightControls.getBoundingClientRect().height);
    const values: Record<string, string> = {
      "--yte-pill-bg": transparent ? "rgba(0, 0, 0, 0.3)" : bg,
      "--yte-pill-radius": style.borderRadius && style.borderRadius !== "0px" ? style.borderRadius : "28px",
      "--yte-pill-h": height > 20 && height < 80 ? height + "px" : "40px",
    };
    for (const [name, value] of Object.entries(values)) {
      if (controls.style.getPropertyValue(name) !== value) controls.style.setProperty(name, value);
    }
  }

  function shouldShowPlayerControls() {
    return !!config.enabled && config.playerControlsEnabled !== false && (isWatchPage() || /^\/embed\//.test(location.pathname));
  }

  function removePlayerControls() {
    getYouTubePlayer()?.classList.remove("yte-filter-panel-open");
    document.getElementById(PLAYER_CONTROLS_ID)?.remove();
    document.getElementById(FILTER_PANEL_ID)?.remove();
    document.getElementById(END_TIME_ID)?.remove();
  }

  function stopPlayerEvent(event: Event) {
    event.stopPropagation();
  }

  function updatePlayerControls() {
    bindGearMenu();
    if (!shouldShowPlayerControls()) {
      removePlayerControls();
      return;
    }

    const player = getYouTubePlayer();
    const rightControls = player?.querySelector(".ytp-right-controls") as HTMLElement | null;
    if (!player || !rightControls) return;
    ensurePlayerUiStyle();


    let controls = document.getElementById(PLAYER_CONTROLS_ID);
    const signature = getPlayerControlsSignature();
    const style = getPlayerControlsStyle();
    // Pill: a sibling group right before YouTube's; divider: inside it.
    const expectedParent = style === "pill" ? rightControls.parentElement : rightControls;
    if (!expectedParent) return;
    if (controls && (controls.parentElement !== expectedParent || controls.dataset.signature !== signature)) {
      controls.remove();
      controls = null;
    }

    if (!controls) {
      controls = document.createElement("span");
      controls.id = PLAYER_CONTROLS_ID;
      controls.className = "yte-style-" + style;
      controls.dataset.signature = signature;
      for (const item of getPlayerControlItems()) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ytp-button yte-btn " + (item.className || "");
        button.dataset.yteAction = item.id;
        button.dataset.priority = item.priority;
        button.dataset.tip = item.tip;
        button.setAttribute("aria-label", item.tip.split(" · ")[0]);
        if (item.icon) button.innerHTML = playerIcon(item.icon);
        if (item.text) button.textContent = item.text;
        controls.appendChild(button);
      }

      controls.addEventListener("click", (event) => {
        const button = (event.target as Element).closest?.("[data-yte-action]") as HTMLElement | null;
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        handlePlayerControlAction(button.dataset.yteAction || "", event as MouseEvent);
      });
      controls.addEventListener("contextmenu", (event) => {
        const button = (event.target as Element).closest?.('[data-yte-action="speed"]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        markUserPlaybackIntent("player-controls");
        resetToolbarSpeed(getActiveVideo());
        refreshPlayerControlStates();
      });
      controls.addEventListener("wheel", (event) => {
        const button = (event.target as Element).closest?.('[data-yte-action="speed"]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        adjustToolbarSpeed(getWheelDirection(event), getActiveVideo());
        refreshPlayerControlStates();
      }, { passive: false });

      if (style === "pill") expectedParent.insertBefore(controls, rightControls);
      else rightControls.insertBefore(controls, rightControls.firstChild);
    }

    syncPillStyle(controls, rightControls);
    fitPlayerControls(player);

    ensureEndTimeLabel(player);
    bindPlayerControlsVideo();
    bindGearMenu();
    refreshPlayerControlStates();
  }

  function bindPlayerControlsVideo() {
    const video = getActiveVideo();
    if (!video || playerControlsVideo === video) return;
    if (playerControlsVideo) playerControlsVideo.removeEventListener("ratechange", refreshPlayerControlStates);
    playerControlsVideo = video;
    video.addEventListener("ratechange", refreshPlayerControlStates);
  }

  function refreshPlayerControlStates() {
    const controls = document.getElementById(PLAYER_CONTROLS_ID);
    if (!controls) return;
    const video = getActiveVideo();
    const key = getCurrentVideoKey();
    const set = (id: string, active: boolean) => controls.querySelector(`[data-yte-action="${id}"]`)?.classList.toggle("is-active", active);

    const speed = controls.querySelector('[data-yte-action="speed"]') as HTMLElement | null;
    if (speed && video) {
      const label = formatPlaybackRate(video.playbackRate);
      if (speed.textContent !== label) speed.textContent = label;
      speed.classList.toggle("is-active", Math.abs(video.playbackRate - 1) > 0.001 && !adState.liveRateApplied);
    }
    set("loop", !!video?.loop || (adState.loopEnabled && adState.loopVideoKey === key));
    set("filters", shouldUseVideoFilters());
    set("boost", shouldUseVolumeBoost());
    set("pip", !!document.pictureInPictureElement);

  }

  function handlePlayerControlAction(action: string, event: MouseEvent) {
    const video = getActiveVideo();
    markUserPlaybackIntent("player-controls");
    switch (action) {
      case "speed": {
        if (!video) break;
        if (event.shiftKey) {
          resetToolbarSpeed(video);
          break;
        }
        const current = video.playbackRate;
        const next = SPEED_CYCLE.find((rate) => rate > current + 0.001) ?? SPEED_CYCLE[0];
        setUserPlaybackRate(next, video);
        showPlayerFeedback("speed", formatPlaybackRate(next), "Role para ajuste fino");
        break;
      }
      case "loop":
        handlePlayerToolbarAction("loop");
        break;
      case "filters":
        toggleFilterPanel();
        break;
      case "screenshot":
        captureVideoFrame(video);
        break;
      case "boost":
        setVolumeBoostEnabled(!config.volumeBoostEnabled, video);
        break;
      case "popup":
        // Leave fullscreen first, otherwise the tab stays fullscreen on a paused video.
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {}).finally(() => window.setTimeout(openPopupPlayer, 150));
        } else {
          openPopupPlayer();
        }
        break;
      case "pip":
        togglePictureInPicture(video).then(refreshPlayerControlStates);
        break;
    }
    refreshPlayerControlStates();
  }

  // ── "Termina às" ao lado do tempo do vídeo ──

  function ensureEndTimeLabel(player: HTMLElement) {
    if (config.playerEndTimeEnabled !== true) {
      document.getElementById(END_TIME_ID)?.remove();
      return;
    }
    // Inside the time "pill" (.ytp-time-contents) on the current layout.
    const display = (player.querySelector(".ytp-time-display .ytp-time-contents")
      || player.querySelector(".ytp-time-display")) as HTMLElement | null;
    if (!display) return;
    let label = document.getElementById(END_TIME_ID);
    if (label && label.parentElement !== display) {
      label.remove();
      label = null;
    }
    if (!label) {
      label = document.createElement("span");
      label.id = END_TIME_ID;
      display.appendChild(label);
    }
    updateEndTimeLabel();
  }

  function updateEndTimeLabel() {
    const label = document.getElementById(END_TIME_ID);
    if (!label) return;
    const video = getActiveVideo();
    const duration = Number(video?.duration);
    if (!video || !Number.isFinite(duration) || duration <= 0 || isLiveStream() || getAdPlaying()) {
      if (label.textContent) label.textContent = "";
      return;
    }
    const rate = video.playbackRate > 0 ? video.playbackRate : 1;
    const remaining = Math.max(0, (duration - video.currentTime) / rate);
    const end = new Date(Date.now() + remaining * 1000);
    const text = "· termina " + end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (label.textContent !== text) label.textContent = text;
  }

  // ── Painel de filtros dentro do player ──
  // Built from YouTube's own menu markup (ytp-popup > ytp-panel > ytp-menuitem)
  // so it inherits the native look: translucent background, rows, toggles and
  // the sub-menu header. Only sizing/positioning is ours, like YouTube's JS.

  const FILTER_ROW_ICONS: Record<string, string> = {
    toggle: "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
    presets: "M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z",
    brightness: "M20 15.31 23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18V6c3.31 0 6 2.69 6 6s-2.69 6-6 6z",
    contrast: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86z",
    saturate: "M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
    hue: "M17.66 7.93 12 2.27 6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31A7.98 7.98 0 0 0 12 21.58c2.05 0 4.1-.78 5.66-2.34 3.12-3.12 3.12-8.19 0-11.31zM12 19.59c-1.6 0-3.11-.62-4.24-1.76A5.95 5.95 0 0 1 6 13.59c0-1.6.62-3.11 1.76-4.24L12 5.1v14.49z",
    sepia: "M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7 1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91 1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z",
    grayscale: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16-7-8v8H5l7-8V5h7v14z",
    live: "M7.76 16.24A5.98 5.98 0 0 1 6 12c0-1.66.67-3.16 1.76-4.24l1.42 1.42A3.99 3.99 0 0 0 8 12c0 1.1.45 2.1 1.17 2.83l-1.41 1.41zm8.48 0A5.98 5.98 0 0 0 18 12c0-1.66-.67-3.16-1.76-4.24l-1.42 1.42A3.99 3.99 0 0 1 16 12c0 1.1-.45 2.1-1.17 2.83l1.41 1.41zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 2c0 2.21-.9 4.21-2.35 5.65l1.42 1.42A9.97 9.97 0 0 0 22 12c0-2.76-1.12-5.26-2.93-7.07l-1.42 1.42A7.95 7.95 0 0 1 20 12zM6.35 6.35 4.93 4.93A9.97 9.97 0 0 0 2 12c0 2.76 1.12 5.26 2.93 7.07l1.42-1.42A7.95 7.95 0 0 1 4 12c0-2.21.9-4.21 2.35-5.65z",
    speed: "M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z",
    jump: "M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z",
    reset: "M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm-6 8c0-1.65.67-3.15 1.76-4.24L6.34 7.34A7.95 7.95 0 0 0 4 13c0 4.08 3.05 7.44 7 7.93v-2.02c-2.83-.48-5-2.94-5-5.91z",
  };

  function getVideoFilterValues() {
    return normalizeVideoFilters({
      brightness: config.videoFilterBrightness,
      contrast: config.videoFilterContrast,
      saturate: config.videoFilterSaturate,
      grayscale: config.videoFilterGrayscale,
      sepia: config.videoFilterSepia,
      hue: config.videoFilterHue,
    });
  }

  function setVideoFilterValues(values: VideoFilterValues, enable = true) {
    config.videoFilterBrightness = values.brightness;
    config.videoFilterContrast = values.contrast;
    config.videoFilterSaturate = values.saturate;
    config.videoFilterGrayscale = values.grayscale;
    config.videoFilterSepia = values.sepia;
    config.videoFilterHue = values.hue;
    if (enable) config.videoFiltersEnabled = true;
    applyVideoFilters();
    syncFilterPanel();
    if (filterSaveTimer) window.clearTimeout(filterSaveTimer);
    filterSaveTimer = window.setTimeout(() => {
      filterSaveTimer = null;
      try {
        chrome.storage.local.set({
          videoFiltersEnabled: !!config.videoFiltersEnabled,
          videoFilterBrightness: values.brightness,
          videoFilterContrast: values.contrast,
          videoFilterSaturate: values.saturate,
          videoFilterGrayscale: values.grayscale,
          videoFilterSepia: values.sepia,
          videoFilterHue: values.hue,
        });
      } catch (err) {}
    }, 250);
  }

  let filterPanelView: "main" | "presets" = "main";

  function menuIcon(name: string) {
    return '<svg height="24" viewBox="0 0 24 24" width="24" aria-hidden="true"><path fill="#fff" d="' + (FILTER_ROW_ICONS[name] || "") + '"/></svg>';
  }

  function createMenuItem(options: { role: string; icon?: string; label: string; content?: HTMLElement | string; checked?: boolean; submenu?: boolean }) {
    const item = document.createElement("div");
    item.className = "ytp-menuitem";
    item.setAttribute("role", options.role);
    item.tabIndex = 0;
    if (options.submenu) item.setAttribute("aria-haspopup", "true");
    if (typeof options.checked === "boolean") item.setAttribute("aria-checked", String(options.checked));
    const icon = document.createElement("div");
    icon.className = "ytp-menuitem-icon";
    if (options.icon) icon.innerHTML = menuIcon(options.icon);
    const label = document.createElement("div");
    label.className = "ytp-menuitem-label";
    label.textContent = options.label;
    const content = document.createElement("div");
    content.className = "ytp-menuitem-content";
    if (typeof options.content === "string") content.textContent = options.content;
    else if (options.content) content.appendChild(options.content);
    item.append(icon, label, content);
    return item;
  }

  function onMenuActivate(item: HTMLElement, handler: () => void) {
    item.addEventListener("click", handler);
    item.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        handler();
      }
    });
  }

  interface FilterHost {
    render(direction: "forward" | "back" | "none"): void;
    back(): void;
  }

  // Standalone popup (bar button / shortcut).
  function renderFilterPanel(panel: HTMLElement, direction: "forward" | "back" | "none" = "none") {
    const host: FilterHost = {
      render: (dir) => renderFilterPanel(panel, dir),
      back: () => {
        closeFilterPanel();
        const gear = getYouTubePlayer()?.querySelector(".ytp-settings-button") as HTMLElement | null;
        window.setTimeout(() => gear?.click(), 0);
      },
    };
    const panelEl = buildFilterPanelEl(host);
    const before = panel.getBoundingClientRect();
    (panel.querySelector(".ytp-popup-content") as HTMLElement).replaceChildren(panelEl);
    sizeFilterPanel(panel);
    if (direction !== "none" && before.height > 0) {
      const after = panel.getBoundingClientRect();
      panel.animate(
        [{ width: before.width + "px", height: before.height + "px" }, { width: after.width + "px", height: after.height + "px" }],
        { duration: SUBMENU_ANIM_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
      slidePanels(null, panelEl, direction);
    }
  }

  function buildFilterPanelEl(host: FilterHost) {
    const values = getVideoFilterValues();
    const presetId = findPresetId(values);
    const panelEl = document.createElement("div");
    panelEl.className = "ytp-panel";
    const menu = document.createElement("div");
    menu.className = "ytp-panel-menu";
    menu.setAttribute("role", "menu");

    if (filterPanelView === "presets") {
      const header = document.createElement("div");
      header.className = "ytp-panel-header";
      const back = document.createElement("button");
      back.className = "ytp-button ytp-panel-back-button";
      back.setAttribute("aria-label", "Voltar");
      back.addEventListener("click", () => {
        filterPanelView = "main";
        host.render("back");
      });
      const title = document.createElement("span");
      title.className = "ytp-panel-title";
      title.textContent = "Predefinição";
      header.append(back, title);
      panelEl.appendChild(header);

      for (const preset of VIDEO_FILTER_PRESETS) {
        const item = createMenuItem({ role: "menuitemradio", label: preset.label, checked: preset.id === presetId });
        onMenuActivate(item, () => {
          setVideoFilterValues({ ...preset.values }, preset.id !== "normal" || !!config.videoFiltersEnabled);
          filterPanelView = "main";
          host.render("back");
        });
        menu.appendChild(item);
      }
    } else {
      // Same header as YouTube's sub-menus: "<  Filtros de imagem" goes back
      // to the settings (gear) menu this panel was opened from.
      const header = document.createElement("div");
      header.className = "ytp-panel-header";
      const back = document.createElement("button");
      back.className = "ytp-button ytp-panel-back-button";
      back.setAttribute("aria-label", "Voltar ao menu anterior");
      back.addEventListener("click", () => host.back());
      const title = document.createElement("span");
      title.className = "ytp-panel-title";
      title.textContent = "Filtros de imagem";
      header.append(back, title);
      panelEl.appendChild(header);

      const toggle = createMenuItem({ role: "menuitemcheckbox", icon: "toggle", label: "Ativar filtros", checked: !!config.videoFiltersEnabled });
      const toggleBox = document.createElement("div");
      toggleBox.className = "ytp-menuitem-toggle-checkbox";
      toggle.querySelector(".ytp-menuitem-content")!.appendChild(toggleBox);
      toggle.dataset.yteToggle = "1";
      onMenuActivate(toggle, () => {
        config.videoFiltersEnabled = !config.videoFiltersEnabled;
        setVideoFilterValues(getVideoFilterValues(), false);
      });
      menu.appendChild(toggle);

      const presetLabel = VIDEO_FILTER_PRESETS.find((preset) => preset.id === presetId)?.label || "Personalizado";
      const presets = createMenuItem({ role: "menuitem", icon: "presets", label: "Predefinição", content: presetLabel, submenu: true });
      onMenuActivate(presets, () => {
        filterPanelView = "presets";
        host.render("forward");
      });
      menu.appendChild(presets);

      for (const key of Object.keys(VIDEO_FILTER_LIMITS) as Array<keyof VideoFilterValues>) {
        const limits = VIDEO_FILTER_LIMITS[key];
        const wrap = document.createElement("span");
        wrap.className = "yte-menu-slider";
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(limits.min);
        input.max = String(limits.max);
        input.step = String(limits.step);
        input.value = String(values[key]);
        input.dataset.filter = key;
        input.setAttribute("aria-label", limits.label);
        const output = document.createElement("output");
        output.textContent = values[key] + limits.unit;
        wrap.append(input, output);
        input.addEventListener("input", () => {
          const next = getVideoFilterValues();
          next[key] = Number(input.value);
          setVideoFilterValues(normalizeVideoFilters(next));
        });
        input.addEventListener("dblclick", () => {
          const next = getVideoFilterValues();
          next[key] = VIDEO_FILTER_DEFAULTS[key];
          setVideoFilterValues(next);
        });
        const item = createMenuItem({ role: "menuitem", icon: key, label: limits.label, content: wrap });
        item.classList.add("yte-menuitem--slider");
        menu.appendChild(item);
      }

      const reset = createMenuItem({ role: "menuitem", icon: "reset", label: "Restaurar padrão" });
      onMenuActivate(reset, () => setVideoFilterValues({ ...VIDEO_FILTER_DEFAULTS }, false));
      menu.appendChild(reset);
    }

    panelEl.appendChild(menu);
    return panelEl;
  }

  // Lowest free line above the control bar. In fullscreen YouTube shows
  // overlays above the bar (like/dislike/share quick actions, info cards);
  // the panel must open above those, never on top of them.
  const PANEL_AVOID_SELECTORS = [".ytp-fullscreen-quick-actions", ".ytp-overlay-bottom-right"];

  function getPanelBottomOffset(player: HTMLElement, panelWidth: number) {
    const playerRect = player.getBoundingClientRect();
    const bar = player.querySelector(".ytp-chrome-bottom") as HTMLElement | null;
    let limit = bar ? bar.getBoundingClientRect().top : playerRect.bottom - 62;
    for (const selector of PANEL_AVOID_SELECTORS) {
      player.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.height <= 0 || rect.width <= 0 || rect.top >= limit) return;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return;
        // Only matters if it sits under the panel (right side of the player).
        if (rect.right < playerRect.right - panelWidth - 12) return;
        limit = Math.min(limit, rect.top);
      });
    }
    return { bottom: Math.max(62, Math.round(playerRect.bottom - limit + 10)), available: limit - playerRect.top - 20 };
  }

  // YouTube sizes its popups from JS; do the same so the panel hugs its rows.
  function sizeFilterPanel(panel: HTMLElement) {
    const player = getYouTubePlayer();
    const panelEl = panel.querySelector(".ytp-panel") as HTMLElement | null;
    if (!player || !panelEl) return;
    const width = Math.min(360, Math.max(260, player.clientWidth - 24));
    const offset = getPanelBottomOffset(player, width);
    panel.style.bottom = offset.bottom + "px";
    panel.style.width = width + "px";
    panelEl.style.width = width + "px";
    panel.style.height = "auto";
    panelEl.style.height = "auto";
    panelEl.style.position = "static";
    const natural = panelEl.scrollHeight;
    const maxHeight = Math.max(160, Math.min(player.clientHeight - 84, offset.available));
    const height = Math.min(natural, maxHeight);
    panelEl.style.position = "";
    panel.style.height = height + "px";
    panelEl.style.height = height + "px";
  }

  function buildFilterPanel() {
    const panel = document.createElement("div");
    panel.id = FILTER_PANEL_ID;
    panel.className = "ytp-popup yte-filter-scope";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Filtros de imagem");
    const content = document.createElement("div");
    content.className = "ytp-popup-content";
    panel.appendChild(content);

    // Keep clicks, keys and wheel inside the panel away from the player
    // (otherwise a click toggles play and arrow keys seek the video).
    for (const type of ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "wheel", "contextmenu"]) {
      panel.addEventListener(type, stopPlayerEvent);
    }
    panel.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key !== "Escape") return;
      if (filterPanelView === "presets") {
        filterPanelView = "main";
        renderFilterPanel(panel);
      } else {
        closeFilterPanel();
      }
    });
    return panel;
  }

  // ── Filtros como submenu da engrenagem ──
  // Opened from the gear menu, the filter panel lives INSIDE YouTube's
  // settings popup like its own sub-menus: the popup resizes from the gear
  // size to the filter size while the panels slide, and "back" reverses it.
  const SUBMENU_ANIM_MS = 250;
  let gearSubmenu: { menu: HTMLElement; ytPanel: HTMLElement; ours: HTMLElement | null; size: { w: number; h: number } } | null = null;

  function measurePanel(panelEl: HTMLElement, width: number, container: HTMLElement) {
    panelEl.style.position = "absolute";
    panelEl.style.visibility = "hidden";
    panelEl.style.width = width + "px";
    panelEl.style.height = "auto";
    container.appendChild(panelEl);
    const height = panelEl.scrollHeight;
    panelEl.remove();
    panelEl.style.visibility = "";
    return height;
  }

  function slidePanels(outgoing: HTMLElement | null, incoming: HTMLElement, direction: "forward" | "back" | "none") {
    if (direction === "none") return;
    const sign = direction === "forward" ? 1 : -1;
    const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
    incoming.animate(
      [{ transform: `translateX(${sign * 40}%)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
      { duration: SUBMENU_ANIM_MS, easing },
    );
    if (outgoing) {
      outgoing.animate(
        [{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-sign * 40}%)`, opacity: 0 }],
        { duration: SUBMENU_ANIM_MS, easing, fill: "forwards" },
      );
    }
  }

  function resizeYouTubeMenu(menu: HTMLElement, panelEl: HTMLElement, width: number, height: number) {
    const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
    menu.style.transition = `width ${SUBMENU_ANIM_MS}ms ${easing}, height ${SUBMENU_ANIM_MS}ms ${easing}`;
    menu.style.width = width + "px";
    menu.style.height = height + "px";
    panelEl.style.width = width + "px";
    panelEl.style.height = height + "px";
    window.setTimeout(() => { menu.style.transition = ""; }, SUBMENU_ANIM_MS + 30);
  }

  function renderGearFilterSubmenu(direction: "forward" | "back" | "none") {
    const state = gearSubmenu;
    const player = getYouTubePlayer();
    if (!state || !player) return;
    const content = state.menu.querySelector(".ytp-popup-content") as HTMLElement | null;
    if (!content) return;

    const host: FilterHost = { render: renderGearFilterSubmenu, back: closeGearFilterSubmenu };
    const panelEl = buildFilterPanelEl(host);
    panelEl.classList.add("yte-gear-subpanel", "yte-filter-scope");
    const width = Math.min(380, Math.max(300, player.clientWidth - 24));
    const maxHeight = Math.max(200, player.clientHeight - 80);
    const height = Math.min(maxHeight, measurePanel(panelEl, width, content));

    const previous = state.ours || state.ytPanel;
    panelEl.style.position = "absolute";
    panelEl.style.bottom = "0";
    panelEl.style.right = "0";
    panelEl.style.overflowY = "auto";
    content.appendChild(panelEl);
    resizeYouTubeMenu(state.menu, panelEl, width, height);
    slidePanels(previous, panelEl, direction);

    const hideOld = () => {
      if (previous === state.ytPanel) previous.style.display = "none";
      else previous.remove();
    };
    if (direction === "none") hideOld();
    else window.setTimeout(hideOld, SUBMENU_ANIM_MS);
    state.ours = panelEl;
  }

  function openGearFilterSubmenu() {
    const player = getYouTubePlayer();
    const menu = player?.querySelector(".ytp-settings-menu") as HTMLElement | null;
    const ytPanel = menu?.querySelector(".ytp-popup-content > .ytp-panel") as HTMLElement | null;
    if (!menu || !ytPanel) {
      toggleFilterPanel();
      return;
    }
    const rect = menu.getBoundingClientRect();
    gearSubmenu = { menu, ytPanel, ours: null, size: { w: rect.width, h: rect.height } };
    filterPanelView = "main";
    renderGearFilterSubmenu("forward");
    watchGearMenuClose(menu);
  }

  function closeGearFilterSubmenu() {
    const state = gearSubmenu;
    if (!state) return;
    gearSubmenu = null;
    const ours = state.ours;
    state.ytPanel.style.display = "";
    resizeYouTubeMenu(state.menu, state.ytPanel, state.size.w, state.size.h);
    if (ours) {
      slidePanels(ours, state.ytPanel, "back");
      window.setTimeout(() => ours.remove(), SUBMENU_ANIM_MS);
    }
  }

  // YouTube hides the popup (click outside, Esc): drop our sub-menu so the
  // next open starts on YouTube's own main panel.
  function watchGearMenuClose(menu: HTMLElement) {
    const observer = new MutationObserver(() => {
      if (menu.style.display !== "none" && menu.getAttribute("aria-hidden") !== "true") return;
      observer.disconnect();
      const state = gearSubmenu;
      if (!state) return;
      gearSubmenu = null;
      state.ours?.remove();
      state.ytPanel.style.display = "";
    });
    observer.observe(menu, { attributes: true, attributeFilter: ["style", "aria-hidden"] });
  }

  function syncFilterPanel() {
    if (filterPanelView !== "main") return;
    if (gearSubmenu?.ours) syncFilterValues(gearSubmenu.ours);
    const panel = document.getElementById(FILTER_PANEL_ID);
    if (panel && !panel.hidden) syncFilterValues(panel);
  }

  function syncFilterValues(panel: HTMLElement) {
    const values = getVideoFilterValues();
    panel.querySelector("[data-yte-toggle]")?.setAttribute("aria-checked", String(!!config.videoFiltersEnabled));
    const presetId = findPresetId(values);
    const presetRow = panel.querySelector('[aria-haspopup="true"] .ytp-menuitem-content');
    if (presetRow) presetRow.textContent = VIDEO_FILTER_PRESETS.find((preset) => preset.id === presetId)?.label || "Personalizado";
    panel.querySelectorAll<HTMLInputElement>("input[data-filter]").forEach((input) => {
      const key = input.dataset.filter as keyof VideoFilterValues;
      if (document.activeElement !== input) input.value = String(values[key]);
      const output = input.parentElement?.querySelector("output");
      if (output) output.textContent = values[key] + VIDEO_FILTER_LIMITS[key].unit;
    });
  }

  function closeFilterPanel() {
    const panel = document.getElementById(FILTER_PANEL_ID);
    if (panel) panel.hidden = true;
    getYouTubePlayer()?.classList.remove("yte-filter-panel-open");
    document.removeEventListener("pointerdown", handleOutsideFilterPanel, true);
  }

  function handleOutsideFilterPanel(event: Event) {
    const target = event.target as Element;
    if (target?.closest?.("#" + FILTER_PANEL_ID) || target?.closest?.('[data-yte-action="filters"]')) return;
    closeFilterPanel();
  }

  function toggleFilterPanel() {
    const player = getYouTubePlayer();
    if (!player) return;
    let panel = document.getElementById(FILTER_PANEL_ID);
    if (!panel || panel.parentElement !== player) {
      panel?.remove();
      panel = buildFilterPanel();
      player.appendChild(panel);
    }
    if (!panel.hidden) {
      closeFilterPanel();
      return;
    }
    filterPanelView = "main";
    player.classList.add("yte-filter-panel-open");
    panel.hidden = false;
    renderFilterPanel(panel);
    document.addEventListener("pointerdown", handleOutsideFilterPanel, true);
  }

  // Re-place an open panel when the player changes size (fullscreen, theater).
  const resizeOpenFilterPanel = () => {
    const panel = document.getElementById(FILTER_PANEL_ID);
    if (panel && !panel.hidden) window.setTimeout(() => sizeFilterPanel(panel), 250);
  };
  document.addEventListener("fullscreenchange", resizeOpenFilterPanel);
  window.addEventListener("resize", resizeOpenFilterPanel);

  // ── Itens no menu de configurações (engrenagem) do YouTube ──
  // Our rows are added to YouTube's own settings menu, using its markup, each
  // time its main panel is (re)built. YouTube sizes the popup from JS, so we
  // grow its inline heights by the rows we add, like it does itself.

  const GEAR_ITEM_ATTR = "data-yte-gear";
  const GEAR_ICONS: Record<string, string> = {
    filters: FILTER_ROW_ICONS.toggle,
    loop: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
    boost: "M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z",
    live: "M7.76 16.24A5.98 5.98 0 0 1 6 12c0-1.66.67-3.16 1.76-4.24l1.42 1.42A3.99 3.99 0 0 0 8 12c0 1.1.45 2.1 1.17 2.83l-1.41 1.41zm8.48 0A5.98 5.98 0 0 0 18 12c0-1.66-.67-3.16-1.76-4.24l-1.42 1.42A3.99 3.99 0 0 1 16 12c0 1.1-.45 2.1-1.17 2.83l1.41 1.41zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 2c0 2.21-.9 4.21-2.35 5.65l1.42 1.42A9.97 9.97 0 0 0 22 12c0-2.76-1.12-5.26-2.93-7.07l-1.42 1.42A7.95 7.95 0 0 1 20 12zM6.35 6.35 4.93 4.93A9.97 9.97 0 0 0 2 12c0 2.76 1.12 5.26 2.93 7.07l1.42-1.42A7.95 7.95 0 0 1 4 12c0-2.21.9-4.21 2.35-5.65z",
  };
  let gearObserver: MutationObserver | null = null;
  let gearObservedMenu: HTMLElement | null = null;

  function gearIcon(name: string) {
    return '<svg height="24" viewBox="0 0 24 24" width="24" aria-hidden="true"><path fill="#fff" d="' + (GEAR_ICONS[name] || "") + '"/></svg>';
  }

  function shouldAddGearItems() {
    return !!config.enabled && config.settingsMenuItemsEnabled !== false && (isWatchPage() || /^\/embed\//.test(location.pathname));
  }

  function getGearItems() {
    const key = getCurrentVideoKey();
    const video = getActiveVideo();
    // Toggles first (they join YouTube's toggles), then our sub-menu; all are
    // inserted right before YouTube's first sub-menu (Legendas, Velocidade…).
    const items: Array<{ id: string; label: string; checked?: boolean; value?: string }> = [
      { id: "loop", label: "Repetir vídeo", checked: !!video?.loop || (adState.loopEnabled && adState.loopVideoKey === key) },
    ];
    items.push({ id: "filters", label: "Filtros de imagem", value: shouldUseVideoFilters() ? "Ativados" : "Desativados" });
    return items;
  }

  function closeYouTubeSettingsMenu() {
    const button = getYouTubePlayer()?.querySelector(".ytp-settings-button") as HTMLElement | null;
    if (button?.getAttribute("aria-expanded") === "true") button.click();
  }

  function handleGearItem(id: string) {
    markUserPlaybackIntent("settings-menu");
    switch (id) {
      case "filters":
        openGearFilterSubmenu();
        return;
      case "loop":
        handlePlayerToolbarAction("loop");
        break;
      case "boost":
        setVolumeBoostEnabled(!config.volumeBoostEnabled, getActiveVideo());
        break;
    }
    refreshGearItems();
    refreshPlayerControlStates();
  }

  function refreshGearItems() {
    const states = new Map(getGearItems().map((item) => [item.id, item]));
    document.querySelectorAll<HTMLElement>(`[${GEAR_ITEM_ATTR}]`).forEach((row) => {
      const item = states.get(row.getAttribute(GEAR_ITEM_ATTR) || "");
      if (!item) return;
      if (typeof item.checked === "boolean") row.setAttribute("aria-checked", String(item.checked));
      if (item.value) {
        const content = row.querySelector(".ytp-menuitem-content");
        if (content && content.textContent !== item.value) content.textContent = item.value;
      }
    });
  }

  function buildGearRow(item: { id: string; label: string; checked?: boolean; value?: string }) {
    const row = document.createElement("div");
    row.className = "ytp-menuitem";
    row.setAttribute(GEAR_ITEM_ATTR, item.id);
    row.tabIndex = 0;
    if (typeof item.checked === "boolean") {
      row.setAttribute("role", "menuitemcheckbox");
      row.setAttribute("aria-checked", String(item.checked));
    } else {
      row.setAttribute("role", "menuitem");
      row.setAttribute("aria-haspopup", "true");
    }
    row.innerHTML =
      '<div class="ytp-menuitem-icon">' + gearIcon(item.id) + "</div>" +
      '<div class="ytp-menuitem-label"></div>' +
      '<div class="ytp-menuitem-content"></div>';
    row.querySelector(".ytp-menuitem-label")!.textContent = item.label;
    const content = row.querySelector(".ytp-menuitem-content")!;
    if (typeof item.checked === "boolean") {
      const toggle = document.createElement("div");
      toggle.className = "ytp-menuitem-toggle-checkbox";
      content.appendChild(toggle);
    } else {
      content.textContent = item.value || "";
    }
    const activate = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      handleGearItem(item.id);
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " ") activate(event);
    });
    return row;
  }

  // Make YouTube's inline heights fit the rows actually in the list (ours
  // included). Runs on every rebuild: going back from a sub-menu makes
  // YouTube recompute heights without our rows.
  function fitGearMenu(player: HTMLElement, menu: HTMLElement, panel: HTMLElement, list: HTMLElement, animate = false) {
    const current = parseFloat(list.style.height);
    if (!Number.isFinite(current)) return;
    const listStyle = getComputedStyle(list);
    const padding = (parseFloat(listStyle.paddingTop) || 0) + (parseFloat(listStyle.paddingBottom) || 0);
    const rowsHeight = padding + Array.from(list.children).reduce((sum, row) => sum + (row as HTMLElement).getBoundingClientRect().height, 0);
    const max = Math.max(200, player.clientHeight - 80);
    const target = Math.min(max, Math.ceil(rowsHeight));
    // If YouTube measured before our rows existed (first open), grow with the
    // same easing as its own resizes instead of jumping.
    if (animate && Math.abs((parseFloat(menu.style.height) || 0) - target) >= 1) {
      const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
      for (const el of [menu, panel]) {
        el.style.transition = `height 200ms ${easing}`;
        window.setTimeout(() => { el.style.transition = ""; }, 230);
      }
    }
    // On the main panel YouTube keeps menu = panel = list height.
    for (const el of [list, panel, menu]) {
      const height = parseFloat(el.style.height);
      if (Number.isFinite(height) && Math.abs(height - target) >= 1) el.style.height = target + "px";
    }
  }

  function injectGearItems() {
    const player = getYouTubePlayer();
    const menu = player?.querySelector(".ytp-settings-menu") as HTMLElement | null;
    if (menu && config.enabled) syncSpeedPanel(menu);
    if (!player || !menu || !shouldAddGearItems()) return;
    // Rows are also added while the menu is closed, so YouTube already
    // measures them when it opens (no size jump in its open animation).
    const hidden = menu.style.display === "none" || getComputedStyle(menu).display === "none";

    // Main panel = the one without a sub-menu header.
    // While a sub-menu (Legendas, Qualidade, Timer…) is open, leave YouTube's
    // sizes alone: forcing the main list height there left a big empty gap.
    if (gearSubmenu || menu.querySelector(".ytp-panel .ytp-panel-header")) return;
    const panels = Array.from(menu.querySelectorAll<HTMLElement>(".ytp-panel"));
    const panel = panels[panels.length - 1];
    const list = panel?.querySelector(".ytp-panel-menu") as HTMLElement | null;
    if (!panel || !list) return;
    if (list.querySelector(`[${GEAR_ITEM_ATTR}]`)) {
      refreshGearItems();
      if (!hidden) fitGearMenu(player, menu, panel, list);
      return;
    }

    const rows = getGearItems().map(buildGearRow);
    // Right after YouTube's last toggle (e.g. "Iluminação cinematográfica"),
    // so ours continue that group instead of landing after the sub-menus.
    const toggles = Array.from(list.querySelectorAll<HTMLElement>(':scope > .ytp-menuitem[role="menuitemcheckbox"]'));
    const anchor = toggles.length ? toggles[toggles.length - 1].nextElementSibling : list.querySelector(':scope > .ytp-menuitem[aria-haspopup="true"]');
    for (const row of rows) list.insertBefore(row, anchor);

    if (!hidden) fitGearMenu(player, menu, panel, list, true);
  }

  // ── YouTube's speed panel up to 10x ──
  // YouTube's API stops at 2x without Premium. The panel's slider is
  // extended to 10x; above 2x we apply the rate ourselves and keep the
  // panel's numbers in sync with the real speed.
  const SPEED_PANEL_MAX = 10;
  const SPEED_PANEL_STEP_ABOVE_API = 0.25;

  function formatPanelRate(rate: number) {
    return rate.toFixed(2) + "x";
  }

  function syncSpeedPanel(menu: ParentNode = document) {
    const slider = menu.querySelector(".ytp-varispeed-input-slider") as HTMLInputElement | null;
    if (!slider) return;
    if (slider.max !== String(SPEED_PANEL_MAX)) {
      slider.max = String(SPEED_PANEL_MAX);
      slider.setAttribute("aria-valuemax", String(SPEED_PANEL_MAX));
    }
    const video = getActiveVideo();
    if (!video) return;
    const rate = video.playbackRate;
    const min = Number(slider.min) || 0.25;
    const percent = ((Math.min(SPEED_PANEL_MAX, rate) - min) / (SPEED_PANEL_MAX - min)) * 100;
    // YouTube computes the fill for a 0.25-2 range; recompute for 0.25-10.
    slider.style.setProperty("--yt-slider-shape-gradient-percent", percent + "%");
    if (rate > YOUTUBE_API_MAX_RATE + 0.001) {
      if (document.activeElement !== slider) slider.value = String(rate);
      slider.setAttribute("aria-valuenow", String(rate));
      const label = formatPanelRate(rate);
      menu.querySelectorAll(".ytp-variable-speed-panel-display span, .ytp-speedslider-text").forEach((el) => {
        if (el.textContent !== label) el.textContent = label;
      });
    }
  }

  function applyPanelRate(rate: number) {
    const target = Math.min(SPEED_PANEL_MAX, Math.max(0.25, Math.round(rate * 100) / 100));
    markUserPlaybackIntent("speed-panel");
    setUserPlaybackRate(target, getActiveVideo());
    syncSpeedPanel();
    refreshPlayerControlStates();
  }

  // Slider above 2x: handled by us before YouTube clamps it.
  document.addEventListener("input", (event) => {
    const slider = event.target as HTMLInputElement;
    if (!config.enabled || !slider?.classList?.contains("ytp-varispeed-input-slider")) return;
    const value = Number(slider.value);
    if (!(value > YOUTUBE_API_MAX_RATE)) return;
    event.stopImmediatePropagation();
    applyPanelRate(value);
  }, true);

  document.addEventListener("change", (event) => {
    const slider = event.target as HTMLInputElement;
    if (!config.enabled || !slider?.classList?.contains("ytp-varispeed-input-slider")) return;
    if (Number(slider.value) > YOUTUBE_API_MAX_RATE) event.stopImmediatePropagation();
  }, true);

  // − / + buttons: bigger steps above 2x, and "+" keeps going past 2x.
  document.addEventListener("click", (event) => {
    if (!config.enabled) return;
    const button = (event.target as Element)?.closest?.(".ytp-variable-speed-panel-increment-button") as HTMLElement | null;
    if (!button) return;
    const video = getActiveVideo();
    if (!video) return;
    const label = (button.getAttribute("aria-label") || "").toLowerCase();
    const up = label.includes("aument") || label.includes("increase") || button.textContent?.trim() === "+";
    const rate = video.playbackRate;
    if (up && rate >= YOUTUBE_API_MAX_RATE - 0.001) {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyPanelRate(rate + SPEED_PANEL_STEP_ABOVE_API);
    } else if (!up && rate > YOUTUBE_API_MAX_RATE + 0.001) {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyPanelRate(Math.max(YOUTUBE_API_MAX_RATE, rate - SPEED_PANEL_STEP_ABOVE_API));
    }
  }, true);

  // Microtask, not rAF: rows land before the browser paints the opening menu.
  let gearQueued = false;
  function scheduleGearInjection() {
    if (gearQueued) return;
    gearQueued = true;
    queueMicrotask(() => {
      gearQueued = false;
      injectGearItems();
    });
  }

  // Watch YouTube's settings menu: it is created lazily and its panels are
  // rebuilt when you enter/leave sub-menus.
  function bindGearMenu() {
    if (!shouldAddGearItems()) return;
    const menu = getYouTubePlayer()?.querySelector(".ytp-settings-menu") as HTMLElement | null;
    if (!menu || menu === gearObservedMenu) return;
    gearObserver?.disconnect();
    gearObservedMenu = menu;
    // Only react to YouTube rebuilding panels (childList). Reacting to its
    // style writes made us fight its resize animation: the menu height
    // flipped back and forth (the "blink" when toggling an option).
    gearObserver = new MutationObserver(scheduleGearInjection);
    gearObserver.observe(menu, { childList: true, subtree: true });
    // After YouTube re-measures (e.g. a toggle), fit once when it settles.
    menu.addEventListener("click", () => window.setTimeout(scheduleGearInjection, 260));
    scheduleGearInjection();
  }

  document.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target?.closest?.(".ytp-settings-button")) window.setTimeout(() => { bindGearMenu(); scheduleGearInjection(); }, 0);
  }, true);

  // YouTube's speed panel shows a Premium-only "3,0" chip. With the extension
  // it just works: we apply the rate ourselves instead of the upsell.
  document.addEventListener("click", (event) => {
    if (!config.enabled) return;
    const chip = (event.target as Element)?.closest?.(".ytp-variable-speed-panel-preset-button") as HTMLElement | null;
    if (!chip || !chip.querySelector(".ytp-variable-speed-panel-premium-upsell-icon")) return;
    const rate = Number.parseFloat((chip.textContent || "").replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    markUserPlaybackIntent("speed-panel");
    setUserPlaybackRate(rate, getActiveVideo());
    showPlayerFeedback("speed", formatPlaybackRate(rate));
    refreshPlayerControlStates();
    window.setTimeout(() => syncSpeedPanel(), 0);
    window.setTimeout(() => syncSpeedPanel(), 300);
  }, true);

  // ── Live: tirar o atraso ──
  // Stats (real latency to the live edge, buffer health) and rate changes go
  // through YouTube's player API in the page: modern lives ignore direct
  // video.playbackRate changes. A latency button sits right after YouTube's
  // own "AO VIVO" badge and opens a menu in YouTube's popup style.

  const LIVE_BUTTON_ID = "yte-live-latency";
  const LIVE_PANEL_ID = "yte-live-panel";
  let livePanelView: "main" | "mode" | "rate" = "main";

  function requestLiveStats() {
    postMainWorldMessage({ source: MAIN_LIVE_QUERY });
  }

  function getLiveStats() {
    const stats = adState.liveStats;
    if (!stats || Date.now() - stats.at > 3000) return null;
    return stats;
  }

  function setLiveRate(rate: number) {
    const video = getActiveVideo();
    if (video && Math.abs(video.playbackRate - rate) > 0.005) {
      try { video.playbackRate = rate; } catch (err) {}
    }
    requestMainWorldSpeedThrough(rate);
    adState.liveRateApplied = rate;
  }

  function restoreLiveRate() {
    if (!adState.liveRateApplied || adState.liveRateApplied === 1) return;
    const video = getActiveVideo();
    if (video && Math.abs(video.playbackRate - adState.liveRateApplied) < 0.02) setLiveRate(1);
    adState.liveRateApplied = 1;
    adState.liveEngaged = false;
  }

  function runLiveCatchUp() {
    const video = getActiveVideo();
    const key = getCurrentVideoKey();
    if (!video || !config.enabled || !isLiveStream() || adState.active || getAdPlaying()) {
      restoreLiveRate();
      return;
    }

    requestLiveStats();
    updateLiveButton();
    syncLivePanel();

    if (!config.liveCatchUpEnabled) {
      restoreLiveRate();
      return;
    }
    if (video.paused || adState.liveUserOverrideKey === key) return;

    const applied = adState.liveRateApplied || 1;
    // The user picked a speed themselves: stop managing this live.
    if (Math.abs(video.playbackRate - applied) > 0.02 && Math.abs(video.playbackRate - 1) > 0.02) {
      adState.liveUserOverrideKey = key;
      adState.liveRateApplied = 1;
      return;
    }

    const stats = getLiveStats();
    if (!stats || !stats.atLiveHead) {
      // DVR (watching behind on purpose) or no stats yet: stay at 1x.
      if (applied !== 1) setLiveRate(1);
      return;
    }

    const decision = decideLiveRate({
      latency: stats.latency,
      bufferHealth: stats.health,
      mode: normalizeLiveMode(config.liveCatchUpMode),
      maxRate: Number(config.liveCatchUpMaxRate) || 1.25,
      engaged: !!adState.liveEngaged,
      jumpEnabled: config.liveJumpEnabled !== false,
    });
    adState.liveEngaged = decision.engaged;

    if (decision.jumpToLive && Date.now() - (adState.liveLastJumpAt || 0) > 10000) {
      adState.liveLastJumpAt = Date.now();
      postMainWorldMessage({ source: MAIN_PLAYER_COMMAND, command: "seekToLiveHead" });
      recordPlaybackEvent("live-jump", "live-catch-up", Number(video.currentTime || 0));
    }
    if (Math.abs(decision.rate - applied) > 0.005) setLiveRate(decision.rate);
  }

  function jumpToLiveEdge() {
    if (!isLiveStream()) return;
    adState.liveUserOverrideKey = "";
    adState.liveLastJumpAt = Date.now();
    postMainWorldMessage({ source: MAIN_PLAYER_COMMAND, command: "seekToLiveHead" });
    showPlayerFeedback("speed", "Ao vivo", "Indo para o ponto mais recente");
  }

  function formatSeconds(value: number) {
    return Number.isFinite(value) ? value.toFixed(1).replace(".", ",") + " s" : "—";
  }

  // Button glued to YouTube's own "AO VIVO" badge.
  function updateLiveButton() {
    const player = getYouTubePlayer();
    const badge = player?.querySelector(".ytp-live-badge") as HTMLElement | null;
    let button = document.getElementById(LIVE_BUTTON_ID) as HTMLButtonElement | null;
    if (!player || !badge || !isLiveStream() || !config.enabled) {
      button?.remove();
      return;
    }
    if (!button || button.previousElementSibling !== badge) {
      button?.remove();
      button = document.createElement("button");
      button.id = LIVE_BUTTON_ID;
      button.type = "button";
      button.className = "ytp-button";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleLivePanel();
      });
      badge.insertAdjacentElement("afterend", button);
    }
    const stats = getLiveStats();
    const catching = (adState.liveRateApplied || 1) > 1.005;
    const text = stats && stats.atLiveHead ? formatSeconds(stats.latency) : stats ? "DVR" : "…";
    if (button.textContent !== text) button.textContent = text;
    button.dataset.state = !config.liveCatchUpEnabled ? "off" : catching ? "catching" : "on";
    button.title = config.liveCatchUpEnabled
      ? (catching ? "Acelerando " + (adState.liveRateApplied || 1).toFixed(2) + "x para tirar o atraso" : "Atraso até o ao vivo") + " · clique para configurar"
      : "Atraso até o ao vivo · clique para ativar o \"tirar atraso\"";
  }

  function renderLivePanel(panel: HTMLElement, direction: "forward" | "back" | "none" = "none") {
    const panelEl = document.createElement("div");
    panelEl.className = "ytp-panel";
    const menu = document.createElement("div");
    menu.className = "ytp-panel-menu";
    menu.setAttribute("role", "menu");

    const header = (title: string) => {
      const head = document.createElement("div");
      head.className = "ytp-panel-header";
      const back = document.createElement("button");
      back.className = "ytp-button ytp-panel-back-button";
      back.setAttribute("aria-label", "Voltar");
      back.addEventListener("click", () => {
        livePanelView = "main";
        renderLivePanel(panel, "back");
      });
      const label = document.createElement("span");
      label.className = "ytp-panel-title";
      label.textContent = title;
      head.append(back, label);
      panelEl.appendChild(head);
    };

    const save = (values: Record<string, unknown>) => {
      Object.assign(config, values);
      try { chrome.storage.local.set(values); } catch (err) {}
    };

    if (livePanelView === "mode") {
      header("Modo");
      const current = normalizeLiveMode(config.liveCatchUpMode);
      for (const [id, mode] of Object.entries(LIVE_MODES)) {
        const item = createMenuItem({ role: "menuitemradio", label: mode.label, content: mode.hint, checked: id === current });
        onMenuActivate(item, () => {
          save({ liveCatchUpMode: id });
          adState.liveEngaged = false;
          livePanelView = "main";
          renderLivePanel(panel, "back");
        });
        menu.appendChild(item);
      }
    } else if (livePanelView === "rate") {
      header("Velocidade máxima");
      for (const rate of LIVE_MAX_RATES) {
        const label = rate.toString().replace(".", ",") + "x" + (rate === 1.1 ? " (imperceptível)" : rate === 1.25 ? " (recomendado)" : "");
        const item = createMenuItem({ role: "menuitemradio", label, checked: Math.abs(rate - Number(config.liveCatchUpMaxRate || 1.25)) < 0.001 });
        onMenuActivate(item, () => {
          save({ liveCatchUpMaxRate: rate });
          livePanelView = "main";
          renderLivePanel(panel, "back");
        });
        menu.appendChild(item);
      }
    } else {
      const toggle = createMenuItem({ role: "menuitemcheckbox", icon: "live", label: "Tirar atraso", checked: !!config.liveCatchUpEnabled });
      toggle.querySelector(".ytp-menuitem-content")!.appendChild(Object.assign(document.createElement("div"), { className: "ytp-menuitem-toggle-checkbox" }));
      onMenuActivate(toggle, () => {
        save({ liveCatchUpEnabled: !config.liveCatchUpEnabled });
        adState.liveUserOverrideKey = "";
        if (!config.liveCatchUpEnabled) restoreLiveRate();
        renderLivePanel(panel);
        updateLiveButton();
      });
      menu.appendChild(toggle);

      const mode = createMenuItem({ role: "menuitem", icon: "presets", label: "Modo", content: LIVE_MODES[normalizeLiveMode(config.liveCatchUpMode)].label, submenu: true });
      onMenuActivate(mode, () => { livePanelView = "mode"; renderLivePanel(panel, "forward"); });
      menu.appendChild(mode);

      const rate = createMenuItem({ role: "menuitem", icon: "speed", label: "Velocidade máxima", content: Number(config.liveCatchUpMaxRate || 1.25).toString().replace(".", ",") + "x", submenu: true });
      onMenuActivate(rate, () => { livePanelView = "rate"; renderLivePanel(panel, "forward"); });
      menu.appendChild(rate);

      const jump = createMenuItem({ role: "menuitemcheckbox", icon: "jump", label: "Pular para o ao vivo após 30 s", checked: config.liveJumpEnabled !== false });
      jump.querySelector(".ytp-menuitem-content")!.appendChild(Object.assign(document.createElement("div"), { className: "ytp-menuitem-toggle-checkbox" }));
      onMenuActivate(jump, () => { save({ liveJumpEnabled: config.liveJumpEnabled === false }); renderLivePanel(panel); });
      menu.appendChild(jump);

      const now = createMenuItem({ role: "menuitem", icon: "jump", label: "Ir para o ao vivo agora" });
      onMenuActivate(now, () => { jumpToLiveEdge(); closeLivePanel(); });
      menu.appendChild(now);

      for (const [key, label] of [["latency", "Atraso"], ["health", "Buffer"], ["rate", "Velocidade agora"]]) {
        const info = createMenuItem({ role: "menuitem", label, content: "—" });
        info.classList.add("yte-menuitem--info");
        info.dataset.liveInfo = key;
        info.tabIndex = -1;
        menu.appendChild(info);
      }
    }

    panelEl.appendChild(menu);
    const content = panel.querySelector(".ytp-popup-content") as HTMLElement;
    const previous = content.querySelector(".ytp-panel") as HTMLElement | null;
    const before = panel.getBoundingClientRect();
    content.replaceChildren(panelEl);
    sizeFilterPanel(panel);
    if (direction !== "none" && previous) {
      // Same feel as YouTube's sub-menus: the box resizes while the new
      // view slides in from the side.
      const after = panel.getBoundingClientRect();
      panel.animate(
        [{ width: before.width + "px", height: before.height + "px" }, { width: after.width + "px", height: after.height + "px" }],
        { duration: SUBMENU_ANIM_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
      slidePanels(null, panelEl, direction);
    }
    syncLivePanel();
  }

  function syncLivePanel() {
    const panel = document.getElementById(LIVE_PANEL_ID);
    if (!panel || panel.hidden) return;
    const stats = getLiveStats();
    const set = (key: string, value: string) => {
      const content = panel.querySelector(`[data-live-info="${key}"] .ytp-menuitem-content`);
      if (content && content.textContent !== value) content.textContent = value;
    };
    set("latency", stats ? (stats.atLiveHead ? formatSeconds(stats.latency) : "assistindo atrás (DVR)") : "—");
    set("health", stats ? formatSeconds(stats.health) : "—");
    set("rate", (getActiveVideo()?.playbackRate || 1).toFixed(2).replace(".", ",") + "x");
  }

  function closeLivePanel() {
    const panel = document.getElementById(LIVE_PANEL_ID);
    if (panel) panel.hidden = true;
    getYouTubePlayer()?.classList.remove("yte-filter-panel-open");
    document.removeEventListener("pointerdown", handleOutsideLivePanel, true);
  }

  function handleOutsideLivePanel(event: Event) {
    const target = event.target as Element;
    if (target?.closest?.("#" + LIVE_PANEL_ID) || target?.closest?.("#" + LIVE_BUTTON_ID)) return;
    closeLivePanel();
  }

  function toggleLivePanel() {
    const player = getYouTubePlayer();
    if (!player) return;
    let panel = document.getElementById(LIVE_PANEL_ID);
    if (!panel || panel.parentElement !== player) {
      panel?.remove();
      panel = buildFilterPanel();
      panel.id = LIVE_PANEL_ID;
      panel.setAttribute("aria-label", "Atraso da live");
      player.appendChild(panel);
    }
    if (!panel.hidden) {
      closeLivePanel();
      return;
    }
    closeFilterPanel();
    livePanelView = "main";
    player.classList.add("yte-filter-panel-open");
    panel.hidden = false;
    renderLivePanel(panel);
    document.addEventListener("pointerdown", handleOutsideLivePanel, true);
  }

  function runPlayerUiTick() {
    runLiveCatchUp();
    if (!shouldShowPlayerControls()) return;
    updateEndTimeLabel();
    refreshPlayerControlStates();
  }

  // ── Main loop ─────────────────────────────────────────

  function mainLoop() {
    const startedAt = isDiagnosticsEnabled() ? performance.now() : 0;
    try {
      mainLoopBody();
    } finally {
      if (startedAt) {
        const duration = performance.now() - startedAt;
        if (duration >= MAIN_LOOP_SLOW_THRESHOLD_MS) {
          debugPlayback("mainLoop slow", {
            duration: Math.round(duration * 10) / 10,
            hidden: document.hidden,
            url: location.href,
            videoKey: getCurrentVideoKey(),
          });
        }
      }
    }
  }

  function mainLoopBody() {
    bindPersistentVideoState();
    syncLoopState();
    runVisualMaintenanceTasks();

    if (!config.enabled) {
      if (adState.active || adState.overlayEl) cleanupRuntimeState();
      stopAdblockProtection();
      return;
    }

    if (!isAdSkipperActive()) {
      if (adState.active || adState.overlayEl) cleanupRuntimeState();
      enforceAutoplayGuards();
      applyPlayerPreferences();
      runPlayerUiTick();
      return;
    }

    bindAdSkipperWatchdog();

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

      adState.adSrc = getMainVideo()?.currentSrc || "";
      capturePlaybackRate();
      muteVideo();
      startSpeedThrough();
      scheduleSkip();
      if (config.showOverlay) createOverlay();

    } else if (adPlaying && adState.active) {
      // ── Anúncio ainda ativo — tick ───

      if (adState.watching) return;

      const video = getMainVideo();

      // Detectar novo anúncio em sequência (posição do vídeo voltou ao início)
      if (video) {
        const ct = video.currentTime;
        if (adState.lastVideoTime > 2 && ct < adState.lastVideoTime - 2) {
          // Contar o anúncio anterior como pulado
          if (incrementAdCounter("ad-sequence")) showToastNotification();
          // Resetar para o novo anúncio
          adState.startTime = Date.now();
          adState.alreadyCounted = false;
          adState.lastVideoTime = ct;
          adState.adSrc = video.currentSrc || "";
          scheduleSkip();
          if (config.showOverlay) createOverlay();
          return;
        }
        adState.lastVideoTime = ct;
        // The ad class is confirmed synchronously here, so this src is an ad.
        if (video.currentSrc) adState.adSrc = video.currentSrc;
      }

      // Verificar se o delay passou (comparação DIRETA de timestamp)
      if (adState.skipTargetTime && Date.now() >= adState.skipTargetTime) {
        attemptScheduledSkip();
      }
    } else if (!adPlaying && adState.active) {
      // ── Anúncio ACABOU ───

      // Contar como pulado se não estava assistindo
      if (!adState.watching) {
        if (incrementAdCounter("ad-end")) showToastNotification();
      }

      cleanupRuntimeState();
    } else if (!adPlaying && !adState.active) {
      applyPlayerPreferences();
      runPlayerUiTick();
      const orphans = document.querySelectorAll("#" + OVERLAY_ID);
      if (orphans.length > 0) orphans.forEach(el => el.remove());
    }
  }

  // ── Atalho de teclado ─────────────────────────────────

  function runSkipShortcut() {
    if (!isAdSkipperActive() || !config.aggressiveSkip || !adState.active || adState.watching) return false;
    const skipped = clickSkipAdBtn();
    if (skipped) {
      finishSkipClick();
      return true;
    }
    return attemptScheduledSkip();
  }

  function handleConfiguredShortcut(event) {
    if (!config.enabled || !config.shortcutEnabled || isEditableTarget(event.target)) return;

    const actions = [
      { combo: config.shortcutSkipAd, action: "skip-ad" },
      { combo: config.shortcutSpeedDown, action: "speed-down" },
      { combo: config.shortcutSpeedUp, action: "speed-up" },
      { combo: config.shortcutVolumeDown, action: "volume-down" },
      { combo: config.shortcutVolumeUp, action: "volume-up" },
      { combo: config.shortcutScreenshot, action: "screenshot" },
      { combo: config.shortcutPopup, action: "popup" },
      { combo: config.shortcutLoop, action: "loop" },
    ];

    const matched = actions.find(item => shortcutMatches(event, item.combo));
    if (!matched) return;

    event.preventDefault();
    event.stopPropagation();

    if (matched.action === "skip-ad") {
      runSkipShortcut();
      return;
    }

    if (matched.action === "volume-down" || matched.action === "volume-up") {
      const video = getActiveVideo();
      const current = video ? Math.round(video.volume * 100) : 50;
      const direction = matched.action === "volume-up" ? 1 : -1;
      const next = setUserVolume(current + direction * normalizeVolumeStep(config.playerVolumeStep), true, video);
      if (shouldUseVolumeBoost()) applyVolumeBoost(video);
      showPlayerFeedback("volume", next + "%", shouldUseVolumeBoost() ? "Boost " + normalizeVolumeBoostLevel(config.volumeBoostLevel) + "x" : "");
      return;
    }

    if (matched.action === "popup") {
      // Same path as the button: leaves fullscreen before opening the window.
      handlePlayerControlAction("popup", new MouseEvent("click"));
      return;
    }

    handlePlayerToolbarAction(matched.action);
    refreshPlayerControlStates();
    refreshGearItems();
  }

  document.addEventListener('keydown', handleConfiguredShortcut, true);

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

  document.addEventListener("pointerdown", (event) => {
    markUserPlaybackIntent("pointerdown");
    resumeSuspendedBoost();
    if (config.volumeBoostEnabled) setTimeout(() => applyVolumeBoost(getActiveVideo()), 0);
    if (config.volumeBoostEnabled && config.volumeBoostAuto && isPointerInsidePlayer(event.target)) {
      setTimeout(() => applyVolumeBoost(getActiveVideo()), 0);
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    const playbackKeys = [" ", "Enter", "k", "K", "MediaPlayPause", "MediaPlay"];
    if (playbackKeys.includes(event.key)) markUserPlaybackIntent("keyboard");
    resumeSuspendedBoost();
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) markUserPlaybackIntent("tab-visible");
    enforceAutoplayGuards();
    scheduleAdWatchdogTick();
  });

  window.addEventListener("scroll", scheduleMiniplayerUpdate, { passive: true });
  window.addEventListener("resize", scheduleMiniplayerUpdate);

  // Cleanup ids of the retired floating PiP button.
  const PIP_BTN_ID = 'ytp-pip-float-btn';
  const PIP_STYLE_ID = 'ytp-pip-style';

  function removePipButton() {
    const btn = document.getElementById(PIP_BTN_ID);
    if (btn) btn.remove();
    const style = document.getElementById(PIP_STYLE_ID);
    if (style) style.remove();
  }

  // Legacy floating PiP button: replaced by the PiP button in the player's
  // control bar. Kept only to clean up pages that still have it.
  function injectPipButton() {
    removePipButton();
  }

  // SPA navigation. This used to be a MutationObserver on the whole document
  // (fires thousands of times per page); YouTube's own event is enough.
  let lastNavigationUrl = location.href;
  function handleSpaNavigation() {
    if (location.href === lastNavigationUrl) return;
    lastNavigationUrl = location.href;
    if (config.enabled && config.pipEnabled) setTimeout(injectPipButton, 600);
    scheduleVisualMaintenanceTasks(true, 300);
  }
  window.addEventListener("popstate", handleSpaNavigation);

  document.addEventListener("yt-navigate-finish", () => {
    handleSpaNavigation();
    setTimeout(() => {
      runVisualMaintenanceTasks(true);
      if (config.volumeBoostEnabled && config.volumeBoostAuto) applyVolumeBoost();
    }, 350);
  });

  // ── Init ──────────────────────────────────────────────

  function isInIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }

  function isSupportedEmbedFrame() {
    return /^\/embed\//.test(location.pathname);
  }

  let initStarted = false;

  function init() {
    if (initStarted) return;
    initStarted = true;
    if (isInIframe() && !isSupportedEmbedFrame()) return;
    loadSettings().then(() => {
      // garantir que as configurações foram carregadas antes de iniciar o loop
      syncMainWorldSession(true);
      syncCodecSettingsToMainWorld();
      if (isAdSkipperActive()) startAdblockProtection();
      try { mainLoop(); } catch (e) {}
      setInterval(mainLoop, CHECK_INTERVAL);
      // Inject PiP button if enabled
      injectPipButton();
    });
  }

  init();
})();

export {};
