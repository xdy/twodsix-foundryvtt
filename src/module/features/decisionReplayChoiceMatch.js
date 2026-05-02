/**
 * Pure helpers for replaying stored choices when labels/i18n keys drift (CharGen, Trader).
 */

/**
 * @param {unknown} value
 * @returns {Set<string>}
 */
export function choiceMatchCandidates(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return new Set();
  }
  const candidates = new Set([raw]);
  if (raw.startsWith('TWODSIX.') && typeof game?.i18n?.localize === 'function') {
    candidates.add(game.i18n.localize(raw));
  }
  return candidates;
}

/**
 * @param {Set<string>|Iterable<string>} candidates
 * @param {unknown} optionText
 */
export function choiceTextMatches(candidates, optionText) {
  const optionCandidates = choiceMatchCandidates(optionText);
  for (const candidate of candidates) {
    if (optionCandidates.has(candidate)) {
      return true;
    }
    for (const optionCandidate of optionCandidates) {
      if (optionCandidate.startsWith(`${candidate} —`)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCoordinateLike(value) {
  return /^-?\d+,-?\d+$/.test(String(value ?? '').trim());
}

/**
 * @param {Array<{ value?: unknown, label?: unknown, matchCoordinateLike?: boolean, aliases?: unknown[] }>} choiceOptions
 * @param {unknown} storedValue
 * @returns {{ value: unknown, label?: unknown }|undefined}
 */
export function findReplayChoiceOption(choiceOptions, storedValue) {
  if (!Array.isArray(choiceOptions) || !choiceOptions.length) {
    return undefined;
  }
  const candidates = choiceMatchCandidates(storedValue);
  return choiceOptions.find(
    option =>
      choiceTextMatches(candidates, option.value)
      || choiceTextMatches(candidates, option.label)
      || (!!option.matchCoordinateLike && isCoordinateLike(storedValue))
      || (Array.isArray(option.aliases) && option.aliases.some(alias => choiceTextMatches(candidates, alias))),
  );
}
