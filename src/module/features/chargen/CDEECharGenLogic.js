// CDEECharGenLogic.js — Cepheus Deluxe Enhanced Edition character generation logic
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign } from '../../utils/utils.js';
import { BaseCharGenLogic, stripMechanicTags } from './BaseCharGenLogic.js';
import {
  CDEE_AGING_TABLE,
  CDEE_CASCADE_SKILLS,
  CDEE_HOMEWORLD_TYPES,
  CDEE_INJURY_TABLE,
  CDEE_LIFE_EVENTS,
  CDEE_PRISON_EVENTS,
  CDEE_PRISON_SKILLS,
  CDEE_SKILL_NAME_MAP,
  CDEE_SKILL_PACKAGES,
  CDEE_UNUSUAL_EVENTS,
  CDEE_ZERO_LEVEL_CIVILIAN,
  CDEE_ZERO_LEVEL_MILITARY
} from './CDEECharGenConstants.js';
import { adjustChar, CHARACTERISTIC_KEYS, CHARGEN_DIED } from './CharGenState.js';
import {
  assignCharacteristicPoolFromChoices,
  getSkillLevel,
  localizedAllCharOptsForAssignment,
  nextLevelAfterImprove,
  optionsFromCareerNames,
  optionsFromStrings,
} from './CharGenUtils.js';
import { reportAutoHandled, reportSubRow } from './EventReport.js';

// ─── MODULE-LEVEL DATA (loaded from CDEE pack) ────────────────────────────────

export class CDEECharGenLogic extends BaseCharGenLogic {
  resetData() {
    super.resetData();
    this.careers = {};
    this.careerNames = [];
    this.agingTable = [];
    this.homeworldTypes = [];
    this.lifeEvents = [];
    this.unusualEvents = [];
    this.prisonEvents = [];
    this.prisonSkills = [];
    this.injuryTable = [];
    this.skillPackages = [];
    this.zeroLevelMilitary = [];
    this.zeroLevelCivilian = [];
    this.traitPackName = 'twodsix.cepheus-deluxe-items';
  }

  _getCareerPackOptions(ruleset) {
    return {
      careersFallbackPackName: 'twodsix.cdee-srd-careers',
    };
  }

  _assignRulesetConstants(careers, careerNames, ruleset) {
    this.careers = careers;
    this.careerNames = careerNames;

    this.agingTable = CDEE_AGING_TABLE;
    this.homeworldTypes = CDEE_HOMEWORLD_TYPES;
    this.lifeEvents = CDEE_LIFE_EVENTS;
    this.unusualEvents = CDEE_UNUSUAL_EVENTS;
    this.prisonEvents = CDEE_PRISON_EVENTS;
    this.prisonSkills = CDEE_PRISON_SKILLS;
    this.injuryTable = CDEE_INJURY_TABLE;
    this.skillPackages = CDEE_SKILL_PACKAGES;
    this.zeroLevelMilitary = CDEE_ZERO_LEVEL_MILITARY;
    this.zeroLevelCivilian = CDEE_ZERO_LEVEL_CIVILIAN;
    this.cascadeSkills = CDEE_CASCADE_SKILLS;
    this.skillNameMap = CDEE_SKILL_NAME_MAP;
    this.traitPackName = `twodsix.${ruleset.toLowerCase()}-traits`;
  }

  async run(app) {
    await this.loadData(app.charState.ruleset);
    const state = app.charState;

    // 1. Characteristics
    const charMethod = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CDEECharMethod'), [
      { value: 'array', label: game.i18n.localize('TWODSIX.CharGen.Steps.CDEECharMethodArray') },
      { value: 'pointbuy', label: game.i18n.localize('TWODSIX.CharGen.Steps.CDEECharMethodPointBuy') },
    ]);
    state.creationMode = charMethod;

    const skipIdentityCharacteristics = charMethod === 'array';
    if (skipIdentityCharacteristics) {
      await this.stepCDEECharacteristicsArray(app);
    }

    // 2. Identity
    await this.stepIdentity(app, {
      characteristicsStep: skipIdentityCharacteristics ? async () => {} : null,
    });

    await this.stepOptionalRules(app);

    // 3. Homeworld
    await this.stepHomeworld(app);

    // 4. Career Selection Loop
    let lastCareerWasMilitary = false;
    while (true) {
      const careerName = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.Steps.CDEEChooseCareer'),
        optionsFromCareerNames(this.careerNames),
      );
      const career = this.careers[careerName];

      if (state.careers.length > 0) {
        if (!(lastCareerWasMilitary && career.isMilitary)) {
          state.currentRank = 0;
        }
      } else {
        state.currentRank = 0;
      }

      // 5. Terms
      const remainingTerms = 7 - state.totalTerms;
      const termOptions = [];
      for (let i = 1; i <= remainingTerms; i++) {
        termOptions.push({
          value: i,
          label: game.i18n.format('TWODSIX.CharGen.TermCountOption', {
            count: i,
            termWord: game.i18n.localize(i > 1 ? 'TWODSIX.CharGen.TermWord.many' : 'TWODSIX.CharGen.TermWord.one'),
          }),
        });
      }
      const selection = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.CDEEChooseTermsInCareer', { career: careerName, max: remainingTerms }),
        termOptions,
      );
      const numTerms = parseInt(selection, 10);
      const careerStartTerm = state.totalTerms + 1;

      // 6. Zero-level skills
      if (state.careers.length === 0) {
        const zeroSkills = career.isMilitary ? this.zeroLevelMilitary : this.zeroLevelCivilian;
        for (const sk of zeroSkills) {
          await this._addSkillAtLevel(app, sk, 0);
        }
        state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.ZeroLevelSkills', {
          branch: game.i18n.localize(
            career.isMilitary ? 'TWODSIX.CharGen.CDEE.BranchMilitary' : 'TWODSIX.CharGen.CDEE.BranchCivilian',
          ),
          skills: zeroSkills.join(', '),
        }));
      } else {
        // Subsequent careers: pick ONE service skill at level 0
        const sk = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.Steps.CDEEChooseSecondSkillTable'),
          optionsFromStrings(career.service),
        );
        await this._addSkillAtLevel(app, sk, 0);
        state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.NewCareerBasicTraining', { career: careerName, skill: sk }));
      }

      // 7. Career term loop
      let termsServedInCareer = 0;
      for (let term = 1; term <= numTerms; term++) {
        state.totalTerms++;
        state.currentTermInCareer = term;
        termsServedInCareer++;
        const ageStart = state.age;
        const { termEntry } = this.logTermStart(app, {
          careerName,
          termInCareer: term,
          totalTerm: state.totalTerms,
          ageStart,
        });

        if (careerStartTerm === 1 && term === 1) {
          const mainSkill = await app._choose(
            game.i18n.localize('TWODSIX.CharGen.Steps.CDEEFirstTermMainSkill'),
            optionsFromStrings(career.service),
          );
          for (const sk of career.service) {
            await this._addSkillAtLevel(app, sk, sk === mainSkill ? 1 : 0);
          }
          state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.ServiceSkillsMain', { skill: mainSkill }));
          await this.stepSkillsAndTraining(app, careerName, 2, { term: 1 });
        } else if (term <= 3) {
          await this.stepSkillsAndTraining(app, careerName, 2);
        } else {
          await this.stepSkillsAndTraining(app, careerName, 1);
        }

        const roll = await app._roll('2d6');
        const event = (career.eventTable || []).find(e => e.roll === roll);
        if (event) {
          await this._dispatchEvent(app, event, roll, careerName, termEntry);
        }

        if (term % 2 === 0) {
          state.currentRank++;
          const rankInfo = career.ranks[state.currentRank];
          if (rankInfo) {
            app._log(
              game.i18n.localize('TWODSIX.CharGen.CDEE.LogRankIncrease'),
              rankInfo.title
                ? game.i18n.format('TWODSIX.CharGen.CDEE.LogRankNowTitle', { title: rankInfo.title })
                : game.i18n.format('TWODSIX.CharGen.CDEE.LogRankNumber', { rank: state.currentRank }),
            );
            state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.RankIncreased', {
              rank: state.currentRank,
              title: rankInfo.title || game.i18n.localize('TWODSIX.CharGen.CDEE.NoTitle'),
            }));
            if (rankInfo.skill) {
              await this._addSkillAtLevel(app, rankInfo.skill, rankInfo.level);
              state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.RankSkill', {
                skill: rankInfo.skill,
                level: rankInfo.level,
              }));
            }
          }
        }

        await this.stepAging(app);

        if (state.died) {
          break;
        }
        // crisis survival forces retirement from this career at end of the current term
        if (state.retireFromCareer) {
          state.retireFromCareer = false; // reset for any future career
          state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.LeftCareerAfterCrisis', { career: careerName }));
          break;
        }
      }

      if (state.died) {
        break;
      }

      const careerRecord = {
        name: careerName,
        terms: termsServedInCareer,
        rank: state.currentRank,
        mishap: false,
      };
      state.careers.push(careerRecord);
      lastCareerWasMilitary = career.isMilitary;

      if (state.optionalRules.switchingCareers && state.totalTerms < 7) {
        const switchChoice = await app._choose(
          game.i18n.format('TWODSIX.CharGen.Steps.CDEEOptionalSwitchCareerPrompt', { terms: state.totalTerms }),
          [
            { value: 'switch', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.SwitchCareer') },
            { value: 'finish', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.Finish') },
          ],
        );
        if (switchChoice === 'switch') {
          state.careerChanges++;
          continue;
        }
      }
      break;
    }

    if (!state.died) {
      await this.stepMusterOutAll(app);
      // settle outstanding medical/legal debt from cash benefits
      this.stepSettleDebt(app);
      await this.stepSkillPackage(app);
      await this.stepTraitSelection(app, state.totalTerms);
    }
  }

  async stepCDEECharacteristicsArray(app) {
    const values = [10, 9, 8, 7, 6, 5];
    await assignCharacteristicPoolFromChoices(app, localizedAllCharOptsForAssignment(), values, opt =>
      game.i18n.format('TWODSIX.CharGen.Steps.AssignValueToCharacteristic', { label: opt.label }),
    );
  }

  async stepHomeworld(app) {
    const state = app.charState;
    const type = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.Steps.CDEEHomeworldType'),
      this.homeworldTypes.map(t => ({
        value: t.name,
        label: game.i18n.format('TWODSIX.CharGen.Steps.CDEEHomeworldTypeOption', {
          name: t.name,
          skills: t.skills.join(', '),
        }),
      })),
    );
    const hw = this.homeworldTypes.find(t => t.name === type);
    const skill = await app._choose(
      game.i18n.format('TWODSIX.CharGen.Steps.CDEEHomeworldSkillAt1', { type }),
      [...hw.skills].sort().map(s => ({ value: s, label: `${s}-1` })),
    );
    await this._addSkillAtLevel(app, skill, 1);
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.HomeworldLog', { type, skill }));
  }

  async stepSkillsAndTraining(app, careerName, numRolls, { term = 0 } = {}) {
    const career = this.careers[careerName];
    const canAdv = app.charState.chars.edu >= 8;

    for (let i = 0; i < numRolls; i++) {
      const tables = [
        { value: 'service', label: game.i18n.localize('TWODSIX.CharGen.Skills.ServiceSkills') },
        { value: 'specialist', label: game.i18n.localize('TWODSIX.CharGen.Skills.SpecialistSkills') },
      ];
      if (canAdv) {
        tables.push({
          value: 'advanced',
          label: game.i18n.format('TWODSIX.CharGen.Skills.AdvancedEducationWithScore', { edu: app.charState.chars.edu }),
        });
      }
      tables.push({ value: 'char', label: game.i18n.localize('TWODSIX.CharGen.Steps.CDEECharacteristicPlusOne') });

      const tbl = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.CDEESkillChoiceNTotal', {
          term: app.charState.currentTermInCareer,
          current: i + 1,
          total: numRolls,
        }),
        tables,
      );

      if (tbl === 'char') {
        const opts = CHARACTERISTIC_KEYS.map(k => ({
          value: k,
          label: game.i18n.localize(`TWODSIX.CharGen.Chars.${k.toUpperCase()}`),
        }));
        const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CDEEIncreaseCharPlus1'), opts);
        adjustChar(app.charState, c, 1); // M1: capped at 15
        app._log(
          game.i18n.localize('TWODSIX.CharGen.CDEE.LogCharacteristic'),
          game.i18n.format('TWODSIX.CharGen.CDEE.CharacteristicPlusOne', {
            char: game.i18n.localize(`TWODSIX.CharGen.Chars.${c.toUpperCase()}`),
          }),
        );
      } else {
        // M7: build option list upfront; for term 1 filter out skills already at level 2
        let skills = career[tbl].sort();
        if (term === 1) {
          const available = skills.filter(s => {
            const cur = app.charState.skills.get(this.skillNameMap[s] ?? s) ?? -1;
            return cur < 2;
          });
          if (available.length > 0) {
            skills = available;
          }
        }
        const sk = await app._choose(
          game.i18n.format('TWODSIX.CharGen.Steps.CDEEChooseSkillFromTable', {
            table: tables.find(t => t.value === tbl).label,
          }),
          optionsFromStrings(skills, { sort: false }),
        );
        await this._addOrImproveSkill(app, sk, skills);
      }
    }
  }

  async stepAging(app) {
    const state = app.charState;
    state.age += 4;
    // aging begins at end of 4th term OR when age reaches 34, whichever comes first
    if (state.totalTerms < 4 && state.age < 34) {
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.AgeNow', { age: state.age }));
      return;
    }
    let agingDM = 0;
    if (state.optionalRules.agingTech) {
      const selection = await app._choose(game.i18n.localize("TWODSIX.CharGen.OptionalRules.ChooseTL"), [
        { value: 0, label: game.i18n.localize("TWODSIX.CharGen.OptionalRules.TL8Below") },
        { value: 1, label: game.i18n.localize("TWODSIX.CharGen.OptionalRules.TL9to11") },
        { value: 2, label: game.i18n.localize("TWODSIX.CharGen.OptionalRules.TL12to14") },
        { value: 3, label: game.i18n.localize("TWODSIX.CharGen.OptionalRules.TL15Plus") },
      ]);
      agingDM = parseInt(selection, 10);
    }
    const roll = await app._roll('2d6');
    const result = roll - state.totalTerms + agingDM;
    app._log(
      game.i18n.localize('TWODSIX.CharGen.CDEE.LogAging'),
      game.i18n.format('TWODSIX.CharGen.CDEE.AgingRollLog', {
        roll,
        terms: state.totalTerms,
        agingDM: agingDM ? addSign(agingDM) : '',
        result,
        ageLabel: game.i18n.localize('TWODSIX.CharGen.App.Age'),
        age: state.age,
      }),
    );

    if (result <= 0) {
      const idx = Math.min(7, Math.max(0, result + 6));
      const entry = this.agingTable[idx];
      if (entry) {
        state.log.push(game.i18n.localize('TWODSIX.CharGen.CDEE.AgingEffectReducing'));
        await this.applyAgingEntryReductions(app, entry, {
          physPromptFormatKey: 'TWODSIX.CharGen.Aging.ReducePhysicalCharBy',
        });
      }
    }
  }

  async _handleCrisis(app, zeroChars) {
    const state = app.charState;
    // apply END modifier to the 6+ survival throw (standard Cepheus throw convention)
    const endMod = calcModFor(state.chars.end ?? 0);
    const roll = await app._roll('2d6');
    const total = roll + endMod;
    const success = total >= 6;
    app._log(
      game.i18n.localize('TWODSIX.CharGen.CDEE.LogCrisis'),
      game.i18n.format('TWODSIX.CharGen.CDEE.CrisisRoll', {
        roll,
        endMod: addSign(endMod),
        total,
        outcome: game.i18n.localize(
          success ? 'TWODSIX.CharGen.Outcome.Survived' : 'TWODSIX.CharGen.Outcome.Died',
        ),
      }),
    );

    if (success) {
      zeroChars.forEach(c => (state.chars[c] = 1));
      // flag that the character must leave this career at the end of the term
      state.retireFromCareer = true;
      state.log.push(game.i18n.localize('TWODSIX.CharGen.CDEE.SurvivedCrisisRetire'));
    } else {
      state.died = true;
      state.log.push(game.i18n.localize('TWODSIX.CharGen.CDEE.DiedAgingCrisis'));
      throw CHARGEN_DIED;
    }
  }

  _humanizeTag(tag) {
    if (tag.startsWith('CHECK:')) {
      const parts = tag.split(':');
      return `${parts[1]} ${parts[2] ?? 8}+`;
    }
    if (tag.startsWith('CHOOSE_SKILL:')) {
      const or = game.i18n.localize('TWODSIX.CharGen.ListOr');
      return tag.split(':')[1].split(',').join(or);
    }
    if (tag === 'INJURY') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagInjury');
    }
    if (tag === 'LIFE_EVENT') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagLifeEvent');
    }
    if (tag === 'UNUSUAL_EVENT') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagUnusualEvent');
    }
    if (tag === 'PRISON') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagPrison');
    }
    if (tag === 'RANK_UP') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagRankUp');
    }
    if (tag.startsWith('BENEFIT_DM:')) {
      return game.i18n.format('TWODSIX.CharGen.CDEE.TagBenefitDM', { n: tag.split(':')[1] });
    }
    if (tag === 'FREE_SKILL') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagFreeSkill');
    }
    if (tag === 'BENEFIT_ROLL') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagExtraBenefitRoll');
    }
    if (tag === 'LOSE_BENEFIT_ROLL') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagLoseBenefitRoll');
    }
    if (tag.startsWith('TRAIT:')) {
      return game.i18n.format('TWODSIX.CharGen.CDEE.TagTraitNamed', { name: tag.slice(6) });
    }
    if (tag === 'TRAIT') {
      return game.i18n.localize('TWODSIX.CharGen.CDEE.TagFreeTrait');
    }
    if (tag.startsWith('CASH:')) {
      const amt = parseInt(tag.split(':')[1], 10);
      return isNaN(amt)
        ? game.i18n.localize('TWODSIX.CharGen.CDEE.TagCashUnknown')
        : game.i18n.format('TWODSIX.CharGen.CDEE.TagCash', { amount: amt.toLocaleString() });
    }
    if (tag.startsWith('CYBERNETICS:')) {
      const amt = parseInt(tag.split(':')[1], 10);
      return isNaN(amt)
        ? game.i18n.localize('TWODSIX.CharGen.CDEE.TagCyberneticsUnknown')
        : game.i18n.format('TWODSIX.CharGen.CDEE.TagCybernetics', { amount: amt.toLocaleString() });
    }
    return super._humanizeTag(tag);
  }

  // CDEE never returns true (leaveCareer signal) from this method. Career exit is handled
  // via state.retireFromCareer (set in _handleCrisis on survival), not via the event-report path.
  async _applyRulesetTag(app, tag, description, careerName, report = null) {
    const state = app.charState;
    if (tag.startsWith('CHOOSE_SKILL:')) {
      const skills = tag.split(':')[1].split(',');
      const sk = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CDEEEventPickSkill'), optionsFromStrings(skills, { sort: false }));
      await this._addOrImproveSkill(app, sk, skills);
      reportSubRow(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportChoseSkill', { skill: sk }));
    } else if (tag.startsWith('CHECK:')) {
      const parts = tag.split(':');
      const skill = parts[1];
      const target = parseInt(parts[2]) || 8;
      const { success } = await this._rollSkillOrCharCheck(app, skill, target, { abbreviatedStateLog: true });
      reportSubRow(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportCheck', {
        skill,
        target,
        outcome: game.i18n.localize(
          success ? 'TWODSIX.CharGen.Outcome.Success' : 'TWODSIX.CharGen.Outcome.Fail',
        ),
      }));
    } else if (tag === 'INJURY') {
      await this.stepInjury(app, report);
    } else if (tag === 'LIFE_EVENT') {
      await this.stepLifeEvent(app, report);
    } else if (tag === 'UNUSUAL_EVENT') {
      await this.stepUnusualEvent(app, report);
    } else if (tag === 'PRISON') {
      await this.stepPrison(app, report);
    } else if (tag === 'RANK_UP') {
      state.currentRank++;
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogRankUp'),
        game.i18n.format('TWODSIX.CharGen.CDEE.LogRankNow', { rank: state.currentRank }),
      );
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateEarlyPromotion', { rank: state.currentRank }));
      reportAutoHandled(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportRank', { rank: state.currentRank }));
    } else if (tag.startsWith('BENEFIT_DM:')) {
      const dm = parseInt(tag.split(':')[1]);
      state.benefitDMs.push(dm);
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogBenefitDM'),
        game.i18n.format('TWODSIX.CharGen.CDEE.LogBenefitDMDetail', { dm }),
      );
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateBenefitDMNext', { dm }));
      reportAutoHandled(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportBenefitDM', { dm }));
    } else if (tag === 'FREE_SKILL') {
      await this.stepFreeSkill(app, careerName, report);
    } else if (tag === 'BENEFIT_ROLL') {
      state.extraBenefitRolls++;
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogBenefitRoll'),
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogExtraMusterRoll'),
      );
      state.log.push(game.i18n.localize('TWODSIX.CharGen.CDEE.StateGainedExtraRoll'));
      reportAutoHandled(report, game.i18n.localize('TWODSIX.CharGen.CDEE.ReportExtraBenefitRoll'));
    } else if (tag === 'LOSE_BENEFIT_ROLL') {
      // Floor: can't go further into debt than the total rolls ever earned (1 base + terms per career)
      const totalEarnedRolls = state.careers.reduce((acc, c) => acc + (1 + c.terms), 0);
      state.extraBenefitRolls = Math.max(state.extraBenefitRolls - 1, -totalEarnedRolls);
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogBenefitRoll'),
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogLostMusterRoll'),
      );
      state.log.push(game.i18n.localize('TWODSIX.CharGen.CDEE.StateLostRoll'));
      reportAutoHandled(report, game.i18n.localize('TWODSIX.CharGen.CDEE.ReportLostBenefitRoll'));
    } else if (tag === 'TRAIT') {
      await this.stepPickTrait(app, report);
    } else if (tag.startsWith('TRAIT:')) {
      const traitName = tag.slice(6).trim();
      await this.stepGainNamedTrait(app, traitName, report);
    } else if (tag.startsWith('CASH:')) {
      const amt = parseInt(tag.split(':')[1], 10);
      if (!isNaN(amt)) {
        state.cashBenefits += amt;
        app._log(
          game.i18n.localize('TWODSIX.CharGen.CDEE.LogCash'),
          game.i18n.format('TWODSIX.CharGen.CDEE.LogCashPlus', { amount: amt.toLocaleString() }),
        );
        state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateCashGain', { amount: amt.toLocaleString() }));
        reportAutoHandled(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportCrAmount', { amount: amt.toLocaleString() }));
      }
    } else if (tag.startsWith('CYBERNETICS:')) {
      const amt = parseInt(tag.split(':')[1], 10);
      const label = isNaN(amt)
        ? game.i18n.localize('TWODSIX.CharGen.CDEE.TagCyberneticsUnknown')
        : game.i18n.format('TWODSIX.CharGen.CDEE.TagCybernetics', { amount: amt.toLocaleString() });
      state.materialBenefits.push(label);
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogCybernetics'), label);
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateGainedItem', { label }));
      reportAutoHandled(report, label);
    }
    return false;
  }

  /**
   * Prompt user to pick any one skill from all career tables and add it at level 1.
   */
  async stepFreeSkill(app, careerName, report = null) {
    const state = app.charState;
    const allSkills = new Set();
    for (const career of Object.values(this.careers)) {
      for (const sk of [...(career.service || []), ...(career.specialist || []), ...(career.advanced || [])]) {
        if (typeof sk === 'string') {
          allSkills.add(sk);
        }
      }
    }
    const opts = optionsFromStrings([...allSkills]);
    if (!opts.length) {
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogFreeSkill'), game.i18n.localize('TWODSIX.CharGen.CDEE.LogNoSkillsAvailable'));
      return;
    }
    const chosen = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CDEEFreeSkillPick'), opts);
    const name = await this._addSkillAtLevel(app, chosen, 1);
    if (name) {
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogFreeSkill'),
        game.i18n.format('TWODSIX.CharGen.CDEE.LogFreeSkillGain', { name }),
      );
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateFreeSkill', { name }));
      reportSubRow(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportFreeSkill', { name }));
    }
  }

  /**
   * Prompt user to pick a trait (free trait from unusual event).
   */
  async stepPickTrait(app, report = null) {
    const state = app.charState;
    const traitPack = game.packs.get(this.traitPackName) || game.packs.get('twodsix.cepheus-deluxe-items');
    if (!traitPack) {
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogTrait'), game.i18n.localize('TWODSIX.CharGen.CDEE.LogTraitPackNotFound'));
      return;
    }
    const docs = await traitPack.getDocuments();
    const available = docs.filter(d => d.type === 'trait').sort((a, b) => a.name.localeCompare(b.name));
    if (!available.length) {
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogTrait'), game.i18n.localize('TWODSIX.CharGen.CDEE.LogNoTraitsAvailable'));
      return;
    }
    const chosen = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.Steps.CDEEFreeTrait'),
      available.map(t => ({ value: t.name, label: t.name })),
    );
    state.traits.push(chosen);
    app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogTrait'), chosen);
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateGainedTrait', { name: chosen }));
    reportSubRow(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportGainedTrait', { name: chosen }));
  }

  /**
   * Auto-grant a named trait (e.g. from [TRAIT:Hard to Kill]).
   */
  async stepGainNamedTrait(app, traitName, report = null) {
    const state = app.charState;
    if (!state.traits.includes(traitName)) {
      state.traits.push(traitName);
    }
    app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogTrait'), traitName);
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateGainedTrait', { name: traitName }));
    reportAutoHandled(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportTraitNamed', { name: traitName }));
  }

  /**
   * Roll on the unusual events table and apply resulting tags.
   */
  async stepUnusualEvent(app, report = null) {
    const state = app.charState;
    const roll = await app._roll('1d6');
    const entry = this.unusualEvents[roll - 1];
    if (!entry) {
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogUnusualEvent'),
        game.i18n.format('TWODSIX.CharGen.CDEE.LogUnusualEventNoEntry', { roll }),
      );
      return;
    }
    app._log(`${game.i18n.localize('TWODSIX.CharGen.CDEE.TagUnusualEvent')} (${roll})`, entry);
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateUnusualEvent', { roll, entry }));
    reportSubRow(report, game.i18n.format('TWODSIX.CharGen.CDEE.ReportUnusualEvent', {
      roll,
      text: this._humanizeTaggedDescription(entry),
    }));
    await this.applyEventTags(app, entry);
  }

  async stepInjury(app, parentReport = null) {
    const state = app.charState;
    if (state.optionalRules.ironMan) {
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogIronMan'),
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogInjuryFatal'),
      );
      state.died = true;
      throw CHARGEN_DIED;
    }
    const roll = await app._roll('2d6');
    const endMod = calcModFor(state.chars.end ?? 0);
    const effect = roll + endMod - 6;
    const entry = this.injuryTable.find(e => e.effect === effect) || this.injuryTable[0];
    app._log(
      game.i18n.localize('TWODSIX.CharGen.CDEE.LogInjury'),
      game.i18n.format('TWODSIX.CharGen.CDEE.LogInjuryDetail', {
        roll,
        endMod: addSign(endMod),
        effect: addSign(effect),
        description: entry.description,
      }),
    );
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateInjury', { description: entry.description }));
    reportSubRow(parentReport, game.i18n.format('TWODSIX.CharGen.CDEE.ReportInjury', {
      text: this._humanizeTaggedDescription(entry.description),
    }));
    await this.applyEventTags(app, entry);
    await this.checkCrisis(app);
  }

  async stepLifeEvent(app, parentReport = null) {
    const roll = await app._roll('2d6');
    const event = this.lifeEvents.find(e => e.roll === roll);
    if (event) {
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogLifeEvent'), event.description);
      reportSubRow(parentReport, game.i18n.format('TWODSIX.CharGen.CDEE.ReportLifeEvent', {
        roll,
        text: this._humanizeTaggedDescription(event.description),
      }));
      await this.applyEventTags(app, event);
    }
  }

  async stepPrison(app, parentReport = null) {
    const state = app.charState;
    state.prisonTerms++;
    const sk = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.Steps.CDEEPrisonPickSkill'),
      optionsFromStrings(this.prisonSkills, { sort: false }),
    );
    await this._addOrImproveSkill(app, sk);
    reportSubRow(parentReport, game.i18n.format('TWODSIX.CharGen.CDEE.ReportPrisonSkill', { skill: sk }));

    const roll = await app._roll('2d6');
    const event = this.prisonEvents.find(e => e.roll === roll);
    if (event) {
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogPrisonEvent'), event.description);
      reportSubRow(parentReport, game.i18n.format('TWODSIX.CharGen.CDEE.ReportPrisonEvent', {
        roll,
        text: this._humanizeTaggedDescription(event.description),
      }));
      await this.applyEventTags(app, event);
    }
  }

  /**
   * Dispatch a single career event — handles both structured (has `checks` field) and
   * legacy prose events.  Updates termEntry.events with headline + sub-rows.
   *
   * Headline format:
   *   "Description. Check Skill T+: roll+mod=total → Success/Fail."
   * Appends " AUTOMATICALLY HANDLED" when every effect is purely automatic.
   */
  async _dispatchEvent(app, event, rollResult, careerName, termEntry) {
    const state = app.charState;

    if (event.checks?.length) {
      // ── Structured event: resolve check(s), apply conditional branches ──────
      const { success, checkSummary } = await this._resolveChecks(app, event.checks);
      const baseHeadline = `${event.description} ${checkSummary}.`;
      const eventLabel = game.i18n.format('TWODSIX.CharGen.CDEE.EventLogLabel', { roll: rollResult });
      app._log(eventLabel, baseHeadline);
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateEvent', { roll: rollResult, text: baseHeadline }));

      let allAuto = true;
      const subRows = [];

      // Apply 'always' tags first
      for (const tagExpr of (event.always || [])) {
        const r = await this.applyEventTags(app, tagExpr, careerName);
        if (!r.allAutoHandled) {
          allAuto = false;
        }
        subRows.push(...r.subRows);
      }
      // Apply branch tags
      const branchTags = success ? (event.onSuccess || []) : (event.onFail || []);
      for (const tagExpr of branchTags) {
        const r = await this.applyEventTags(app, tagExpr, careerName);
        if (!r.allAutoHandled) {
          allAuto = false;
        }
        subRows.push(...r.subRows);
      }

      const autoSuffix = game.i18n.localize('TWODSIX.CharGen.CDEE.AutoHandledSuffix');
      const displayHeadline = allAuto ? `${baseHeadline}${autoSuffix}` : baseHeadline;
      termEntry.events.push(displayHeadline);
      if (!allAuto) {
        for (const subRow of subRows) {
          termEntry.events.push(`  ${subRow}`);
        }
      }
    } else {
      // ── Legacy prose event ────────────────────────────────────────────────
      const report = await this.applyEventTags(app, event, careerName);
      // Strip tag placeholders from headline so they aren't doubled when auto-handled
      const autoSuffix = game.i18n.localize('TWODSIX.CharGen.CDEE.AutoHandledSuffix');
      const cleanHeadline = report.allAutoHandled
        ? `${stripMechanicTags(event.description)}${autoSuffix}`
        : report.headline;
      const eventLabel = game.i18n.format('TWODSIX.CharGen.CDEE.EventLogLabel', { roll: rollResult });
      app._log(eventLabel, cleanHeadline);
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateEvent', { roll: rollResult, text: cleanHeadline }));
      termEntry.events.push(cleanHeadline);
      if (!report.allAutoHandled) {
        for (const subRow of report.subRows) {
          termEntry.events.push(`  ${subRow}`);
        }
      }
    }
  }

  /**
   * 2D6 + characteristic or skill DM vs target (shared by structured events and CHECK tags).
   * @param {CharGenApp} app
   * @param {string} skill - Characteristic key or skill name as printed in the UI
   * @param {number} target
   * @param {{ abbreviatedStateLog?: boolean }} [opts]
   * @returns {Promise<{ success: boolean, checkSummary: string }>}
   */
  async _rollSkillOrCharCheck(app, skill, target, { abbreviatedStateLog = false } = {}) {
    const state = app.charState;
    const roll = await app._roll('2d6');
    const charKey = skill.toLowerCase();
    const isCharCheck = ['str', 'dex', 'end', 'int', 'edu', 'soc'].includes(charKey);
    const rawVal = isCharCheck ? (state.chars[charKey] ?? 0) : (state.skills.get(skill) ?? -1);
    const mod = calcModFor(rawVal);
    const total = roll + mod;
    const success = total >= target;
    const outcome = success
      ? game.i18n.localize('TWODSIX.CharGen.Outcome.Success')
      : game.i18n.localize('TWODSIX.CharGen.Outcome.Fail');
    const modSign = addSign(mod);
    const checkSummary = game.i18n.format('TWODSIX.CharGen.CDEE.EventCheckSummary', {
      skill,
      target,
      roll,
      modSign,
      total,
      outcome,
    });
    app._log(
      game.i18n.localize('TWODSIX.CharGen.CDEE.LogEventCheck'),
      game.i18n.format('TWODSIX.CharGen.CDEE.EventCheckDetail', {
        skill,
        target,
        roll,
        modSign,
        total,
        outcome,
      }),
    );
    state.log.push(
      abbreviatedStateLog
        ? game.i18n.format('TWODSIX.CharGen.CDEE.StateCheckAbbrev', { skill, target, outcome })
        : game.i18n.format('TWODSIX.CharGen.CDEE.StateCheckFull', { summary: checkSummary }),
    );
    return { success, checkSummary };
  }

  /**
   * Resolve one or more checks (OR logic: any passing = success).
   * If multiple checks are provided the player picks which one to roll.
   * Returns { success: boolean, checkSummary: string }.
   */
  async _resolveChecks(app, checks) {
    let checkToRoll;

    if (checks.length === 1) {
      checkToRoll = checks[0];
    } else {
      const chosen = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.Steps.CDEEWhichCheckAttempt'),
        checks.map(c => ({ value: c.skill, label: `${c.skill} ${c.target}+` })),
      );
      checkToRoll = checks.find(c => c.skill === chosen) ?? checks[0];
    }

    const { skill, target } = checkToRoll;
    return this._rollSkillOrCharCheck(app, skill, target, { abbreviatedStateLog: false });
  }

  async stepMusterOutAll(app) {
    const state = app.charState;
    if (state.died) {
      return;
    }

    let totalRolls = state.careers.reduce((acc, c) => acc + (1 + c.terms), 0);
    totalRolls -= state.prisonTerms;
    totalRolls -= state.careerChanges;
    totalRolls += state.extraBenefitRolls;
    totalRolls = Math.max(0, totalRolls);

    app._log(
      game.i18n.localize('TWODSIX.CharGen.CDEE.LogMusterOut'),
      game.i18n.format('TWODSIX.CharGen.CDEE.LogTotalBenefitRolls', { n: totalRolls }),
    );
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateMusterHeader', { n: totalRolls }));

    for (let i = 0; i < totalRolls; i++) {
      let careerRecordIdx = 0;
      if (state.careers.length > 1) {
        const selected = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.OptionalRules.ChooseMusterCareer'),
          state.careers.map((c, idx) => {
            const termWord = c.terms === 1
              ? game.i18n.localize('TWODSIX.CharGen.TermWord.one')
              : game.i18n.localize('TWODSIX.CharGen.TermWord.many');
            return {
              value: String(idx),
              label: game.i18n.format('TWODSIX.CharGen.CDEE.MusterCareerOption', {
                name: c.name,
                terms: c.terms,
                termWord,
              }),
            };
          }),
        );
        careerRecordIdx = Math.max(0, parseInt(selected, 10) || 0);
      }
      const careerRecord = state.careers[careerRecordIdx];
      const careerName = careerRecord.name;
      const career = this.careers[careerName];

      const opts = [
        { value: 'cash', label: game.i18n.localize('TWODSIX.CharGen.Options.Cash') },
        { value: 'material', label: game.i18n.localize('TWODSIX.CharGen.Options.MaterialBenefit') },
      ];
      if (careerRecord.rank < 6) {
        opts.push({ value: 'rank', label: game.i18n.localize('TWODSIX.CharGen.Options.PurchaseRank') });
      }

      const choice = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.CDEEMusterBenefitNTotal', { current: i + 1, total: totalRolls }),
        opts,
      );

      if (choice === 'rank') {
        careerRecord.rank++;
        const rankInfo = career.ranks[careerRecord.rank];
        const titleLabel = rankInfo?.title
          ?? game.i18n.format('TWODSIX.CharGen.CDEE.LogRankNumber', { rank: careerRecord.rank });
        app._log(
          game.i18n.localize('TWODSIX.CharGen.CDEE.LogRankPurchased'),
          game.i18n.format('TWODSIX.CharGen.CDEE.LogRankPurchasedDetail', { title: titleLabel, career: careerName }),
        );
        if (rankInfo?.skill) {
          await this._addOrImproveSkill(app, rankInfo.skill);
        }
        state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StatePurchasedRank', {
          rank: careerRecord.rank,
          career: careerName,
        }));
        continue;
      }

      const carousingMod = calcModFor(state.skills.get('Carousing') ?? -1);
      const socMod = calcModFor(state.chars.soc ?? 0);
      const dm = i < state.benefitDMs.length ? state.benefitDMs[i] : 0;

      let cashDM = 0;
      if (choice === 'cash') {
        // throw Carouse/SOC 10+ (use best of the two modifiers); success = +1 DM, fail = -1 DM
        const roll2d6 = await app._roll('2d6');
        const best = roll2d6 + Math.max(carousingMod, socMod);
        cashDM = best >= 10 ? 1 : -1;
        app._log(
          game.i18n.localize('TWODSIX.CharGen.CDEE.LogCashDMRoll'),
          game.i18n.format('TWODSIX.CharGen.CDEE.LogCashDMRollDetail', {
            roll: roll2d6,
            mod: Math.max(carousingMod, socMod),
            best,
            dm: addSign(cashDM),
          }),
        );
      }

      const roll1d6 = await app._roll('1d6');
      const finalRoll = Math.min(6, Math.max(1, roll1d6 + dm + cashDM));

      if (choice === 'cash') {
        const amt = career.cash[finalRoll - 1];
        state.cashBenefits += amt;
        state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateCashRoll', {
          detail: `${roll1d6}${addSign(dm + cashDM)}`,
          amount: amt.toLocaleString(),
        }));
      } else {
        const benefit = career.material[finalRoll - 1];
        await this.applySharedMaterialBenefit(app, benefit, 'cdee');
        state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateMaterialRoll', {
          detail: `${roll1d6}${addSign(dm)}`,
          benefit,
        }));
      }
    }
  }

  async stepSkillPackage(app) {
    const state = app.charState;
    const pkgName = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CDEESkillPackage'), [
      { value: 'none', label: game.i18n.localize('TWODSIX.CharGen.Steps.CDEESkillPackageNone') },
      ...this.skillPackages.map(p => ({ value: p.name, label: p.name })),
    ]);
    if (pkgName === 'none') {
      return;
    }

    const pkg = this.skillPackages.find(p => p.name === pkgName);
    for (const sk of pkg.skills) {
      await this._addOrImproveSkill(app, sk);
    }
    state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateSkillPackage', { name: pkgName }));
  }

  async stepTraitSelection(app, numTerms) {
    const state = app.charState;
    const numTraits = Math.ceil(numTerms / 2);
    if (numTraits <= 0) {
      return;
    }

    const traitPack = game.packs.get(this.traitPackName) || game.packs.get('twodsix.cepheus-deluxe-items');
    if (!traitPack) {
      app._log(
        game.i18n.localize('TWODSIX.CharGen.CDEE.LogError'),
        game.i18n.format('TWODSIX.CharGen.CDEE.LogTraitPackMissing', { pack: this.traitPackName }),
      );
      return;
    }
    const docs = await traitPack.getDocuments();
    const availableTraits = docs.filter(d => d.type === 'trait').sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < numTraits; i++) {
      const traitName = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.CDEESelectTraitNTotal', { current: i + 1, total: numTraits }),
        availableTraits.map(t => ({ value: t.name, label: t.name })),
      );
      state.traits.push(traitName);
      app._log(game.i18n.localize('TWODSIX.CharGen.CDEE.LogTrait'), traitName);
      state.log.push(game.i18n.format('TWODSIX.CharGen.CDEE.StateSelectedTrait', { name: traitName }));
    }
  }

  async stepOptionalRules(app) {
    const state = app.charState;
    const rules = state.optionalRules;

    const yesNo = [
      { value: true, label: game.i18n.localize('TWODSIX.CharGen.Options.YesEnterAnother').split(' — ')[0] },
      { value: false, label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.No') },
    ];
    const yesRecNo = [
      { value: true, label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.YesRecommended') },
      { value: false, label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.No') },
    ];

    rules.switchingCareers = await app._choose(game.i18n.localize('TWODSIX.CharGen.OptionalRules.SwitchingCareers'), yesNo);
    rules.agingTech = await app._choose(game.i18n.localize('TWODSIX.CharGen.OptionalRules.AgingTech'), yesNo);
    rules.ironMan = await app._choose(game.i18n.localize('TWODSIX.CharGen.OptionalRules.IronMan'), yesNo);
    rules.skillLimits = await app._choose(game.i18n.localize('TWODSIX.CharGen.OptionalRules.SkillLimits'), yesRecNo);
  }

  async _addOrImproveSkill(app, rawName, alternativeSkills = null) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return;
    }

    const state = app.charState;
    const cur = getSkillLevel(state, name);
    const newLevel = nextLevelAfterImprove(cur);

    if (state.optionalRules.skillLimits && newLevel > 3) {
      const choices = [
        { value: 'ignore', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.IgnoreLimit') },
        { value: 'other', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.PickDifferent') },
        { value: 'skip', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.SkipSkill') },
      ];
      const choice = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.CDEESkillAtLimitPrompt', {
          name,
          level: cur,
          detail: game.i18n.localize('TWODSIX.CharGen.OptionalRules.SkillLimits'),
        }),
        choices,
      );

      if (choice === 'ignore') {
        await super._addOrImproveSkill(app, name);
      } else if (choice === 'other') {
        const alts = (alternativeSkills || Array.from(state.skills.keys())).filter(s => s !== name);
        if (alts.length === 0) {
          app._log(
            game.i18n.localize('TWODSIX.CharGen.CDEE.LogSkillLimit'),
            game.i18n.localize('TWODSIX.CharGen.CDEE.LogNoAlternativeSkills'),
          );
          return;
        }
        const other = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.OptionalRules.PickDifferent'),
          optionsFromStrings(alts, { sort: false }),
        );
        await this._addOrImproveSkill(app, other, alts);
      } else {
        app._log(
          game.i18n.localize('TWODSIX.CharGen.CDEE.LogSkillLimit'),
          game.i18n.format('TWODSIX.CharGen.CDEE.LogSkippedSkillGain', { name }),
        );
      }
    } else {
      await super._addOrImproveSkill(app, name);
    }
  }
}
