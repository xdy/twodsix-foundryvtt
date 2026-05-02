function getCompat() {
  const compat = game?.twodsix?.compat?.utils;
  if (!compat) {
    throw new Error('twodsix | sheetUtils compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const calcModFor = getCompat().calcModFor;
