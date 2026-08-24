import { describe, expect, it } from "vitest";
import { shouldApplyPlaybackRate } from "./playback";

describe("playback mutation policy", () => {
  it("does not touch the player when the requested rate is already active", () => {
    expect(shouldApplyPlaybackRate(1, 1)).toBe(false);
    expect(shouldApplyPlaybackRate(1.25, 1.25)).toBe(false);
  });

  it("allows an intentional rate change", () => {
    expect(shouldApplyPlaybackRate(1, 1.25)).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(shouldApplyPlaybackRate(Number.NaN, 1)).toBe(false);
    expect(shouldApplyPlaybackRate(1, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
