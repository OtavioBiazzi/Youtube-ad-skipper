export const AUTOPLAY_START_WINDOW_SECONDS = 4;
export const AUTOPLAY_AD_END_GRACE_MS = 6000;

export type AutoplayBlockReason = "" | "autoplay-disable-all" | "background-autoplay" | "foreground-autoplay";

export interface AutoplayContext {
  enabled: boolean;
  /** An ad is showing or the skipper is still handling one. */
  adActive: boolean;
  /** The element that fired is the watch player's <video> (not a hover preview). */
  isMainVideo: boolean;
  currentTime: number;
  hidden: boolean;
  isPopup: boolean;
  ignorePopup: boolean;
  isPlaylist: boolean;
  allowPlaylists: boolean;
  /** User clicked / pressed a playback key recently. */
  recentIntent: boolean;
  /** We already paused this video once. Any later play is the user's decision
   *  (headphone buttons, OS media hub, etc. never reach the page as input). */
  alreadyBlockedThisVideo: boolean;
  msSinceAdEnded: number;
  disableAll: boolean;
  blockBackground: boolean;
  blockForeground: boolean;
}

export function getAutoplayBlockReason(ctx: AutoplayContext): AutoplayBlockReason {
  if (!ctx.enabled || ctx.adActive || !ctx.isMainVideo) return "";
  if (ctx.alreadyBlockedThisVideo) return "";

  const time = Number(ctx.currentTime);
  if (Number.isFinite(time) && time >= AUTOPLAY_START_WINDOW_SECONDS) return "";

  // Content resuming right after a pre-roll is not "autoplay".
  if (ctx.msSinceAdEnded >= 0 && ctx.msSinceAdEnded < AUTOPLAY_AD_END_GRACE_MS) return "";
  if (ctx.ignorePopup && ctx.isPopup) return "";
  if (ctx.allowPlaylists && ctx.isPlaylist) return "";
  if (ctx.recentIntent) return "";

  if (ctx.disableAll) return "autoplay-disable-all";
  if (ctx.hidden && ctx.blockBackground) return "background-autoplay";
  if (!ctx.hidden && ctx.blockForeground) return "foreground-autoplay";
  return "";
}
