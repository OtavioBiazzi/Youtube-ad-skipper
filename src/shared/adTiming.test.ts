import { describe, expect, it } from "vitest";
import {
  INSTANT_AD_SPEED_RATE,
  formatSpeed,
  getRiskAdaptiveSpeed,
  getSafeAdaptiveSpeed,
  normalizeSkipDelay,
  normalizeSpeedRate,
} from "./adTiming";

describe("ad timing helpers", () => {
  it("normalizes skip delay into the supported range", () => {
    expect(normalizeSkipDelay(0)).toBe(1);
    expect(normalizeSkipDelay(99)).toBe(30);
    expect(normalizeSkipDelay("8")).toBe(8);
    expect(normalizeSkipDelay("nope")).toBe(1);
  });

  it("normalizes ad speed into the manual safe range", () => {
    expect(normalizeSpeedRate(0)).toBe(1);
    expect(normalizeSpeedRate(99)).toBe(8);
    expect(normalizeSpeedRate("4")).toBe(4);
    expect(normalizeSpeedRate("nope")).toBe(3);
  });

  it("uses conservative adaptive speeds by default", () => {
    expect(getSafeAdaptiveSpeed(1)).toBe(3);
    expect(getSafeAdaptiveSpeed(8)).toBe(2);
    expect(getSafeAdaptiveSpeed(25)).toBe(1.25);
  });

  it("uses riskier adaptive speeds only when requested", () => {
    expect(getRiskAdaptiveSpeed(1)).toBe(8);
    expect(getRiskAdaptiveSpeed(4)).toBe(4);
    expect(getRiskAdaptiveSpeed(25)).toBe(1.5);
  });

  it("formats speed labels", () => {
    expect(formatSpeed(3)).toBe("3x");
    expect(formatSpeed(2.5)).toBe("2.5x");
    expect(formatSpeed("nope")).toBe("3x");
    expect(INSTANT_AD_SPEED_RATE).toBe(16);
  });
});
