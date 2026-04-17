/**
 * Whether a career / table row should use structured {@link BaseCharGenLogic#_resolveEvent}
 * instead of flat tag parsing only.
 * @param {unknown} eventOrDescription
 * @returns {boolean}
 */
export function eventUsesStructuredResolve(eventOrDescription) {
  const e = eventOrDescription;
  if (!e || typeof e !== 'object' || Array.isArray(e)) {
    return false;
  }
  return (e.checks?.length ?? 0) > 0
    || (e.branchChoices?.length ?? 0) > 0
    || e.benefitGamble?.kind != null
    || (e.onSuccess?.length ?? 0) > 0
    || (e.onFail?.length ?? 0) > 0
    || (e.always?.length ?? 0) > 0;
}
