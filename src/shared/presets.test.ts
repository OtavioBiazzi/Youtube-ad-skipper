import { describe, expect, it } from "vitest";
import { getSettingsPreset, getThemePreset, SETTINGS_PRESETS, THEME_PRESETS } from "./presets";
import { DEFAULT_SETTINGS } from "./settings";

describe("settings presets", () => {
  it("keeps the safe preset on native-button-only behavior", () => {
    expect(SETTINGS_PRESETS.safe.aggressiveSkip).toBe(false);
    expect(SETTINGS_PRESETS.safe.instantSkip).toBe(false);
    expect(SETTINGS_PRESETS.safe.customSpeedEnabled).toBe(false);
  });

  it("caps the balanced preset at the safe automatic speed", () => {
    expect(SETTINGS_PRESETS.balanced.adSpeedRate).toBeLessThanOrEqual(3);
    expect(SETTINGS_PRESETS.balanced.adaptiveSpeedEnabled).toBe(false);
  });

  it("marks focus as a visual preset without changing skipper behavior", () => {
    const focus = getSettingsPreset("focus");
    expect(focus?.appearanceHideShorts).toBe(true);
    expect(focus?.themeVariant).toBe("deep-dark");
    expect(focus).not.toHaveProperty("aggressiveSkip");
  });

  it("returns a copy and rejects unknown presets", () => {
    const first = getSettingsPreset("balanced");
    const second = getSettingsPreset("balanced");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(getSettingsPreset("unknown")).toBeNull();
  });

  it("maps visual theme presets to supported engines and variants", () => {
    expect(getThemePreset("graphite")).toEqual({ themeEngine: "tube-shield", themeVariant: "red" });
    expect(getThemePreset("warm")?.themeVariant).toBe("warm");
    expect(getThemePreset("unknown")).toBeNull();
  });

  it("uses only settings recognized by the shared schema", () => {
    for (const preset of [...Object.values(SETTINGS_PRESETS), ...Object.values(THEME_PRESETS)]) {
      for (const key of Object.keys(preset)) {
        expect(key in DEFAULT_SETTINGS).toBe(true);
      }
    }
  });
});
