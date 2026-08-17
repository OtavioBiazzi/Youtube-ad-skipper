import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  PLAYER_DEFAULTS_PROFILE,
  PLAYER_DEFAULTS_PROFILE_VERSION,
  SETTINGS_EXPORT_KEYS,
  migrateSettings,
  normalizeSettings,
} from "./settings";

describe("shared settings", () => {
  it("keeps known defaults available for all extension surfaces", () => {
    const settings = normalizeSettings();

    expect(settings.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(settings.skipDelay).toBe(DEFAULT_SETTINGS.skipDelay);
    expect(settings.miniplayerSize).toBe(DEFAULT_SETTINGS.miniplayerSize);
    expect(settings.toolbarEnabled).toBe(DEFAULT_SETTINGS.toolbarEnabled);
  });

  it("preserves stored values while filling missing defaults", () => {
    const settings = normalizeSettings({
      enabled: false,
      skipDelay: 8,
      miniplayerPosition: "bottom-right",
    });

    expect(settings.enabled).toBe(false);
    expect(settings.skipDelay).toBe(8);
    expect(settings.miniplayerPosition).toBe("bottom-right");
    expect(settings.adSkipperEnabled).toBe(true);
  });

  it("drops unknown keys and invalid value types", () => {
    const settings = normalizeSettings({
      enabled: "yes",
      skipDelay: Number.POSITIVE_INFINITY,
      whitelist: ["@canal", 42, null],
      injectedSetting: true,
    });

    expect(settings.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(settings.skipDelay).toBe(DEFAULT_SETTINGS.skipDelay);
    expect(settings.whitelist).toEqual(["@canal"]);
    expect("injectedSetting" in settings).toBe(false);
  });

  it("applies the player defaults profile migration once old storage is detected", () => {
    const settings = migrateSettings({
      playerDefaultsProfileVersion: 0,
      toolbarEnabled: false,
      miniplayerSize: "360x203",
    });

    expect(settings.playerDefaultsProfileVersion).toBe(PLAYER_DEFAULTS_PROFILE_VERSION);
    expect(settings.toolbarEnabled).toBe(PLAYER_DEFAULTS_PROFILE.toolbarEnabled);
    expect(settings.miniplayerSize).toBe(PLAYER_DEFAULTS_PROFILE.miniplayerSize);
  });

  it("disables legacy automatic pause controls during the safe profile migration", () => {
    const settings = migrateSettings({
      playerDefaultsProfileVersion: 2,
      autoplayBlockBackground: true,
      autoplayBlockForeground: true,
      autoplayDisableAll: true,
      autoplayStopPreload: true,
      pauseBackgroundTabs: true,
    });

    expect(settings.playerDefaultsProfileVersion).toBe(PLAYER_DEFAULTS_PROFILE_VERSION);
    expect(settings.autoplayBlockBackground).toBe(false);
    expect(settings.autoplayBlockForeground).toBe(false);
    expect(settings.autoplayDisableAll).toBe(false);
    expect(settings.autoplayStopPreload).toBe(false);
    expect(settings.pauseBackgroundTabs).toBe(false);
  });

  it("exposes import/export keys without duplicates", () => {
    const unique = new Set(SETTINGS_EXPORT_KEYS);

    expect(unique.size).toBe(SETTINGS_EXPORT_KEYS.length);
    expect(unique.has("enabled")).toBe(true);
    expect(unique.has("themeEngine")).toBe(true);
    expect(unique.has("qualityVideo")).toBe(true);
  });
});
