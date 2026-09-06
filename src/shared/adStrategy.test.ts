import { describe, expect, it } from "vitest";
import { chooseAdSkipAction, isLikelySkipControlText } from "./adStrategy";

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

  it("uses safe acceleration instead of seeking the media to its end", () => {
    expect(chooseAdSkipAction(base)).toBe("speed-through");
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
