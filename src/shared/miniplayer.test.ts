import { describe, expect, it } from "vitest";
import { shouldFloatPlayer, shouldResetMiniplayerDismissal } from "./miniplayer";

const base = { eligible: true, currentlyActive: false, dismissed: false, mastheadHeight: 56 };

describe("miniplayer hysteresis", () => {
  it("stays docked while the player is visible", () => {
    expect(shouldFloatPlayer({ ...base, slotBottom: 600 })).toBe(false);
  });

  it("floats once the player slot is scrolled past the masthead", () => {
    expect(shouldFloatPlayer({ ...base, slotBottom: 20 })).toBe(true);
  });

  it("does not flicker around the threshold", () => {
    // Just above the enter line: stays docked if docked, stays floating if floating.
    expect(shouldFloatPlayer({ ...base, slotBottom: 120 })).toBe(false);
    expect(shouldFloatPlayer({ ...base, currentlyActive: true, slotBottom: 120 })).toBe(true);
    // Far enough back: docks again.
    expect(shouldFloatPlayer({ ...base, currentlyActive: true, slotBottom: 300 })).toBe(false);
  });

  it("respects dismissal and eligibility", () => {
    expect(shouldFloatPlayer({ ...base, dismissed: true, slotBottom: 0 })).toBe(false);
    expect(shouldFloatPlayer({ ...base, eligible: false, slotBottom: 0 })).toBe(false);
  });

  it("keeps the current state when the slot cannot be measured", () => {
    expect(shouldFloatPlayer({ ...base, currentlyActive: true, slotBottom: Number.NaN })).toBe(true);
  });

  it("re-arms dismissal only when the player is back in view", () => {
    expect(shouldResetMiniplayerDismissal(100, 56)).toBe(false);
    expect(shouldResetMiniplayerDismissal(500, 56)).toBe(true);
  });
});
