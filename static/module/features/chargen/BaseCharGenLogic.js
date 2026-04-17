function getCompat() {
  const compat = game?.twodsix?.compat?.chargen;
  if (!compat?.BaseCharGenLogic) {
    throw new Error('twodsix | BaseCharGenLogic compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const BaseCharGenLogic = getCompat().BaseCharGenLogic;
