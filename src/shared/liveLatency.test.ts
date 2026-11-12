import { describe, expect, it } from "vitest";
import { decideLiveRate, getBufferAhead } from "./liveLatency";

const base = { target: 3, currentRate: 1, maxRate: 1.25 };

describe("live catch-up", () => {
  it("stays at 1x when the delay is on target", () => {
    expect(decideLiveRate({ ...base, bufferAhead: 3.5 })).toEqual({ rate: 1, jumpBy: 0 });
  });

  it("speeds up gently for a small excess", () => {
    const { rate } = decideLiveRate({ ...base, bufferAhead: 5 });
    expect(rate).toBeGreaterThan(1);
    expect(rate).toBeLessThan(1.15);
  });

  it("never exceeds the max rate", () => {
    expect(decideLiveRate({ ...base, bufferAhead: 25 }).rate).toBe(1.25);
  });

  it("keeps catching up until the target is reached (hysteresis)", () => {
    expect(decideLiveRate({ ...base, bufferAhead: 3.6, currentRate: 1.1 }).rate).toBeGreaterThan(1);
    expect(decideLiveRate({ ...base, bufferAhead: 3.6, currentRate: 1 }).rate).toBe(1);
    expect(decideLiveRate({ ...base, bufferAhead: 2.9, currentRate: 1.1 }).rate).toBe(1);
  });

  it("jumps when far behind", () => {
    expect(decideLiveRate({ ...base, bufferAhead: 45 })).toEqual({ rate: 1, jumpBy: 42 });
  });

  it("ignores empty buffers", () => {
    expect(decideLiveRate({ ...base, bufferAhead: 0 })).toEqual({ rate: 1, jumpBy: 0 });
  });

  it("reads the buffered range containing the playhead", () => {
    const ranges = [[0, 10], [20, 34]];
    const video = {
      currentTime: 25,
      buffered: { length: 2, start: (i: number) => ranges[i][0], end: (i: number) => ranges[i][1] } as TimeRanges,
    };
    expect(getBufferAhead(video)).toBe(9);
  });
});
