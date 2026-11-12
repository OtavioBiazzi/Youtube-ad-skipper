/**
 * Live catch-up (written for this project).
 *
 * Inputs come from YouTube's own player stats: the real latency to the live
 * edge and the buffer health (seconds downloaded ahead). Speeding up spends
 * buffered content, which pulls the playhead toward live without skipping
 * anything. Rules:
 *  - never accelerate when the buffer is thin (stall guard);
 *  - only spend the buffer that sits above the mode's cushion, with a
 *    hysteresis band so it does not oscillate at the edge of the cushion;
 *  - speed grows with how far behind live we are, up to the max rate;
 *  - optionally jump to the live edge when the delay gets very large.
 */

export type LiveMode = "balanced" | "close" | "extreme";

export const LIVE_MODES: Record<LiveMode, { label: string; cushion: number; hint: string }> = {
  balanced: { label: "Equilibrado", cushion: 4, hint: "~4s de folga · qualquer conexão" },
  close: { label: "Perto do ao vivo", cushion: 3, hint: "~3s de folga · conexão estável" },
  extreme: { label: "Extremo", cushion: 2, hint: "~2s de folga · conexão rápida" },
};

export const LIVE_MAX_RATES = [1.1, 1.25, 1.5] as const;
export const LIVE_JUMP_SECONDS = 30;

const STALL_GUARD = 1.5;     // below this much buffer, never speed up
const MIN_LATENCY = 2;       // already this close to live: nothing to gain
const FULL_DEMAND = 6;       // seconds past MIN_LATENCY at which demand is full
const SURPLUS_RAMP = 2;      // seconds above the cushion at which headroom is full
const ENGAGE_MARGIN = 1.5;   // start only this far above the cushion

export function normalizeLiveMode(value: unknown): LiveMode {
  return value === "close" || value === "extreme" ? value : "balanced";
}

export interface LiveRateInput {
  latency: number;
  bufferHealth: number;
  mode: LiveMode;
  maxRate: number;
  engaged: boolean;
  jumpEnabled: boolean;
}

export interface LiveRateDecision {
  rate: number;
  engaged: boolean;
  jumpToLive: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function decideLiveRate(input: LiveRateInput): LiveRateDecision {
  const latency = Number(input.latency);
  const health = Number(input.bufferHealth);
  const maxRate = Math.min(2, Math.max(1.05, Number(input.maxRate) || 1.25));
  const cushion = LIVE_MODES[normalizeLiveMode(input.mode)].cushion;
  const rest = (engaged: boolean, jumpToLive = false): LiveRateDecision => ({ rate: 1, engaged, jumpToLive });

  if (!Number.isFinite(latency) || !Number.isFinite(health)) return rest(false);
  if (input.jumpEnabled && latency >= LIVE_JUMP_SECONDS) return rest(false, true);
  if (latency < MIN_LATENCY || health < STALL_GUARD) return rest(input.engaged && health >= STALL_GUARD);

  let engaged = input.engaged;
  if (engaged && health <= cushion) engaged = false;
  else if (!engaged && health > cushion + ENGAGE_MARGIN) engaged = true;
  if (!engaged) return rest(false);

  const demand = clamp01((latency - MIN_LATENCY) / FULL_DEMAND);
  const headroom = clamp01((health - cushion) / SURPLUS_RAMP);
  const rate = 1 + (maxRate - 1) * demand * headroom;
  return { rate: Math.round(rate * 100) / 100, engaged, jumpToLive: false };
}
