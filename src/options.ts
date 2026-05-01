// ══════════════════════════════════════════════════
// YouTube Extension - Options Logic | Taste Skill
// ══════════════════════════════════════════════════

type ListMode = 'whitelist' | 'blacklist';
type QualityLevel = 'auto' | 'medium' | 'large' | 'hd720' | 'hd1080' | 'hd1440' | 'hd2160' | 'highres';
type MiniplayerSize = '360x203' | '480x270' | '640x360';
type MiniplayerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type PlayerPopupSize = '480x270' | '640x360' | '960x540';
type ToolbarPosition = 'below' | 'above';
type PlannedSettingValue = string | number | boolean;

type OptionsSettings = {
  enabled: boolean;
  adSkipperEnabled: boolean;
  skipDelay: number;
  muteAds: boolean;
  showOverlay: boolean;
  aggressiveSkip: boolean;
  warningCount: number;
  theme: string;
  totalAdsSkipped: number;
  adsSkippedToday: number;
  todayDate: string | null;
  playerDefaultsProfileVersion: number;
  whitelist: string[];
  listMode: ListMode;
  showToast: boolean;
  shortcutEnabled: boolean;
  instantSkip: boolean;
  pipEnabled: boolean;
  adSpeedRate: number;
  customSpeedEnabled: boolean;
  adaptiveSpeedEnabled: boolean;
  playerSpeedEnabled: boolean;
  playerSpeedDefault: number;
  playerSpeedStep: number;
  playerSpeedWheel: boolean;
  playerSpeedWheelRightButton: boolean;
  playerVolumeEnabled: boolean;
  playerVolumeDefault: number;
  playerVolumeStep: number;
  playerVolumeWheel: boolean;
  playerVolumeWheelRightButton: boolean;
  playerWheelInvert: boolean;
  autoplayBlockBackground: boolean;
  autoplayBlockForeground: boolean;
  autoplayAllowPlaylists: boolean;
  pauseBackgroundTabs: boolean;
  qualityEnabled: boolean;
  qualityVideo: QualityLevel;
  qualityPlaylist: QualityLevel;
  qualityFullscreenEnabled: boolean;
  qualityFullscreenVideo: QualityLevel;
  qualityFullscreenPlaylist: QualityLevel;
  qualityRestoreOnExit: boolean;
  appearanceConvertShorts: boolean;
  appearanceHideShorts: boolean;
  appearanceHideRelated: boolean;
  appearanceHideChat: boolean;
  appearanceHideComments: boolean;
  appearanceHideEndcards: boolean;
  miniplayerEnabled: boolean;
  miniplayerSize: MiniplayerSize;
  miniplayerPosition: MiniplayerPosition;
  playerPopupSize: PlayerPopupSize;
  toolbarEnabled: boolean;
  toolbarPosition: ToolbarPosition;
  toolbarCenter: boolean;
  toolbarLoop: boolean;
  toolbarSpeed: boolean;
  toolbarPopup: boolean;
  toolbarPip: boolean;
  toolbarScreenshot: boolean;
  toolbarTheater: boolean;
  toolbarSettings: boolean;
};

const DEFAULT: OptionsSettings = {
  enabled: true,
  adSkipperEnabled: true,
  skipDelay: 1,
  muteAds: true,
  showOverlay: true,
  aggressiveSkip: true,
  warningCount: 0,
  theme: 'dark',
  totalAdsSkipped: 0,
  adsSkippedToday: 0,
  todayDate: null,
  playerDefaultsProfileVersion: 0,
  whitelist: [],
  listMode: 'whitelist',
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
  playerWheelInvert: false,
  autoplayBlockBackground: true,
  autoplayBlockForeground: false,
  autoplayAllowPlaylists: true,
  pauseBackgroundTabs: false,
  qualityEnabled: false,
  qualityVideo: 'hd720',
  qualityPlaylist: 'hd720',
  qualityFullscreenEnabled: false,
  qualityFullscreenVideo: 'hd1080',
  qualityFullscreenPlaylist: 'hd1080',
  qualityRestoreOnExit: true,
  appearanceConvertShorts: false,
  appearanceHideShorts: false,
  appearanceHideRelated: false,
  appearanceHideChat: false,
  appearanceHideComments: false,
  appearanceHideEndcards: false,
  miniplayerEnabled: true,
  miniplayerSize: '480x270',
  miniplayerPosition: 'top-left',
  playerPopupSize: '640x360',
  toolbarEnabled: true,
  toolbarPosition: 'below',
  toolbarCenter: true,
  toolbarLoop: true,
  toolbarSpeed: true,
  toolbarPopup: true,
  toolbarPip: true,
  toolbarScreenshot: true,
  toolbarTheater: true,
  toolbarSettings: true,
};

const SAFE_AD_SPEED_RATE = 3;
const MIN_AD_SPEED_RATE = 1;
const MAX_AD_SPEED_RATE = 8;
const INSTANT_AD_SPEED_RATE = 16;
const PLAYER_DEFAULTS_PROFILE_VERSION = 1;
const PLAYER_DEFAULTS_PROFILE: Partial<OptionsSettings> = {
  playerSpeedEnabled: true,
  playerSpeedStep: 0.02,
  playerSpeedWheel: true,
  autoplayBlockBackground: true,
  autoplayAllowPlaylists: true,
  miniplayerEnabled: true,
  miniplayerSize: '480x270',
  miniplayerPosition: 'top-left',
  playerPopupSize: '640x360',
  toolbarEnabled: true,
  toolbarPosition: 'below',
  toolbarCenter: true,
  toolbarLoop: true,
  toolbarSpeed: true,
  toolbarPopup: true,
  toolbarPip: true,
  toolbarScreenshot: true,
  toolbarTheater: true,
  toolbarSettings: true,
};
const PLANNED_DEFAULTS: Record<string, PlannedSettingValue> = {
  playerSpeedReplaceMenu: true,
  playerSpeedMenuList: '0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4',
  playerSpeedButtonsEnabled: true,
  volumeBoostEnabled: false,
  volumeBoostLevel: 2,
  volumeBoostAuto: false,
  shortcutSkipAd: 'Shift+S',
  shortcutSpeedDown: 'Ctrl+,',
  shortcutSpeedUp: 'Ctrl+.',
  shortcutVolumeDown: 'Alt+,',
  shortcutVolumeUp: 'Alt+.',
  shortcutCinema: 'C',
  shortcutScreenshot: 'P',
  shortcutPopup: 'O',
  shortcutLoop: 'L',
  autoplayDisableAll: false,
  autoplayStopPreload: false,
  autoplayIgnorePopup: true,
  qualityPopup: 'medium',
  qualityFullscreenPopup: 'hd1080',
  miniplayerCustomSize: '480x270',
  playerPopupEnabled: true,
  playerPopupEmbeds: false,
  appearanceSortNewestComments: false,
  appearanceAutoApplyFilters: false,
  themeEngine: 'tube-shield',
  themeVariant: 'red',
  themeDeepDarkCustom: false,
  themeCustomAccent: '#ff334b',
  themeCustomBackground: '#0f0f0f',
  themeCustomText: '#f4f5f7',
  themeCustomCss: 'body {\n  --yt-spec-base-background: #0f0f0f;\n}',
  layoutVideosPerRow: 4,
  layoutChannelVideosPerRow: 4,
  layoutShortsPerRow: 8,
  layoutChannelShortsPerRow: 5,
  layoutPostsPerRow: 4,
  appearanceKeepBlackBars: false,
  appearanceAutoTheater: false,
  appearanceAutoExpandPlayer: false,
  appearanceUseViewportPlayer: false,
  cinemaColor: '#000000',
  cinemaOpacity: 85,
  cinemaDefault: false,
  cinemaAutoResize: false,
  cinemaUseYouTubeTheater: true,
  ultrawideEnabled: false,
  ultrawideFit: 'smart-crop',
  toolbarInsidePlayer: false,
  toolbarAlwaysVisible: false,
  toolbarVolumeBoost: true,
  codecForceStandardFps: false,
  codecForceAvc: false,
  customScriptEnabled: false,
  customScriptCode: '// seu script aqui\ndocument.addEventListener("yt-navigate-finish", () => {});',
  customScriptAutoRun: false,
  customScriptRunAt: 0,
};

// ── Elements ─────────────────────────────────────

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const optEnabled    = byId<HTMLInputElement>("opt-enabled");
const optAdSkipperEnabled = byId<HTMLInputElement>("opt-ad-skipper-enabled");
const optMute       = byId<HTMLInputElement>("opt-mute");
const optOverlay    = byId<HTMLInputElement>("opt-overlay");
const optAggressive = byId<HTMLInputElement>("opt-aggressive");
const optDelay      = byId<HTMLInputElement>("opt-delay");
const timingCard    = byId<HTMLElement>("timing-card");
const delayControl  = byId<HTMLElement>("delay-control");
const themeToggle   = byId<HTMLButtonElement>("theme-toggle");
const delayValue    = byId<HTMLElement>("opt-delay-value");
const delayHint     = byId<HTMLElement>("opt-delay-hint");
const statTotal     = byId<HTMLElement>("stat-total");
const statToday     = byId<HTMLElement>("stat-today");
const statWarnings  = byId<HTMLElement>("stat-warnings");
const stealthBadge  = byId<HTMLElement>("stealth-mode-badge");

const warningBox    = byId<HTMLElement>("warning-box");
const warningText   = byId<HTMLElement>("warning-text");
const versionTag    = byId<HTMLElement>("version-tag");
const btnReset      = byId<HTMLButtonElement>("btn-reset");
const stateIcons    = Array.from(document.querySelectorAll<HTMLImageElement>("[data-state-icon]"));

const whitelistInput  = byId<HTMLInputElement>("whitelist-input");
const whitelistAddBtn = byId<HTMLButtonElement>("whitelist-add");
const whitelistList   = byId<HTMLElement>("whitelist-list");
const whitelistEmpty  = byId<HTMLElement>("whitelist-empty");

const optListMode = byId<HTMLInputElement>("opt-list-mode");
const listModeLabel = byId<HTMLElement>("list-mode-label");

const optToast    = byId<HTMLInputElement>("opt-toast");
const optShortcut = byId<HTMLInputElement>("opt-shortcut");
const optInstant  = byId<HTMLInputElement>("opt-instant");
const optPip      = byId<HTMLInputElement>("opt-pip");
const optAdSpeed  = byId<HTMLInputElement>("opt-ad-speed");
const optCustomSpeed = byId<HTMLInputElement>("opt-custom-speed");
const optAdaptiveSpeed = byId<HTMLInputElement>("opt-adaptive-speed");
const adSpeedControl = byId<HTMLElement>("ad-speed-control");
const manualSpeedControl = byId<HTMLElement>("manual-speed-control");
const adSpeedValue = byId<HTMLElement>("opt-ad-speed-value");
const adSpeedBetaHint = byId<HTMLElement>("ad-speed-beta-hint");
const f5Banner    = byId<HTMLElement>("f5-banner");
const plannedControls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-setting]"));

const optPlayerSpeedEnabled = byId<HTMLInputElement>("opt-player-speed-enabled");
const optPlayerSpeedDefault = byId<HTMLInputElement>("opt-player-speed-default");
const optPlayerSpeedStep = byId<HTMLInputElement>("opt-player-speed-step");
const optPlayerSpeedWheel = byId<HTMLInputElement>("opt-player-speed-wheel");
const optPlayerSpeedRightButton = byId<HTMLInputElement>("opt-player-speed-right-button");
const optPlayerVolumeEnabled = byId<HTMLInputElement>("opt-player-volume-enabled");
const optPlayerVolumeDefault = byId<HTMLInputElement>("opt-player-volume-default");
const optPlayerVolumeStep = byId<HTMLInputElement>("opt-player-volume-step");
const optPlayerVolumeWheel = byId<HTMLInputElement>("opt-player-volume-wheel");
const optPlayerVolumeRightButton = byId<HTMLInputElement>("opt-player-volume-right-button");
const optPlayerWheelInvert = byId<HTMLInputElement>("opt-player-wheel-invert");
const optAutoplayBackground = byId<HTMLInputElement>("opt-autoplay-background");
const optAutoplayForeground = byId<HTMLInputElement>("opt-autoplay-foreground");
const optAutoplayAllowPlaylists = byId<HTMLInputElement>("opt-autoplay-allow-playlists");
const optPauseBackgroundTabs = byId<HTMLInputElement>("opt-pause-background-tabs");
const optQualityEnabled = byId<HTMLInputElement>("opt-quality-enabled");
const optQualityVideo = byId<HTMLSelectElement>("opt-quality-video");
const optQualityPlaylist = byId<HTMLSelectElement>("opt-quality-playlist");
const optQualityFullscreenEnabled = byId<HTMLInputElement>("opt-quality-fullscreen-enabled");
const optQualityFullscreenVideo = byId<HTMLSelectElement>("opt-quality-fullscreen-video");
const optQualityFullscreenPlaylist = byId<HTMLSelectElement>("opt-quality-fullscreen-playlist");
const optQualityRestore = byId<HTMLInputElement>("opt-quality-restore");
const optAppearanceConvertShorts = byId<HTMLInputElement>("opt-appearance-convert-shorts");
const optAppearanceHideShorts = byId<HTMLInputElement>("opt-appearance-hide-shorts");
const optAppearanceHideRelated = byId<HTMLInputElement>("opt-appearance-hide-related");
const optAppearanceHideChat = byId<HTMLInputElement>("opt-appearance-hide-chat");
const optAppearanceHideComments = byId<HTMLInputElement>("opt-appearance-hide-comments");
const optAppearanceHideEndcards = byId<HTMLInputElement>("opt-appearance-hide-endcards");
const optMiniplayerEnabled = byId<HTMLInputElement>("opt-miniplayer-enabled");
const optMiniplayerSize = byId<HTMLSelectElement>("opt-miniplayer-size");
const optMiniplayerPosition = byId<HTMLSelectElement>("opt-miniplayer-position");
const optPlayerPopupSize = byId<HTMLSelectElement>("opt-player-popup-size");
const optToolbarEnabled = byId<HTMLInputElement>("opt-toolbar-enabled");
const optToolbarPosition = byId<HTMLSelectElement>("opt-toolbar-position");
const optToolbarCenter = byId<HTMLInputElement>("opt-toolbar-center");
const optToolbarLoop = byId<HTMLInputElement>("opt-toolbar-loop");
const optToolbarSpeed = byId<HTMLInputElement>("opt-toolbar-speed");
const optToolbarPopup = byId<HTMLInputElement>("opt-toolbar-popup");
const optToolbarPip = byId<HTMLInputElement>("opt-toolbar-pip");
const optToolbarScreenshot = byId<HTMLInputElement>("opt-toolbar-screenshot");
const optToolbarTheater = byId<HTMLInputElement>("opt-toolbar-theater");
const optToolbarSettings = byId<HTMLInputElement>("opt-toolbar-settings");

let currentWhitelist: string[] = [];
let initialState: OptionsSettings | null = null;

// ── Load ─────────────────────────────────────────

chrome.storage.local.get(DEFAULT, (s: OptionsSettings) => {
  if ((Number(s.playerDefaultsProfileVersion) || 0) < PLAYER_DEFAULTS_PROFILE_VERSION) {
    Object.assign(s, PLAYER_DEFAULTS_PROFILE, { playerDefaultsProfileVersion: PLAYER_DEFAULTS_PROFILE_VERSION });
    chrome.storage.local.set({
      ...PLAYER_DEFAULTS_PROFILE,
      playerDefaultsProfileVersion: PLAYER_DEFAULTS_PROFILE_VERSION,
    });
  }

  initialState = JSON.parse(JSON.stringify(s));

  optEnabled.checked    = s.enabled;
  optAdSkipperEnabled.checked = s.adSkipperEnabled !== false;
  optMute.checked       = s.muteAds;
  optOverlay.checked    = s.showOverlay;
  optAggressive.checked = s.aggressiveSkip;
  optDelay.value        = String(s.skipDelay);
  
  optToast.checked      = !!s.showToast;
  optShortcut.checked   = !!s.shortcutEnabled;
  optInstant.checked    = !!s.aggressiveSkip && !!s.instantSkip;
  optPip.checked        = !!s.pipEnabled;
  optAdSpeed.value      = String(normalizeAdSpeed(s.adSpeedRate));
  optCustomSpeed.checked = !!s.customSpeedEnabled;
  optAdaptiveSpeed.checked = !!s.adaptiveSpeedEnabled;
  optListMode.checked   = s.listMode === 'blacklist';
  optPlayerSpeedEnabled.checked = !!s.playerSpeedEnabled;
  optPlayerSpeedDefault.value = formatControlNumber(normalizePlayerSpeed(s.playerSpeedDefault, DEFAULT.playerSpeedDefault));
  optPlayerSpeedStep.value = formatControlNumber(normalizePlayerSpeedStep(s.playerSpeedStep));
  optPlayerSpeedWheel.checked = !!s.playerSpeedWheel;
  optPlayerSpeedRightButton.checked = !!s.playerSpeedWheelRightButton;
  optPlayerVolumeEnabled.checked = !!s.playerVolumeEnabled;
  optPlayerVolumeDefault.value = String(normalizeVolumePercent(s.playerVolumeDefault));
  optPlayerVolumeStep.value = String(normalizeVolumeStep(s.playerVolumeStep));
  optPlayerVolumeWheel.checked = !!s.playerVolumeWheel;
  optPlayerVolumeRightButton.checked = !!s.playerVolumeWheelRightButton;
  optPlayerWheelInvert.checked = !!s.playerWheelInvert;
  optAutoplayBackground.checked = !!s.autoplayBlockBackground;
  optAutoplayForeground.checked = !!s.autoplayBlockForeground;
  optAutoplayAllowPlaylists.checked = s.autoplayAllowPlaylists !== false;
  optPauseBackgroundTabs.checked = !!s.pauseBackgroundTabs;
  optQualityEnabled.checked = !!s.qualityEnabled;
  optQualityVideo.value = normalizeQuality(s.qualityVideo);
  optQualityPlaylist.value = normalizeQuality(s.qualityPlaylist);
  optQualityFullscreenEnabled.checked = !!s.qualityFullscreenEnabled;
  optQualityFullscreenVideo.value = normalizeQuality(s.qualityFullscreenVideo);
  optQualityFullscreenPlaylist.value = normalizeQuality(s.qualityFullscreenPlaylist);
  optQualityRestore.checked = s.qualityRestoreOnExit !== false;
  optAppearanceConvertShorts.checked = !!s.appearanceConvertShorts;
  optAppearanceHideShorts.checked = !!s.appearanceHideShorts;
  optAppearanceHideRelated.checked = !!s.appearanceHideRelated;
  optAppearanceHideChat.checked = !!s.appearanceHideChat;
  optAppearanceHideComments.checked = !!s.appearanceHideComments;
  optAppearanceHideEndcards.checked = !!s.appearanceHideEndcards;
  optMiniplayerEnabled.checked = s.miniplayerEnabled !== false;
  optMiniplayerSize.value = normalizeMiniplayerSize(s.miniplayerSize);
  optMiniplayerPosition.value = normalizeMiniplayerPosition(s.miniplayerPosition);
  optPlayerPopupSize.value = normalizePlayerPopupSize(s.playerPopupSize);
  optToolbarEnabled.checked = s.toolbarEnabled !== false;
  optToolbarPosition.value = normalizeToolbarPosition(s.toolbarPosition);
  optToolbarCenter.checked = s.toolbarCenter !== false;
  optToolbarLoop.checked = s.toolbarLoop !== false;
  optToolbarSpeed.checked = s.toolbarSpeed !== false;
  optToolbarPopup.checked = s.toolbarPopup !== false;
  optToolbarPip.checked = s.toolbarPip !== false;
  optToolbarScreenshot.checked = s.toolbarScreenshot !== false;
  optToolbarTheater.checked = s.toolbarTheater !== false;
  optToolbarSettings.checked = s.toolbarSettings !== false;

  if (!s.aggressiveSkip && s.instantSkip) {
    chrome.storage.local.set({ instantSkip: false });
  }

  applyTheme(s.theme);
  renderStatus(s.enabled);
  renderWarnings(s.warningCount || 0);
  renderMode(s.aggressiveSkip);
  renderStateIcons(s.enabled, s.aggressiveSkip);
  renderListMode(s.listMode || 'whitelist');
  renderTimingControls();
  renderPlayerControlLocks();
  renderAutoplayControlLocks();
  renderQualityControlLocks();
  renderMiniplayerControlLocks();
  renderToolbarControlLocks();
  loadPlannedSettings();
  bindPlannedSettingEvents();
  
  // Stats
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const todayCount = s.todayDate === today ? (s.adsSkippedToday || 0) : 0;
  
  animateCounter(statTotal, s.totalAdsSkipped || 0);
  animateCounter(statToday, todayCount);
  
  // Whitelist
  currentWhitelist = Array.isArray(s.whitelist) ? [...s.whitelist] : [];
  renderWhitelist();
});

// Get version from manifest
try {
  versionTag.textContent = "v" + chrome.runtime.getManifest().version;
} catch (err) {
  console.warn("[YouTube Extension] Failed to read manifest version:", err);
  versionTag.textContent = "v-";
}

// ── Events ───────────────────────────────────────

optEnabled.addEventListener("change", () => {
  const on = optEnabled.checked;
  chrome.storage.local.set({ enabled: on });
  renderStatus(on);
});

optAdSkipperEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ adSkipperEnabled: optAdSkipperEnabled.checked });
});

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.contains('theme-light');
  const theme = isLight ? 'dark' : 'light';
  chrome.storage.local.set({ theme });
  applyTheme(theme);
});

function applyTheme(theme: string) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

optMute.addEventListener("change", () => {
  chrome.storage.local.set({ muteAds: optMute.checked });
});

optOverlay.addEventListener("change", () => {
  chrome.storage.local.set({ showOverlay: optOverlay.checked });
});

optAggressive.addEventListener("change", () => {
  const on = optAggressive.checked;
  if (!on && optInstant.checked) {
    optInstant.checked = false;
    chrome.storage.local.set({ aggressiveSkip: on, instantSkip: false });
  } else {
    chrome.storage.local.set({ aggressiveSkip: on });
  }
  renderMode(on);
  renderTimingControls();
});

optDelay.addEventListener("input", () => {
  const v = parseInt(optDelay.value, 10);
  chrome.storage.local.set({ skipDelay: v });
  renderTimingControls();
});

optListMode.addEventListener("change", () => {
  const mode = optListMode.checked ? 'blacklist' : 'whitelist';
  chrome.storage.local.set({ listMode: mode });
  renderListMode(mode);
});

optToast.addEventListener("change", () => {
  chrome.storage.local.set({ showToast: optToast.checked });
});

optShortcut.addEventListener("change", () => {
  chrome.storage.local.set({ shortcutEnabled: optShortcut.checked });
});

optInstant.addEventListener("change", () => {
  chrome.storage.local.set({ instantSkip: optInstant.checked });
  renderTimingControls();
});

optPip.addEventListener("change", () => {
  chrome.storage.local.set({ pipEnabled: optPip.checked });
});

optCustomSpeed.addEventListener("change", () => {
  chrome.storage.local.set({ customSpeedEnabled: optCustomSpeed.checked });
  renderTimingControls();
});

optAdaptiveSpeed.addEventListener("change", () => {
  chrome.storage.local.set({ adaptiveSpeedEnabled: optAdaptiveSpeed.checked });
  renderTimingControls();
});

optAdSpeed.addEventListener("input", () => {
  const value = normalizeAdSpeed(optAdSpeed.value);
  chrome.storage.local.set({ adSpeedRate: value });
  renderTimingControls();
});

optPlayerSpeedEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ playerSpeedEnabled: optPlayerSpeedEnabled.checked });
  renderPlayerControlLocks();
});

optPlayerSpeedDefault.addEventListener("input", () => {
  const value = normalizePlayerSpeed(optPlayerSpeedDefault.value, DEFAULT.playerSpeedDefault);
  chrome.storage.local.set({ playerSpeedDefault: value });
});

optPlayerSpeedDefault.addEventListener("change", () => {
  optPlayerSpeedDefault.value = formatControlNumber(normalizePlayerSpeed(optPlayerSpeedDefault.value, DEFAULT.playerSpeedDefault));
});

optPlayerSpeedStep.addEventListener("input", () => {
  const value = normalizePlayerSpeedStep(optPlayerSpeedStep.value);
  chrome.storage.local.set({ playerSpeedStep: value });
});

optPlayerSpeedStep.addEventListener("change", () => {
  optPlayerSpeedStep.value = formatControlNumber(normalizePlayerSpeedStep(optPlayerSpeedStep.value));
});

optPlayerSpeedWheel.addEventListener("change", () => {
  chrome.storage.local.set({ playerSpeedWheel: optPlayerSpeedWheel.checked });
  renderPlayerControlLocks();
});

optPlayerSpeedRightButton.addEventListener("change", () => {
  chrome.storage.local.set({ playerSpeedWheelRightButton: optPlayerSpeedRightButton.checked });
});

optPlayerVolumeEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ playerVolumeEnabled: optPlayerVolumeEnabled.checked });
  renderPlayerControlLocks();
});

optPlayerVolumeDefault.addEventListener("input", () => {
  const value = normalizeVolumePercent(optPlayerVolumeDefault.value);
  chrome.storage.local.set({ playerVolumeDefault: value });
});

optPlayerVolumeDefault.addEventListener("change", () => {
  optPlayerVolumeDefault.value = String(normalizeVolumePercent(optPlayerVolumeDefault.value));
});

optPlayerVolumeStep.addEventListener("input", () => {
  const value = normalizeVolumeStep(optPlayerVolumeStep.value);
  chrome.storage.local.set({ playerVolumeStep: value });
});

optPlayerVolumeStep.addEventListener("change", () => {
  optPlayerVolumeStep.value = String(normalizeVolumeStep(optPlayerVolumeStep.value));
});

optPlayerVolumeWheel.addEventListener("change", () => {
  chrome.storage.local.set({ playerVolumeWheel: optPlayerVolumeWheel.checked });
  renderPlayerControlLocks();
});

optPlayerVolumeRightButton.addEventListener("change", () => {
  chrome.storage.local.set({ playerVolumeWheelRightButton: optPlayerVolumeRightButton.checked });
});

optPlayerWheelInvert.addEventListener("change", () => {
  chrome.storage.local.set({ playerWheelInvert: optPlayerWheelInvert.checked });
});

optAutoplayBackground.addEventListener("change", () => {
  chrome.storage.local.set({ autoplayBlockBackground: optAutoplayBackground.checked });
  renderAutoplayControlLocks();
});

optAutoplayForeground.addEventListener("change", () => {
  chrome.storage.local.set({ autoplayBlockForeground: optAutoplayForeground.checked });
  renderAutoplayControlLocks();
});

optAutoplayAllowPlaylists.addEventListener("change", () => {
  chrome.storage.local.set({ autoplayAllowPlaylists: optAutoplayAllowPlaylists.checked });
});

optPauseBackgroundTabs.addEventListener("change", () => {
  chrome.storage.local.set({ pauseBackgroundTabs: optPauseBackgroundTabs.checked });
});

optQualityEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ qualityEnabled: optQualityEnabled.checked });
  renderQualityControlLocks();
});

optQualityVideo.addEventListener("change", () => {
  chrome.storage.local.set({ qualityVideo: normalizeQuality(optQualityVideo.value) });
});

optQualityPlaylist.addEventListener("change", () => {
  chrome.storage.local.set({ qualityPlaylist: normalizeQuality(optQualityPlaylist.value) });
});

optQualityFullscreenEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ qualityFullscreenEnabled: optQualityFullscreenEnabled.checked });
  renderQualityControlLocks();
});

optQualityFullscreenVideo.addEventListener("change", () => {
  chrome.storage.local.set({ qualityFullscreenVideo: normalizeQuality(optQualityFullscreenVideo.value) });
});

optQualityFullscreenPlaylist.addEventListener("change", () => {
  chrome.storage.local.set({ qualityFullscreenPlaylist: normalizeQuality(optQualityFullscreenPlaylist.value) });
});

optQualityRestore.addEventListener("change", () => {
  chrome.storage.local.set({ qualityRestoreOnExit: optQualityRestore.checked });
});

optAppearanceConvertShorts.addEventListener("change", () => {
  chrome.storage.local.set({ appearanceConvertShorts: optAppearanceConvertShorts.checked });
});

optAppearanceHideShorts.addEventListener("change", () => {
  chrome.storage.local.set({ appearanceHideShorts: optAppearanceHideShorts.checked });
});

optAppearanceHideRelated.addEventListener("change", () => {
  chrome.storage.local.set({ appearanceHideRelated: optAppearanceHideRelated.checked });
});

optAppearanceHideChat.addEventListener("change", () => {
  chrome.storage.local.set({ appearanceHideChat: optAppearanceHideChat.checked });
});

optAppearanceHideComments.addEventListener("change", () => {
  chrome.storage.local.set({ appearanceHideComments: optAppearanceHideComments.checked });
});

optAppearanceHideEndcards.addEventListener("change", () => {
  chrome.storage.local.set({ appearanceHideEndcards: optAppearanceHideEndcards.checked });
});

optMiniplayerEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ miniplayerEnabled: optMiniplayerEnabled.checked });
  renderMiniplayerControlLocks();
});

optMiniplayerSize.addEventListener("change", () => {
  chrome.storage.local.set({ miniplayerSize: normalizeMiniplayerSize(optMiniplayerSize.value) });
});

optMiniplayerPosition.addEventListener("change", () => {
  chrome.storage.local.set({ miniplayerPosition: normalizeMiniplayerPosition(optMiniplayerPosition.value) });
});

optPlayerPopupSize.addEventListener("change", () => {
  chrome.storage.local.set({ playerPopupSize: normalizePlayerPopupSize(optPlayerPopupSize.value) });
});

optToolbarEnabled.addEventListener("change", () => {
  chrome.storage.local.set({ toolbarEnabled: optToolbarEnabled.checked });
  renderToolbarControlLocks();
});

optToolbarPosition.addEventListener("change", () => {
  chrome.storage.local.set({ toolbarPosition: normalizeToolbarPosition(optToolbarPosition.value) });
});

optToolbarCenter.addEventListener("change", () => {
  chrome.storage.local.set({ toolbarCenter: optToolbarCenter.checked });
});

[
  [optToolbarLoop, "toolbarLoop"],
  [optToolbarSpeed, "toolbarSpeed"],
  [optToolbarPopup, "toolbarPopup"],
  [optToolbarPip, "toolbarPip"],
  [optToolbarScreenshot, "toolbarScreenshot"],
  [optToolbarTheater, "toolbarTheater"],
  [optToolbarSettings, "toolbarSettings"],
].forEach(([input, key]) => {
  (input as HTMLInputElement).addEventListener("change", () => {
    chrome.storage.local.set({ [key as string]: (input as HTMLInputElement).checked });
  });
});

btnReset.addEventListener("click", () => {
  if (confirm("Isso vai resetar todas as configurações e zerar o contador de anúncios e avisos. Continuar?")) {
    chrome.storage.local.set({ ...DEFAULT, ...PLANNED_DEFAULTS }, () => {
      location.reload();
    });
  }
});

// ── Whitelist Logic ───────────────────────────────

function renderWhitelist() {
  whitelistList.innerHTML = "";

  if (currentWhitelist.length === 0) {
    whitelistEmpty.style.display = "block";
    return;
  }

  whitelistEmpty.style.display = "none";

  currentWhitelist.forEach((name, i) => {
    const item = document.createElement("div");
    item.className = "whitelist-item";
    item.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="whitelist-remove" data-index="${i}" title="Remover">✕</button>
    `;
    whitelistList.appendChild(item);
  });

  whitelistList.querySelectorAll(".whitelist-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt((btn as HTMLElement).dataset.index || "0", 10);
      currentWhitelist.splice(idx, 1);
      chrome.storage.local.set({ whitelist: currentWhitelist });
      renderWhitelist();
    });
  });
}

function addWhitelistEntry() {
  const name = whitelistInput.value.trim();
  if (!name) return;

  if (currentWhitelist.some(w => w.toLowerCase() === name.toLowerCase())) {
    whitelistInput.value = "";
    flashBorder(whitelistInput, "var(--orange)");
    return;
  }

  currentWhitelist.push(name);
  chrome.storage.local.set({ whitelist: currentWhitelist });
  whitelistInput.value = "";
  renderWhitelist();
}

whitelistAddBtn.addEventListener("click", addWhitelistEntry);
whitelistInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWhitelistEntry();
});

function escapeHtml(str: string) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function flashBorder(el: HTMLElement, color: string) {
  const orig = el.style.borderColor;
  el.style.borderColor = color;
  setTimeout(() => { el.style.borderColor = orig; }, 600);
}

function getPlannedKey(control: HTMLElement) {
  return control.dataset.setting || "";
}

function setPlannedControlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: PlannedSettingValue) {
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    control.checked = value !== false;
    return;
  }

  control.value = String(value ?? "");
}

function readPlannedControlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): PlannedSettingValue {
  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    return control.checked;
  }

  if (control instanceof HTMLInputElement && control.type === "number") {
    const value = Number(control.value);
    const key = getPlannedKey(control);
    return Number.isFinite(value) ? value : PLANNED_DEFAULTS[key] || 0;
  }

  return control.value;
}

function loadPlannedSettings() {
  chrome.storage.local.get(PLANNED_DEFAULTS, (settings: Record<string, PlannedSettingValue>) => {
    plannedControls.forEach((control) => {
      const key = getPlannedKey(control);
      if (!key) return;
      setPlannedControlValue(control, settings[key] ?? PLANNED_DEFAULTS[key] ?? "");
    });
    updateCinemaPreview();
  });
}

function persistPlannedControls() {
  const values: Record<string, PlannedSettingValue> = {};
  plannedControls.forEach((control) => {
    const key = getPlannedKey(control);
    if (!key) return;
    values[key] = readPlannedControlValue(control);
  });
  chrome.storage.local.set(values);
  return values;
}

function bindPlannedSettingEvents() {
  plannedControls.forEach((control) => {
    if (control.dataset.bound === "true") return;
    control.dataset.bound = "true";

    const persist = () => {
      const key = getPlannedKey(control);
      if (!key) return;
      chrome.storage.local.set({ [key]: readPlannedControlValue(control) });
      if (key.startsWith("cinema")) updateCinemaPreview();
    };

    control.addEventListener("change", persist);
    if (!(control instanceof HTMLInputElement) || control.type !== "checkbox") {
      control.addEventListener("input", persist);
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-setting-action]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const action = button.dataset.settingAction || "";
      if (action === "themeReset") {
        const resetValues = {
          themeEngine: PLANNED_DEFAULTS.themeEngine,
          themeVariant: PLANNED_DEFAULTS.themeVariant,
          themeDeepDarkCustom: PLANNED_DEFAULTS.themeDeepDarkCustom,
          themeCustomAccent: PLANNED_DEFAULTS.themeCustomAccent,
          themeCustomBackground: PLANNED_DEFAULTS.themeCustomBackground,
          themeCustomText: PLANNED_DEFAULTS.themeCustomText,
          themeCustomCss: PLANNED_DEFAULTS.themeCustomCss,
        };
        chrome.storage.local.set(resetValues, loadPlannedSettings);
      } else if (action === "customScriptSave") {
        persistPlannedControls();
        flashBorder(button, "var(--green)");
      } else if (action === "customScriptRun") {
        persistPlannedControls();
        chrome.storage.local.set({ customScriptEnabled: true, customScriptRunAt: Date.now() });
        flashBorder(button, "var(--green)");
      } else if (action === "shortcutEditor") {
        const firstShortcut = document.querySelector<HTMLInputElement>('[data-setting="shortcutSkipAd"]');
        firstShortcut?.focus();
        firstShortcut?.select();
        flashBorder(button, "var(--accent)");
      } else if (action === "backupExport") {
        exportSettingsBackup(button);
      } else if (action === "backupImport") {
        importSettingsBackup(button);
      } else {
        flashBorder(button, "var(--accent)");
      }
    });
  });
}

function getPlannedInput(key: string) {
  return plannedControls.find(control => getPlannedKey(control) === key) || null;
}

function updateCinemaPreview() {
  const preview = document.querySelector<HTMLElement>(".cinema-preview");
  const player = document.querySelector<HTMLElement>(".cinema-preview .preview-player");
  if (!preview || !player) return;

  const color = String((getPlannedInput("cinemaColor") as HTMLInputElement | null)?.value || PLANNED_DEFAULTS.cinemaColor);
  const opacity = Number((getPlannedInput("cinemaOpacity") as HTMLInputElement | null)?.value || PLANNED_DEFAULTS.cinemaOpacity);
  const alpha = Math.min(1, Math.max(0, opacity / 100));
  preview.style.background = color;
  player.style.boxShadow = `0 0 0 999px rgba(0, 0, 0, ${alpha})`;
}

function exportSettingsBackup(button: HTMLElement) {
  chrome.storage.local.get(null, (settings) => {
    const payload = {
      app: "YouTube Extension",
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "youtube-extension-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    flashBorder(button, "var(--green)");
  });
}

function importSettingsBackup(button: HTMLElement) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const settings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
        chrome.storage.local.set(settings, () => {
          flashBorder(button, "var(--green)");
          location.reload();
        });
      } catch (err) {
        flashBorder(button, "var(--red)");
      }
    });
    reader.readAsText(file);
  });
  input.click();
}

// ── Render ────────────────────────────────────────

function renderDelay(v: number, aggressive: boolean, instant: boolean) {
  delayValue.textContent = String(instant ? 0 : v);
  if (!aggressive) {
    delayHint.textContent = "Modo agressivo desligado: aguarda o botão de pular aparecer naturalmente.";
    delayHint.style.color = "hsl(45, 75%, 52%)";
  } else if (instant) {
    delayHint.textContent = "Pulo instantâneo ativo: usa 0s e aceleração máxima.";
    delayHint.style.color = "hsl(0, 72%, 58%)";
  } else if (v <= 3) {
    delayHint.textContent = "Espera ~" + v + "s e depois pula o anúncio.";
    delayHint.style.color = "hsl(152, 55%, 42%)";
  } else if (v <= 10) {
    delayHint.textContent = "Espera ~" + v + "s e depois pula o anúncio.";
    delayHint.style.color = "hsl(45, 75%, 52%)";
  } else {
    delayHint.textContent = "Espera ~" + v + "s e depois pula o anúncio. Delay alto pode causar experiência lenta.";
    delayHint.style.color = "hsl(25, 80%, 55%)";
  }
}

function renderSlider() {
  const min = parseInt(optDelay.min, 10);
  const max = parseInt(optDelay.max, 10);
  const val = parseInt(optDelay.value, 10);
  const pct = ((val - min) / (max - min)) * 100;
  optDelay.style.background = "linear-gradient(90deg, var(--accent) " + pct + "%, var(--surface-2) " + pct + "%)";
}

function renderStatus(enabled: boolean) {
  document.body.classList.toggle("extension-disabled", !enabled);
  renderStateIcons(enabled, optAggressive.checked);
}

function renderMode(aggressive: boolean) {
  if (stealthBadge) {
    stealthBadge.textContent = aggressive ? "AGRESSIVO" : "SEGURO/FURTIVO";
    stealthBadge.style.background = aggressive ? "var(--accent-dim)" : "var(--green-dim)";
    stealthBadge.style.color = aggressive ? "var(--accent)" : "var(--green)";
  }
  renderStateIcons(optEnabled.checked, aggressive);
}

function getStateIconPath(enabled: boolean, aggressive: boolean) {
  if (!enabled) return "icon48_off.png";
  return aggressive ? "icon48.png" : "icon48_stealth.png";
}

function renderStateIcons(enabled: boolean, aggressive: boolean) {
  const path = getStateIconPath(enabled, aggressive);
  stateIcons.forEach((icon) => {
    icon.src = path;
  });
}

function renderListMode(mode: ListMode) {
  if (!listModeLabel) return;
  if (mode === 'blacklist') {
    listModeLabel.textContent = "Blacklist";
    listModeLabel.style.color = "var(--green)";
  } else {
    listModeLabel.textContent = "Whitelist";
    listModeLabel.style.color = "var(--accent)";
  }
}

function normalizeAdSpeed(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SAFE_AD_SPEED_RATE;
  return Math.min(MAX_AD_SPEED_RATE, Math.max(MIN_AD_SPEED_RATE, n));
}

function normalizePlayerSpeed(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(16, Math.max(0.25, n));
}

function normalizePlayerSpeedStep(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT.playerSpeedStep;
  return Math.min(2, Math.max(0.01, n));
}

function normalizeVolumePercent(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT.playerVolumeDefault;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeVolumeStep(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT.playerVolumeStep;
  return Math.min(25, Math.max(1, Math.round(n)));
}

function normalizeQuality(value: unknown): QualityLevel {
  const valid: QualityLevel[] = ['auto', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
  return valid.includes(value as QualityLevel) ? value as QualityLevel : DEFAULT.qualityVideo;
}

function normalizeMiniplayerSize(value: unknown): MiniplayerSize {
  const valid: MiniplayerSize[] = ['360x203', '480x270', '640x360'];
  return valid.includes(value as MiniplayerSize) ? value as MiniplayerSize : DEFAULT.miniplayerSize;
}

function normalizeMiniplayerPosition(value: unknown): MiniplayerPosition {
  const valid: MiniplayerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  return valid.includes(value as MiniplayerPosition) ? value as MiniplayerPosition : DEFAULT.miniplayerPosition;
}

function normalizePlayerPopupSize(value: unknown): PlayerPopupSize {
  const valid: PlayerPopupSize[] = ['480x270', '640x360', '960x540'];
  return valid.includes(value as PlayerPopupSize) ? value as PlayerPopupSize : DEFAULT.playerPopupSize;
}

function normalizeToolbarPosition(value: unknown): ToolbarPosition {
  const valid: ToolbarPosition[] = ['below', 'above'];
  return valid.includes(value as ToolbarPosition) ? value as ToolbarPosition : DEFAULT.toolbarPosition;
}

function formatControlNumber(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function getSafeAdaptiveSpeed(delay: number) {
  if (delay <= 3) return SAFE_AD_SPEED_RATE;
  if (delay <= 6) return 2.5;
  if (delay <= 10) return 2;
  if (delay <= 20) return 1.5;
  return 1.25;
}

function getRiskAdaptiveSpeed(delay: number) {
  if (delay <= 1) return 8;
  if (delay <= 2) return 6;
  if (delay <= 3) return 5;
  if (delay <= 5) return 4;
  if (delay <= 10) return 3;
  if (delay <= 20) return 2;
  return 1.5;
}

function getTimingState() {
  const aggressive = optAggressive.checked;
  const instant = aggressive && optInstant.checked;
  const customSpeed = optCustomSpeed.checked;
  const adaptiveSpeed = customSpeed && optAdaptiveSpeed.checked;
  return {
    aggressive,
    instant,
    locked: !aggressive || instant,
    customSpeed,
    adaptiveSpeed,
  };
}

function formatSpeed(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 1) + "x";
}

function renderTimingControls() {
  const delay = parseInt(optDelay.value, 10) || DEFAULT.skipDelay;
  const speed = normalizeAdSpeed(optAdSpeed.value);
  const state = getTimingState();

  optDelay.disabled = state.locked;
  optInstant.disabled = !state.aggressive;
  optCustomSpeed.disabled = !state.aggressive || state.instant;
  optAdaptiveSpeed.disabled = !state.aggressive || state.instant || !state.customSpeed;
  optAdSpeed.disabled = !state.aggressive || state.instant || !state.customSpeed || state.adaptiveSpeed;
  timingCard.classList.toggle("card--locked", state.locked);
  delayControl.classList.toggle("control-locked", state.locked);
  adSpeedControl.classList.toggle("is-open", state.customSpeed);
  adSpeedControl.classList.toggle("control-locked", !state.aggressive || state.instant);
  manualSpeedControl.classList.toggle("is-hidden", state.adaptiveSpeed);

  renderDelay(delay, state.aggressive, state.instant);
  renderSlider();
  renderAdSpeed(delay, speed, state);
}

function renderPlayerControlLocks() {
  optPlayerSpeedDefault.disabled = !optPlayerSpeedEnabled.checked;
  optPlayerSpeedRightButton.disabled = !optPlayerSpeedWheel.checked;
  optPlayerVolumeDefault.disabled = !optPlayerVolumeEnabled.checked;
  optPlayerVolumeRightButton.disabled = !optPlayerVolumeWheel.checked;
}

function renderAutoplayControlLocks() {
  const blockingAutoplay = optAutoplayBackground.checked || optAutoplayForeground.checked;
  optAutoplayAllowPlaylists.disabled = !blockingAutoplay;
}

function renderQualityControlLocks() {
  optQualityVideo.disabled = !optQualityEnabled.checked;
  optQualityPlaylist.disabled = !optQualityEnabled.checked;
  optQualityFullscreenVideo.disabled = !optQualityFullscreenEnabled.checked;
  optQualityFullscreenPlaylist.disabled = !optQualityFullscreenEnabled.checked;
  optQualityRestore.disabled = !optQualityFullscreenEnabled.checked;
}

function renderMiniplayerControlLocks() {
  optMiniplayerSize.disabled = !optMiniplayerEnabled.checked;
  optMiniplayerPosition.disabled = !optMiniplayerEnabled.checked;
}

function renderToolbarControlLocks() {
  const disabled = !optToolbarEnabled.checked;
  optToolbarPosition.disabled = disabled;
  optToolbarCenter.disabled = disabled;
  optToolbarLoop.disabled = disabled;
  optToolbarSpeed.disabled = disabled;
  optToolbarPopup.disabled = disabled;
  optToolbarPip.disabled = disabled;
  optToolbarScreenshot.disabled = disabled;
  optToolbarTheater.disabled = disabled;
  optToolbarSettings.disabled = disabled;
}

function renderAdSpeed(delay: number, manualSpeed: number, state = getTimingState()) {
  let speed = getSafeAdaptiveSpeed(delay);
  let labelPrefix = "auto ";
  if (state.instant) {
    speed = INSTANT_AD_SPEED_RATE;
    labelPrefix = "";
  } else if (state.customSpeed && state.adaptiveSpeed) {
    speed = getRiskAdaptiveSpeed(delay);
    labelPrefix = "adapt ";
  } else if (state.customSpeed) {
    speed = normalizeAdSpeed(manualSpeed);
    labelPrefix = "";
  }

  const isRisk = speed > SAFE_AD_SPEED_RATE;
  adSpeedValue.textContent = state.instant ? formatSpeed(speed) + " max" : labelPrefix + formatSpeed(speed);
  adSpeedValue.classList.toggle("tag--safe", !isRisk);
  adSpeedValue.classList.toggle("tag--risk", isRisk);
  const min = parseFloat(optAdSpeed.min);
  const max = parseFloat(optAdSpeed.max);
  const visualSpeed = state.instant ? max : Math.min(max, speed);
  const pct = ((visualSpeed - min) / (max - min)) * 100;
  optAdSpeed.style.background = "linear-gradient(90deg, var(--accent) " + pct + "%, var(--surface-2) " + pct + "%)";
  adSpeedBetaHint.textContent = state.adaptiveSpeed
    ? "Adaptação beta ativa: " + delay + "s usa " + formatSpeed(speed) + ". Acima de 3x pode aumentar o risco de identificação."
    : "Acima de 3x pode aumentar o risco de identificação.";
}

function animateCounter(el: HTMLElement, target: number) {
  if (!el) return;
  if (target === 0) { el.textContent = "0"; return; }
  const duration = 600;
  const start = performance.now();

  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString("pt-BR");
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function renderWarnings(count: number) {
  statWarnings.textContent = String(count);

  if (count === 0) {
    warningBox.classList.remove("warning-box--alert");
    warningText.textContent = "Nenhum aviso do YouTube interceptado.";
  } else {
    warningBox.classList.add("warning-box--alert");
    warningText.textContent = count + " aviso" + (count > 1 ? "s" : "") + " do YouTube interceptado" + (count > 1 ? "s" : "") + " e bloqueado" + (count > 1 ? "s" : "") + ".";
  }
}

// ── Live Sync ────────────────────────────────────

function checkRestartWarning() {
  if (!initialState) return;
  chrome.storage.local.get(DEFAULT, (current: OptionsSettings) => {
    const needsReload: Array<keyof OptionsSettings> = [
      'enabled', 'adSkipperEnabled', 'skipDelay', 'muteAds', 'showOverlay', 'aggressiveSkip', 'listMode',
      'instantSkip', 'pipEnabled', 'adSpeedRate', 'customSpeedEnabled', 'adaptiveSpeedEnabled'
    ];
    let changed = false;
    
    for (const key of needsReload) {
      if (current[key] !== initialState[key]) { changed = true; break; }
    }
    
    if (!changed && JSON.stringify(current.whitelist) !== JSON.stringify(initialState.whitelist)) {
      changed = true;
    }

    const initialSpeed = normalizeAdSpeed(initialState.adSpeedRate);
    const currentSpeed = normalizeAdSpeed(current.adSpeedRate);
    const currentDelay = Number(current.skipDelay) || DEFAULT.skipDelay;
    const effectiveCurrentSpeed = current.customSpeedEnabled
      ? (current.adaptiveSpeedEnabled ? getRiskAdaptiveSpeed(currentDelay) : currentSpeed)
      : getSafeAdaptiveSpeed(currentDelay);
    const riskySpeedChange = (
      (current.instantSkip && current.aggressiveSkip && current.instantSkip !== initialState.instantSkip) ||
      (effectiveCurrentSpeed > SAFE_AD_SPEED_RATE && (
        currentSpeed !== initialSpeed ||
        current.customSpeedEnabled !== initialState.customSpeedEnabled ||
        current.adaptiveSpeedEnabled !== initialState.adaptiveSpeedEnabled ||
        current.skipDelay !== initialState.skipDelay
      ))
    );
    renderRestartBanner(changed, riskySpeedChange);
  });
}

function renderRestartBanner(visible: boolean, riskySpeedChange: boolean) {
  if (!f5Banner) return;
  f5Banner.style.display = visible ? "block" : "none";
  f5Banner.classList.toggle("f5-banner--danger", riskySpeedChange);
  f5Banner.textContent = riskySpeedChange
    ? "Recarregue os vídeos do YouTube (F5) para aplicar. Aceleração acima de 3x pode aumentar o risco de identificação."
    : "Configurações alteradas! Recarregue os vídeos do YouTube (F5) para aplicar.";
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    optEnabled.checked = !!changes.enabled.newValue;
    renderStatus(!!changes.enabled.newValue);
  }
  if (changes.adSkipperEnabled) optAdSkipperEnabled.checked = changes.adSkipperEnabled.newValue !== false;
  if (changes.muteAds) optMute.checked = !!changes.muteAds.newValue;
  if (changes.showOverlay) optOverlay.checked = !!changes.showOverlay.newValue;
  if (changes.skipDelay) {
    const value = parseInt(String(changes.skipDelay.newValue), 10);
    if (!isNaN(value)) {
      optDelay.value = String(value);
      renderTimingControls();
    }
  }
  if (changes.warningCount) renderWarnings(Number(changes.warningCount.newValue) || 0);
  if (changes.aggressiveSkip) {
    optAggressive.checked = !!changes.aggressiveSkip.newValue;
    renderMode(!!changes.aggressiveSkip.newValue);
    renderTimingControls();
  }
  if (changes.theme) applyTheme(String(changes.theme.newValue));
  if (changes.listMode) {
    const mode: ListMode = changes.listMode.newValue === 'blacklist' ? 'blacklist' : 'whitelist';
    optListMode.checked = mode === 'blacklist';
    renderListMode(mode);
  }
  if (changes.showToast) optToast.checked = !!changes.showToast.newValue;
  if (changes.shortcutEnabled) optShortcut.checked = !!changes.shortcutEnabled.newValue;
  if (changes.instantSkip) {
    optInstant.checked = !!changes.instantSkip.newValue;
    renderTimingControls();
  }
  if (changes.customSpeedEnabled) {
    optCustomSpeed.checked = !!changes.customSpeedEnabled.newValue;
    renderTimingControls();
  }
  if (changes.adaptiveSpeedEnabled) {
    optAdaptiveSpeed.checked = !!changes.adaptiveSpeedEnabled.newValue;
    renderTimingControls();
  }
  if (changes.pipEnabled) optPip.checked = !!changes.pipEnabled.newValue;
  if (changes.adSpeedRate) {
    const value = normalizeAdSpeed(changes.adSpeedRate.newValue);
    optAdSpeed.value = String(value);
    renderTimingControls();
  }
  if (changes.playerSpeedEnabled) {
    optPlayerSpeedEnabled.checked = !!changes.playerSpeedEnabled.newValue;
    renderPlayerControlLocks();
  }
  if (changes.playerSpeedDefault) {
    optPlayerSpeedDefault.value = formatControlNumber(normalizePlayerSpeed(changes.playerSpeedDefault.newValue, DEFAULT.playerSpeedDefault));
  }
  if (changes.playerSpeedStep) {
    optPlayerSpeedStep.value = formatControlNumber(normalizePlayerSpeedStep(changes.playerSpeedStep.newValue));
  }
  if (changes.playerSpeedWheel) {
    optPlayerSpeedWheel.checked = !!changes.playerSpeedWheel.newValue;
    renderPlayerControlLocks();
  }
  if (changes.playerSpeedWheelRightButton) optPlayerSpeedRightButton.checked = !!changes.playerSpeedWheelRightButton.newValue;
  if (changes.playerVolumeEnabled) {
    optPlayerVolumeEnabled.checked = !!changes.playerVolumeEnabled.newValue;
    renderPlayerControlLocks();
  }
  if (changes.playerVolumeDefault) {
    optPlayerVolumeDefault.value = String(normalizeVolumePercent(changes.playerVolumeDefault.newValue));
  }
  if (changes.playerVolumeStep) {
    optPlayerVolumeStep.value = String(normalizeVolumeStep(changes.playerVolumeStep.newValue));
  }
  if (changes.playerVolumeWheel) {
    optPlayerVolumeWheel.checked = !!changes.playerVolumeWheel.newValue;
    renderPlayerControlLocks();
  }
  if (changes.playerVolumeWheelRightButton) optPlayerVolumeRightButton.checked = !!changes.playerVolumeWheelRightButton.newValue;
  if (changes.playerWheelInvert) optPlayerWheelInvert.checked = !!changes.playerWheelInvert.newValue;
  if (changes.autoplayBlockBackground) {
    optAutoplayBackground.checked = !!changes.autoplayBlockBackground.newValue;
    renderAutoplayControlLocks();
  }
  if (changes.autoplayBlockForeground) {
    optAutoplayForeground.checked = !!changes.autoplayBlockForeground.newValue;
    renderAutoplayControlLocks();
  }
  if (changes.autoplayAllowPlaylists) optAutoplayAllowPlaylists.checked = changes.autoplayAllowPlaylists.newValue !== false;
  if (changes.pauseBackgroundTabs) optPauseBackgroundTabs.checked = !!changes.pauseBackgroundTabs.newValue;
  if (changes.qualityEnabled) {
    optQualityEnabled.checked = !!changes.qualityEnabled.newValue;
    renderQualityControlLocks();
  }
  if (changes.qualityVideo) optQualityVideo.value = normalizeQuality(changes.qualityVideo.newValue);
  if (changes.qualityPlaylist) optQualityPlaylist.value = normalizeQuality(changes.qualityPlaylist.newValue);
  if (changes.qualityFullscreenEnabled) {
    optQualityFullscreenEnabled.checked = !!changes.qualityFullscreenEnabled.newValue;
    renderQualityControlLocks();
  }
  if (changes.qualityFullscreenVideo) optQualityFullscreenVideo.value = normalizeQuality(changes.qualityFullscreenVideo.newValue);
  if (changes.qualityFullscreenPlaylist) optQualityFullscreenPlaylist.value = normalizeQuality(changes.qualityFullscreenPlaylist.newValue);
  if (changes.qualityRestoreOnExit) optQualityRestore.checked = changes.qualityRestoreOnExit.newValue !== false;
  if (changes.appearanceConvertShorts) optAppearanceConvertShorts.checked = !!changes.appearanceConvertShorts.newValue;
  if (changes.appearanceHideShorts) optAppearanceHideShorts.checked = !!changes.appearanceHideShorts.newValue;
  if (changes.appearanceHideRelated) optAppearanceHideRelated.checked = !!changes.appearanceHideRelated.newValue;
  if (changes.appearanceHideChat) optAppearanceHideChat.checked = !!changes.appearanceHideChat.newValue;
  if (changes.appearanceHideComments) optAppearanceHideComments.checked = !!changes.appearanceHideComments.newValue;
  if (changes.appearanceHideEndcards) optAppearanceHideEndcards.checked = !!changes.appearanceHideEndcards.newValue;
  if (changes.miniplayerEnabled) {
    optMiniplayerEnabled.checked = changes.miniplayerEnabled.newValue !== false;
    renderMiniplayerControlLocks();
  }
  if (changes.miniplayerSize) optMiniplayerSize.value = normalizeMiniplayerSize(changes.miniplayerSize.newValue);
  if (changes.miniplayerPosition) optMiniplayerPosition.value = normalizeMiniplayerPosition(changes.miniplayerPosition.newValue);
  if (changes.playerPopupSize) optPlayerPopupSize.value = normalizePlayerPopupSize(changes.playerPopupSize.newValue);
  if (changes.toolbarEnabled) {
    optToolbarEnabled.checked = changes.toolbarEnabled.newValue !== false;
    renderToolbarControlLocks();
  }
  if (changes.toolbarPosition) optToolbarPosition.value = normalizeToolbarPosition(changes.toolbarPosition.newValue);
  if (changes.toolbarCenter) optToolbarCenter.checked = changes.toolbarCenter.newValue !== false;
  if (changes.toolbarLoop) optToolbarLoop.checked = changes.toolbarLoop.newValue !== false;
  if (changes.toolbarSpeed) optToolbarSpeed.checked = changes.toolbarSpeed.newValue !== false;
  if (changes.toolbarPopup) optToolbarPopup.checked = changes.toolbarPopup.newValue !== false;
  if (changes.toolbarPip) optToolbarPip.checked = changes.toolbarPip.newValue !== false;
  if (changes.toolbarScreenshot) optToolbarScreenshot.checked = changes.toolbarScreenshot.newValue !== false;
  if (changes.toolbarTheater) optToolbarTheater.checked = changes.toolbarTheater.newValue !== false;
  if (changes.toolbarSettings) optToolbarSettings.checked = changes.toolbarSettings.newValue !== false;
  plannedControls.forEach((control) => {
    const key = getPlannedKey(control);
    if (!key || !changes[key] || document.activeElement === control) return;
    const nextValue = (changes[key].newValue ?? PLANNED_DEFAULTS[key] ?? "") as PlannedSettingValue;
    setPlannedControlValue(control, nextValue);
  });
  if (changes.cinemaColor || changes.cinemaOpacity) updateCinemaPreview();
  
  if (changes.totalAdsSkipped) {
    animateCounter(statTotal, Number(changes.totalAdsSkipped.newValue) || 0);
  }
  if (changes.adsSkippedToday) {
    animateCounter(statToday, Number(changes.adsSkippedToday.newValue) || 0);
  }
  if (changes.whitelist) {
    currentWhitelist = Array.isArray(changes.whitelist.newValue) ? [...changes.whitelist.newValue] : [];
    renderWhitelist();
  }
  
  checkRestartWarning();
});

export {};
