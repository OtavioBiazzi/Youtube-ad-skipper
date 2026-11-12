/** Pixels of the player slot that must be scrolled past before floating. */
export const MINIPLAYER_ENTER_MARGIN = 40;
/** Extra pixels the slot must come back into view before docking again.
 *  The gap between enter and exit is what stops the on/off flicker. */
export const MINIPLAYER_EXIT_MARGIN = 140;

export interface MiniplayerInput {
  /** Feature enabled, on a watch page, not fullscreen/PiP, player present. */
  eligible: boolean;
  currentlyActive: boolean;
  /** User closed the miniplayer for this video until they scroll back up. */
  dismissed: boolean;
  /** Bottom edge of the in-page player slot, relative to the viewport. */
  slotBottom: number;
  /** Height of the sticky masthead. */
  mastheadHeight: number;
}

export function shouldFloatPlayer(input: MiniplayerInput): boolean {
  if (!input.eligible || input.dismissed) return false;
  if (!Number.isFinite(input.slotBottom)) return input.currentlyActive;

  const enterAt = input.mastheadHeight + MINIPLAYER_ENTER_MARGIN;
  const exitAt = enterAt + MINIPLAYER_EXIT_MARGIN;

  return input.currentlyActive ? input.slotBottom < exitAt : input.slotBottom < enterAt;
}

/** A dismissed miniplayer re-arms only once the real player is visible again. */
export function shouldResetMiniplayerDismissal(slotBottom: number, mastheadHeight: number): boolean {
  return Number.isFinite(slotBottom) && slotBottom > mastheadHeight + MINIPLAYER_ENTER_MARGIN + MINIPLAYER_EXIT_MARGIN;
}
