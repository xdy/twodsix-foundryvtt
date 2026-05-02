// CECharGenLogic.js — Cepheus Engine character generation logic
//
// CE vs CDEE: career loops differ materially (qualification, survival, term batching, CDEE-only systems).
// Shared mechanics live on BaseCharGenLogic; do not merge the two `run()` implementations without a rules pass.
import { calcModFor } from '../../../../utils/sheetUtils.js';
import { addSign } from '../../../../utils/utils.js';
import { BaseCharGenLogic } from '../../BaseCharGenLogic.js';
import {
  CE_AGING_TABLE,
  CE_CASCADE_SKILLS,
  CE_DRAFT_TABLE,
  CE_EDUCATION_SKILLS,
  CE_HOMEWORLD_DESCRIPTORS,
  CE_INJURY_DESC,
  CE_MISHAP_DESC,
  CE_SKILL_NAME_MAP
} from './CECharGenConstants.js';
import { CHARGEN_DIED, CharGenConstants } from '../../CharGenState.js';
import {
  localizedPhysicalOpts,
  optionsFromCareerNames,
  optionsFromStrings,
  promptContinueInCareer,
} from '../../CharGenUtils.js';

// ─── MODULE-LEVEL DATA (loaded from CE pack) ──────────────────────────────────

/**
 * CE character generation logic.
 * Extends BaseCharGenLogic with Cepheus Engine-specific rules.
 */
export class CECharGenLogic extends BaseCharGenLogic {
  resetData() {
    super.resetData();
    this.careers = {};
    this.careerNames = [];
    this.agingTable = [];
    this.mishapDesc = {};
    this.injuryDesc = {};
    this.draftTable = {};
    this.homeworldDescriptors = {};
    this.educationSkills = [];
  }

  _getCareerPackOptions(ruleset) {
    return {
      careersPackName: 'twodsix.ce-srd-items',
    };
  }

  _assignRulesetConstants(careers, careerNames, ruleset) {
    this.careers = careers;
    this.careerNames = careerNames;

    this.agingTable = CE_AGING_TABLE;
    this.mishapDesc = CE_MISHAP_DESC;
    this.injuryDesc = CE_INJURY_DESC;
    this.draftTable = CE_DRAFT_TABLE;
    this.cascadeSkills = CE_CASCADE_SKILLS;
    this.homeworldDescriptors = CE_HOMEWORLD_DESCRIPTORS;
    this.educationSkills = CE_EDUCATION_SKILLS;
    this.skillNameMap = CE_SKILL_NAME_MAP;
  }

  /**
   * Run character generation.
   * @param {CharGenApp} app - The character generation app
   * @returns {Promise<void>}
   */
  async run(app) {
    await this.loadData(app.charState.ruleset);
    const state = app.charState;
    await this.stepIdentity(app);

    await this.stepHomeworld(app);

    let isFirstCareer = true;
    let forceRetire = false;
    while (true) {
      const { careerName, drafted } = await this.stepQualification(app);
      const career = this.careers[careerName];
      state.currentRank = 0;
      state.currentTermInCareer = 0;
      await this._applyRankSkill(app, careerName, 0);
      await this.stepBasicTraining(app, careerName, isFirstCareer);
      isFirstCareer = false;
      let termBenefitsLost = false;
      let careerMishap = false;
      while (true) {
        state.totalTerms++;
        state.currentTermInCareer++;
        const ageStart = state.age;
        this.logTermStart(app, {
          careerName,
          termInCareer: state.currentTermInCareer,
          totalTerm: state.totalTerms,
          ageStart,
        });
        const { survived, benefitsLost } = await this.stepSurvival(app, careerName);
        if (!survived) {
          termBenefitsLost = benefitsLost;
          careerMishap = true;
          state.age += 2;
          break;
        }
        let extraRolls = 0;
        if (!drafted || state.currentTermInCareer > 1) {
          const comm = await this.stepCommission(app, careerName);
          extraRolls += comm.extraRoll;
        }
        const adv = await this.stepAdvancement(app, careerName);
        extraRolls += adv.extraRoll;
        await this.stepSkillsAndTraining(app, careerName, (career.hasCommAdv ? 1 : 2) + extraRolls);
        await this.stepAging(app);
        const { mustContinue, mustRetire, wantsToContinue } = await this.stepReenlistment(app, careerName);
        if (mustRetire) {
          forceRetire = true;
          break;
        }
        if (!mustContinue && !wantsToContinue) {
          break;
        }
      }
      const rankInfo = career.ranks[state.currentRank];
      const currentCareerEntry = {
        name: careerName,
        terms: state.currentTermInCareer,
        rank: state.currentRank,
        rankTitle: rankInfo?.title ?? null,
        benefitsLost: termBenefitsLost,
        mishap: careerMishap,
        assignment: careerName,
      };
      state.careers.push(currentCareerEntry);
      if (!state.previousCareers.includes(careerName)) {
        state.previousCareers.push(careerName);
      }
      if (!termBenefitsLost) {
        await this.stepMusterOut(app, state.careers.at(-1));
      }
      if (forceRetire) {
        app._log(
          game.i18n.localize('TWODSIX.CharGen.Events.Retirement'),
          game.i18n.localize('TWODSIX.CharGen.Messages.RetirementMandatory'),
        );
        break;
      }
      const another = await this.promptAnotherCareer(app, state.totalTerms);
      if (another !== 'yes') {
        const h = this.findTermEntry(state, careerName, state.totalTerms);
        if (h) {
          h.events.push(game.i18n.format('TWODSIX.CharGen.Messages.VoluntarilyLeftCareer', { career: careerName }));
        }
        break;
      }
    }
    // settle outstanding medical/legal debt from cash benefits
    this.stepSettleDebt(app);
  }

  // ─── CE-SPECIFIC STEPS ────────────────────────────────────────────────────────

  async stepHomeworld(app) {
    const state = app.charState;
    const doHW = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.HomeworldBackground'), [
      { value: 'yes', label: game.i18n.localize('TWODSIX.CharGen.Options.YesPickHomeworld') },
      { value: 'no', label: game.i18n.localize('TWODSIX.CharGen.Options.NoSkipHomeworldEducation') },
    ]);
    const total = Math.max(1, 3 + calcModFor(state.chars.edu ?? 0));
    state.log.push(`Background skills: ${total}`);

    if (doHW !== 'yes') {
      // No homeworld chosen: all slots come from the education list
      for (let i = 0; i < total; i++) {
        const sk = await app._choose(
          game.i18n.format('TWODSIX.CharGen.Steps.EducationBackgroundSkillNTotal', { current: i + 1, total }),
          optionsFromStrings(this.educationSkills),
        );
        await this._addSkillAtLevel(app, sk, 0);
        state.log.push(`Background (education): ${sk}-0`);
      }
      return;
    }

    const hwKeys = Object.keys(this.homeworldDescriptors);
    const hwCount = Math.min(2, total);
    for (let i = 0; i < hwCount; i++) {
      const desc = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.HomeworldDescriptorNTotal', { current: i + 1, max: hwCount }),
        hwKeys.map(k => ({
          value: k,
          label: game.i18n.format('TWODSIX.CharGen.Steps.HomeworldDescriptorWithSkill', {
            descriptor: k,
            skill: this.homeworldDescriptors[k],
          }),
        })),
      );
      await this._addSkillAtLevel(app, this.homeworldDescriptors[desc], 0);
      state.homeworldDescriptors.push(desc);
      state.log.push(`Background (${desc}): ${this.homeworldDescriptors[desc]}-0`);
    }
    for (let i = 0; i < total - hwCount; i++) {
      const sk = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.EducationBackgroundSkillNTotal', {
          current: i + 1,
          total: total - hwCount,
        }),
        optionsFromStrings(this.educationSkills),
      );
      await this._addSkillAtLevel(app, sk, 0);
      state.log.push(`Background (education): ${sk}-0`);
    }
  }

  async stepQualification(app) {
    const state = app.charState;
    const fallbackCareer = this.careers.Drifter ? 'Drifter' : this.careerNames[0];
    if (!fallbackCareer) {
      throw new Error('CharGen qualification failed: no careers are available.');
    }
    if (state.qualFails) {
      app._log('Qualification', 'Prior crisis — auto-fail. Entering Drifter.');
      return { careerName: fallbackCareer, drafted: false };
    }
    const available = this.careerNames.filter(n => n === 'Drifter' || !state.previousCareers.includes(n)).sort((a, b) =>
      a.localeCompare(b)
    );
    if (!available.length) {
      app._log('Qualification', `No eligible careers left; defaulting to ${fallbackCareer}.`);
      return { careerName: fallbackCareer, drafted: false };
    }
    const qualDM = -2 * state.previousCareers.length;
    const careerLabel =
      qualDM === 0
        ? game.i18n.localize('TWODSIX.CharGen.Steps.ChooseCareer')
        : game.i18n.localize('TWODSIX.CharGen.Steps.ChooseCareer') +
          game.i18n.format('TWODSIX.CharGen.Steps.ChooseCareerQualDmSuffix', { dm: addSign(qualDM) });
    const careerName = await app._choose(careerLabel, optionsFromCareerNames(available));
    const chosenCareerName = available.includes(careerName) ? careerName : fallbackCareer;
    const career = this.careers[chosenCareerName];
    if (!career) {
      app._log('Qualification', `Selected career data missing; defaulting to ${fallbackCareer}.`);
      return { careerName: fallbackCareer, drafted: false };
    }
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[career.qual?.char ?? 0] ?? 0);
    const total = roll + mod + qualDM;
    const success = career.qual ? total >= career.qual.target : true;
    const qualChar = career.qual?.char?.toUpperCase() ?? 'N/A';
    app._log(
      `Qualification: ${chosenCareerName}`,
      `${roll}${addSign(mod)}(${qualChar})${qualDM ? addSign(qualDM) + '(DM)' : ''}=${total} vs ${career.qual?.target ?? 'N/A'}+ -> ${success ? 'Qualified' : 'Failed'}`
    );
    state.log.push(success ? `Qualified for ${chosenCareerName}.` : `Failed qualification for ${chosenCareerName}.`);
    if (success) {
      return { careerName: chosenCareerName, drafted: false };
    }
    const failOpts = [];
    if (!state.hasBeenDrafted) {
      failOpts.push({ value: 'draft', label: game.i18n.localize('TWODSIX.CharGen.Options.SubmitToDraft') });
    }
    failOpts.push({ value: 'drifter', label: game.i18n.localize('TWODSIX.CharGen.Options.EnterDrifter') });
    const failChoice = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.QualificationFailed'), failOpts, {
      preserveOptionOrder: true,
    });
    if (failChoice === 'draft') {
      const dr = await app._roll('1d6');
      const drafted = this.draftTable[dr] && this.careers[this.draftTable[dr]] ? this.draftTable[dr] : fallbackCareer;
      state.hasBeenDrafted = true;
      state.log.push(`Drafted into ${drafted} (1D6=${dr}).`);
      app._log('Draft', `1D6=${dr} -> ${drafted}`);
      return { careerName: drafted, drafted: true };
    }
    state.log.push(`Entered ${fallbackCareer}.`);
    return { careerName: fallbackCareer, drafted: false };
  }

  async stepBasicTraining(app, careerName, isFirstCareer) {
    const state = app.charState;
    const career = this.careers[careerName];
    if (isFirstCareer) {
      for (const sk of career.service.sort()) {
        await this._addSkillAtLevel(app, sk, 0);
      }
      state.log.push('Basic training: all service skills at 0.');
      app._log('Basic training', 'All service skills at 0');
    } else {
      const sk = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.Steps.BasicTraining'),
        optionsFromStrings(career.service),
        { preserveOptionOrder: true },
      );
      await this._addSkillAtLevel(app, sk, 0);
      state.log.push(`Basic training: ${sk}-0`);
    }
  }

  async stepSurvival(app, careerName) {
    const state = app.charState;
    const career = this.careers[careerName];
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[career.surv.char] ?? 0);
    const total = roll + mod;
    const nat2 = roll === 2;
    const survived = !nat2 && total >= career.surv.target;
    app._log(
      'Survival',
      `${roll}${addSign(mod)}(${career.surv.char.toUpperCase()})=${total} vs ${career.surv.target}+${nat2 ? ' (auto-fail)' : ''} -> ${survived ? 'Survived' : 'Mishap'}`
    );
    state.log.push(survived ? `Survived term in ${careerName}.` : `Mishap in ${careerName}.`);
    const h = this.findTermEntry(state, careerName, state.totalTerms);
    if (!survived && h) {
      h.events.push(`Mishap in ${careerName}.`);
    }
    if (survived) {
      return { survived: true, benefitsLost: false };
    }
    const mr = await app._roll('1d6');
    app._log(`Mishap (${mr})`, this.mishapDesc[mr]);
    state.log.push(`Mishap ${mr}: ${this.mishapDesc[mr]}`);
    if (h) {
      h.events.push(this.mishapDesc[mr]);
    }
    const benefitsLost = mr >= 4;
    if (mr === 5) {
      state.age += 4;
      state.log.push('Imprisoned +4 years.');
      if (h) {
        h.events.push('Imprisoned +4 years.');
      }
    }
    if (mr === 1) {
      const r1 = await app._roll('1d6');
      const r2 = await app._roll('1d6');
      await this._applyInjury(app, Math.min(r1, r2));
    } else if (mr === 6) {
      await this._applyInjury(app, await app._roll('1d6'));
    } else if (mr === 3) {
      state.medicalDebt += 10000;
      state.log.push('Legal debt: +Cr10,000.');
      app._log('Legal debt', '+Cr10,000');
    }
    return { survived: false, benefitsLost };
  }

  /**
   * Shared 2D6 + characteristic DM roll for commission and advancement (CE).
   * @returns {Promise<{ succeeded: boolean, extraRoll: number }>}
   */
  async _ceAttemptStatRoll(app, careerName, {
    choosePrompt,
    logLabel,
    statChar,
    target,
    buildAppLogOutcome,
    stateLogLine,
    pushTermHistory,
    onSuccess,
  }) {
    const state = app.charState;
    const attempt = await app._choose(
      choosePrompt,
      [
        {
          value: 'yes',
          label: game.i18n.localize(
            logLabel === 'Commission'
              ? 'TWODSIX.CharGen.Options.YesAttemptCommission'
              : 'TWODSIX.CharGen.Options.YesAttemptAdvancement',
          ),
        },
        {
          value: 'no',
          label: game.i18n.localize(
            logLabel === 'Commission'
              ? 'TWODSIX.CharGen.Options.NoSkipCommission'
              : 'TWODSIX.CharGen.Options.NoSkipAdvancement',
          ),
        },
      ],
      { preserveOptionOrder: true },
    );
    if (attempt !== 'yes') {
      return { succeeded: false, extraRoll: 0 };
    }
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[statChar] ?? 0);
    const total = roll + mod;
    const success = total >= target;
    app._log(logLabel, `${roll}${addSign(mod)}=${total} vs ${target}+ -> ${buildAppLogOutcome(success)}`);
    state.log.push(stateLogLine(success));
    const h = this.findTermEntry(state, careerName, state.totalTerms);
    pushTermHistory(success, h);
    if (!success) {
      return { succeeded: false, extraRoll: 0 };
    }
    await onSuccess();
    return { succeeded: true, extraRoll: 1 };
  }

  async stepCommission(app, careerName) {
    const state = app.charState;
    const career = this.careers[careerName];
    if (!career.comm || state.currentRank !== 0) {
      return { succeeded: false, extraRoll: 0 };
    }
    return this._ceAttemptStatRoll(app, careerName, {
      choosePrompt: game.i18n.format('TWODSIX.CharGen.Steps.CommissionWithTarget', {
        char: career.comm.char.toUpperCase(),
        target: career.comm.target,
      }),
      logLabel: 'Commission',
      statChar: career.comm.char,
      target: career.comm.target,
      buildAppLogOutcome: success => (success ? 'Commissioned (Rank 1)' : 'Failed'),
      stateLogLine: success =>
        success ? `Commissioned. Now ${this.careers[careerName].ranks[1]?.title ?? 'Rank 1'}.` : 'Commission failed.',
      pushTermHistory: (success, h) => {
        if (success && h) {
          h.events.push(`Promoted to ${this.careers[careerName].ranks[1]?.title || careerName} rank 1`);
        } else if (!success && h) {
          h.events.push('Attempt at commission failed.');
        }
      },
      onSuccess: async () => {
        state.currentRank = 1;
        await this._applyRankSkill(app, careerName, 1);
      },
    });
  }

  async stepAdvancement(app, careerName) {
    const state = app.charState;
    const career = this.careers[careerName];
    if (!career.adv || state.currentRank < 1) {
      return { succeeded: false, extraRoll: 0 };
    }
    const newRank = state.currentRank + 1;
    return this._ceAttemptStatRoll(app, careerName, {
      choosePrompt: game.i18n.format('TWODSIX.CharGen.Steps.AdvancementWithTargetRank', {
        char: career.adv.char.toUpperCase(),
        target: career.adv.target,
        rank: state.currentRank,
      }),
      logLabel: 'Advancement',
      statChar: career.adv.char,
      target: career.adv.target,
      buildAppLogOutcome: success => (success ? `Rank ${newRank}` : 'Failed'),
      stateLogLine: success => (success ? `Advanced to rank ${newRank}.` : 'Advancement failed.'),
      pushTermHistory: (success, h) => {
        if (success && h) {
          h.events.push(`Promoted to ${this.careers[careerName].ranks[newRank]?.title || careerName} rank ${newRank}`);
        }
      },
      onSuccess: async () => {
        state.currentRank = newRank;
        await this._applyRankSkill(app, careerName, newRank);
      },
    });
  }

  async stepSkillsAndTraining(app, careerName, numRolls) {
    const state = app.charState;
    const career = this.careers[careerName];
    const canAdv = state.chars.edu >= 8;
    for (let i = 0; i < numRolls; i++) {
      const tables = [
        { value: 'personal', label: game.i18n.localize('TWODSIX.CharGen.Skills.PersonalDevelopment') },
        { value: 'service', label: game.i18n.localize('TWODSIX.CharGen.Skills.ServiceSkills') },
        { value: 'specialist', label: game.i18n.localize('TWODSIX.CharGen.Skills.SpecialistSkills') },
      ];
      if (canAdv) {
        tables.push({
          value: 'advanced',
          label: game.i18n.format('TWODSIX.CharGen.Skills.AdvancedEducationWithScore', { edu: state.chars.edu }),
        });
      }
      const tbl = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.SkillsAndTrainingRollNTotal', { current: i + 1, total: numRolls }),
        tables,
        { preserveOptionOrder: true },
      );
      const dr = await app._roll('1d6');
      const entry = career[tbl][dr - 1];
      app._log(`  Table: ${tables.find(t => t.value === tbl).label}, roll ${dr}`, entry);
      await this._applyTableEntry(app, entry);
    }
  }

  async stepAging(app) {
    const state = app.charState;
    state.age += 4;
    if (state.age >= 34) {
      const roll = await app._roll('2d6');
      const result = roll - state.totalTerms;
      app._log('Aging', `${roll}−${state.totalTerms} terms=${result} (age ${state.age})`);
      state.log.push(`Aging: 2D6(${roll})−${state.totalTerms}=${result}. Age ${state.age}.`);
      await this._applyAgingEffect(app, result);
    } else {
      state.log.push(`Age now ${state.age}.`);
    }
  }

  async stepReenlistment(app, careerName) {
    const state = app.charState;
    const career = this.careers[careerName];
    const roll = await app._roll('2d6');
    const success = roll >= career.reenlist;
    const nat12 = roll === 12;
    app._log(
      'Re-enlistment',
      `${roll} vs ${career.reenlist}+ -> ${nat12 ? '★ Must continue' : success ? 'May continue' : 'Must leave'}`
    );
    if (nat12) {
      state.log.push('Re-enlistment: natural 12, must continue.');
      return { mustContinue: true, mustRetire: false, wantsToContinue: true };
    }
    if (state.totalTerms >= 7) {
      state.retired = true;
      state.log.push('Mandatory retirement (7+ terms).');
      return { mustContinue: false, mustRetire: true, wantsToContinue: false };
    }
    if (!success) {
      state.log.push(`Re-enlistment failed; leaving ${careerName}.`);
      return { mustContinue: false, mustRetire: false, wantsToContinue: false };
    }
    const stay = await promptContinueInCareer(app, careerName);
    state.log.push(stay === 'yes' ? `Continuing in ${careerName}.` : `Leaving ${careerName}.`);
    return { mustContinue: false, mustRetire: false, wantsToContinue: stay === 'yes' };
  }

  async stepMusterOut(app, careerRecord) {
    const state = app.charState;
    const career = this.careers[careerRecord.name];
    const billableTerms = careerRecord.mishap ? careerRecord.terms - 1 : careerRecord.terms;
    const rankBonus = careerRecord.rank >= 4 ? careerRecord.rank - 3 : 0;
    const totalRolls = billableTerms + rankBonus;
    if (totalRolls <= 0) {
      state.log.push('No muster-out rolls.');
      return;
    }
    const matDM = careerRecord.rank >= 5 ? 1 : 0;
    // CE SRD: characters with Gambling skill or who have retired get +1 on cash rolls
    const cashBonusDM = (state.retired || state.skills.has('Gambling')) ? 1 : 0;
    state.log.push(`Muster out: ${totalRolls} roll(s). Mat. DM: ${addSign(matDM)}${cashBonusDM ? '. Cash DM: +1 (Gambling/retired)' : ''}`);
    for (let i = 0; i < totalRolls; i++) {
      const cashLeft = 3 - state.cashRollsUsed;
      const btns = [];
      if (cashLeft > 0) {
        btns.push({
          value: 'cash',
          label: game.i18n.format('TWODSIX.CharGen.Options.CashRemaining', { remaining: cashLeft }),
        });
      }
      btns.push({ value: 'material', label: game.i18n.localize('TWODSIX.CharGen.Options.MaterialBenefit') });
      const choice = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.MusterOutRollN', {
          current: i + 1,
          total: totalRolls,
          career: careerRecord.name,
          rank: careerRecord.rank,
        }),
        btns,
        { preserveOptionOrder: true },
      );
      const roll = await app._roll('1d6');
      if (choice === 'cash') {
        const adjRoll = Math.min(career.cash.length, roll + cashBonusDM);
        const amt = career.cash[adjRoll - 1];
        state.cashBenefits += amt;
        state.cashRollsUsed++;
        state.log.push(`Cash (1D6=${roll}${cashBonusDM ? '+1' : ''}=${adjRoll}): Cr${amt.toLocaleString()}`);
        app._log(`Cash (${adjRoll})`, `Cr${amt.toLocaleString()}`);
      } else {
        const adjRoll = Math.min(7, roll + matDM);
        const benefit = career.material[adjRoll - 1];
        if (!benefit) {
          state.log.push(`Material (${adjRoll}): no benefit.`);
          continue;
        }
        app._log(`Material (${roll}${matDM ? '+' + matDM : ''}=${adjRoll})`, benefit);
        if (benefit === '1D6 Ship Shares') {
          const count = await app._roll('1d6');
          state.materialBenefits.push(`${count} Ship Share(s)`);
          state.log.push(`Material: ${count} Ship Share(s)`);
        } else if (benefit === "Explorers' Society") {
          if (!state.materialBenefits.includes("Explorers' Society")) {
            state.materialBenefits.push("Explorers' Society");
          }
          state.log.push("Material: Explorers' Society");
        } else {
          await this.applySharedMaterialBenefit(app, benefit, 'verbose');
        }
      }
    }
    const pension = CharGenConstants.getPensionForTerms(billableTerms);
    if (pension > 0) {
      state.retired = true;
      if (state.pension === 0) {
        state.pension = pension;
        state.log.push(`Pension: Cr${state.pension.toLocaleString()}/year`);
        app._log('Pension', `Cr${state.pension.toLocaleString()}/year`);
      }
    }
  }

  // ─── CE CRISIS CHECK ─────────────────────────────────────────────────────────

  async _handleCrisis(app, zeroChars) {
    const state = app.charState;
    const cost = (await app._roll('1d6')) * CharGenConstants.CRISIS_COST_MULTIPLIER;
    const choice = await app._choose(
      game.i18n.format('TWODSIX.CharGen.Steps.CrisisPayEmergency', { amount: cost.toLocaleString() }),
      [
        { value: 'plata', label: game.i18n.format('TWODSIX.CharGen.Options.PaySurvive', { amount: cost.toLocaleString() }) },
        { value: 'plomo', label: game.i18n.localize('TWODSIX.CharGen.Options.RefuseDie') },
      ],
      { preserveOptionOrder: true },
    );
    if (choice === 'plomo') {
      app._log('Outcome', 'Character died — generation ended.');
      state.died = true;
      state.log.push('DIED during character generation.');
      const lastTerm = state.termHistory.at(-1);
      if (lastTerm) {
        lastTerm.events.push('Died during this term.');
      } else {
        state.termHistory.push({ term: 1, career: 'None', events: ['Died before starting a career.'] });
      }
      throw CHARGEN_DIED;
    }
    zeroChars.forEach(c => {
      if ((state.chars[c] ?? 0) <= 0) {
        state.chars[c] = 1;
      }
    });
    state.medicalDebt += cost;
    state.qualFails = true;
    state.log.push(`Survived crisis. Medical debt +Cr${cost.toLocaleString()}.`);
    app._log('Crisis survived', `Medical debt +Cr${cost.toLocaleString()}`);
  }

  async _applyInjury(app, roll) {
    const state = app.charState;
    app._log(`Injury (${roll})`, this.injuryDesc[roll]);
    state.log.push(`Injury (${roll}): ${this.injuryDesc[roll]}`);
    if (roll === 6) {
      return;
    }
    if (roll === 5) {
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Injuries.Injured'), localizedPhysicalOpts(), {
        preserveOptionOrder: true,
      });
      state.chars[c]--;
    } else if (roll === 4) {
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Injuries.Scarred'), localizedPhysicalOpts(), {
        preserveOptionOrder: true,
      });
      state.chars[c] -= 2;
    } else if (roll === 3) {
      const c = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.Injuries.MissingPart'),
        [
          { value: 'str', label: game.i18n.localize('TWODSIX.CharGen.Options.StrengthMinus2') },
          { value: 'dex', label: game.i18n.localize('TWODSIX.CharGen.Options.DexterityMinus2') },
        ],
        { preserveOptionOrder: true },
      );
      state.chars[c] -= 2;
    } else if (roll === 2) {
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Injuries.SeverelyInjured'), localizedPhysicalOpts(), {
        preserveOptionOrder: true,
      });
      state.chars[c] -= await app._roll('1d6');
    } else {
      const c1 = await app._choose(game.i18n.localize('TWODSIX.CharGen.Injuries.NearlyKilled'), localizedPhysicalOpts(), {
        preserveOptionOrder: true,
      });
      state.chars[c1] -= await app._roll('1d6');
      const others = ['str', 'dex', 'end'].filter(c => c !== c1);
      const mode = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.Injuries.DistributeRemaining'),
        [
          {
            value: 'split',
            label: game.i18n.format('TWODSIX.CharGen.Injuries.SplitPenalty', {
              stat1: others[0].toUpperCase(),
              stat2: others[1].toUpperCase(),
            }),
          },
          { value: 'one', label: game.i18n.localize('TWODSIX.CharGen.Injuries.OneTakes') },
        ],
        { preserveOptionOrder: true },
      );
      if (mode === 'split') {
        state.chars[others[0]] -= 2;
        state.chars[others[1]] -= 2;
      } else {
        const c2 = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.Injuries.WhichTakes'),
          others.map(c => ({ value: c, label: `${c.toUpperCase()} −4` })),
          { preserveOptionOrder: true },
        );
        state.chars[c2] -= 4;
      }
    }
    await this.checkCrisis(app);
  }

  async _applyAgingEffect(app, result) {
    const state = app.charState;
    const idx = Math.min(7, Math.max(0, result + 6));
    const entry = this.agingTable[idx];
    if (!entry) {
      app._log('Aging effect', 'No effect.');
      return;
    }
    state.log.push(`Aging roll ${result}: reducing characteristics.`);
    await this.applyAgingEntryReductions(app, entry);
  }

  async _applyRankSkill(app, careerName, rank) {
    const state = app.charState;
    const r = this.careers[careerName].ranks[rank];
    if (r?.skill) {
      await this._addSkillAtLevel(app, r.skill, r.level);
      state.log.push(`Rank ${rank} skill: ${r.skill}-${r.level}`);
      app._log(`Rank ${rank} skill`, `${r.skill}-${r.level}`);
    }
  }
}
