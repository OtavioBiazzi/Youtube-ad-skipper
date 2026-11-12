import { describe, expect, it } from "vitest";
import { AutoplayContext, getAutoplayBlockReason } from "./autoplay";

const base: AutoplayContext = {
  enabled: true,
  adActive: false,
  isMainVideo: true,
  currentTime: 0,
  hidden: true,
  isPopup: false,
  ignorePopup: true,
  isPlaylist: false,
  allowPlaylists: true,
  recentIntent: false,
  alreadyBlockedThisVideo: false,
  msSinceAdEnded: Number.POSITIVE_INFINITY,
  disableAll: false,
  blockBackground: true,
  blockForeground: false,
};

describe("autoplay guard", () => {
  it("blocks background autoplay when enabled", () => {
    expect(getAutoplayBlockReason(base)).toBe("background-autoplay");
  });

  it("never touches hover previews or non-main videos", () => {
    expect(getAutoplayBlockReason({ ...base, isMainVideo: false })).toBe("");
  });

  it("blocks a video at most once so manual resumes always work", () => {
    expect(getAutoplayBlockReason({ ...base, alreadyBlockedThisVideo: true })).toBe("");
  });

  it("does not pause content that starts right after an ad", () => {
    expect(getAutoplayBlockReason({ ...base, msSinceAdEnded: 1500 })).toBe("");
    expect(getAutoplayBlockReason({ ...base, adActive: true })).toBe("");
  });

  it("ignores videos already past the start window", () => {
    expect(getAutoplayBlockReason({ ...base, currentTime: 12 })).toBe("");
  });

  it("respects recent user intent, playlists and popups", () => {
    expect(getAutoplayBlockReason({ ...base, recentIntent: true })).toBe("");
    expect(getAutoplayBlockReason({ ...base, isPlaylist: true })).toBe("");
    expect(getAutoplayBlockReason({ ...base, isPopup: true })).toBe("");
  });

  it("does nothing in the foreground unless asked", () => {
    expect(getAutoplayBlockReason({ ...base, hidden: false })).toBe("");
    expect(getAutoplayBlockReason({ ...base, hidden: false, blockForeground: true })).toBe("foreground-autoplay");
  });

  it("disable-all wins over the per-visibility switches", () => {
    expect(getAutoplayBlockReason({ ...base, hidden: false, blockBackground: false, disableAll: true })).toBe("autoplay-disable-all");
  });
});
