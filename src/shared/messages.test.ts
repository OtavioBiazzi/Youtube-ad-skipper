import { describe, expect, it, vi } from "vitest";
import {
  CODEC_SETTINGS_MESSAGE,
  MAIN_FORCE_SKIP_MESSAGE,
  MAIN_FORCE_SKIP_RESULT,
  MAIN_QUALITY_MESSAGE,
  MAIN_SESSION_MESSAGE,
  MAIN_SPEED_THROUGH_MESSAGE,
  createBridgeSessionToken,
  isBridgeMessage,
} from "./messages";

describe("shared bridge messages", () => {
  it("keeps bridge source names stable", () => {
    expect(MAIN_SESSION_MESSAGE).toBe("youtube-extension:main-session");
    expect(MAIN_FORCE_SKIP_MESSAGE).toBe("yt-ad-skipper:force-skip");
    expect(MAIN_SPEED_THROUGH_MESSAGE).toBe("yt-ad-skipper:speed-through");
    expect(MAIN_FORCE_SKIP_RESULT).toBe("yt-ad-skipper:force-skip-result");
    expect(MAIN_QUALITY_MESSAGE).toBe("youtube-extension:set-quality");
    expect(CODEC_SETTINGS_MESSAGE).toBe("youtube-extension:codec-settings");
  });

  it("recognizes only object messages with string source", () => {
    expect(isBridgeMessage({ source: MAIN_SESSION_MESSAGE })).toBe(true);
    expect(isBridgeMessage({ source: 10 })).toBe(false);
    expect(isBridgeMessage(null)).toBe(false);
    expect(isBridgeMessage("youtube-extension:main-session")).toBe(false);
  });

  it("creates random-looking session tokens with native crypto", () => {
    const first = createBridgeSessionToken();
    const second = createBridgeSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(10);
  });

  it("falls back when crypto generation is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", undefined);

    try {
      expect(createBridgeSessionToken()).toMatch(/-/);
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });
});
