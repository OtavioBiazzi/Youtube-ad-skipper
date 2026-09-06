export type AdCompletionState = {
  watching: boolean;
  skipActionPerformed: boolean;
  alreadyCounted: boolean;
};

export function shouldCountAdCompletion(state: AdCompletionState) {
  return !state.watching && state.skipActionPerformed && !state.alreadyCounted;
}
