function getCompat() {
  const compat = game?.twodsix?.compat?.chargen;
  if (!compat) {
    throw new Error('twodsix | CECharGenConstants compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const CE_INJURY_DESC = getCompat().CE_INJURY_DESC;
