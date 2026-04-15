// cuCareerTerms.js — CU term-by-term career loop (extracted from CUCharGenLogic)
import { addSign } from '../../../utils/utils.js';
import { CHARGEN_DIED, adjustChar } from '../CharGenState.js';
import { optionsFromStrings, promptContinueInCareer } from '../CharGenUtils.js';

/**
 * @param {object} logic - CUCharGenLogic instance (`this`)
 * @param {import('../CharGenApp.js').CharGenApp} app
 * @param {string} careerName
 */
export async function runCUCareerTerms(logic, app, careerName) {
  const state = app.charState;
  const career = logic.careers[careerName];

  await logic.setSkillAtLeast(app, career.autoSkill, 1);
  app._log('Auto Skill', `${career.autoSkill}-1`);
  state.log.push(`Auto Skill: ${career.autoSkill}-1`);

  let skillTable2 = career.skillTable2;
  if (skillTable2 === 'choice' && career.skillTable2Options?.length) {
    skillTable2 = await app._choose(
      game.i18n.format('TWODSIX.CharGen.Steps.CUChooseSecondSkillTable', { career: careerName }),
      optionsFromStrings(career.skillTable2Options, { sort: false }),
    );
  }

  let termNumber = 0;
  let currentRank = 0;
  let isCommissioned = false;
  let promoBonus = 0;
  let promoPenalty = 0;
  let extraBenefitRolls = 0;
  let careerMishap = false;

  const buildRecord = () => {
    const rankList = isCommissioned ? (career.commissionedRanks ?? []) : (career.ranks ?? []);
    return {
      name: careerName,
      terms: termNumber,
      rank: currentRank,
      rankTitle: rankList[currentRank - 1]?.title ?? null,
      commissioned: isCommissioned,
      mishap: careerMishap,
      assignment: careerName,
      benefitsLost: false,
      extraBenefitRolls,
    };
  };

  try {
    while (true) {
      termNumber++;
      state.totalTerms++;
      state.currentTermInCareer = termNumber;
      const ageStart = state.age;
      const { termEntry } = logic.logTermStart(app, {
        careerName,
        termInCareer: termNumber,
        totalTerm: state.totalTerms,
        ageStart,
      });

      const riskRoll = await app._roll('2d6');
      const prefMod = (state.chars[career.preferredChar] ?? 0) >= 10 ? 1 : 0;
      const riskTotal = riskRoll + prefMod;
      const riskTarget = career.riskTarget ?? 6;
      const riskSucceeded = riskTotal >= riskTarget;
      const riskEffect = riskTotal - riskTarget;
      app._log(
        'Risk',
        `${riskRoll}${prefMod ? '+1(pref)' : ''}=${riskTotal} vs ${riskTarget}+ → ${riskSucceeded ? `Success (Effect: ${addSign(riskEffect)})` : `Fail (Effect: ${addSign(riskEffect)})`}`,
      );
      state.log.push(`Risk: ${riskTotal} vs ${riskTarget}+ → ${riskSucceeded ? 'Success' : 'Fail'} (Effect ${addSign(riskEffect)})`);

      const eventRoll = (await app._roll('2d6')) + riskEffect;
      const eventTable = riskSucceeded ? logic.riskSuccessEvents : logic.riskFailEvents;
      const event = logic._lookupEvent(eventTable, eventRoll);
      if (event) {
        const cleanDesc = logic._humanizeTaggedDescription(event.description);
        app._log(riskSucceeded ? `Risk Success (${eventRoll})` : `Risk Fail (${eventRoll})`, cleanDesc);
        state.log.push(`${riskSucceeded ? 'Risk Success' : 'Risk Fail'} (${eventRoll}): ${cleanDesc}`);

        if (event.description.includes('[AUTO_PROMO_OR_PRISON]')) {
          const riskLogBefore = state.log.length;
          termEntry.events.push(cleanDesc);
          const subRoll = await app._roll('2d6');
          if (subRoll >= 4) {
            app._log('Big chance!', `Roll ${subRoll} ≥4 → auto promotion + extra skill`);
            state.log.push(`Auto promotion and extra skill roll.`);
            currentRank = Math.min(5, currentRank + 1);
            promoBonus += 99;
            await logic._rollSkillFromTable(app, career.skillTable1);
          } else {
            app._log('Prison!', `Roll ${subRoll} <4 → SOC −1, gain criminal Contact`);
            adjustChar(state, 'soc', -1);
            state.contacts.push(`Criminal contact (served time in prison)`);
            state.log.push(`Imprisoned: SOC −1, gained criminal Contact.`);
          }
          const tags = logic._parseTags(event.description).filter(t => t !== 'AUTO_PROMO_OR_PRISON');
          for (const tag of tags) {
            if (tag === 'CONTACT' && cleanDesc) {
              state.contacts.push(cleanDesc);
            } else if (tag === 'FRIEND' && cleanDesc) {
              state.friends.push(cleanDesc);
            } else if (tag === 'ENEMY' && cleanDesc) {
              state.enemies.push(cleanDesc);
            }
          }
          for (const outcome of state.log.slice(riskLogBefore)) {
            termEntry.events.push(`  ${outcome}`);
          }
        } else {
          const eventReport = await logic.applyEventTags(app, event.description, careerName);
          const headline = eventReport.allAutoHandled ? `${cleanDesc} AUTOMATICALLY HANDLED` : cleanDesc;
          termEntry.events.push(headline);
          for (const subRow of eventReport.subRows) {
            termEntry.events.push(`  ${subRow}`);
          }
          if (eventReport.leaveCareer) {
            careerMishap = true;
            break;
          }
        }
      }

      let justCommissioned = false;
      if (!isCommissioned && career.hasCommissioned && currentRank === 0 && state.chars.edu >= 8) {
        const attempt = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUCommissionPrompt'), [
          { value: 'yes', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCommissionYes') },
          { value: 'no', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCommissionNo') },
        ]);
        if (attempt === 'yes') {
          const commRoll = await app._roll('2d6');
          const commSucceeded = commRoll >= 9;
          app._log('Commission', `${commRoll} vs 9+ → ${commSucceeded ? 'Commissioned' : 'Failed'}`);
          if (commSucceeded) {
            isCommissioned = true;
            justCommissioned = true;
            currentRank = 1;
            state.log.push(`Commissioned. Now ${career.commissionedRanks?.[0]?.title ?? 'Officer Rank 1'}.`);
            termEntry.events.push(`Commissioned as ${career.commissionedRanks?.[0]?.title ?? 'Officer Rank 1'}`);
            app._log('Commission', `Promoted to ${career.commissionedRanks?.[0]?.title ?? 'Officer Rank 1'}`);
          }
        }
      }

      let justPromoted = false;
      const promoTarget = career.promotionTarget ?? 6;
      const promoRoll = await app._roll('2d6');
      const promoTotalRoll = promoRoll + promoBonus - promoPenalty;
      const promoSucceeded = promoTotalRoll >= promoTarget || promoBonus >= 99;
      const promoEffect = promoTotalRoll - promoTarget;
      promoBonus = 0;
      promoPenalty = 0;
      const promoEventRoll = (await app._roll('2d6')) + promoEffect;
      app._log(
        'Promotion',
        `${promoRoll}${promoTotalRoll !== promoRoll ? `(adjusted to ${promoTotalRoll})` : ''} vs ${promoTarget}+ → ${promoSucceeded ? `Promoted (Effect: ${addSign(promoEffect)})` : `No promotion (Effect: ${addSign(promoEffect)})`}`,
      );
      const promoTable = promoSucceeded ? logic.promoSuccessEvents : logic.promoFailEvents;
      const promoEvent = logic._lookupEvent(promoTable, promoEventRoll);
      if (promoEvent) {
        const cleanDesc = logic._humanizeTaggedDescription(promoEvent.description);
        app._log(promoSucceeded ? `Promo Success (${promoEventRoll})` : `Promo Fail (${promoEventRoll})`, cleanDesc);
        state.log.push(`${promoSucceeded ? 'Promo Success' : 'Promo Fail'} (${promoEventRoll}): ${cleanDesc}`);

        const promoTags = logic._parseTags(promoEvent.description);
        if (promoTags.includes('PROMO_BONUS_2')) {
          promoBonus += 2;
        }
        if (promoTags.includes('PROMO_PENALTY_1')) {
          promoPenalty += 1;
        }
        if (promoTags.includes('EXTRA_BENEFIT')) {
          extraBenefitRolls++;
        }

        const remainingPromoTags = promoTags.filter(t => !['PROMO_BONUS_2', 'PROMO_PENALTY_1', 'EXTRA_BENEFIT'].includes(t));
        let promoAllAuto = true;
        const promoSubRows = [];
        for (const tag of remainingPromoTags) {
          const er = await logic.applyEventTags(app, `[${tag}]`, careerName);
          if (!er.allAutoHandled) {
            promoAllAuto = false;
          }
          promoSubRows.push(...er.subRows);
        }

        const promoHeadline = promoAllAuto ? `${cleanDesc} AUTOMATICALLY HANDLED` : cleanDesc;
        termEntry.events.push(promoHeadline);
        for (const subRow of promoSubRows) {
          termEntry.events.push(`  ${subRow}`);
        }
      }

      if (promoSucceeded && !justCommissioned) {
        const newRank = Math.min(5, currentRank + 1);
        if (newRank > currentRank) {
          currentRank = newRank;
          justPromoted = true;
          const rankList = isCommissioned ? career.commissionedRanks : career.ranks;
          const rankTitle = rankList?.[currentRank - 1]?.title ?? `Rank ${currentRank}`;
          app._log('Promoted', rankTitle);
          termEntry.events.push(`Promoted to ${rankTitle}`);
          state.log.push(`Promoted to ${rankTitle}.`);
        }
      }

      const skillRolls = (termNumber === 1 ? 2 : 1) + (justCommissioned ? 1 : 0) + (justPromoted ? 1 : 0);
      const tableOptions = [
        { value: career.skillTable1, label: career.skillTable1 },
        { value: skillTable2, label: skillTable2 },
      ].filter((t, i, arr) => t.value && arr.findIndex(x => x.value === t.value) === i);
      for (let i = 0; i < skillRolls; i++) {
        let chosenTable = career.skillTable1;
        if (tableOptions.length > 1) {
          chosenTable = await app._choose(
            game.i18n.format('TWODSIX.CharGen.Steps.CUSkillRollChooseTable', {
              current: i + 1,
              total: skillRolls,
            }),
            tableOptions,
          );
        }
        await logic._rollSkillFromTable(app, chosenTable);
      }

      await logic.stepAging(app, termNumber);
      if (state.retireFromCareer) {
        state.retireFromCareer = false;
        termEntry.events.push('Survived an aging crisis — forced to leave career.');
        break;
      }

      const remainPrefBonus = (state.chars[career.preferredChar] ?? 0) >= 10 ? 1 : 0;
      const remainAutoSkillBonus = state.skills.has(career.autoSkill) ? 1 : 0;
      const remainRoll = await app._roll('2d6');
      const remainTotal = remainRoll + state.totalTerms - remainPrefBonus - remainAutoSkillBonus;
      const canRemain = remainTotal < 12;
      app._log(
        'Remain',
        `2D6(${remainRoll})+${state.totalTerms} terms${remainPrefBonus ? '-1(pref)' : ''}${remainAutoSkillBonus ? '-1(autoSkill)' : ''}=${remainTotal} vs <12 → ${canRemain ? 'May continue' : 'Must leave'}`,
      );

      if (!canRemain) {
        state.log.push(`Remain roll failed (${remainTotal} ≥12): leaving ${careerName}.`);
        termEntry.events.push(`Left ${careerName} (remain roll failed).`);
        break;
      }

      const stay = await promptContinueInCareer(app, careerName);
      if (stay !== 'yes') {
        termEntry.events.push(`Voluntarily left ${careerName}.`);
        break;
      }
    }
  } catch (err) {
    if (err !== CHARGEN_DIED) {
      throw err;
    }
    const record = buildRecord();
    state.careers.push(record);
    if (!state.previousCareers.includes(careerName)) {
      state.previousCareers.push(careerName);
    }
    throw CHARGEN_DIED;
  }

  return buildRecord();
}
