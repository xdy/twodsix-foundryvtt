// cuMusterBenefits.js — CU muster-out and benefit rolls (extracted from CUCharGenLogic)
import { adjustChar } from '../CharGenState.js';
import { chooseWeapon } from '../CharGenUtils.js';

/**
 * @param {import('../CUCharGenLogic.js').CUCharGenLogic} logic
 * @param {import('../CharGenApp.js').CharGenApp} app
 * @param {string} careerName
 */
export async function cuBenefitRoll(logic, app, careerName) {
  const state = app.charState;
  const cashBase = logic.careers[careerName]?.cashBase ?? 0;
  const isOfficer =
    logic.careers[careerName]?.hasCommissioned && state.careers.length > 0 && state.careers.at(-1)?.commissioned;
  const cashMultiplier = isOfficer ? (logic.careers[careerName]?.officerCashMultiplier ?? 1) : 1;
  const effectiveCash = cashBase * cashMultiplier;

  const roll = await app._roll('2d6');
  const event = logic._lookupEvent(logic.benefitsTable, roll);
  if (!event) {
    app._log(`Benefit (${roll})`, 'No entry found.');
    return;
  }
  const desc = event.description;
  app._log(`Benefit (${roll})`, desc.replace(/\[.*?\]/g, '').trim());
  state.log.push(`Benefit (${roll}): ${desc}`);

  const tags = logic._parseTags(desc);
  for (const tag of tags) {
    if (await logic._applyCommonTag(app, tag, desc)) {
      continue;
    }

    if (tag === 'CASH' || tag === 'AUGMENT_OR_CASH') {
      state.cashBenefits += effectiveCash;
      state.cashRollsUsed++;
      app._log('Cash', `+Cr${effectiveCash.toLocaleString()}`);
    } else if (tag === 'AUGMENT_OR_END') {
      const choice = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUBenefitAugmentOrEnd'), [
        { value: 'augment', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUBenefitAugment') },
        { value: 'end', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUBenefitEndPlus1') },
      ]);
      if (choice === 'end') {
        adjustChar(state, 'end', 1);
        app._log('Characteristic', 'END +1');
      } else {
        state.materialBenefits.push('Augment (5 points)');
        app._log('Augment', '5 points');
      }
    } else if (tag === 'WEAPON') {
      await chooseWeapon(app, { maxPrice: 5000 });
    }
  }
}

/**
 * @param {import('../CUCharGenLogic.js').CUCharGenLogic} logic
 * @param {import('../CharGenApp.js').CharGenApp} app
 * @param {Object} careerRecord
 * @param {number} extraBenefitRolls
 */
export async function cuMusterOut(logic, app, careerRecord, extraBenefitRolls) {
  const state = app.charState;
  const rank = careerRecord.rank;
  const rankBonus = rank >= 5 ? 3 : rank >= 3 ? 2 : rank >= 1 ? 1 : 0;
  const totalRolls = careerRecord.terms + rankBonus + extraBenefitRolls;
  if (totalRolls <= 0) {
    state.log.push('No benefit rolls.');
    return;
  }
  state.log.push(
    `Muster out: ${totalRolls} benefit roll(s) (${careerRecord.terms} terms + ${rankBonus} rank bonus + ${extraBenefitRolls} extra).`,
  );
  for (let i = 0; i < totalRolls; i++) {
    app._log(`Benefit roll ${i + 1}/${totalRolls}`, `(${careerRecord.name}, rank ${rank})`);
    await cuBenefitRoll(logic, app, careerRecord.name);
  }
}
