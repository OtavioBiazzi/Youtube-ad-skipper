import type { ExtensionSettings } from "./settings";

export type SettingsPresetId = "safe" | "balanced" | "turbo" | "focus";
export type ThemePresetId = "graphite" | "deep-dark" | "slate" | "warm";

export const SETTINGS_PRESETS: Record<SettingsPresetId, Partial<ExtensionSettings>> = {
  safe: {
    enabled: true,
    adSkipperEnabled: true,
    aggressiveSkip: false,
    instantSkip: false,
    skipDelay: 5,
    muteAds: true,
    showOverlay: true,
    customSpeedEnabled: false,
    adaptiveSpeedEnabled: false,
    adSpeedRate: 3,
  },
  balanced: {
    enabled: true,
    adSkipperEnabled: true,
    aggressiveSkip: true,
    instantSkip: false,
    skipDelay: 1,
    muteAds: true,
    showOverlay: true,
    customSpeedEnabled: false,
    adaptiveSpeedEnabled: false,
    adSpeedRate: 3,
  },
  turbo: {
    enabled: true,
    adSkipperEnabled: true,
    aggressiveSkip: true,
    instantSkip: false,
    skipDelay: 1,
    muteAds: true,
    showOverlay: true,
    customSpeedEnabled: true,
    adaptiveSpeedEnabled: true,
    adSpeedRate: 6,
  },
  focus: {
    appearanceHideShorts: true,
    appearanceHideRelated: true,
    appearanceHideChat: true,
    appearanceHideComments: true,
    appearanceHideEndcards: true,
    appearanceAutoTheater: true,
    cinemaDefault: true,
    themeEngine: "tube-shield",
    themeVariant: "deep-dark",
  },
};

export function getSettingsPreset(id: string) {
  if (!(id in SETTINGS_PRESETS)) return null;
  return { ...SETTINGS_PRESETS[id as SettingsPresetId] };
}

export const THEME_PRESETS: Record<ThemePresetId, Partial<ExtensionSettings>> = {
  graphite: { themeEngine: "tube-shield", themeVariant: "red" },
  "deep-dark": { themeEngine: "deepdark", themeVariant: "deep-dark" },
  slate: { themeEngine: "tube-shield", themeVariant: "blue" },
  warm: { themeEngine: "tube-shield", themeVariant: "warm" },
};

export function getThemePreset(id: string) {
  if (!(id in THEME_PRESETS)) return null;
  return { ...THEME_PRESETS[id as ThemePresetId] };
}
