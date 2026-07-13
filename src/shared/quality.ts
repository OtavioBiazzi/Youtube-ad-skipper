import type { QualityLevel } from "./settings";

export const QUALITY_ORDER = ["tiny", "small", "medium", "large", "hd720", "hd1080", "hd1440", "hd2160", "hd2880", "highres"];
export const QUALITY_ALLOWED = ["auto", ...QUALITY_ORDER];

export function normalizeQualityLevel(level: unknown, fallback: QualityLevel | "" = "hd720") {
  const value = String(level || "");
  return QUALITY_ALLOWED.includes(value) ? value : fallback;
}

export function pickBestQualityLevel(target: unknown, available: unknown[] = []) {
  const normalizedTarget = normalizeQualityLevel(target);
  if (normalizedTarget === "auto") return "auto";

  const normalizedAvailable = available
    .map(level => normalizeQualityLevel(level, ""))
    .filter(level => level && level !== "auto");

  if (normalizedAvailable.length === 0) return normalizedTarget;
  if (normalizedAvailable.includes(normalizedTarget)) return normalizedTarget;

  const targetRank = QUALITY_ORDER.indexOf(normalizedTarget);
  let best = "";
  let bestRank = -1;

  for (const level of normalizedAvailable) {
    const rank = QUALITY_ORDER.indexOf(level);
    if (rank >= 0 && rank <= targetRank && rank > bestRank) {
      best = level;
      bestRank = rank;
    }
  }

  if (best) return best;

  return normalizedAvailable
    .slice()
    .sort((a, b) => QUALITY_ORDER.indexOf(b) - QUALITY_ORDER.indexOf(a))[0] || normalizedTarget;
}
