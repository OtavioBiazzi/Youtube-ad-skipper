export const SAFE_AD_SPEED_RATE = 3;
export const DEFAULT_SPEED_THROUGH_RATE = SAFE_AD_SPEED_RATE;
export const MIN_AD_SPEED_RATE = 1;
export const MAX_AD_SPEED_RATE = 8;
export const INSTANT_AD_SPEED_RATE = 16;

export const MIN_SPEED_THROUGH_RATE = MIN_AD_SPEED_RATE;
export const MAX_SPEED_THROUGH_RATE = MAX_AD_SPEED_RATE;
export const SAFE_SPEED_THROUGH_RATE = SAFE_AD_SPEED_RATE;
export const INSTANT_SPEED_THROUGH_RATE = INSTANT_AD_SPEED_RATE;

export function normalizeSpeedRate(rate: unknown, fallback = DEFAULT_SPEED_THROUGH_RATE) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_AD_SPEED_RATE, Math.max(MIN_AD_SPEED_RATE, n));
}

export function normalizeSkipDelay(delay: unknown, fallback = 1) {
  const n = Number(delay);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(30, Math.max(1, n));
}

export function getSafeAdaptiveSpeed(delay: unknown) {
  const d = normalizeSkipDelay(delay);
  if (d <= 3) return SAFE_AD_SPEED_RATE;
  if (d <= 6) return 2.5;
  if (d <= 10) return 2;
  if (d <= 20) return 1.5;
  return 1.25;
}

export function getRiskAdaptiveSpeed(delay: unknown) {
  const d = normalizeSkipDelay(delay);
  if (d <= 1) return 8;
  if (d <= 2) return 6;
  if (d <= 3) return 5;
  if (d <= 5) return 4;
  if (d <= 10) return 3;
  if (d <= 20) return 2;
  return 1.5;
}

export function formatSpeed(value: unknown) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : SAFE_AD_SPEED_RATE;
  return safe.toFixed(safe % 1 === 0 ? 0 : 1) + "x";
}
