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
} from "./content/adDom";
import {
  CODEC_SETTINGS_MESSAGE,
  CODEC_SETTINGS_STORAGE_KEY,
  MAIN_FORCE_SKIP_MESSAGE,
  MAIN_FORCE_SKIP_RESULT,
  MAIN_PLAYER_RESIZE_MESSAGE,
  MAIN_QUALITY_MESSAGE,
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
import { shouldFloatPlayer, shouldResetMiniplayerDismissal } from "./shared/miniplayer";
import { decideLiveRate, getBufferAhead } from "./shared/liveLatency";
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
import {
  RESUME_STORAGE_KEY,
  ResumeStore,
  formatClock,
  getResumeSaveAction,
  getResumeTarget,
  pruneResumeStore,
} from "./shared/resume";
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
    cinemaActive: false,
    cinemaInitialized: false,
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
  let cinemaSignature = "";
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
    config.shortcutCinema = normalizeShortcutSetting(s.shortcutCinema, "Alt+Shift+C");
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
    config.cinemaColor = normalizeHexColor(s.cinemaColor, "#000000");
    config.cinemaOpacity = normalizePercent(s.cinemaOpacity, 85);
    config.cinemaDefault = !!s.cinemaDefault;
    config.cinemaAutoResize = !!s.cinemaAutoResize;
    config.cinemaUseYouTubeTheater = s.cinemaUseYouTubeTheater !== false;
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
    config.videoFilterBrightness = normalizePercent(s.videoFilterBrightness, 100);
    config.videoFilterContrast = normalizePercent(s.videoFilterContrast, 100);
    config.videoFilterSaturate = normalizePercent(s.videoFilterSaturate, 100);
    config.videoFilterGrayscale = normalizePercent(s.videoFilterGrayscale, 0);
    config.videoFilterSepia = normalizePercent(s.videoFilterSepia, 0);
    config.codecForceStandardFps = !!s.codecForceStandardFps;
    config.codecForceAvc = !!s.codecForceAvc;
    config.resumePlaybackEnabled = !!s.resumePlaybackEnabled;
    config.playerControlsEnabled = s.playerControlsEnabled !== false;
    config.playerControlsStyle = s.playerControlsStyle === "divider" ? "divider" : "pill";
    config.playerEndTimeEnabled = s.playerEndTimeEnabled === true;
    config.liveCatchUpEnabled = s.liveCatchUpEnabled !== false;
    config.liveCatchUpTarget = Number(s.liveCatchUpTarget) > 0 ? Number(s.liveCatchUpTarget) : 3;
    config.liveCatchUpMaxRate = Math.min(1.5, Math.max(1.05, Number(s.liveCatchUpMaxRate) || 1.25));
    config.videoFilterHue = Number(s.videoFilterHue) || 0;
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
      if (hasPrefix(settingChanges, "appearanceHide", "layout", "theme", "ultrawide") ||
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
      if (hasPrefix(settingChanges, "toolbar", "playerControls", "playerEndTime", "liveCatchUp") ||
          has(settingChanges, "playerSpeedButtonsEnabled", "playerPopupEnabled")) {
        updatePlayerControls();
      }
      if (hasPrefix(settingChanges, "miniplayer")) scheduleMiniplayerUpdate();
      if (hasPrefix(settingChanges, "toolbar", "volumeBoost") || has(settingChanges, "playerSpeedButtonsEnabled", "playerPopupEnabled")) {
        schedulePlayerToolbarUpdate();
      }
      if (has(settingChanges, "cinemaColor", "cinemaOpacity")) applyCinemaMode();
      if (has(settingChanges, "cinemaDefault")) setCinemaMode(config.cinemaDefault);
      if (hasPrefix(settingChanges, "codec")) syncCodecSettingsToMainWorld();
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (!isBridgeMessage(data)) return;
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

    const player: any = getYouTubePlayer();
    try {
      if (player && typeof player.setPlaybackRate === "function") {
        player.setPlaybackRate(targetRate);
      }
    } catch (err) {}

    if (targetRate <= MAX_PLAYBACK_RATE) requestMainWorldSpeedThrough(targetRate);
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

  function shouldUseVolumeBoost() {
    return !!config.enabled && !!config.volumeBoostEnabled && normalizeVolumeBoostLevel(config.volumeBoostLevel) > 1;
  }

  function ensureVolumeBoostGraph(video: HTMLMediaElement | null) {
    if (!video) return null;
    const existing = volumeBoostGraphs.get(video);
    if (existing) return existing;

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
      if (showFeedback) showPlayerFeedback("volume", "Boost indisponivel", "O navegador bloqueou o audio graph");
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
    return pickBestQualityLevel(target, getAvailableQualityLevels());
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

    requestMainWorldQuality(level);
    attempted = true;

    return attempted;
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
      location.pathname,
    ].join(":");

    if (signature === appearanceSignature) return;
    appearanceSignature = signature;

    const css = config.enabled ? buildAppearanceCss() : "";
    const existing = document.getElementById(APPEARANCE_STYLE_ID);
    if (!css) {
      existing?.remove();
      scheduleYouTubeLayoutRefresh();
      return;
    }

    const style = existing || document.createElement("style");
    style.id = APPEARANCE_STYLE_ID;
    style.textContent = css;
    if (!existing) (document.head || document.documentElement).appendChild(style);
    scheduleYouTubeLayoutRefresh();
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

    if (config.cinemaDefault && !adState.cinemaInitialized) {
      adState.cinemaInitialized = true;
      setCinemaMode(true);
    }

    // Cinema may ask for theater before the page is ready; keep retrying per video.
    if (adState.cinemaActive && (config.cinemaUseYouTubeTheater || config.cinemaAutoResize) && key && adState.cinemaTheaterKey !== key) {
      if (ensureTheaterMode(true)) adState.cinemaTheaterKey = key;
    }
  }

  function runAppearanceTasks() {
    applyAppearanceFilters();
    convertShortsUrlIfNeeded();
    runAutoLayoutTasks();
    applyCinemaMode();
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

  const CINEMA_STYLE_ID = "youtube-extension-cinema-style";
  const CINEMA_CLASS = "youtube-extension-cinema-active";

  function buildCinemaCss() {
    const color = normalizeHexColor(config.cinemaColor, "#000000");
    const opacity = normalizePercent(config.cinemaOpacity, 85) / 100;
    const dimOpacity = Math.max(0.45, 1 - opacity);
    return `
      html.${CINEMA_CLASS},
      html.${CINEMA_CLASS} body,
      html.${CINEMA_CLASS} ytd-app,
      html.${CINEMA_CLASS} #page-manager {
        background: ${color} !important;
      }

      html.${CINEMA_CLASS} ytd-watch-flexy #secondary,
      html.${CINEMA_CLASS} ytd-watch-flexy #below,
      html.${CINEMA_CLASS} ytd-watch-flexy ytd-watch-metadata,
      html.${CINEMA_CLASS} ytd-comments {
        opacity: ${dimOpacity.toFixed(2)} !important;
        transition: opacity 180ms ease !important;
      }

      html.${CINEMA_CLASS} ytd-watch-flexy #player-container-outer,
      html.${CINEMA_CLASS} ytd-watch-flexy #player-theater-container,
      html.${CINEMA_CLASS} ytd-watch-flexy #player-full-bleed-container {
        background: ${color} !important;
        box-shadow: 0 0 0 100vmax rgba(0, 0, 0, ${Math.min(0.85, opacity).toFixed(2)}) !important;
      }

      /* Cinema only darkens the surroundings. It used to force its own size
         on #movie_player, which fought YouTube's computed size and could crop
         the video or push it out of view. Sizing is left to YouTube/theater. */

      html.${CINEMA_CLASS}.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container-outer,
      html.${CINEMA_CLASS}.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-theater-container,
      html.${CINEMA_CLASS}.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-full-bleed-container {
        box-shadow: none !important;
      }
    `;
  }

  function applyCinemaMode() {
    document.documentElement.classList.toggle(CINEMA_CLASS, !!adState.cinemaActive && !!config.enabled);

    const signature = [
      config.enabled,
      adState.cinemaActive,
      config.cinemaColor,
      config.cinemaOpacity,
    ].join(":");

    if (signature === cinemaSignature) return;
    cinemaSignature = signature;

    const existing = document.getElementById(CINEMA_STYLE_ID);
    if (!config.enabled || !adState.cinemaActive) {
      existing?.remove();
      return;
    }

    const style = existing || document.createElement("style");
    style.id = CINEMA_STYLE_ID;
    style.textContent = buildCinemaCss();
    if (!existing) (document.head || document.documentElement).appendChild(style);
  }

  function setCinemaMode(active) {
    adState.cinemaActive = !!active;
    adState.cinemaTheaterKey = "";
    if (config.cinemaUseYouTubeTheater || config.cinemaAutoResize) {
      ensureTheaterMode(adState.cinemaActive);
    }
    applyCinemaMode();
    updatePlayerToolbarStates();
  }

  function toggleCinemaMode() {
    setCinemaMode(!adState.cinemaActive);
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
      : kind === "resume" ? "Continuar"
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
  const MINIPLAYER_ACTIVE_CLASS = "tube-shield-miniplayer-active";

  const MINIPLAYER_SLOT_ATTR = "data-yte-mini-slot";
  const MINIPLAYER_CLOSE_ID = "yte-miniplayer-close";
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

  function buildMiniplayerCss() {
    const size = parseMiniplayerSize();
    // z-index stays below YouTube's masthead (2020) and its dropdowns/dialogs
    // (2200+), so menus like "Sort comments" open on top of the miniplayer.
    return `
      [${MINIPLAYER_SLOT_ATTR}] {
        min-height: var(--yte-mini-slot-height, 0px) !important;
      }

      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container-outer,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container-inner,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-theater-container,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-full-bleed-container,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #full-bleed-container,
      html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy ytd-player {
        z-index: 2010 !important;
        overflow: visible !important;
        transform: none !important;
        contain: none !important;
        filter: none !important;
      }

      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player.html5-video-player {
        position: fixed !important;
        ${getMiniplayerPositionCss()}
        width: min(${size.width}px, calc(100vw - 36px)) !important;
        height: min(${size.height}px, calc(100vh - 90px)) !important;
        z-index: 2010 !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.14) !important;
        background: #000 !important;
        animation: yte-mini-in 180ms ease-out;
      }

      @keyframes yte-mini-in {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: none; }
      }

      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .html5-video-container,
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .html5-main-video,
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player video {
        width: 100% !important;
        height: 100% !important;
      }

      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player video.html5-main-video {
        left: 0 !important;
        top: 0 !important;
        object-fit: contain !important;
        transform: none !important;
      }

      /* YouTube sizes the control bar in px for the docked player. */
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-chrome-bottom {
        width: calc(100% - 24px) !important;
        left: 12px !important;
      }

      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-ce-element,
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-cards-teaser,
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-size-button,
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-miniplayer-button,
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-chapter-container {
        display: none !important;
      }

      #${MINIPLAYER_CLOSE_ID} {
        display: none;
      }

      html.${MINIPLAYER_ACTIVE_CLASS} #${MINIPLAYER_CLOSE_ID} {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 80;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.62);
        color: #fff;
        cursor: pointer;
        opacity: 0;
        transition: opacity 140ms ease, background 140ms ease;
      }

      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player:hover #${MINIPLAYER_CLOSE_ID},
      html.${MINIPLAYER_ACTIVE_CLASS} #${MINIPLAYER_CLOSE_ID}:focus-visible {
        opacity: 1;
      }

      #${MINIPLAYER_CLOSE_ID}:hover {
        background: rgba(255, 51, 75, 0.9);
      }

      #${MINIPLAYER_CLOSE_ID} svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
        stroke-width: 2.4;
        fill: none;
      }
    `;
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
    style.textContent = buildMiniplayerCss();
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

  const PLAYER_TOOLBAR_ID = "tube-shield-player-toolbar";
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
    if (config.toolbarFilters) actions.push({ action: "filters", title: "Filtros de video", icon: "filters" });
    if (config.toolbarSettings) actions.push({ action: "settings", title: "Configuracoes", icon: "settings" });
    return actions;
  }

  function buildPlayerToolbarCss() {
    return `
      #${PLAYER_TOOLBAR_ID} {
        --yse-toolbar-bg: rgba(18, 18, 20, 0.9);
        --yse-toolbar-border: rgba(255, 255, 255, 0.14);
        --yse-toolbar-color: rgba(255, 255, 255, 0.84);
        --yse-toolbar-hover: rgba(255, 255, 255, 0.12);
        display: flex;
        align-items: center;
        gap: 6px;
        width: max-content;
        max-width: calc(100% - 16px);
        margin: 8px 0 12px;
        padding: 6px;
        border: 1px solid var(--yse-toolbar-border);
        border-radius: 999px;
        background: var(--yse-toolbar-bg);
        color: var(--yse-toolbar-color);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-sizing: border-box;
      }

      html:not([dark]) #${PLAYER_TOOLBAR_ID} {
        --yse-toolbar-bg: rgba(255, 255, 255, 0.92);
        --yse-toolbar-border: rgba(15, 15, 15, 0.13);
        --yse-toolbar-color: rgba(15, 15, 15, 0.82);
        --yse-toolbar-hover: rgba(15, 15, 15, 0.08);
        box-shadow: 0 10px 24px rgba(15, 15, 15, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.82);
      }

      #${PLAYER_TOOLBAR_ID}.is-centered {
        margin-left: auto;
        margin-right: auto;
      }

      #${PLAYER_TOOLBAR_ID}.is-inside {
        position: absolute;
        left: 50%;
        bottom: 54px;
        transform: translateX(-50%);
        z-index: 60;
        margin: 0;
      }

      #player-container-outer:has(#${PLAYER_TOOLBAR_ID}.is-inside),
      #player-theater-container:has(#${PLAYER_TOOLBAR_ID}.is-inside),
      #player:has(#${PLAYER_TOOLBAR_ID}.is-inside),
      ytd-player:has(#${PLAYER_TOOLBAR_ID}.is-inside) {
        position: relative !important;
      }

      #${PLAYER_TOOLBAR_ID}.is-always-visible {
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn {
        width: 34px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        border-radius: 999px;
        background: transparent;
        color: var(--yse-toolbar-color);
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
      }

      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:hover,
      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:focus-visible {
        color: #fff;
        background: var(--yse-toolbar-hover);
        border-color: var(--yse-toolbar-border);
        outline: none;
      }

      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:active {
        transform: translateY(1px) scale(0.98);
      }

      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn.is-active {
        color: #fff;
        background: rgba(255, 51, 75, 0.84);
        border-color: rgba(255, 255, 255, 0.18);
      }

      #${PLAYER_TOOLBAR_ID} svg {
        width: 18px;
        height: 18px;
        color: currentColor !important;
        stroke: currentColor !important;
        fill: none !important;
        pointer-events: none;
      }

      #${PLAYER_TOOLBAR_ID} svg [fill="currentColor"] {
        fill: currentColor !important;
        stroke: none !important;
      }

      #${PLAYER_TOOLBAR_ID} svg * {
        vector-effect: non-scaling-stroke;
      }

      /* visibility (not display) so hiding it does not shift the page */
      html.${MINIPLAYER_ACTIVE_CLASS} #${PLAYER_TOOLBAR_ID} {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      @media (max-width: 720px) {
        #${PLAYER_TOOLBAR_ID} {
          overflow-x: auto;
          border-radius: 16px;
          width: 100%;
          max-width: 100%;
          justify-content: flex-start;
        }
      }
    `;
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
    theaterButton?.classList.toggle("is-active", !!document.querySelector("ytd-watch-flexy")?.hasAttribute("theater") || !!adState.cinemaActive);

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

    if (config.playerSpeedEnabled && adState.defaultSpeedAppliedKey !== key) {
      setUserPlaybackRate(config.playerSpeedDefault, video);
      adState.defaultSpeedAppliedKey = key;
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

    return !!document.querySelector("ytd-playlist-panel-renderer, ytd-playlist-video-list-renderer");
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
    if (incrementAdCounter()) showToastNotification();
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
  const PLAYER_CONTROLS_ID = "yte-controls";
  const FILTER_PANEL_ID = "yte-filter-panel";
  const END_TIME_ID = "yte-end-time";
  const SPEED_CYCLE = [1, 1.25, 1.5, 1.75, 2];
  let playerControlsVideo: HTMLVideoElement | null = null;
  let filterSaveTimer: number | null = null;

  // Filled 24px icons (Material Icons, Apache-2.0), the same visual language
  // as YouTube's own control bar, so the buttons read as native.
  const PLAYER_ICON_PATHS: Record<string, string> = {
    loop: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
    camera: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z",
    filters: "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
    pip: "M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z",
    popup: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
    cinema: "M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z",
    boost: "M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z",
  };

  function playerIcon(name: string) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (PLAYER_ICON_PATHS[name] || "") + '"/></svg>';
  }

  function buildPlayerUiCss() {
    return `
      #${PLAYER_CONTROLS_ID} {
        display: inline-flex;
        align-items: center;
        height: 100%;
        vertical-align: top;
        float: left;
      }

      #${PLAYER_CONTROLS_ID} .yte-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 100%;
        min-height: 36px;
        padding: 0;
        color: #fff;
        opacity: 1;
        font: 500 14px/1 "YouTube Sans", Roboto, Arial, sans-serif;
        letter-spacing: 0.01em;
        transition: opacity 0.12s ease;
      }

      #${PLAYER_CONTROLS_ID} .yte-btn:hover,
      #${PLAYER_CONTROLS_ID} .yte-btn:focus-visible {
        opacity: 1;
      }

      #${PLAYER_CONTROLS_ID} .yte-btn svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
        stroke: none;
        filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
      }

      #${PLAYER_CONTROLS_ID} .yte-btn.is-active::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 7px;
        width: 20px;
        height: 3px;
        margin-left: -10px;
        border-radius: 2px;
        background: #f03;
      }

      #${PLAYER_CONTROLS_ID} .yte-btn--text {
        width: auto;
        min-width: 42px;
        padding: 0 6px;
        font-variant-numeric: tabular-nums;
      }

      #${PLAYER_CONTROLS_ID} .yte-live {
        gap: 6px;
        padding: 0 10px 0 8px;
        font-size: 12px;
      }

      #${PLAYER_CONTROLS_ID} .yte-live::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #8a8a8a;
      }

      #${PLAYER_CONTROLS_ID} .yte-live.is-synced::before { background: #f03; }
      #${PLAYER_CONTROLS_ID} .yte-live.is-catching::before { background: #ffb020; }

      #${PLAYER_CONTROLS_ID} .yte-btn[data-tip]:hover::before {
        content: attr(data-tip);
        position: absolute;
        bottom: calc(100% + 12px);
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 9px;
        border-radius: 4px;
        background: rgba(28, 28, 28, 0.92);
        color: #eee;
        font: 500 12px/1.2 Roboto, Arial, sans-serif;
        white-space: nowrap;
        pointer-events: none;
        z-index: 80;
      }

      #${PLAYER_CONTROLS_ID} [data-fit-hidden] {
        display: none;
      }

      /* Cinema only dims the page around the player: pointless in fullscreen. */
      #movie_player.ytp-fullscreen #${PLAYER_CONTROLS_ID} [data-yte-action="cinema"] {
        display: none;
      }

      #${END_TIME_ID}:empty { display: none; }
      #movie_player.yte-no-endtime #${END_TIME_ID} { display: none; }

      #${END_TIME_ID} {
        margin-left: 6px;
        color: rgba(255, 255, 255, 0.72);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      /* The panel uses YouTube's .ytp-popup/.ytp-menuitem styles; these are
         only placement and fallbacks (zero specificity via :where). */
      #${FILTER_PANEL_ID} {
        position: absolute;
        right: 12px;
        bottom: 62px;
        z-index: 70;
        border-radius: 12px !important;
        overflow: hidden !important;
      }

      #${FILTER_PANEL_ID}[hidden] { display: none !important; }

      :where(#${FILTER_PANEL_ID}) {
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.6);
        overflow: hidden;
        color: #eee;
      }

      #${FILTER_PANEL_ID} .ytp-panel { overflow-y: auto; overflow-x: hidden; }

      #${FILTER_PANEL_ID} .yte-menuitem--slider { cursor: default; }

      #${FILTER_PANEL_ID} .yte-menu-slider {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        width: 150px;
      }

      #${FILTER_PANEL_ID} .yte-menu-slider output {
        min-width: 38px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      #${FILTER_PANEL_ID} .yte-menu-slider input[type="range"] {
        flex: 1;
        min-width: 0;
        height: 16px;
        margin: 0;
        background: transparent;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
      }

      #${FILTER_PANEL_ID} .yte-menu-slider input[type="range"]::-webkit-slider-runnable-track {
        height: 3px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.3);
      }

      #${FILTER_PANEL_ID} .yte-menu-slider input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        margin-top: -4.5px;
        border-radius: 50%;
        background: #fff;
      }

      #${FILTER_PANEL_ID} .yte-menu-slider input[type="range"]:focus-visible { outline: none; }
      #${FILTER_PANEL_ID} .yte-menu-slider input[type="range"]:focus-visible::-webkit-slider-thumb {
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
      }

      /* Style "pill": our own rounded group next to YouTube's, using the
         same background/radius/height read from YouTube's group at runtime. */
      #${PLAYER_CONTROLS_ID}.yte-style-pill {
        float: none;
        align-self: center;
        flex: none;
        height: var(--yte-pill-h, 40px);
        margin: 0 var(--yte-pill-gap, 12px);
        padding: 0 4px;
        border-radius: var(--yte-pill-radius, 28px);
        background: var(--yte-pill-bg, rgba(0, 0, 0, 0.3));
      }

      #${PLAYER_CONTROLS_ID}.yte-style-pill .yte-btn { min-height: 0; }

      /* Style "divider": inside YouTube's group, separated by a thin line. */
      #${PLAYER_CONTROLS_ID}.yte-style-divider::after {
        content: "";
        align-self: center;
        width: 1px;
        height: 20px;
        margin: 0 6px 0 4px;
        background: rgba(255, 255, 255, 0.28);
      }
    `;
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
    const badge = player.querySelector(".ytp-live-badge") as HTMLElement | null;
    return !!badge && badge.offsetParent !== null && !badge.hasAttribute("disabled");
  }

  function getPlayerControlItems() {
    const items: Array<{ id: string; tip: string; icon?: string; text?: string; priority: "high" | "mid" | "low"; className?: string }> = [];
    if (config.liveCatchUpEnabled !== false) items.push({ id: "live", tip: "Atraso da live", text: "AO VIVO", priority: "high", className: "yte-btn--text yte-live" });
    if (config.toolbarSpeed !== false && config.playerSpeedButtonsEnabled !== false) {
      items.push({ id: "speed", tip: "Velocidade · clique para alternar, role para ajustar, botão direito volta a 1x", text: "1x", priority: "high", className: "yte-btn--text" });
    }
    if (config.toolbarLoop !== false) items.push({ id: "loop", tip: "Repetir vídeo", icon: "loop", priority: "mid" });
    if (config.toolbarFilters !== false) items.push({ id: "filters", tip: "Filtros de imagem", icon: "filters", priority: "mid" });
    if (config.toolbarScreenshot !== false) items.push({ id: "screenshot", tip: "Salvar frame (PNG)", icon: "camera", priority: "low" });
    if (config.toolbarVolumeBoost !== false) items.push({ id: "boost", tip: "Volume boost", icon: "boost", priority: "low" });
    items.push({ id: "cinema", tip: "Modo cinema", icon: "cinema", priority: "low" });
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
  const FIT_HIDE_ORDER = ["popup", "boost", "cinema", "screenshot", "pip", "loop", "filters"];

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
    document.getElementById(PLAYER_CONTROLS_ID)?.remove();
    document.getElementById(FILTER_PANEL_ID)?.remove();
    document.getElementById(END_TIME_ID)?.remove();
  }

  function stopPlayerEvent(event: Event) {
    event.stopPropagation();
  }

  function updatePlayerControls() {
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
    set("cinema", !!adState.cinemaActive);
    set("pip", !!document.pictureInPictureElement);

    const live = controls.querySelector('[data-yte-action="live"]') as HTMLElement | null;
    if (live) {
      const isLive = isLiveStream();
      live.hidden = !isLive;
      if (isLive) {
        const delay = adState.liveDelay || 0;
        const catching = (adState.liveRateApplied || 1) > 1.001;
        const text = delay > 0.05 ? "AO VIVO −" + delay.toFixed(1) + "s" : "AO VIVO";
        if (live.textContent !== text) live.textContent = text;
        live.classList.toggle("is-synced", delay <= Number(config.liveCatchUpTarget || 3) + 1);
        live.classList.toggle("is-catching", catching);
        live.dataset.tip = catching
          ? "Acelerando " + (adState.liveRateApplied || 1).toFixed(2) + "x para tirar o atraso · clique para ir ao vivo"
          : "Atraso ~" + delay.toFixed(1) + "s · clique para ir ao vivo";
      }
    }
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
      case "cinema":
        toggleCinemaMode();
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
      case "live":
        jumpToLiveEdge();
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

  function renderFilterPanel(panel: HTMLElement) {
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
        renderFilterPanel(panel);
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
          renderFilterPanel(panel);
        });
        menu.appendChild(item);
      }
    } else {
      const toggle = createMenuItem({ role: "menuitemcheckbox", icon: "toggle", label: "Filtros de imagem", checked: !!config.videoFiltersEnabled });
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
        renderFilterPanel(panel);
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
    const content = panel.querySelector(".ytp-popup-content") as HTMLElement;
    content.replaceChildren(panelEl);
    sizeFilterPanel(panel);
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
    panel.className = "ytp-popup";
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

  function syncFilterPanel() {
    const panel = document.getElementById(FILTER_PANEL_ID);
    if (!panel || panel.hidden || filterPanelView !== "main") return;
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

  // ── Live: tirar o atraso acelerando de leve ──

  function getLiveTarget() {
    const n = Number(config.liveCatchUpTarget);
    return Number.isFinite(n) && n > 0 ? n : 3;
  }

  function restoreLiveRate() {
    if (!adState.liveRateApplied || adState.liveRateApplied === 1) return;
    const video = getActiveVideo();
    if (video && Math.abs(video.playbackRate - adState.liveRateApplied) < 0.01) {
      try { video.playbackRate = 1; } catch (err) {}
      requestMainWorldSpeedThrough(1);
    }
    adState.liveRateApplied = 1;
  }

  function runLiveCatchUp() {
    const video = getActiveVideo();
    const key = getCurrentVideoKey();
    if (!video || !config.enabled || config.liveCatchUpEnabled === false || !isLiveStream() || adState.active || getAdPlaying()) {
      restoreLiveRate();
      adState.liveDelay = 0;
      return;
    }

    adState.liveDelay = getBufferAhead(video);
    if (video.paused || adState.liveUserOverrideKey === key) return;

    const applied = adState.liveRateApplied || 1;
    // The user picked a speed themselves: stop managing this live.
    if (Math.abs(video.playbackRate - applied) > 0.01 && Math.abs(video.playbackRate - 1) > 0.01) {
      adState.liveUserOverrideKey = key;
      adState.liveRateApplied = 1;
      return;
    }

    const decision = decideLiveRate({
      bufferAhead: adState.liveDelay,
      target: getLiveTarget(),
      currentRate: applied,
      maxRate: Number(config.liveCatchUpMaxRate) || 1.25,
    });

    if (decision.jumpBy > 0) {
      try { video.currentTime = video.currentTime + decision.jumpBy; } catch (err) {}
      recordPlaybackEvent("live-jump", "live-catch-up", Number(video.currentTime || 0));
    }
    if (Math.abs(decision.rate - video.playbackRate) > 0.005) {
      try { video.playbackRate = decision.rate; } catch (err) {}
      requestMainWorldSpeedThrough(decision.rate);
    }
    adState.liveRateApplied = decision.rate;
  }

  function jumpToLiveEdge() {
    const video = getActiveVideo();
    if (!video || !isLiveStream()) return;
    const ahead = getBufferAhead(video);
    adState.liveUserOverrideKey = "";
    if (ahead > 1.5) {
      try { video.currentTime = video.currentTime + ahead - 1; } catch (err) {}
    }
    showPlayerFeedback("speed", "Ao vivo", ahead > 1.5 ? "Pulou " + (ahead - 1).toFixed(1) + "s" : "Já está no ao vivo");
  }

  function runPlayerUiTick() {
    runLiveCatchUp();
    if (!shouldShowPlayerControls()) return;
    updateEndTimeLabel();
    refreshPlayerControlStates();
  }

  // ── Continuar de onde parou ───────────────────────────

  let resumeStore: ResumeStore | null = null;
  let resumeLoading = false;
  let resumeLastSaveAt = 0;

  function withResumeStore(callback: (store: ResumeStore) => void) {
    if (resumeStore) {
      callback(resumeStore);
      return;
    }
    if (resumeLoading || !chrome?.storage?.local) return;
    resumeLoading = true;
    chrome.storage.local.get({ [RESUME_STORAGE_KEY]: {} }, (data) => {
      resumeLoading = false;
      const stored = data[RESUME_STORAGE_KEY];
      resumeStore = stored && typeof stored === "object" ? (stored as ResumeStore) : {};
      callback(resumeStore);
    });
  }

  function hasExplicitStartTime() {
    try {
      const url = new URL(location.href);
      return url.searchParams.has("t") || url.searchParams.has("start") || /(^|[#&])t=/.test(url.hash.slice(1));
    } catch (err) {
      return false;
    }
  }

  // During SPA navigation the URL can change before the <video> swaps
  // sources. The player's own title link tells which video it really holds.
  function playerHoldsCurrentVideo(videoId: string) {
    const link = getYouTubePlayer()?.querySelector(".ytp-title-link") as HTMLAnchorElement | null;
    const href = link?.href || "";
    if (!href) return true;
    return getYouTubeVideoIdFromUrl(href) === videoId;
  }

  function runResumePlayback() {
    if (!config.enabled || !config.resumePlaybackEnabled || !isWatchPage() || isPopupWindow()) return;
    if (adState.active || getAdPlaying()) return;
    const video = getMainVideo();
    const videoId = getCurrentVideoId();
    const key = getCurrentVideoKey();
    if (!video || !videoId || !key || video.readyState < 1) return;
    if (!playerHoldsCurrentVideo(videoId)) return;
    const duration = Number(video.duration);

    if (adState.resumeCheckedKey !== key) {
      if (adState.resumeCheckStartedKey !== key) {
        adState.resumeCheckStartedKey = key;
        adState.resumeCheckStartedAt = Date.now();
      }
      withResumeStore((store) => {
        if (adState.resumeCheckedKey === key) return;
        const entry = store[videoId];
        const target = getResumeTarget(entry, duration, hasExplicitStartTime());
        if (target === null) {
          const durationMismatch = !!entry && Math.abs(entry.d - duration) > 3;
          if (!durationMismatch || Date.now() - adState.resumeCheckStartedAt > 15000) adState.resumeCheckedKey = key;
          return;
        }
        adState.resumeCheckedKey = key;
        if (video.currentTime >= target - 5) return;
        try {
          video.currentTime = target;
          showPlayerFeedback("resume", formatClock(target), "Continuando de onde parou");
          recordPlaybackEvent("resume-seek", "resume-playback", target);
        } catch (err) {}
      });
      return;
    }

    if (video.paused || Date.now() - resumeLastSaveAt < 5000) return;
    resumeLastSaveAt = Date.now();
    const action = getResumeSaveAction(Number(video.currentTime), duration);
    if (action === "skip") return;

    withResumeStore((store) => {
      if (action === "delete") {
        if (!store[videoId]) return;
        delete store[videoId];
      } else {
        store[videoId] = { t: Math.floor(video.currentTime), d: Math.round(duration), at: Date.now() };
      }
      resumeStore = pruneResumeStore(store);
      chrome.storage.local.set({ [RESUME_STORAGE_KEY]: resumeStore });
    });
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
      runResumePlayback();
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
          if (incrementAdCounter()) showToastNotification();
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
        if (incrementAdCounter()) showToastNotification();
      }

      cleanupRuntimeState();
    } else if (!adPlaying && !adState.active) {
      applyPlayerPreferences();
      runResumePlayback();
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
      { combo: config.shortcutCinema, action: "theater" },
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

    handlePlayerToolbarAction(matched.action);
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
    if (config.volumeBoostEnabled && config.volumeBoostAuto && isPointerInsidePlayer(event.target)) {
      setTimeout(() => applyVolumeBoost(getActiveVideo()), 0);
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    const playbackKeys = [" ", "Enter", "k", "K", "MediaPlayPause", "MediaPlay"];
    if (playbackKeys.includes(event.key)) markUserPlaybackIntent("keyboard");
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) markUserPlaybackIntent("tab-visible");
    enforceAutoplayGuards();
    scheduleAdWatchdogTick();
  });

  window.addEventListener("scroll", scheduleMiniplayerUpdate, { passive: true });
  window.addEventListener("resize", scheduleMiniplayerUpdate);

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

      const video = getMainVideo();
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
        console.warn('[YouTube Extension] PiP error:', err);
      }
    });

    player.appendChild(btn);

    // Listen for PiP state changes to update button
    const video = getMainVideo();
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
