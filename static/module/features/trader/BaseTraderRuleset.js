function getCompat() {
  const compat = game?.twodsix?.compat?.trader;
  if (!compat) {
    throw new Error('twodsix | BaseTraderRuleset compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const BaseTraderRuleset = getCompat().BaseTraderRuleset;
export const SEARCH_METHOD = getCompat().SEARCH_METHOD;
