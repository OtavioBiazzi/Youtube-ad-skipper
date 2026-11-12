import { describe, expect, it } from "vitest";
import { VIDEO_FILTER_DEFAULTS, VIDEO_FILTER_PRESETS, buildFilterCss, findPresetId, isNeutralFilter, normalizeVideoFilters } from "./videoFilters";

describe("video filters", () => {
  it("clamps and rounds values", () => {
    expect(normalizeVideoFilters({ brightness: 999, contrast: "80.6", saturate: -5, hue: 90 })).toEqual({
      brightness: 150, contrast: 81, saturate: 0, grayscale: 0, sepia: 0, hue: 30,
    });
  });

  it("detects the neutral state", () => {
    expect(isNeutralFilter({ ...VIDEO_FILTER_DEFAULTS })).toBe(true);
    expect(isNeutralFilter({ ...VIDEO_FILTER_DEFAULTS, sepia: 10 })).toBe(false);
  });

  it("only emits the optional filters that are in use", () => {
    expect(buildFilterCss({ ...VIDEO_FILTER_DEFAULTS })).toBe("brightness(100%) contrast(100%) saturate(100%)");
    expect(buildFilterCss({ ...VIDEO_FILTER_DEFAULTS, hue: -6, sepia: 35 })).toContain("hue-rotate(-6deg) sepia(35%)");
  });

  it("recognizes presets", () => {
    const night = VIDEO_FILTER_PRESETS.find((p) => p.id === "night")!;
    expect(findPresetId(night.values)).toBe("night");
    expect(findPresetId({ ...night.values, brightness: 50 })).toBe("");
  });
});
