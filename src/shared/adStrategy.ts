export type AdSkipAction = "none" | "wait" | "click" | "seek-end" | "speed-through";

export interface AdSkipDecisionInput {
  adConfirmed: boolean;
  aggressive: boolean;
  delayElapsed: boolean;
  skipButtonAvailable: boolean;
  watching: boolean;
  duration: number;
  currentTime: number;
}

const MIN_SEEKABLE_AD_DURATION_SECONDS = 0.5;
const MIN_REMAINING_AD_SECONDS = 0.15;

export function getAdSeekTarget(duration: unknown, currentTime: unknown): number | null {
  const normalizedDuration = Number(duration);
  const normalizedCurrentTime = Number(currentTime);

  if (!Number.isFinite(normalizedDuration) || normalizedDuration < MIN_SEEKABLE_AD_DURATION_SECONDS) {
    return null;
  }
  if (!Number.isFinite(normalizedCurrentTime) || normalizedCurrentTime < 0) {
    return null;
  }
  if (normalizedCurrentTime >= normalizedDuration - MIN_REMAINING_AD_SECONDS) {
    return null;
  }

  return Math.min(
    normalizedDuration - 0.05,
    Math.max(normalizedCurrentTime + 0.25, normalizedDuration - 0.05),
  );
}

export function chooseAdSkipAction(input: AdSkipDecisionInput): AdSkipAction {
  if (!input.adConfirmed || input.watching) return "none";
  if (!input.delayElapsed) return input.aggressive ? "speed-through" : "wait";
  if (input.skipButtonAvailable) return "click";
  if (!input.aggressive) return "wait";
  return getAdSeekTarget(input.duration, input.currentTime) === null ? "speed-through" : "seek-end";
}

export function isLikelySkipControlText(value: unknown): boolean {
  const text = String(value || "").trim().toLocaleLowerCase();
  return ["skip", "pular", "ignorar", "omitir", "saltar"].some((term) => text.includes(term));
}
