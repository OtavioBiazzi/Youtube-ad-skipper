export function shouldApplyPlaybackRate(currentRate: unknown, targetRate: unknown): boolean {
  const current = Number(currentRate);
  const target = Number(targetRate);
  if (!Number.isFinite(current) || !Number.isFinite(target)) return false;
  return Math.abs(current - target) > 0.0001;
}
