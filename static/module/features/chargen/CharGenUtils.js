function getCompat() {
  const compat = game?.twodsix?.compat?.chargen;
  if (!compat) {
    throw new Error('twodsix | CharGenUtils compat API unavailable. Ensure twodsix initialized first.');
  }
  return compat;
}

export const localizedPhysicalOpts = getCompat().localizedPhysicalOpts;
export const optionsFromCareerNames = getCompat().optionsFromCareerNames;
export const optionsFromStrings = getCompat().optionsFromStrings;
export const promptContinueInCareer = getCompat().promptContinueInCareer;
