export type AdSkipAction = "none" | "wait" | "click" | "speed-through";

export interface AdSkipDecisionInput {
  adConfirmed: boolean;
  aggressive: boolean;
  delayElapsed: boolean;
  skipButtonAvailable: boolean;
  watching: boolean;
  duration: number;
  currentTime: number;
}

export function chooseAdSkipAction(input: AdSkipDecisionInput): AdSkipAction {
  if (!input.adConfirmed || input.watching) return "none";
  if (!input.delayElapsed) return input.aggressive ? "speed-through" : "wait";
  if (input.skipButtonAvailable) return "click";
  if (!input.aggressive) return "wait";
  return "speed-through";
}

export function isLikelySkipControlText(value: unknown): boolean {
  const text = String(value || "").trim().toLocaleLowerCase();
  return ["skip", "pular", "ignorar", "omitir", "saltar"].some((term) => text.includes(term));
}
