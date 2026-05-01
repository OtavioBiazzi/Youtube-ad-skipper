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
      adSkipperEnabled: true,
      skipDelay: 1,
      muteAds: true,
      showOverlay: true,
      aggressiveSkip: true,
      instantSkip: false,
      showToast: false,
      shortcutEnabled: false,
      listMode: "whitelist",
      playerDefaultsProfileVersion: 0,
      whitelist: [],
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
      playerSpeedButtonsEnabled: true,
      shortcutSkipAd: "Shift+S",
      shortcutSpeedDown: "Ctrl+,",
      shortcutSpeedUp: "Ctrl+.",
      shortcutVolumeDown: "Alt+,",
      shortcutVolumeUp: "Alt+.",
      shortcutCinema: "C",
      shortcutScreenshot: "P",
      shortcutPopup: "O",
      shortcutLoop: "L",
      autoplayDisableAll: false,
      autoplayStopPreload: false,
      autoplayIgnorePopup: true,
      playerPopupEnabled: true,
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
      cinemaUseYouTubeTheater: true,
      ultrawideEnabled: false,
      ultrawideFit: "smart-crop",
      toolbarInsidePlayer: false,
      toolbarAlwaysVisible: false,
      themeEngine: "tube-shield",
      themeVariant: "red",
      themeDeepDarkCustom: false,
      themeCustomAccent: "#ff334b",
      themeCustomBackground: "#0f0f0f",
      themeCustomSurface: "#17191f",
      themeCustomSurfaceRaised: "#20232b",
      themeCustomText: "#f4f5f7",
      themeCustomMuted: "#a9adb8",
      themeCustomBorder: "#343741",
      themeCustomCss: "",
      codecForceStandardFps: false,
      codecForceAvc: false,
      customScriptEnabled: false,
      customScriptCode: "",
      customScriptAutoRun: false,
      customScriptRunAt: 0
    };
    const CHECK_INTERVAL = 500;
    const FORCE_SKIP_RETRY_MS = 120;
    const FORCE_SKIP_WINDOW_MS = 6e3;
    const DEFAULT_SPEED_THROUGH_RATE = 3;
    const MIN_SPEED_THROUGH_RATE = 1;
    const MAX_SPEED_THROUGH_RATE = 8;
    const SAFE_SPEED_THROUGH_RATE = 3;
    const INSTANT_SPEED_THROUGH_RATE = 16;
    const MIN_PLAYBACK_RATE = 0.0625;
    const MAX_PLAYBACK_RATE = 16;
    const MIN_USER_PLAYBACK_RATE = 0.1;
    const MAX_USER_PLAYBACK_RATE = 100;
    const SPEED_THROUGH_RETRY_MS = 250;
    const PLAYBACK_RESTORE_RETRY_MS = 150;
    const PLAYBACK_RESTORE_WINDOW_MS = 2400;
    const POST_SKIP_RESTORE_DELAYS_MS = [180, 450, 900, 1500];
    const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
    const MAIN_SPEED_THROUGH_MESSAGE = "yt-ad-skipper:speed-through";
    const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";
    const CODEC_SETTINGS_MESSAGE = "youtube-extension:codec-settings";
    const CODEC_SETTINGS_STORAGE_KEY = "youtubeExtensionCodecSettings";
    const PLAYER_DEFAULTS_PROFILE_VERSION = 1;
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
      playerSpeedButtonsEnabled: true,
      playerPopupEnabled: true
    };
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
      cinemaActive: false,
      cinemaInitialized: false,
      autoTheaterAppliedKey: "",
      autoExpandAppliedKey: "",
      customScriptAutoKey: "",
      customScriptLastRunAt: 0
    };
    let adblockObserver = null;
    let adblockBodyWaitObserver = null;
    let skipButtonObserver = null;
    let appearanceSignature = "";
    let cinemaSignature = "";
    let miniplayerSignature = "";
    let miniplayerUpdateRaf = 0;
    let adWatchdogVideo = null;
    let adWatchdogTimeout = null;
    const volumeBoostGraphs = /* @__PURE__ */ new WeakMap();
    let playerFeedbackTimer = null;
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
              adSkipperEnabled: true,
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
              playerDefaultsProfileVersion: 0,
              pipEnabled: false,
              adSpeedRate: DEFAULT_SPEED_THROUGH_RATE,
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
              playerSpeedButtonsEnabled: true,
              shortcutSkipAd: "Shift+S",
              shortcutSpeedDown: "Ctrl+,",
              shortcutSpeedUp: "Ctrl+.",
              shortcutVolumeDown: "Alt+,",
              shortcutVolumeUp: "Alt+.",
              shortcutCinema: "C",
              shortcutScreenshot: "P",
              shortcutPopup: "O",
              shortcutLoop: "L",
              autoplayDisableAll: false,
              autoplayStopPreload: false,
              autoplayIgnorePopup: true,
              playerPopupEnabled: true,
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
              cinemaUseYouTubeTheater: true,
              ultrawideEnabled: false,
              ultrawideFit: "smart-crop",
              toolbarInsidePlayer: false,
              toolbarAlwaysVisible: false,
              themeEngine: "tube-shield",
              themeVariant: "red",
              themeDeepDarkCustom: false,
              themeCustomAccent: "#ff334b",
              themeCustomBackground: "#0f0f0f",
              themeCustomSurface: "#17191f",
              themeCustomSurfaceRaised: "#20232b",
              themeCustomText: "#f4f5f7",
              themeCustomMuted: "#a9adb8",
              themeCustomBorder: "#343741",
              themeCustomCss: "",
              codecForceStandardFps: false,
              codecForceAvc: false,
              customScriptEnabled: false,
              customScriptCode: "",
              customScriptAutoRun: false,
              customScriptRunAt: 0
            },
            (s) => {
              if ((Number(s.playerDefaultsProfileVersion) || 0) < PLAYER_DEFAULTS_PROFILE_VERSION) {
                Object.assign(s, PLAYER_DEFAULTS_PROFILE, { playerDefaultsProfileVersion: PLAYER_DEFAULTS_PROFILE_VERSION });
                chrome.storage.local.set({
                  ...PLAYER_DEFAULTS_PROFILE,
                  playerDefaultsProfileVersion: PLAYER_DEFAULTS_PROFILE_VERSION
                });
              }
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
              config.playerSpeedButtonsEnabled = s.playerSpeedButtonsEnabled !== false;
              config.shortcutSkipAd = normalizeShortcutText(s.shortcutSkipAd, "Shift+S");
              config.shortcutSpeedDown = normalizeShortcutText(s.shortcutSpeedDown, "Ctrl+,");
              config.shortcutSpeedUp = normalizeShortcutText(s.shortcutSpeedUp, "Ctrl+.");
              config.shortcutVolumeDown = normalizeShortcutText(s.shortcutVolumeDown, "Alt+,");
              config.shortcutVolumeUp = normalizeShortcutText(s.shortcutVolumeUp, "Alt+.");
              config.shortcutCinema = normalizeShortcutText(s.shortcutCinema, "C");
              config.shortcutScreenshot = normalizeShortcutText(s.shortcutScreenshot, "P");
              config.shortcutPopup = normalizeShortcutText(s.shortcutPopup, "O");
              config.shortcutLoop = normalizeShortcutText(s.shortcutLoop, "L");
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
              config.codecForceStandardFps = !!s.codecForceStandardFps;
              config.codecForceAvc = !!s.codecForceAvc;
              config.customScriptEnabled = !!s.customScriptEnabled;
              config.customScriptCode = String(s.customScriptCode || "");
              config.customScriptAutoRun = !!s.customScriptAutoRun;
              config.customScriptRunAt = Number(s.customScriptRunAt) || 0;
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
            if (isAdSkipperActive()) startAdblockProtection();
            if (config.pipEnabled) injectPipButton();
          } else {
            cleanupRuntimeState();
            stopAdblockProtection();
            removePipButton();
          }
          applyAppearanceFilters();
          updateMiniplayer();
        }
        if (changes.adSkipperEnabled) {
          config.adSkipperEnabled = changes.adSkipperEnabled.newValue !== false;
          if (isAdSkipperActive()) {
            startAdblockProtection();
            scheduleAdWatchdogTick();
          } else {
            cleanupRuntimeState();
            stopAdblockProtection();
          }
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
          if (config.enabled && config.pipEnabled) {
            injectPipButton();
          } else {
            removePipButton();
          }
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
        if (changes.volumeBoostEnabled) {
          config.volumeBoostEnabled = !!changes.volumeBoostEnabled.newValue;
          applyVolumeBoost();
          updatePlayerToolbar();
        }
        if (changes.volumeBoostLevel) {
          config.volumeBoostLevel = normalizeVolumeBoostLevel(changes.volumeBoostLevel.newValue);
          applyVolumeBoost();
        }
        if (changes.volumeBoostAuto) {
          config.volumeBoostAuto = !!changes.volumeBoostAuto.newValue;
          applyVolumeBoost();
        }
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
        if (changes.qualityPopup) {
          config.qualityPopup = normalizeQualityLevel(changes.qualityPopup.newValue, "medium");
          resetQualityState();
        }
        if (changes.qualityFullscreenPopup) {
          config.qualityFullscreenPopup = normalizeQualityLevel(changes.qualityFullscreenPopup.newValue, "hd1080");
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
        if (changes.miniplayerEnabled) {
          config.miniplayerEnabled = changes.miniplayerEnabled.newValue !== false;
          updateMiniplayer();
        }
        if (changes.miniplayerSize) {
          config.miniplayerSize = normalizeMiniplayerSize(changes.miniplayerSize.newValue);
          updateMiniplayer();
        }
        if (changes.miniplayerPosition) {
          config.miniplayerPosition = normalizeMiniplayerPosition(changes.miniplayerPosition.newValue);
          updateMiniplayer();
        }
        if (changes.playerPopupSize) config.playerPopupSize = normalizePlayerPopupSize(changes.playerPopupSize.newValue);
        if (changes.toolbarEnabled) {
          config.toolbarEnabled = changes.toolbarEnabled.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarPosition) {
          config.toolbarPosition = normalizeToolbarPosition(changes.toolbarPosition.newValue);
          updatePlayerToolbar();
        }
        if (changes.toolbarCenter) {
          config.toolbarCenter = changes.toolbarCenter.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarLoop) {
          config.toolbarLoop = changes.toolbarLoop.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarSpeed) {
          config.toolbarSpeed = changes.toolbarSpeed.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarPopup) {
          config.toolbarPopup = changes.toolbarPopup.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarPip) {
          config.toolbarPip = changes.toolbarPip.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarScreenshot) {
          config.toolbarScreenshot = changes.toolbarScreenshot.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarTheater) {
          config.toolbarTheater = changes.toolbarTheater.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarSettings) {
          config.toolbarSettings = changes.toolbarSettings.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.toolbarVolumeBoost) {
          config.toolbarVolumeBoost = changes.toolbarVolumeBoost.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.playerSpeedButtonsEnabled) {
          config.playerSpeedButtonsEnabled = changes.playerSpeedButtonsEnabled.newValue !== false;
          updatePlayerToolbar();
        }
        if (changes.playerPopupEnabled) {
          config.playerPopupEnabled = changes.playerPopupEnabled.newValue !== false;
          updatePlayerToolbar();
        }
        const shortcutKeys = [
          "shortcutSkipAd",
          "shortcutSpeedDown",
          "shortcutSpeedUp",
          "shortcutVolumeDown",
          "shortcutVolumeUp",
          "shortcutCinema",
          "shortcutScreenshot",
          "shortcutPopup",
          "shortcutLoop"
        ];
        shortcutKeys.forEach((key) => {
          if (changes[key]) config[key] = normalizeShortcutText(changes[key].newValue, config[key]);
        });
        if (changes.autoplayDisableAll) config.autoplayDisableAll = !!changes.autoplayDisableAll.newValue;
        if (changes.autoplayStopPreload) config.autoplayStopPreload = !!changes.autoplayStopPreload.newValue;
        if (changes.autoplayIgnorePopup) config.autoplayIgnorePopup = changes.autoplayIgnorePopup.newValue !== false;
        const layoutKeys = [
          ["layoutVideosPerRow", 4, 1, 8],
          ["layoutChannelVideosPerRow", 4, 1, 8],
          ["layoutShortsPerRow", 8, 1, 12],
          ["layoutChannelShortsPerRow", 5, 1, 12],
          ["layoutPostsPerRow", 4, 1, 8]
        ];
        let layoutChanged = false;
        layoutKeys.forEach(([key, fallback, min, max]) => {
          if (changes[key]) {
            config[key] = normalizeGridCount(changes[key].newValue, fallback, min, max);
            layoutChanged = true;
          }
        });
        if (layoutChanged) applyAppearanceFilters();
        if (changes.appearanceAutoTheater) config.appearanceAutoTheater = !!changes.appearanceAutoTheater.newValue;
        if (changes.appearanceAutoExpandPlayer) config.appearanceAutoExpandPlayer = !!changes.appearanceAutoExpandPlayer.newValue;
        if (changes.appearanceUseViewportPlayer) {
          config.appearanceUseViewportPlayer = !!changes.appearanceUseViewportPlayer.newValue;
          applyAppearanceFilters();
        }
        if (changes.cinemaColor) {
          config.cinemaColor = normalizeHexColor(changes.cinemaColor.newValue, "#000000");
          applyCinemaMode();
        }
        if (changes.cinemaOpacity) {
          config.cinemaOpacity = normalizePercent(changes.cinemaOpacity.newValue, 85);
          applyCinemaMode();
        }
        if (changes.cinemaDefault) {
          config.cinemaDefault = !!changes.cinemaDefault.newValue;
          setCinemaMode(config.cinemaDefault);
        }
        if (changes.cinemaAutoResize) config.cinemaAutoResize = !!changes.cinemaAutoResize.newValue;
        if (changes.cinemaUseYouTubeTheater) config.cinemaUseYouTubeTheater = changes.cinemaUseYouTubeTheater.newValue !== false;
        if (changes.ultrawideEnabled) {
          config.ultrawideEnabled = !!changes.ultrawideEnabled.newValue;
          applyAppearanceFilters();
        }
        if (changes.ultrawideFit) {
          config.ultrawideFit = normalizeUltrawideFit(changes.ultrawideFit.newValue);
          applyAppearanceFilters();
        }
        if (changes.toolbarInsidePlayer) {
          config.toolbarInsidePlayer = !!changes.toolbarInsidePlayer.newValue;
          updatePlayerToolbar();
        }
        if (changes.toolbarAlwaysVisible) {
          config.toolbarAlwaysVisible = !!changes.toolbarAlwaysVisible.newValue;
          updatePlayerToolbar();
        }
        const themeKeys = [
          "themeEngine",
          "themeVariant",
          "themeDeepDarkCustom",
          "themeCustomAccent",
          "themeCustomBackground",
          "themeCustomSurface",
          "themeCustomSurfaceRaised",
          "themeCustomText",
          "themeCustomMuted",
          "themeCustomBorder",
          "themeCustomCss"
        ];
        let themeChanged = false;
        themeKeys.forEach((key) => {
          if (!changes[key]) return;
          if (key === "themeEngine") config.themeEngine = normalizeThemeEngine(changes[key].newValue);
          else if (key === "themeVariant") config.themeVariant = normalizeThemeVariant(changes[key].newValue);
          else if (key === "themeDeepDarkCustom") config.themeDeepDarkCustom = !!changes[key].newValue;
          else if (key === "themeCustomAccent") config.themeCustomAccent = normalizeHexColor(changes[key].newValue, "#ff334b");
          else if (key === "themeCustomBackground") config.themeCustomBackground = normalizeHexColor(changes[key].newValue, "#0f0f0f");
          else if (key === "themeCustomSurface") config.themeCustomSurface = normalizeHexColor(changes[key].newValue, "#17191f");
          else if (key === "themeCustomSurfaceRaised") config.themeCustomSurfaceRaised = normalizeHexColor(changes[key].newValue, "#20232b");
          else if (key === "themeCustomText") config.themeCustomText = normalizeHexColor(changes[key].newValue, "#f4f5f7");
          else if (key === "themeCustomMuted") config.themeCustomMuted = normalizeHexColor(changes[key].newValue, "#a9adb8");
          else if (key === "themeCustomBorder") config.themeCustomBorder = normalizeHexColor(changes[key].newValue, "#343741");
          else if (key === "themeCustomCss") config.themeCustomCss = String(changes[key].newValue || "");
          themeChanged = true;
        });
        if (themeChanged) applyAppearanceFilters();
        if (changes.codecForceStandardFps) {
          config.codecForceStandardFps = !!changes.codecForceStandardFps.newValue;
          syncCodecSettingsToMainWorld();
        }
        if (changes.codecForceAvc) {
          config.codecForceAvc = !!changes.codecForceAvc.newValue;
          syncCodecSettingsToMainWorld();
        }
        if (changes.customScriptEnabled) config.customScriptEnabled = !!changes.customScriptEnabled.newValue;
        if (changes.customScriptCode) config.customScriptCode = String(changes.customScriptCode.newValue || "");
        if (changes.customScriptAutoRun) config.customScriptAutoRun = !!changes.customScriptAutoRun.newValue;
        if (changes.customScriptRunAt) {
          config.customScriptRunAt = Number(changes.customScriptRunAt.newValue) || 0;
          runCustomScript("manual");
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
    function getAdPlaying() {
      const player = getYouTubePlayer();
      if (player && (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting"))) {
        return true;
      }
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
    function isAdSkipperActive() {
      return !!config.enabled && config.adSkipperEnabled !== false;
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
      return ["youtube", "tube-shield", "enhancer", "deepdark", "custom"].includes(text) ? text : "tube-shield";
    }
    function normalizeThemeVariant(value) {
      const text = String(value || "");
      return ["red", "deep-dark", "gray", "blue"].includes(text) ? text : "red";
    }
    function normalizeShortcutText(value, fallback = "") {
      const text = String(value || "").trim();
      return text || fallback;
    }
    function isEditableTarget(target) {
      if (!target || !(target instanceof Element)) return false;
      const element = target;
      const tag = element.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
    }
    function normalizeShortcutToken(token) {
      const raw = String(token || "");
      if (raw === " ") return "Space";
      const text = raw.trim();
      if (!text) return "";
      const lower = text.toLowerCase();
      if (lower === "control") return "Ctrl";
      if (lower === "ctrl") return "Ctrl";
      if (lower === "option") return "Alt";
      if (lower === "alt") return "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "cmd" || lower === "command" || lower === "meta") return "Meta";
      if (lower === "space") return "Space";
      if (lower.length === 1) return lower.toUpperCase();
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    function normalizeShortcutCombo(combo) {
      const parts = String(combo || "").split("+").map(normalizeShortcutToken).filter(Boolean);
      const modifiers = ["Ctrl", "Alt", "Shift", "Meta"].filter((mod) => parts.includes(mod));
      const key = parts.find((part) => !["Ctrl", "Alt", "Shift", "Meta"].includes(part)) || "";
      return [...modifiers, key].filter(Boolean).join("+");
    }
    function eventToShortcutCombo(event) {
      const key = normalizeShortcutToken(event.key);
      if (!key || ["Ctrl", "Alt", "Shift", "Meta"].includes(key)) return "";
      return [
        event.ctrlKey ? "Ctrl" : "",
        event.altKey ? "Alt" : "",
        event.shiftKey ? "Shift" : "",
        event.metaKey ? "Meta" : "",
        key
      ].filter(Boolean).join("+");
    }
    function shortcutMatches(event, combo) {
      const wanted = normalizeShortcutCombo(combo);
      return !!wanted && eventToShortcutCombo(event) === wanted;
    }
    function getCodecSettings() {
      return {
        forceStandardFps: !!config.codecForceStandardFps,
        forceAvc: !!config.codecForceAvc
      };
    }
    function syncCodecSettingsToMainWorld() {
      const settings = getCodecSettings();
      try {
        localStorage.setItem(CODEC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch (err) {
      }
      window.postMessage({ source: CODEC_SETTINGS_MESSAGE, settings }, "*");
    }
    function parseMiniplayerSize(size = config.miniplayerSize) {
      const [width, height] = normalizeMiniplayerSize(size).split("x").map((part) => parseInt(part, 10));
      return {
        width: Number.isFinite(width) ? width : 480,
        height: Number.isFinite(height) ? height : 270
      };
    }
    function parsePlayerPopupSize(size = config.playerPopupSize) {
      const [width, height] = normalizePlayerPopupSize(size).split("x").map((part) => parseInt(part, 10));
      return {
        width: Number.isFinite(width) ? width : 640,
        height: Number.isFinite(height) ? height : 360
      };
    }
    function getActiveVideo() {
      return document.querySelector("video");
    }
    function getCurrentVideoKey() {
      try {
        const url = new URL(location.href);
        const videoId = url.searchParams.get("v");
        if (videoId) return "watch:" + videoId;
      } catch (err) {
      }
      return location.pathname + location.search;
    }
    function getCurrentVideoId() {
      try {
        const url = new URL(location.href);
        return url.searchParams.get("v") || "";
      } catch (err) {
        return "";
      }
    }
    function setUserPlaybackRate(rate, video = getActiveVideo()) {
      const targetRate = normalizeUserPlaybackRate(rate, 1);
      if (video) {
        try {
          if (video.playbackRate !== targetRate) video.playbackRate = targetRate;
        } catch (err) {
        }
      }
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(targetRate);
        }
      } catch (err) {
      }
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
        } catch (err) {
        }
      }
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.setVolume === "function") {
          player.setVolume(target);
        }
        if (unmute && target > 0 && player && typeof player.unMute === "function") {
          player.unMute();
        }
      } catch (err) {
      }
      return target;
    }
    function shouldUseVolumeBoost() {
      return !!config.enabled && !!config.volumeBoostEnabled && normalizeVolumeBoostLevel(config.volumeBoostLevel) > 1;
    }
    function ensureVolumeBoostGraph(video) {
      if (!video) return null;
      const existing = volumeBoostGraphs.get(video);
      if (existing) return existing;
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
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
    function applyVolumeBoost(video = getActiveVideo(), showFeedback = false) {
      if (!video) return false;
      const enabled = shouldUseVolumeBoost();
      const level = enabled ? normalizeVolumeBoostLevel(config.volumeBoostLevel) : 1;
      try {
        const graph = enabled ? ensureVolumeBoostGraph(video) : volumeBoostGraphs.get(video);
        if (!graph) return false;
        graph.gain.gain.value = level;
        if (enabled && graph.context.state === "suspended") {
          graph.context.resume().catch(() => {
          });
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
      } catch (err) {
      }
      return applyVolumeBoost(video, true);
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
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.getPlaybackQuality === "function") {
          return normalizeQualityLevel(player.getPlaybackQuality(), "");
        }
      } catch (err) {
      }
      return "";
    }
    function getAvailableQualityLevels() {
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.getAvailableQualityLevels === "function") {
          const levels = player.getAvailableQualityLevels();
          if (Array.isArray(levels)) {
            return levels.map((level) => normalizeQualityLevel(level, "")).filter((level) => level && level !== "auto");
          }
        }
      } catch (err) {
      }
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
      return available.slice().sort((a, b) => QUALITY_ORDER.indexOf(b) - QUALITY_ORDER.indexOf(a))[0] || normalizedTarget;
    }
    function setPlaybackQuality(target) {
      const player = getYouTubePlayer();
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
      } catch (err) {
      }
      try {
        if (typeof player.setPlaybackQuality === "function") {
          player.setPlaybackQuality(level);
          attempted = true;
        }
      } catch (err) {
      }
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
      if (matched || attempted && now - adState.qualityRequestStartedAt > 2400 || now - adState.qualityRequestStartedAt > 8e3) {
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
          border: "#323642"
        },
        "deep-dark": {
          accent: "#e02f42",
          background: "#07080a",
          surface: "#101116",
          surfaceRaised: "#171a20",
          text: "#f5f5f6",
          muted: "#a3a6ad",
          border: "#292d35"
        },
        gray: {
          accent: "#d43f52",
          background: "#15161a",
          surface: "#202227",
          surfaceRaised: "#2a2d34",
          text: "#f0f2f5",
          muted: "#aeb3bd",
          border: "#393e47"
        },
        blue: {
          accent: "#4f7fc2",
          background: "#0e1117",
          surface: "#171d27",
          surfaceRaised: "#202838",
          text: "#f3f6fb",
          muted: "#aab4c3",
          border: "#313b4f"
        }
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
          border: normalizeHexColor(config.themeCustomBorder, "#343741")
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
      const allowCustomCss = engine === "custom" || engine === "deepdark" && config.themeDeepDarkCustom;
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
      ytd-rich-grid-renderer,
      ytd-watch-flexy #secondary-inner,
      ytd-comments,
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
      const blocks = [];
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
        ytd-watch-flexy #movie_player video {
          object-fit: ${objectFit} !important;
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
        location.pathname
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
    function ensureTheaterMode(active) {
      const watchFlexy = document.querySelector("ytd-watch-flexy");
      const currentlyTheater = !!watchFlexy?.hasAttribute("theater");
      if (currentlyTheater === active) return;
      const theaterButton = document.querySelector(".ytp-size-button, button.ytp-size-button");
      if (theaterButton) {
        theaterButton.click();
        return;
      }
      if (!watchFlexy) return;
      if (active) {
        watchFlexy.setAttribute("theater", "");
      } else {
        watchFlexy.removeAttribute("theater");
      }
    }
    function runAutoLayoutTasks() {
      if (!config.enabled || !isWatchPage()) return;
      const key = getCurrentVideoKey();
      if ((config.appearanceAutoTheater || config.appearanceAutoExpandPlayer) && adState.autoTheaterAppliedKey !== key) {
        adState.autoTheaterAppliedKey = key;
        setTimeout(() => ensureTheaterMode(true), 300);
      }
      if (config.cinemaDefault && !adState.cinemaInitialized) {
        adState.cinemaInitialized = true;
        setCinemaMode(true);
      }
    }
    function runAppearanceTasks() {
      applyAppearanceFilters();
      convertShortsUrlIfNeeded();
      runAutoLayoutTasks();
      applyCinemaMode();
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
    `;
    }
    function applyCinemaMode() {
      document.documentElement.classList.toggle(CINEMA_CLASS, !!adState.cinemaActive && !!config.enabled);
      const signature = [
        config.enabled,
        adState.cinemaActive,
        config.cinemaColor,
        config.cinemaOpacity
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
      if (config.cinemaUseYouTubeTheater || config.cinemaAutoResize) {
        ensureTheaterMode(adState.cinemaActive);
      }
      applyCinemaMode();
      updatePlayerToolbarStates();
    }
    const PLAYER_FEEDBACK_ID = "youtube-extension-player-feedback";
    const PLAYER_FEEDBACK_STYLE_ID = "youtube-extension-player-feedback-style";
    function ensurePlayerFeedbackStyle() {
      if (document.getElementById(PLAYER_FEEDBACK_STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = PLAYER_FEEDBACK_STYLE_ID;
      style.textContent = `
      #${PLAYER_FEEDBACK_ID} {
        position: fixed !important;
        z-index: 2147483600 !important;
        min-width: 132px !important;
        max-width: min(260px, calc(100vw - 32px)) !important;
        padding: 10px 14px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        background: rgba(10, 10, 12, 0.84) !important;
        color: #fff !important;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
        backdrop-filter: blur(14px) saturate(1.1) !important;
        -webkit-backdrop-filter: blur(14px) saturate(1.1) !important;
        font: 700 13px/1.15 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        letter-spacing: 0 !important;
        text-align: center !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transform: translate(-50%, -50%) scale(0.96) !important;
        transition: opacity 150ms ease, transform 150ms ease !important;
      }

      #${PLAYER_FEEDBACK_ID}.is-visible {
        opacity: 1 !important;
        transform: translate(-50%, -50%) scale(1) !important;
      }

      #${PLAYER_FEEDBACK_ID} .feedback-label {
        display: block !important;
        color: rgba(255, 255, 255, 0.68) !important;
        font-size: 10px !important;
        font-weight: 650 !important;
        text-transform: uppercase !important;
      }

      #${PLAYER_FEEDBACK_ID} .feedback-value {
        display: block !important;
        margin-top: 2px !important;
        color: #fff !important;
        font-size: 18px !important;
      }
    `;
      (document.head || document.documentElement).appendChild(style);
    }
    function showPlayerFeedback(kind, value, label = "") {
      const player = getYouTubePlayer();
      const rect = player?.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      ensurePlayerFeedbackStyle();
      let feedback = document.getElementById(PLAYER_FEEDBACK_ID);
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.id = PLAYER_FEEDBACK_ID;
        document.body.appendChild(feedback);
      }
      feedback.innerHTML = `
      <span class="feedback-label">${kind === "volume" ? "Volume" : "Velocidade"}</span>
      <span class="feedback-value">${value}</span>
      ${label ? `<span class="feedback-label">${label}</span>` : ""}
    `;
      feedback.style.left = Math.round(rect.left + rect.width / 2) + "px";
      feedback.style.top = Math.round(rect.top + rect.height * 0.23) + "px";
      feedback.classList.add("is-visible");
      if (playerFeedbackTimer) window.clearTimeout(playerFeedbackTimer);
      playerFeedbackTimer = window.setTimeout(() => {
        feedback?.classList.remove("is-visible");
      }, 950);
    }
    const MINIPLAYER_STYLE_ID = "tube-shield-miniplayer-style";
    const MINIPLAYER_ACTIVE_CLASS = "tube-shield-miniplayer-active";
    function getPlayerAnchor() {
      return document.querySelector("#player-container-outer") || document.querySelector("#player") || document.querySelector("ytd-player") || getYouTubePlayer();
    }
    function getMiniplayerPositionCss() {
      const margin = "18px";
      const topOffset = "72px";
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
      return `
      html.${MINIPLAYER_ACTIVE_CLASS} #movie_player.html5-video-player {
        position: fixed !important;
        ${getMiniplayerPositionCss()}
        width: min(${size.width}px, calc(100vw - 36px)) !important;
        height: min(${size.height}px, calc(100vh - 90px)) !important;
        z-index: 2147483000 !important;
        border-radius: 10px !important;
        overflow: hidden !important;
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.14) !important;
        background: #000 !important;
        transform: translateZ(0) !important;
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
    `;
    }
    function ensureMiniplayerStyle() {
      const signature = [
        normalizeMiniplayerSize(config.miniplayerSize),
        normalizeMiniplayerPosition(config.miniplayerPosition)
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
    function shouldUseMiniplayer() {
      if (!config.enabled || !config.miniplayerEnabled || !isWatchPage()) return false;
      if (document.fullscreenElement || document.pictureInPictureElement) return false;
      const player = getYouTubePlayer();
      const video = getActiveVideo();
      const anchor = getPlayerAnchor();
      if (!player || !video || !anchor?.getBoundingClientRect) return false;
      const rect = anchor.getBoundingClientRect();
      return window.scrollY > 320 && rect.bottom < 80;
    }
    function updateMiniplayer() {
      const root = document.documentElement;
      const active = shouldUseMiniplayer();
      if (!config.enabled || !config.miniplayerEnabled) {
        root.classList.remove(MINIPLAYER_ACTIVE_CLASS);
        document.getElementById(MINIPLAYER_STYLE_ID)?.remove();
        miniplayerSignature = "";
        return;
      }
      ensureMiniplayerStyle();
      root.classList.toggle(MINIPLAYER_ACTIVE_CLASS, active);
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
        return document.querySelector("#player-theater-container") || document.querySelector("#player-full-bleed-container") || document.querySelector("#player-container-outer") || document.querySelector("#player") || document.querySelector("ytd-player") || getYouTubePlayer();
      }
      return document.querySelector("#player-container-outer") || document.querySelector("#player-theater-container") || document.querySelector("#player-full-bleed-container") || document.querySelector("#player") || document.querySelector("ytd-player") || getYouTubePlayer();
    }
    function getPlayerToolbarActions() {
      const actions = [];
      if (config.toolbarLoop) actions.push({ action: "loop", title: "Loop", icon: "loop" });
      if (config.toolbarSpeed && config.playerSpeedButtonsEnabled !== false) {
        actions.push({ action: "speed-control", title: "Velocidade: role a roda; clique para 1x", icon: "speed-control" });
      }
      if (config.toolbarVolumeBoost) actions.push({ action: "volume-boost", title: "Volume boost", icon: "volume-boost" });
      if (config.toolbarPopup && config.playerPopupEnabled !== false) actions.push({ action: "popup", title: "Abrir em pop-up", icon: "popup" });
      if (config.toolbarPip) actions.push({ action: "pip", title: "Picture-in-Picture", icon: "pip" });
      if (config.toolbarScreenshot) actions.push({ action: "screenshot", title: "Capturar frame", icon: "camera" });
      if (config.toolbarTheater) actions.push({ action: "theater", title: "Modo teatro do YouTube", icon: "theater" });
      if (config.toolbarSettings) actions.push({ action: "settings", title: "Configuracoes", icon: "settings" });
      return actions;
    }
    function buildPlayerToolbarCss() {
      return `
      #${PLAYER_TOOLBAR_ID} {
        display: flex;
        align-items: center;
        gap: 6px;
        width: max-content;
        max-width: calc(100% - 16px);
        margin: 8px 0 12px;
        padding: 6px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        background: rgba(12, 12, 14, 0.9);
        color: #fff;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-sizing: border-box;
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
        color: rgba(255, 255, 255, 0.82);
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
      }

      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:hover,
      #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:focus-visible {
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.16);
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

      html.${MINIPLAYER_ACTIVE_CLASS} #${PLAYER_TOOLBAR_ID} {
        display: none !important;
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
        config.playerSpeedButtonsEnabled,
        config.playerPopupEnabled,
        config.toolbarInsidePlayer,
        config.toolbarAlwaysVisible,
        normalizePlayerPopupSize(config.playerPopupSize),
        location.pathname
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
      loopButton?.classList.toggle("is-active", !!video?.loop);
      const pipButton = toolbar.querySelector('[data-toolbar-action="pip"]');
      pipButton?.classList.toggle("is-active", !!document.pictureInPictureElement);
      const theaterButton = toolbar.querySelector('[data-toolbar-action="theater"]');
      theaterButton?.classList.toggle("is-active", !!adState.cinemaActive);
      const boostButton = toolbar.querySelector('[data-toolbar-action="volume-boost"]');
      boostButton?.classList.toggle("is-active", shouldUseVolumeBoost());
    }
    function updatePlayerToolbar() {
      if (!config.enabled || !config.toolbarEnabled || !isWatchPage()) {
        removePlayerToolbar();
        return;
      }
      const anchor = getPlayerToolbarAnchor();
      const parent = anchor?.parentElement;
      if (!anchor || !parent) {
        removePlayerToolbar();
        return;
      }
      const signature = getPlayerToolbarSignature();
      let toolbar = document.getElementById(PLAYER_TOOLBAR_ID);
      const insidePlayer = !!config.toolbarInsidePlayer && anchor instanceof HTMLElement;
      const expectedParent = insidePlayer ? anchor : parent;
      const expectedNext = normalizeToolbarPosition(config.toolbarPosition) === "above" ? anchor : anchor.nextSibling === toolbar ? toolbar.nextSibling : anchor.nextSibling;
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
          const target = event.target;
          const button = target.closest?.("[data-toolbar-action]");
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
        config.toolbarAlwaysVisible ? "is-always-visible" : ""
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
    function openPopupPlayer() {
      if (config.playerPopupEnabled === false) return;
      const videoId = getCurrentVideoId();
      if (!videoId) return;
      const size = parsePlayerPopupSize();
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - size.width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - size.height) / 2));
      const features = [
        "popup=yes",
        "noopener=yes",
        "width=" + size.width,
        "height=" + size.height,
        "left=" + left,
        "top=" + top
      ].join(",");
      try {
        getActiveVideo()?.pause();
      } catch (err) {
      }
      const embedUrl = "https://www.youtube.com/embed/" + encodeURIComponent(videoId) + "?autoplay=1&playsinline=1";
      window.open(embedUrl, "youtubeExtensionPlayerPopup", features);
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
      const theaterButton = document.querySelector(".ytp-size-button, button.ytp-size-button");
      if (theaterButton) {
        theaterButton.click();
        setTimeout(updatePlayerToolbar, 300);
        return;
      }
      const watchFlexy = document.querySelector("ytd-watch-flexy");
      if (!watchFlexy) return;
      if (watchFlexy.hasAttribute("theater")) {
        watchFlexy.removeAttribute("theater");
      } else {
        watchFlexy.setAttribute("theater", "");
      }
      setTimeout(updatePlayerToolbar, 300);
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
        chrome.runtime.sendMessage({ type: "youtube-extension:open-options" }, () => {
          if (chrome.runtime.lastError) {
            window.open(chrome.runtime.getURL("options.html"), "_blank", "noopener=yes");
          }
        });
      } catch (err) {
        try {
          window.open(chrome.runtime.getURL("options.html"), "_blank", "noopener=yes");
        } catch (fallbackErr) {
          window.open("/options.html", "_blank", "noopener=yes");
        }
      }
    }
    function handlePlayerToolbarAction(action) {
      const video = getActiveVideo();
      markUserPlaybackIntent();
      if (action === "loop") {
        if (video) {
          video.loop = !video.loop;
          video.toggleAttribute("loop", video.loop);
          showPlayerFeedback("speed", video.loop ? "Loop on" : "Loop off");
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
      if (config.volumeBoostEnabled && config.volumeBoostAuto) {
        applyVolumeBoost(video);
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
      if (config.playerSpeedWheel && event.ctrlKey && (!config.playerSpeedWheelRightButton || rightButtonHeld)) {
        event.preventDefault();
        event.stopPropagation();
        const current = getCurrentPlaybackRate(video);
        const next = normalizeUserPlaybackRate(current + direction * normalizePlayerSpeedStep(config.playerSpeedStep), current);
        setUserPlaybackRate(next, video);
        showPlayerFeedback("speed", next + "x");
        return;
      }
      if (config.playerVolumeWheel && !event.ctrlKey && (!config.playerVolumeWheelRightButton || rightButtonHeld)) {
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
      } catch (err) {
      }
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
    function isPopupWindow() {
      return window.name === "youtubeExtensionPlayerPopup" || !!window.opener && window.outerWidth <= 1040 && window.outerHeight <= 680;
    }
    function shouldBlockAutoplay(video = getActiveVideo()) {
      if (!video || !config.enabled || adState.active || getAdPlaying()) return false;
      if (!isNearVideoStart(video)) return false;
      if (config.autoplayIgnorePopup && isPopupWindow()) return false;
      if (config.autoplayAllowPlaylists && isPlaylistContext()) return false;
      if (config.autoplayDisableAll) return !hasRecentPlaybackIntent();
      if (document.hidden) return !!config.autoplayBlockBackground;
      return !!config.autoplayBlockForeground && !hasRecentPlaybackIntent();
    }
    function pauseVideo(video = getActiveVideo()) {
      if (!video) return false;
      let paused = false;
      try {
        video.pause();
        paused = true;
      } catch (err) {
      }
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.pauseVideo === "function") {
          player.pauseVideo();
          paused = true;
        }
      } catch (err) {
      }
      return paused;
    }
    function announceForegroundPlayback() {
      if (!config.enabled || !config.pauseBackgroundTabs || document.hidden || adState.active || getAdPlaying()) return;
      if (!chrome?.storage?.local) return;
      chrome.storage.local.set({
        tubeShieldActivePlayback: {
          token: adState.tabPlaybackToken,
          time: Date.now(),
          url: location.href
        }
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
      if (!video) return;
      if (config.autoplayStopPreload && shouldBlockAutoplay(video)) {
        try {
          video.preload = "none";
        } catch (err) {
        }
      }
      if (video.paused) return;
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
        rate: getSpeedThroughRate()
      }, "*");
    }
    function requestMainWorldSpeedThrough(rate = getSpeedThroughRate()) {
      window.postMessage({
        source: MAIN_SPEED_THROUGH_MESSAGE,
        rate
      }, "*");
    }
    function forceSkipAd(video = document.querySelector("video")) {
      if (!isAdSkipperActive() || !config.aggressiveSkip || adState.watching) return false;
      requestMainWorldSkip();
      const player = getYouTubePlayer();
      let attempted = false;
      if (video) {
        const duration = getFinitePositiveNumber(video.duration);
        const currentTime = getFinitePositiveNumber(video.currentTime);
        const target = duration > 0 ? Math.max(duration - 0.05, currentTime + 0.25) : currentTime + 600;
        try {
          video.playbackRate = getSpeedThroughRate();
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
          player.setPlaybackRate(getSpeedThroughRate());
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
    function getCurrentPlaybackRate(video = document.querySelector("video")) {
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.getPlaybackRate === "function") {
          return normalizePlaybackRate(player.getPlaybackRate());
        }
      } catch (err) {
      }
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
      if (!isAdSkipperActive() || !config.aggressiveSkip || adState.watching) return false;
      const rate = getSpeedThroughRate();
      requestMainWorldSpeedThrough(rate);
      let attempted = false;
      if (video) {
        try {
          if (video.playbackRate !== rate) {
            video.playbackRate = rate;
          }
          attempted = true;
        } catch (err) {
        }
      }
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(rate);
          attempted = true;
        }
      } catch (err) {
      }
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
      const video = document.querySelector("video");
      if (video) {
        try {
          if (video.playbackRate !== targetRate) video.playbackRate = targetRate;
        } catch (err) {
        }
      }
      const player = getYouTubePlayer();
      try {
        if (player && typeof player.setPlaybackRate === "function") {
          player.setPlaybackRate(targetRate);
        }
      } catch (err) {
      }
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
      adState.skipTargetTime = Date.now() + 1e3;
      removeOverlay();
      queuePlaybackRateRestoreAfterSkip();
      if (incrementAdCounter()) showToastNotification();
    }
    function attemptScheduledSkip() {
      if (!isAdSkipperActive() || !adState.active || adState.watching) return false;
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
        attributeFilter: ["class", "style", "aria-label", "title"]
      });
    }
    const _abTagNames = [
      "YTD-ENFORCEMENT-MESSAGE-VIEW-MODEL"
    ];
    const ANTI_ADBLOCK_STYLE_ID = "ytp-css-patch-ab";
    function injectAntiAdblockCSS() {
      if (!isAdSkipperActive()) return;
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
    function nukeAdblockElement(el) {
      if (!isAdSkipperActive() || !el) return;
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
      if (!isAdSkipperActive()) return;
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
        subtree: true
      });
    }
    function dismissAdblockWarning() {
      if (!isAdSkipperActive()) return false;
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
      return isInstantSkipEnabled() ? 0 : config.skipDelay;
    }
    function scheduleSkip() {
      clearInterval(adState.countdownInterval);
      stopForceSkipBurst();
      clearSkipTimeout();
      stopSkipButtonObserver();
      const delayMs = getEffectiveDelay() * 1e3;
      const actualDelayMs = config.aggressiveSkip ? delayMs : humanDelay(delayMs);
      adState.skipTargetTime = Date.now() + actualDelayMs;
      adState.skipTimeout = setTimeout(attemptScheduledSkip, actualDelayMs);
      startSkipButtonObserver();
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
      adState.currentAd = void 0;
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
        } catch (err) {
        }
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
    function runCustomScript(reason = "manual") {
      if (!config.enabled) return false;
      const manual = reason === "manual";
      if (!manual && (!config.customScriptEnabled || !config.customScriptAutoRun)) return false;
      if (manual && config.customScriptRunAt && config.customScriptRunAt <= adState.customScriptLastRunAt) return false;
      const code = String(config.customScriptCode || "").trim();
      if (!code) return false;
      if (!manual) {
        const key = reason + ":" + getCurrentVideoKey();
        if (adState.customScriptAutoKey === key) return false;
        adState.customScriptAutoKey = key;
      }
      if (manual) adState.customScriptLastRunAt = config.customScriptRunAt || Date.now();
      try {
        const fn = new Function(code + "\n//# sourceURL=youtube-extension-custom-script.js");
        fn.call(window);
        return true;
      } catch (err) {
        console.warn("[YouTube Extension] Custom script error:", err);
        return false;
      }
    }
    function scheduleCustomScriptAutoRun(reason = "auto") {
      window.setTimeout(() => {
        runCustomScript(reason);
      }, 350);
    }
    function mainLoop() {
      runAppearanceTasks();
      updateMiniplayer();
      updatePlayerToolbar();
      if (!config.enabled) {
        if (adState.active || adState.overlayEl) cleanupRuntimeState();
        stopAdblockProtection();
        return;
      }
      if (!isAdSkipperActive()) {
        if (adState.active || adState.overlayEl) cleanupRuntimeState();
        enforceAutoplayGuards();
        applyPlayerPreferences();
        return;
      }
      bindAdSkipperWatchdog();
      dismissAdblockWarning();
      const adPlaying = getAdPlaying();
      if (!adPlaying) enforceAutoplayGuards();
      if (adPlaying && !adState.active) {
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
        applyPlayerPreferences();
        const orphans = document.querySelectorAll("#" + OVERLAY_ID);
        if (orphans.length > 0) orphans.forEach((el) => el.remove());
      }
    }
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
        { combo: config.shortcutLoop, action: "loop" }
      ];
      const matched = actions.find((item) => shortcutMatches(event, item.combo));
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
    document.addEventListener("keydown", handleConfiguredShortcut, true);
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
      markUserPlaybackIntent();
      if (config.volumeBoostEnabled && config.volumeBoostAuto && isPointerInsidePlayer(event.target)) {
        setTimeout(() => applyVolumeBoost(getActiveVideo()), 0);
      }
    }, true);
    document.addEventListener("keydown", (event) => {
      const playbackKeys = [" ", "Enter", "k", "K", "MediaPlayPause", "MediaPlay"];
      if (playbackKeys.includes(event.key)) markUserPlaybackIntent();
    }, true);
    document.addEventListener("visibilitychange", () => {
      enforceAutoplayGuards();
      scheduleAdWatchdogTick();
    });
    window.addEventListener("scroll", scheduleMiniplayerUpdate, { passive: true });
    window.addEventListener("resize", scheduleMiniplayerUpdate);
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
          console.warn("[YouTube Extension] PiP error:", err);
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
        setTimeout(updateMiniplayer, 500);
        setTimeout(updatePlayerToolbar, 500);
        scheduleCustomScriptAutoRun("navigation");
      }
    });
    _pipNavObserver.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("yt-navigate-finish", () => {
      scheduleCustomScriptAutoRun("yt-navigate-finish");
      setTimeout(() => {
        runAppearanceTasks();
        updateMiniplayer();
        updatePlayerToolbar();
        if (config.volumeBoostEnabled && config.volumeBoostAuto) applyVolumeBoost();
      }, 350);
    });
    function isInIframe() {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
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
        syncCodecSettingsToMainWorld();
        if (isAdSkipperActive()) startAdblockProtection();
        try {
          mainLoop();
        } catch (e) {
        }
        setInterval(mainLoop, CHECK_INTERVAL);
        scheduleCustomScriptAutoRun("load");
        injectPipButton();
      });
    }
    init();
  })();
})();
