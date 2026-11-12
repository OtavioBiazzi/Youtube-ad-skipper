import { describe, expect, it } from "vitest";
import { formatClock, getResumeSaveAction, getResumeTarget, pruneResumeStore } from "./resume";

describe("resume playback", () => {
  it("only tracks long videos past the first 30s", () => {
    expect(getResumeSaveAction(100, 90)).toBe("skip");
    expect(getResumeSaveAction(10, 600)).toBe("skip");
    expect(getResumeSaveAction(200, 600)).toBe("save");
    expect(getResumeSaveAction(590, 600)).toBe("delete");
    expect(getResumeSaveAction(100, Number.POSITIVE_INFINITY)).toBe("skip");
  });

  it("resumes a little before the saved position", () => {
    expect(getResumeTarget({ t: 300, d: 600, at: 1 }, 600, false)).toBe(298);
  });

  it("never overrides an explicit ?t= start", () => {
    expect(getResumeTarget({ t: 300, d: 600, at: 1 }, 600, true)).toBeNull();
  });

  it("waits until the element holds the right video", () => {
    expect(getResumeTarget({ t: 300, d: 600, at: 1 }, 1200, false)).toBeNull();
  });

  it("prunes the oldest entries", () => {
    const store = { a: { t: 40, d: 600, at: 1 }, b: { t: 40, d: 600, at: 3 }, c: { t: 40, d: 600, at: 2 } };
    expect(Object.keys(pruneResumeStore(store, 2)).sort()).toEqual(["b", "c"]);
  });

  it("formats clock values", () => {
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});
