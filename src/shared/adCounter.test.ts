import { describe, expect, it } from "vitest";
import { shouldCountAdCompletion } from "./adCounter";

describe("ad counter", () => {
  it("counts an ad only after the extension performed a skip action", () => {
    expect(shouldCountAdCompletion({ watching: false, skipActionPerformed: true, alreadyCounted: false })).toBe(true);
  });

  it("does not count an ad that ended naturally", () => {
    expect(shouldCountAdCompletion({ watching: false, skipActionPerformed: false, alreadyCounted: false })).toBe(false);
  });

  it("does not count watched or already counted ads", () => {
    expect(shouldCountAdCompletion({ watching: true, skipActionPerformed: true, alreadyCounted: false })).toBe(false);
    expect(shouldCountAdCompletion({ watching: false, skipActionPerformed: true, alreadyCounted: true })).toBe(false);
  });
});
