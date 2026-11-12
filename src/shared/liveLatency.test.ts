import { describe, expect, it } from "vitest";
import { decideLiveRate, normalizeLiveMode } from "./liveLatency";

const base = { latency: 14, behind: 10, bufferHealth: 6, mode: "balanced" as const, maxRate: 1.25, engaged: false, jumpEnabled: true };

describe("live catch-up", () => {
  it("speeds up to the max when well behind the newest segment", () => {
    const d = decideLiveRate(base);
    expect(d.engaged).toBe(true);
    expect(d.rate).toBe(1.25);
  });

  it("speeds up even when YouTube buffers only a few seconds ahead", () => {
    // 25 s behind with a 3 s buffer: the old engine stayed at 1x here.
    expect(decideLiveRate({ ...base, behind: 25, bufferHealth: 3 }).rate).toBe(1.25);
  });

  it("never exceeds the max rate", () => {
    expect(decideLiveRate({ ...base, behind: 29, maxRate: 1.5 }).rate).toBe(1.5);
  });

  it("does nothing when already close to the newest segment", () => {
    expect(decideLiveRate({ ...base, behind: 4.5 }).rate).toBe(1);
  });

  it("falls back to latency when the player has no seek range", () => {
    expect(decideLiveRate({ ...base, behind: Number.NaN, latency: 12 }).rate).toBeGreaterThan(1);
  });

  it("holds at 1x with a thin buffer but stays engaged", () => {
    const d = decideLiveRate({ ...base, bufferHealth: 1.2, engaged: true });
    expect(d.rate).toBe(1);
    expect(d.engaged).toBe(true);
  });

  it("uses a hysteresis band around the cushion", () => {
    expect(decideLiveRate({ ...base, behind: 5 }).rate).toBe(1);
    expect(decideLiveRate({ ...base, behind: 5, engaged: true }).rate).toBeGreaterThan(1);
    expect(decideLiveRate({ ...base, behind: 4.2, engaged: true }).engaged).toBe(false);
  });

  it("closer modes keep a smaller cushion", () => {
    expect(decideLiveRate({ ...base, behind: 4, mode: "extreme" }).rate).toBeGreaterThan(1);
    expect(decideLiveRate({ ...base, behind: 4, mode: "balanced" }).rate).toBe(1);
  });

  it("jumps to live when far behind, only if enabled", () => {
    expect(decideLiveRate({ ...base, behind: 45 }).jumpToLive).toBe(true);
    expect(decideLiveRate({ ...base, behind: 45, jumpEnabled: false }).jumpToLive).toBe(false);
  });

  it("ignores missing stats", () => {
    expect(decideLiveRate({ ...base, latency: Number.NaN, behind: Number.NaN })).toEqual({ rate: 1, engaged: false, jumpToLive: false });
  });

  it("normalizes unknown modes", () => {
    expect(normalizeLiveMode("weird")).toBe("balanced");
    expect(normalizeLiveMode("close")).toBe("close");
  });
});
