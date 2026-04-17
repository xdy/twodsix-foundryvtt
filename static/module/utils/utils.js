function getCompat() {
  const compat = game?.twodsix?.compat?.utils;
  if (!compat) {
    throw new Error('twodsix | utils compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const addSign = getCompat().addSign;
