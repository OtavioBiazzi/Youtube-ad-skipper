/**
 * Live catch-up: plays slightly faster while there is more buffered video
 * ahead than the target, which drains the delay without skipping content.
 * If the delay is huge (e.g. after a stall) it jumps close to the live edge.
 */
export const LIVE_TARGET_OPTIONS = [1.5, 3, 5, 8] as const;
export const LIVE_JUMP_THRESHOLD_SECONDS = 30;

export interface LiveLatencyInput {
  /** Seconds of video buffered ahead of the playhead. */
  bufferAhead: number;
  /** Desired buffer/latency in seconds. */
  target: number;
  /** Rate we applied on the previous tick (1 when idle). */
  currentRate: number;
  /** Max catch-up speed. */
  maxRate: number;
}

export interface LiveLatencyDecision {
  rate: number;
  /** Seconds to jump forward (0 = no jump). */
  jumpBy: number;
}

export function decideLiveRate(input: LiveLatencyInput): LiveLatencyDecision {
  const target = Math.max(0.5, Number(input.target) || 3);
  const ahead = Number(input.bufferAhead);
  const maxRate = Math.min(2, Math.max(1.05, Number(input.maxRate) || 1.25));
  if (!Number.isFinite(ahead) || ahead <= 0) return { rate: 1, jumpBy: 0 };

  if (ahead > LIVE_JUMP_THRESHOLD_SECONDS) {
    return { rate: 1, jumpBy: Math.max(0, ahead - target) };
  }

  const excess = ahead - target;
  const catchingUp = input.currentRate > 1.001;
  // Hysteresis: start above target + 1s, keep going until we reach the target.
  if (excess <= (catchingUp ? 0 : 1)) return { rate: 1, jumpBy: 0 };

  // Proportional, smooth: ~1.05x for a small excess, up to maxRate.
  const rate = Math.min(maxRate, 1 + Math.max(0.05, excess * 0.04));
  return { rate: Math.round(rate * 100) / 100, jumpBy: 0 };
}

export function getBufferAhead(video: Pick<HTMLMediaElement, "buffered" | "currentTime">): number {
  const ranges = video.buffered;
  const time = video.currentTime;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    if (ranges.start(i) <= time + 0.5 && ranges.end(i) >= time) return ranges.end(i) - time;
  }
  return 0;
}
