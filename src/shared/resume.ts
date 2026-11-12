export const RESUME_STORAGE_KEY = "resumePositions";
export const RESUME_MAX_ENTRIES = 300;
/** Videos shorter than this are never tracked (music, clips, shorts). */
export const RESUME_MIN_DURATION_SECONDS = 180;
/** Positions earlier than this are not worth resuming. */
export const RESUME_MIN_POSITION_SECONDS = 30;
/** Positions this close to the end count as "finished". */
export const RESUME_END_MARGIN_SECONDS = 25;

export interface ResumeEntry {
  /** Saved position in seconds. */
  t: number;
  /** Duration when saved; used to make sure YouTube already swapped the video. */
  d: number;
  /** Timestamp of the save. */
  at: number;
}

export type ResumeStore = Record<string, ResumeEntry>;

function isTrackableDuration(duration: number) {
  return Number.isFinite(duration) && duration >= RESUME_MIN_DURATION_SECONDS;
}

/** What to do with the stored entry for the current playback position. */
export function getResumeSaveAction(currentTime: number, duration: number): "save" | "delete" | "skip" {
  if (!isTrackableDuration(duration) || !Number.isFinite(currentTime)) return "skip";
  if (currentTime >= duration - RESUME_END_MARGIN_SECONDS) return "delete";
  if (currentTime < RESUME_MIN_POSITION_SECONDS) return "skip";
  return "save";
}

/** Position to seek to when the video opens, or null to leave it alone. */
export function getResumeTarget(entry: ResumeEntry | undefined, duration: number, hasExplicitStart: boolean): number | null {
  if (!entry || hasExplicitStart || !isTrackableDuration(duration)) return null;
  // Duration mismatch means the <video> still holds the previous video (SPA).
  if (!Number.isFinite(entry.d) || Math.abs(entry.d - duration) > 3) return null;
  if (entry.t < RESUME_MIN_POSITION_SECONDS || entry.t >= duration - RESUME_END_MARGIN_SECONDS) return null;
  return Math.max(0, entry.t - 2);
}

export function pruneResumeStore(store: ResumeStore, max = RESUME_MAX_ENTRIES): ResumeStore {
  const entries = Object.entries(store || {}).filter(([, entry]) => entry && Number.isFinite(entry.t));
  if (entries.length <= max) return Object.fromEntries(entries);
  entries.sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  return Object.fromEntries(entries.slice(0, max));
}

export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? h + ":" : "") + mm + ":" + String(s).padStart(2, "0");
}
