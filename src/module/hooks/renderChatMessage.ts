// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import Crit from "../utils/crit";

function escapeHtml(s: any) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/**
 * Hook: renderChatMessageHTML
 * Minimal handler: retain damage drag/drop behavior and apply crit classes
 * to the rendered `.dice-total`. The roll template renders structured
 * markup (sum/effect/timeframe/degree), so no DOM construction is needed.
 */
Hooks.on("renderChatMessageHTML", (message: any, html: HTMLElement, messageData?: any) => {
  if (!message || !html) {
    return;
  }

  // Preserve drag-and-drop for damage transfer elements.
  const damageMessage = html.querySelector<HTMLElement>(".damage-message");
  if (damageMessage) {
    const transfer: string = message.getFlag("twodsix", "transfer") ?? messageData?.flags?.twodsix?.transfer;
    if (transfer) {
      damageMessage.setAttribute("draggable", "true");
      damageMessage.addEventListener("dragstart", (ev) => {
        if (ev.dataTransfer) {
          ev.dataTransfer.setData("text/plain", transfer);
        }
      });
    }
    return;
  }

  // Construct the structured roll results DOM here during chat message
  // rendering. This restores the previous render-hook approach (sum,
  // effect, timeframe on one row and a centered degree badge below) and
  // places attack badges where appropriate. Use textContent for safety
  // and rely on CSS for presentation.

  // Apply crit classes if present so colors propagate to rendered dice.
  const crit = message.getFlag("twodsix", "crit");
  if (crit) {
    const critClass = crit === Crit.success ? 'crit-success-roll' : 'crit-fail-roll';
    html.querySelectorAll('.dice-total').forEach(el => el.classList.add(critClass));
  }

  // Build a compact HTML summary directly into the existing `.dice-total`
  // element rather than constructing a complex DOM tree. This mirrors the
  // original simpler approach and keeps the chat message markup stable.
  const flags = message.flags?.twodsix ?? message.data?.flags?.twodsix ?? null;
  if (!flags) {
    return;
  }

  const diceTotal = html.querySelector('.dice-total');
  if (!diceTotal) {
    return;
  }

  const effect: string = message.getFlag?.('twodsix', 'effect') ?? flags.effect ?? '';
  if (!isNaN(Number(effect))) {
    const sumString = game.i18n.localize('TWODSIX.Rolls.Sum') || 'Sum';
    const effectString = game.i18n.localize('TWODSIX.Rolls.Effect') || 'Effect';
    // Build a structured but compact HTML snippet so existing CSS classes
    // (results-main, result-item, degree-badge, attack-badge) still apply.
    const totalText = escapeHtml(diceTotal.textContent?.trim() ?? '');
    const sumHtml = `<div class="result-item result-sum"><div class="result-label">${escapeHtml(sumString)}</div><div class="result-value">${totalText}</div></div>`;
    const effectHtml = `<div class="result-item result-effect"><div class="result-label">${escapeHtml(effectString)}</div><div class="result-value">${escapeHtml(effect)}</div></div>`;

    let timeframeHtml = '';
    const showTimeframe = game.settings.get('twodsix', 'showTimeframe') && (message.getFlag('twodsix', 'timeframe') ?? flags.timeframe);
    if (showTimeframe) {
      const timeframe = message.getFlag('twodsix', 'timeframe') ?? flags.timeframe;
      const timeString = game.i18n.localize('TWODSIX.Rolls.Timeframe') || 'Timeframe';
      timeframeHtml = `<div class="result-item result-timeframe"><div class="result-label">${escapeHtml(timeString)}</div><div class="result-value">${escapeHtml(timeframe)}</div></div>`;
    }

    // Degree and optional attack badge
    const deg = message.getFlag('twodsix', 'degreeOfSuccess') ?? flags.degreeOfSuccess ?? '';
    const degreeClass = message.getFlag('twodsix', 'degreeClass') ?? flags.degreeClass ?? '';
    const degreeKey = message.getFlag('twodsix', 'degreeKey') ?? flags.degreeKey ?? '';
    const rollClass = message.getFlag('twodsix', 'rollClass') ?? flags.rollClass ?? '';
    const isAttack = rollClass === 'Attack';
    const isHit = Number(message.getFlag('twodsix', 'effect') ?? flags.effect ?? 0) >= 0;

    // Respect the `useDegreesOfSuccess` setting: when set to "none",
    const showDegrees = game.settings.get('twodsix', 'useDegreesOfSuccess') !== 'none';

    // Build the raw badge HTML regardless; decide later whether to insert
    // it into the results markup based on the `useDegreesOfSuccess` setting.
    const degreeBadgeHtml = deg ? `<div class="degree-badge ${escapeHtml(degreeClass)}" data-degree="${escapeHtml(degreeKey)}" role="status" aria-label="${escapeHtml(deg)}">${escapeHtml(deg)}</div>` : '';
    const attackBadgeHtml = isAttack ? `<div class="attack-badge ${isHit ? 'attack-hit' : 'attack-miss'}">${escapeHtml(isHit ? (game.i18n.localize('TWODSIX.Rolls.Hit') || 'Hit') : (game.i18n.localize('TWODSIX.Rolls.Miss') || 'Miss'))}</div>` : '';

    // If no timeframe, place degree inline; otherwise include it as a
    // `result-item` inside `.results-main` so it can wrap to a centered
    // full-width row while remaining part of the main flow.
    const degreeInlineHtml = !showTimeframe && showDegrees && (degreeBadgeHtml || attackBadgeHtml) ? `<div class="result-degree-inline">${degreeBadgeHtml}${attackBadgeHtml}</div>` : '';
    const degreeWrapHtml = showTimeframe && showDegrees && (degreeBadgeHtml || attackBadgeHtml) ? `<div class="result-item result-degree-wrap">${degreeBadgeHtml}${attackBadgeHtml}</div>` : '';

    const contentHtml = `<div class="twodsix-roll-results" role="status"><div class="results-main">${sumHtml}${effectHtml}${timeframeHtml}${degreeInlineHtml}${degreeWrapHtml}</div></div>`;
    diceTotal.innerHTML = contentHtml;
  }
});
