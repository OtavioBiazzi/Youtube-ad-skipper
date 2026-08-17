export const SETTINGS_VERSION = 1;
export const PLAYER_DEFAULTS_PROFILE_VERSION = 3;

export type ListMode = "whitelist" | "blacklist";
export type QualityLevel = "auto" | "medium" | "large" | "hd720" | "hd1080" | "hd1440" | "hd2160" | "highres";
export type MiniplayerSize = "360x203" | "480x270" | "640x360";
export type MiniplayerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type PlayerPopupSize = "480x270" | "640x360" | "960x540";
export type ToolbarPosition = "below" | "above";
export type PlannedSettingValue = string | number | boolean;
export type StoredSettingValue = PlannedSettingValue | string[] | null;

export const PLAYER_DEFAULTS_PROFILE: Record<string, PlannedSettingValue> = {
  playerSpeedEnabled: true,
  playerSpeedStep: 0.02,
  playerSpeedWheel: true,
  autoplayBlockBackground: false,
  autoplayBlockForeground: false,
  autoplayDisableAll: false,
  autoplayStopPreload: false,
  pauseBackgroundTabs: false,
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
  shortcutLoop: "Alt+Shift+L",
};

export const DEFAULT_SETTINGS = {
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
  whitelist: [] as string[],
  listMode: "whitelist" as ListMode,
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
  qualityVideo: "hd720" as QualityLevel,
  qualityPlaylist: "hd720" as QualityLevel,
  qualityFullscreenEnabled: false,
  qualityFullscreenVideo: "hd1080" as QualityLevel,
  qualityFullscreenPlaylist: "hd1080" as QualityLevel,
  qualityPopup: "medium" as QualityLevel,
  qualityFullscreenPopup: "hd1080" as QualityLevel,
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
  miniplayerSize: "480x270" as MiniplayerSize,
  miniplayerPosition: "top-left" as MiniplayerPosition,
  playerPopupSize: "640x360" as PlayerPopupSize,
  toolbarEnabled: true,
  toolbarPosition: "below" as ToolbarPosition,
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
  toolbarAttachToActions: false,
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
};

export type ExtensionSettings = typeof DEFAULT_SETTINGS;
export type ExtensionSettingKey = keyof ExtensionSettings;

export const SETTINGS_EXPORT_KEYS = Object.keys(DEFAULT_SETTINGS);

export function normalizeSettings(raw: Record<string, unknown> = {}) {
  const normalized: Record<string, StoredSettingValue> = { ...DEFAULT_SETTINGS };

  for (const key of SETTINGS_EXPORT_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    const fallback = normalized[key];

    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) normalized[key] = value.filter((item): item is string => typeof item === "string");
      continue;
    }
    if (fallback === null) {
      if (value === null || typeof value === "string") normalized[key] = value as string | null;
      continue;
    }
    if (typeof fallback === "number") {
      if (typeof value === "number" && Number.isFinite(value)) normalized[key] = value;
      continue;
    }
    if (typeof value === typeof fallback) normalized[key] = value as PlannedSettingValue;
  }

  return normalized;
}

export function migrateSettings(raw: Record<string, unknown> = {}) {
  const settings = normalizeSettings(raw);

  if ((Number(settings.playerDefaultsProfileVersion) || 0) < PLAYER_DEFAULTS_PROFILE_VERSION) {
    Object.assign(settings, PLAYER_DEFAULTS_PROFILE, {
      playerDefaultsProfileVersion: PLAYER_DEFAULTS_PROFILE_VERSION,
    });
  }

  return settings;
}
