import { describe, expect, it } from "vitest";
import { decideLiveRate, normalizeLiveMode } from "./liveLatency";

const base = { latency: 10, bufferHealth: 9, mode: "balanced" as const, maxRate: 1.25, engaged: false, jumpEnabled: true };

describe("live catch-up", () => {
  it("speeds up when behind live with buffer to spare", () => {
    const d = decideLiveRate(base);
    expect(d.engaged).toBe(true);
    expect(d.rate).toBeGreaterThan(1);
    expect(d.rate).toBeLessThanOrEqual(1.25);
  });

  it("never exceeds the max rate", () => {
    expect(decideLiveRate({ ...base, latency: 60, bufferHealth: 25, jumpEnabled: false }).rate).toBe(1.25);
  });

  it("does nothing when already close to live", () => {
    expect(decideLiveRate({ ...base, latency: 1.5 }).rate).toBe(1);
  });

  it("never accelerates with a thin buffer (stall guard)", () => {
    expect(decideLiveRate({ ...base, bufferHealth: 1.2, engaged: true }).rate).toBe(1);
  });

  it("uses a hysteresis band around the cushion", () => {
    // Just above the cushion: not engaged yet -> rest.
    expect(decideLiveRate({ ...base, bufferHealth: 4.8 }).rate).toBe(1);
    // Same buffer while already engaged -> keeps spending.
    expect(decideLiveRate({ ...base, bufferHealth: 4.8, engaged: true }).rate).toBeGreaterThan(1);
    // At the cushion -> disengage.
    expect(decideLiveRate({ ...base, bufferHealth: 4, engaged: true }).engaged).toBe(false);
  });

  it("closer modes keep a smaller cushion", () => {
    expect(decideLiveRate({ ...base, bufferHealth: 4, mode: "extreme" }).rate).toBeGreaterThan(1);
    expect(decideLiveRate({ ...base, bufferHealth: 4, mode: "balanced" }).rate).toBe(1);
  });

  it("jumps to live when far behind, only if enabled", () => {
    expect(decideLiveRate({ ...base, latency: 45 }).jumpToLive).toBe(true);
    expect(decideLiveRate({ ...base, latency: 45, jumpEnabled: false }).jumpToLive).toBe(false);
  });

  it("ignores missing stats", () => {
    expect(decideLiveRate({ ...base, latency: Number.NaN })).toEqual({ rate: 1, engaged: false, jumpToLive: false });
  });

  it("normalizes unknown modes", () => {
    expect(normalizeLiveMode("weird")).toBe("balanced");
    expect(normalizeLiveMode("close")).toBe("close");
  });
});
