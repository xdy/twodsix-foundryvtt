function getCompat() {
  const compat = game?.twodsix?.compat?.chargen;
  if (!compat) {
    throw new Error('twodsix | CharGenState compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const CHARGEN_DIED = getCompat().CHARGEN_DIED;
export const CharGenConstants = getCompat().CharGenConstants;
export const getChargenOverlayBucket = getCompat().getChargenOverlayBucket;
