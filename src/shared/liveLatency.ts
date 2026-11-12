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
const SAFE_BUFFER = 3;       // full speed only with at least this much buffer
const ENGAGE_MARGIN = 1.5;   // start when this far past the cushion
const RELEASE_MARGIN = 0.3;  // stop when back within this of the cushion
const FULL_SPEED_GAP = 4;    // seconds past the cushion that get the max rate

export function normalizeLiveMode(value: unknown): LiveMode {
  return value === "close" || value === "extreme" ? value : "balanced";
}

export interface LiveRateInput {
  /** Seconds from the broadcaster's clock (includes encoder delay). */
  latency: number;
  /** Seconds behind the newest segment YouTube has (what we can remove). */
  behind?: number;
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

/**
 * How far behind we are is measured against the newest segment YouTube has
 * ("behind"), which is the delay we can actually remove. The latency figure
 * includes the broadcaster's own delay, so it is only a fallback.
 * Speed grows quickly with the gap (max rate at 4 s past the cushion) and is
 * only held back when the buffer gets thin, so it no longer crawls at 1.05x.
 */
export function decideLiveRate(input: LiveRateInput): LiveRateDecision {
  const latency = Number(input.latency);
  const behind = Number(input.behind);
  const health = Number(input.bufferHealth);
  const maxRate = Math.min(2, Math.max(1.05, Number(input.maxRate) || 1.25));
  const cushion = LIVE_MODES[normalizeLiveMode(input.mode)].cushion;
  const rest = (engaged: boolean, jumpToLive = false): LiveRateDecision => ({ rate: 1, engaged, jumpToLive });

  // Spendable delay: what sits behind the newest segment, or what is
  // already downloaded ahead (some lives report seekableEnd == current while
  // holding 20 s of buffer). Whichever is larger can be played faster.
  const behindOk = Number.isFinite(behind) && behind >= 0 ? behind : Number.NaN;
  const healthOk = Number.isFinite(health) ? health : Number.NaN;
  const gap = Number.isFinite(behindOk) || Number.isFinite(healthOk)
    ? Math.max(Number.isFinite(behindOk) ? behindOk : 0, Number.isFinite(healthOk) ? healthOk : 0)
    : latency;
  if (!Number.isFinite(gap) || !Number.isFinite(health)) return rest(false);
  if (input.jumpEnabled && gap >= LIVE_JUMP_SECONDS) return rest(false, true);

  const excess = gap - cushion;
  let engaged = input.engaged;
  if (engaged && excess <= RELEASE_MARGIN) engaged = false;
  else if (!engaged && excess > ENGAGE_MARGIN) engaged = true;
  if (!engaged) return rest(false);
  // Stall guard: keep the intent, but play at 1x until the buffer refills.
  if (health < STALL_GUARD) return rest(true);

  const demand = clamp01(excess / FULL_SPEED_GAP);
  const safety = clamp01((health - STALL_GUARD) / (SAFE_BUFFER - STALL_GUARD));
  const rate = 1 + (maxRate - 1) * demand * Math.max(0.35, safety);
  return { rate: Math.max(1.05, Math.round(rate * 100) / 100), engaged, jumpToLive: false };
}
