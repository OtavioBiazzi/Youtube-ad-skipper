import { describe, expect, it } from "vitest";
import { chooseAdSkipAction, getAdSeekTarget, isLikelySkipControlText } from "./adStrategy";

describe("getAdSeekTarget", () => {
  it("returns a point near the end for a finite ad", () => {
    expect(getAdSeekTarget(30, 3)).toBeCloseTo(29.95);
  });

  it("does not seek when duration is unknown or invalid", () => {
    expect(getAdSeekTarget(Number.NaN, 3)).toBeNull();
    expect(getAdSeekTarget(Number.POSITIVE_INFINITY, 3)).toBeNull();
    expect(getAdSeekTarget(0, 0)).toBeNull();
  });

  it("does not seek again when playback is already at the end", () => {
    expect(getAdSeekTarget(10, 9.9)).toBeNull();
  });
});

describe("chooseAdSkipAction", () => {
  const base = {
    adConfirmed: true,
    aggressive: true,
    delayElapsed: true,
    skipButtonAvailable: false,
    watching: false,
    duration: 30,
    currentTime: 2,
  };

  it("prioritizes the native skip button", () => {
    expect(chooseAdSkipAction({ ...base, skipButtonAvailable: true })).toBe("click");
  });

  it("uses a bounded seek only for a confirmed finite ad", () => {
    expect(chooseAdSkipAction(base)).toBe("seek-end");
    expect(chooseAdSkipAction({ ...base, duration: Number.NaN })).toBe("speed-through");
  });

  it("never touches playback without a confirmed ad or while watching", () => {
    expect(chooseAdSkipAction({ ...base, adConfirmed: false })).toBe("none");
    expect(chooseAdSkipAction({ ...base, watching: true })).toBe("none");
  });

  it("waits when aggressive mode is disabled and no button exists", () => {
    expect(chooseAdSkipAction({ ...base, aggressive: false })).toBe("wait");
  });
});

describe("isLikelySkipControlText", () => {
  it.each(["Skip ad", "Pular anuncio", "Ignorar", "Omitir anuncio", "Saltar anuncio"])(
    "recognizes %s",
    (label) => expect(isLikelySkipControlText(label)).toBe(true),
  );

  it("does not match unrelated player controls", () => {
    expect(isLikelySkipControlText("Configurações")).toBe(false);
  });
});
