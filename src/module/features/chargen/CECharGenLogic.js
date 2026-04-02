// CECharGenLogic.js — Cepheus Engine character generation logic
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign } from '../../utils/utils.js';
import { BaseCharGenLogic } from './BaseCharGenLogic.js';
import { CHARACTERISTIC_KEYS, CharGenConstants } from './CharGenState.js';
import { chooseGender } from './CharGenUtils.js';

// ─── MODULE-LEVEL DATA (loaded from CE pack) ──────────────────────────────────

let CAREERS = {};
let CAREER_NAMES = [];
let AGING_TABLE = [];
let MISHAP_DESC = {};
let INJURY_DESC = {};
let DRAFT_TABLE = {};
let CASCADE_SKILLS = {};
let HOMEWORLD_DESCRIPTORS = {};
let EDUCATION_SKILLS = [];
let SKILL_NAME_MAP = {};
let CHAR_KEY_MAP = {};
let PHYS_OPTS = [];
let MENT_OPTS = [];

/**
 * CE character generation logic.
 * Extends BaseCharGenLogic with Cepheus Engine-specific rules.
 */
export class CECharGenLogic extends BaseCharGenLogic {
  constructor() {
    super();
  }

  resetData() {
    super.resetData();
    CAREERS = {};
    CAREER_NAMES = [];
    AGING_TABLE = [];
    MISHAP_DESC = {};
    INJURY_DESC = {};
    DRAFT_TABLE = {};
    CASCADE_SKILLS = {};
    HOMEWORLD_DESCRIPTORS = {};
    EDUCATION_SKILLS = [];
    SKILL_NAME_MAP = {};
    CHAR_KEY_MAP = {};
    PHYS_OPTS = [];
    MENT_OPTS = [];
  }

  async loadData(ruleset) {
    this.resetData();

    const packName = `twodsix.${ruleset.toLowerCase()}-careers`;
    const fallbackPackName = 'twodsix.ce-srd-careers';
    const requestedPack = game.packs.get(packName);
    if (!requestedPack && ruleset !== 'CE') {
      console.warn(`twodsix | CharGen: pack "${packName}" not found — falling back to CE careers.`);
    }
    let pack = requestedPack || game.packs.get(fallbackPackName);
    if (!pack) {
      throw new Error(`Failed to load career data: ${packName} or ${fallbackPackName} not found.`);
    }
    const careerDocs = await pack.getDocuments();
    CAREERS = careerDocs.reduce((acc, doc) => {
      acc[doc.name] = doc.system;
      return acc;
    }, {});
    CAREER_NAMES = Object.keys(CAREERS).sort();

    // Load chargen ruleset
    const chargenPackName = `twodsix.${ruleset.toLowerCase()}-chargen-ruleset`;
    const chargenFallbackPackName = 'twodsix.ce-srd-chargen-ruleset';
    const requestedChargenPack = game.packs.get(chargenPackName);
    if (!requestedChargenPack && ruleset !== 'CE') {
      console.warn(`twodsix | CharGen: pack "${chargenPackName}" not found — falling back to CE chargen ruleset.`);
    }
    const chargenPack = requestedChargenPack || game.packs.get(chargenFallbackPackName);
    if (!chargenPack) {
      throw new Error(`Failed to load chargen ruleset: ${chargenPackName} not found.`);
    }
    const chargenDocs = await chargenPack.getDocuments();
    const chargenItem = chargenDocs.find(d => d.system.ruleset === ruleset) ?? chargenDocs[0];
    if (!chargenItem) {
      throw new Error(`Failed to find chargen ruleset in ${chargenPackName}.`);
    }
    const rulesetData = chargenItem.system;

    AGING_TABLE = rulesetData.agingTable.map(row =>
      row.noEffect ? null : { phys: [row.physStr, row.physDex, row.physEnd], mental: row.mental }
    );
    MISHAP_DESC = rulesetData.mishapDesc;
    INJURY_DESC = rulesetData.injuryDesc;
    DRAFT_TABLE = rulesetData.draftTable;
    CASCADE_SKILLS = Object.fromEntries(
      rulesetData.cascadeSkills.map(({ skill, specializations }) => [skill, specializations])
    );
    HOMEWORLD_DESCRIPTORS = Object.fromEntries(
      rulesetData.homeworldDescriptors.map(({ descriptor, skill }) => [descriptor, skill])
    );
    EDUCATION_SKILLS = rulesetData.educationSkills;
    SKILL_NAME_MAP = Object.fromEntries(
      rulesetData.skillNameMap.map(({ from, to }) => [from, to])
    );
    CHAR_KEY_MAP = Object.fromEntries(
      rulesetData.charKeyMap.map(({ benefit, key }) => [benefit, key])
    );
    PHYS_OPTS = [
      { value: 'str', label: 'Strength' },
      { value: 'dex', label: 'Dexterity' },
      { value: 'end', label: 'Endurance' },
    ];
    MENT_OPTS = [
      { value: 'int', label: 'Intelligence' },
      { value: 'edu', label: 'Education' },
      { value: 'soc', label: 'Social Standing' },
    ];
  }

  async run(app) {
    const state = app.charState;

    await app._chooseCharacteristics(app);
    state.gender = await chooseGender(app);
    await app._rollName();

    await this.stepHomeworld(app);
    if (state.died) {
      return;
    }

    let isFirstCareer = true;
    let forceRetire = false;
    while (!forceRetire) {
      if (state.died) {
        return;
      }
      const { careerName, drafted } = await this.stepQualification(app);
      if (state.died) {
        return;
      }
      const career = CAREERS[careerName];
      state.currentRank = 0;
      state.currentTermInCareer = 0;
      await this._applyRankSkill(app, careerName, 0);
      if (state.died) {
        return;
      }
      await this.stepBasicTraining(app, careerName, isFirstCareer);
      if (state.died) {
        return;
      }
      isFirstCareer = false;
      let termBenefitsLost = false;
      let careerMishap = false;
      while (true) {
        state.totalTerms++;
        state.currentTermInCareer++;
        const ageStart = state.age;
        const ageEnd = state.age + 3;
        app._log(`${careerName} — Term ${state.currentTermInCareer}`, `Age ${ageStart}–${ageEnd}`);
        state.log.push(`── ${careerName}, Term ${state.currentTermInCareer} (age ${ageStart}–${ageEnd}) ──`);
        const verb = state.currentTermInCareer > 1 ? 'Stayed a' : 'Became a';
        // Term history entry created but not used in this flow
        this.startTermHistoryEntry(state, {
          careerName,
          termInCareer: state.currentTermInCareer,
          totalTerm: state.totalTerms,
          ageStart,
          startedVerb: verb,
        });
        const { survived, benefitsLost } = await this.stepSurvival(app, careerName);
        if (state.died) {
          return;
        }
        if (!survived) {
          termBenefitsLost = benefitsLost;
          careerMishap = true;
          state.age += 2;
          break;
        }
        let extraRolls = 0;
        if (!drafted || state.currentTermInCareer > 1) {
          const comm = await this.stepCommission(app, careerName);
          if (state.died) {
            return;
          }
          extraRolls += comm.extraRoll;
        }
        const adv = await this.stepAdvancement(app, careerName);
        if (state.died) {
          return;
        }
        extraRolls += adv.extraRoll;
        await this.stepSkillsAndTraining(app, careerName, (career.hasCommAdv ? 1 : 2) + extraRolls);
        if (state.died) {
          return;
        }
        await this.stepAging(app);
        if (state.died) {
          return;
        }
        const { mustContinue, mustRetire, wantsToContinue } = await this.stepReenlistment(app, careerName);
        if (state.died) {
          return;
        }
        if (mustRetire) {
          forceRetire = true;
          break;
        }
        if (!mustContinue && !wantsToContinue) {
          break;
        }
      }
      if (state.died) {
        return;
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
      if (state.died) {
        return;
      }
      if (forceRetire) {
        app._log('Retirement', '7+ total terms — mandatory retirement.');
        break;
      }
      const another = await this.promptAnotherCareer(app, state.totalTerms);
      if (state.died) {
        return;
      }
      if (another !== 'yes') {
        const h = state.termHistory.find(th => th.career === careerName && th.term === state.totalTerms);
        if (h) {
          h.events.push(`Voluntarily left ${careerName}`);
        }
        break;
      }
    }
  }

  // ─── CE-SPECIFIC STEPS ────────────────────────────────────────────────────────

  async stepHomeworld(app) {
    const state = app.charState;
    const doHW = await app._choose(
      'Homeworld background skills?',
      [
        { value: 'yes', label: 'Yes — pick homeworld descriptors' },
        { value: 'no', label: 'No — skip' },
      ]
    );
    if (doHW !== 'yes') {
      return;
    }
    const total = Math.max(1, 3 + calcModFor(state.chars.edu ?? 0));
    state.log.push(`Background skills: ${total}`);
    const hwKeys = Object.keys(HOMEWORLD_DESCRIPTORS);
    const hwCount = Math.min(2, total);
    for (let i = 0; i < hwCount; i++) {
      const desc = await app._choose(
        `Homeworld descriptor ${i + 1}/${hwCount}`,
        hwKeys.sort().map(k => ({ value: k, label: `${k} -> ${HOMEWORLD_DESCRIPTORS[k]}` }))
      );
      await this._addSkillAtLevel(app, HOMEWORLD_DESCRIPTORS[desc], 0);
      state.homeworldDescriptors.push(desc);
      state.log.push(`Background (${desc}): ${HOMEWORLD_DESCRIPTORS[desc]}-0`);
    }
    for (let i = 0; i < total - hwCount; i++) {
      const sk = await app._choose(
        `Education background skill ${i + 1}/${total - hwCount}`,
        EDUCATION_SKILLS.sort().map(s => ({ value: s, label: s }))
      );
      await this._addSkillAtLevel(app, sk, 0);
      state.log.push(`Background (education): ${sk}-0`);
    }
  }

  async stepQualification(app) {
    const state = app.charState;
    if (state.qualFails) {
      app._log('Qualification', 'Prior crisis — auto-fail. Entering Drifter.');
      return { careerName: 'Drifter', drafted: false };
    }
    const available = CAREER_NAMES.filter(n => n === 'Drifter' || !state.previousCareers.includes(n)).sort((a, b) =>
      a.localeCompare(b)
    );
    const qualDM = -2 * state.previousCareers.length;
    const careerName = await app._choose(
      `Choose career${qualDM ? ` (qual DM: ${addSign(qualDM)})` : ''}`,
      available.map(n => ({ value: n, label: n }))
    );
    const career = CAREERS[careerName];
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[career.qual?.char ?? 0] ?? 0);
    const total = roll + mod + qualDM;
    const success = total >= career.qual.target;
    app._log(
      `Qualification: ${careerName}`,
      `${roll}${addSign(mod)}(${career.qual.char.toUpperCase()})${qualDM ? addSign(qualDM) + '(DM)' : ''}=${total} vs ${career.qual.target}+ -> ${success ? '✓ Qualified' : '✗ Failed'}`
    );
    state.log.push(success ? `Qualified for ${careerName}.` : `Failed qualification for ${careerName}.`);
    if (success) {
      return { careerName, drafted: false };
    }
    const failOpts = [];
    if (!state.hasBeenDrafted) {
      failOpts.push({ value: 'draft', label: 'Submit to Draft' });
    }
    failOpts.push({ value: 'drifter', label: 'Enter Drifter career' });
    const failChoice = await app._choose('Qualification failed — choose option', failOpts);
    if (failChoice === 'draft') {
      const dr = await app._roll('1d6');
      const drafted = DRAFT_TABLE[dr];
      state.hasBeenDrafted = true;
      state.log.push(`Drafted into ${drafted} (1D6=${dr}).`);
      app._log('Draft', `1D6=${dr} -> ${drafted}`);
      return { careerName: drafted, drafted: true };
    }
    state.log.push('Entered Drifter.');
    return { careerName: 'Drifter', drafted: false };
  }

  async stepBasicTraining(app, careerName, isFirstCareer) {
    const state = app.charState;
    const career = CAREERS[careerName];
    if (isFirstCareer) {
      for (const sk of career.service.sort()) {
        await this._addSkillAtLevel(app, sk, 0);
      }
      state.log.push('Basic training: all service skills at 0.');
      app._log('Basic training', 'All service skills at 0');
    } else {
      const sk = await app._choose(
        'Basic training: pick one service skill (level 0)',
        career.service.sort().map(s => ({ value: s, label: s }))
      );
      await this._addSkillAtLevel(app, sk, 0);
      state.log.push(`Basic training: ${sk}-0`);
    }
  }

  async stepSurvival(app, careerName) {
    const state = app.charState;
    const career = CAREERS[careerName];
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[career.surv.char] ?? 0);
    const total = roll + mod;
    const nat2 = roll === 2;
    const survived = !nat2 && total >= career.surv.target;
    app._log(
      'Survival',
      `${roll}${addSign(mod)}(${career.surv.char.toUpperCase()})=${total} vs ${career.surv.target}+${nat2 ? ' (auto-fail)' : ''} -> ${survived ? '✓ Survived' : '✗ Mishap'}`
    );
    state.log.push(survived ? `Survived term in ${careerName}.` : `Mishap in ${careerName}.`);
    const h = state.termHistory.find(th => th.career === careerName && th.term === state.totalTerms);
    if (!survived && h) {
      h.events.push(`Mishap in ${careerName}.`);
    }
    if (survived) {
      return { survived: true, benefitsLost: false };
    }
    const mr = await app._roll('1d6');
    app._log(`Mishap (${mr})`, MISHAP_DESC[mr]);
    state.log.push(`Mishap ${mr}: ${MISHAP_DESC[mr]}`);
    if (h) {
      h.events.push(MISHAP_DESC[mr]);
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

  async stepCommission(app, careerName) {
    const state = app.charState;
    const career = CAREERS[careerName];
    if (!career.comm || state.currentRank !== 0) {
      return { succeeded: false, extraRoll: 0 };
    }
    const attempt = await app._choose(
      `Commission? (${career.comm.char.toUpperCase()} ${career.comm.target}+)`,
      [
        { value: 'yes', label: 'Yes — attempt commission' },
        { value: 'no', label: 'No — skip' },
      ]
    );
    if (attempt !== 'yes') {
      return { succeeded: false, extraRoll: 0 };
    }
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[career.comm.char] ?? 0);
    const total = roll + mod;
    const success = total >= career.comm.target;
    app._log(
      'Commission',
      `${roll}${addSign(mod)}=${total} vs ${career.comm.target}+ -> ${success ? '✓ Commissioned (Rank 1)' : '✗ Failed'}`
    );
    state.log.push(success ? `Commissioned. Now ${CAREERS[careerName].ranks[1]?.title ?? 'Rank 1'}.` : 'Commission failed.');
    const h = state.termHistory.find(th => th.career === careerName && th.term === state.totalTerms);
    if (success && h) {
      h.events.push(`Promoted to ${CAREERS[careerName].ranks[1]?.title || careerName} rank 1`);
    } else if (!success && h) {
      h.events.push('Attempt at commission failed.');
    }
    if (!success) {
      return { succeeded: false, extraRoll: 0 };
    }
    state.currentRank = 1;
    await this._applyRankSkill(app, careerName, 1);
    return { succeeded: true, extraRoll: 1 };
  }

  async stepAdvancement(app, careerName) {
    const state = app.charState;
    const career = CAREERS[careerName];
    if (!career.adv || state.currentRank < 1) {
      return { succeeded: false, extraRoll: 0 };
    }
    const attempt = await app._choose(
      `Advancement? (${career.adv.char.toUpperCase()} ${career.adv.target}+, rank ${state.currentRank})`,
      [
        { value: 'yes', label: 'Yes — attempt advancement' },
        { value: 'no', label: 'No — skip' },
      ]
    );
    if (attempt !== 'yes') {
      return { succeeded: false, extraRoll: 0 };
    }
    const roll = await app._roll('2d6');
    const mod = calcModFor(state.chars[career.adv.char] ?? 0);
    const total = roll + mod;
    const success = total >= career.adv.target;
    const newRank = state.currentRank + 1;
    app._log(
      'Advancement',
      `${roll}${addSign(mod)}=${total} vs ${career.adv.target}+ -> ${success ? `✓ Rank ${newRank}` : '✗ Failed'}`
    );
    state.log.push(success ? `Advanced to rank ${newRank}.` : 'Advancement failed.');
    const h = state.termHistory.find(th => th.career === careerName && th.term === state.totalTerms);
    if (success && h) {
      h.events.push(`Promoted to ${CAREERS[careerName].ranks[newRank]?.title || careerName} rank ${newRank}`);
    }
    if (!success) {
      return { succeeded: false, extraRoll: 0 };
    }
    state.currentRank = newRank;
    await this._applyRankSkill(app, careerName, newRank);
    return { succeeded: true, extraRoll: 1 };
  }

  async stepSkillsAndTraining(app, careerName, numRolls) {
    const state = app.charState;
    const career = CAREERS[careerName];
    const canAdv = state.chars.edu >= 8;
    for (let i = 0; i < numRolls; i++) {
      const tables = [
        { value: 'personal', label: 'Personal Development' },
        { value: 'service', label: 'Service Skills' },
        { value: 'specialist', label: 'Specialist Skills' },
      ];
      if (canAdv) {
        tables.push({ value: 'advanced', label: `Advanced Education (Edu ${state.chars.edu})` });
      }
      tables.sort((a, b) => a.label.localeCompare(b.label));
      const tbl = await app._choose(`Skills & Training roll ${i + 1}/${numRolls}`, tables);
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
    const career = CAREERS[careerName];
    const roll = await app._roll('2d6');
    const success = roll >= career.reenlist;
    const nat12 = roll === 12;
    app._log(
      'Re-enlistment',
      `${roll} vs ${career.reenlist}+ -> ${nat12 ? '★ Must continue' : success ? '✓ May continue' : '✗ Must leave'}`
    );
    if (nat12) {
      state.log.push('Re-enlistment: natural 12, must continue.');
      return { mustContinue: true, mustRetire: false, wantsToContinue: true };
    }
    if (state.totalTerms >= 7) {
      state.log.push('Mandatory retirement (7+ terms).');
      return { mustContinue: false, mustRetire: true, wantsToContinue: false };
    }
    if (!success) {
      state.log.push(`Re-enlistment failed; leaving ${careerName}.`);
      return { mustContinue: false, mustRetire: false, wantsToContinue: false };
    }
    const stay = await app._choose(
      `Continue in ${careerName} for another term?`,
      [
        { value: 'yes', label: 'Yes — serve another term' },
        { value: 'no', label: 'No — leave' },
      ]
    );
    state.log.push(stay === 'yes' ? `Continuing in ${careerName}.` : `Leaving ${careerName}.`);
    return { mustContinue: false, mustRetire: false, wantsToContinue: stay === 'yes' };
  }

  async stepMusterOut(app, careerRecord) {
    const state = app.charState;
    const career = CAREERS[careerRecord.name];
    const billableTerms = careerRecord.mishap ? careerRecord.terms - 1 : careerRecord.terms;
    const rankBonus = careerRecord.rank >= 4 ? careerRecord.rank - 3 : 0;
    const totalRolls = billableTerms + rankBonus;
    if (totalRolls <= 0) {
      state.log.push('No muster-out rolls.');
      return;
    }
    const matDM = careerRecord.rank >= 5 ? 1 : 0;
    state.log.push(`Muster out: ${totalRolls} roll(s). Mat. DM: ${addSign(matDM)}`);
    for (let i = 0; i < totalRolls; i++) {
      const cashLeft = 3 - state.cashRollsUsed;
      const btns = [];
      if (cashLeft > 0) {
        btns.push({ value: 'cash', label: `Cash (${cashLeft} remaining)` });
      }
      btns.push({ value: 'material', label: 'Material benefit' });
      btns.sort((a, b) => a.label.localeCompare(b.label));
      const choice = await app._choose(
        `Muster out ${i + 1}/${totalRolls} (${careerRecord.name}, rank ${careerRecord.rank})`,
        btns
      );
      const roll = await app._roll('1d6');
      if (choice === 'cash') {
        const amt = career.cash[roll - 1];
        state.cashBenefits += amt;
        state.cashRollsUsed++;
        state.log.push(`Cash (1D6=${roll}): Cr${amt.toLocaleString()}`);
        app._log(`Cash (${roll})`, `Cr${amt.toLocaleString()}`);
      } else {
        const adjRoll = Math.min(7, roll + matDM);
        const benefit = career.material[adjRoll - 1];
        if (!benefit) {
          state.log.push(`Material (${adjRoll}): no benefit.`);
          continue;
        }
        app._log(`Material (${roll}${matDM ? '+' + matDM : ''}=${adjRoll})`, benefit);
        if (CHAR_KEY_MAP[benefit]) {
          state.chars[CHAR_KEY_MAP[benefit]]++;
          state.log.push(`Material: ${benefit}`);
        } else if (benefit === '1D6 Ship Shares') {
          const count = await app._roll('1d6');
          state.materialBenefits.push(`${count} Ship Share(s)`);
          state.log.push(`Material: ${count} Ship Share(s)`);
        } else if (benefit === "Explorers' Society") {
          if (!state.materialBenefits.includes("Explorers' Society")) {
            state.materialBenefits.push("Explorers' Society");
          }
          state.log.push("Material: Explorers' Society");
        } else {
          state.materialBenefits.push(benefit);
          state.log.push(`Material: ${benefit}`);
        }
      }
    }
    const pension = CharGenConstants.getPensionForTerms(billableTerms);
    if (pension > 0 && state.pension === 0) {
      state.pension = pension;
      state.log.push(`Pension: Cr${state.pension.toLocaleString()}/year`);
      app._log('Pension', `Cr${state.pension.toLocaleString()}/year`);
    }
  }

  // ─── CE CRISIS CHECK ─────────────────────────────────────────────────────────

  async checkCrisis(app) {
    const state = app.charState;
    const zero = CHARACTERISTIC_KEYS.filter(c => (state.chars[c] ?? 0) <= 0);
    if (!zero.length) {
      return;
    }
    const cost = (await app._roll('1d6')) * CharGenConstants.CRISIS_COST_MULTIPLIER;
    const choice = await app._choose(
      `Crisis! Pay Cr${cost.toLocaleString()} for emergency care?`,
      [
        { value: 'pay', label: `Pay Cr${cost.toLocaleString()} — survive` },
        { value: 'die', label: 'Refuse — die' },
      ]
    );
    if (choice === 'die') {
      app._log('Outcome', 'Character died — generation ended.');
      state.died = true;
      state.log.push('DIED during character generation.');
      const lastTerm = state.termHistory.at(-1);
      if (lastTerm) {
        lastTerm.events.push('Died during this term.');
      } else {
        state.termHistory.push({ term: 1, career: 'None', events: ['Died before starting a career.'] });
      }
      return;
    }
    zero.forEach(c => {
      if ((state.chars[c] ?? 0) <= 0) {
        state.chars[c] = 1;
      }
    });
    state.medicalDebt += cost;
    state.qualFails = true;
    state.log.push(`Survived crisis. Medical debt +Cr${cost.toLocaleString()}.`);
    app._log('Crisis survived', `Medical debt +Cr${cost.toLocaleString()}`);
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  async _pickSpecialization(app, name) {
    return app._choose(
      `Specialize: ${name}`,
      CASCADE_SKILLS[name].sort().map(s => ({ value: s, label: s }))
    );
  }

  async _resolveSkillName(app, raw) {
    if (SKILL_NAME_MAP[raw]) {
      return SKILL_NAME_MAP[raw];
    }
    if (raw in CASCADE_SKILLS) {
      return this._pickSpecialization(app, raw);
    }
    return raw;
  }

  async _addSkillAtLevel(app, rawName, level) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return;
    }
    await this.setSkillAtLeast(app, name, level);
  }

  async _addOrImproveSkill(app, rawName) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return;
    }
    await this.improveSkill(app, name);
  }

  async _applyTableEntry(app, entry) {
    const state = app.charState;
    if (CHAR_KEY_MAP[entry]) {
      state.chars[CHAR_KEY_MAP[entry]]++;
      app._log('Characteristic', entry);
    } else {
      const before = state.skills.get(SKILL_NAME_MAP[entry] ?? entry) ?? -1;
      await this._addOrImproveSkill(app, entry);
      const displayName = SKILL_NAME_MAP[entry] ?? entry;
      app._log('Skill', `${displayName}-${state.skills.get(displayName) ?? (before + 1)}`);
    }
  }

  async _applyInjury(app, roll) {
    const state = app.charState;
    app._log(`Injury (${roll})`, INJURY_DESC[roll]);
    state.log.push(`Injury (${roll}): ${INJURY_DESC[roll]}`);
    if (roll === 6) {
      return;
    }
    if (roll === 5) {
      const c = await app._choose('Injured: reduce characteristic by 1', PHYS_OPTS);
      state.chars[c]--;
    } else if (roll === 4) {
      const c = await app._choose('Scarred: reduce characteristic by 2', PHYS_OPTS);
      state.chars[c] -= 2;
    } else if (roll === 3) {
      const c = await app._choose('Missing part: STR or DEX −2', [
        { value: 'str', label: 'Strength −2' },
        { value: 'dex', label: 'Dexterity −2' },
      ]);
      state.chars[c] -= 2;
    } else if (roll === 2) {
      const c = await app._choose('Severely injured: reduce characteristic by 1D6', PHYS_OPTS);
      state.chars[c] -= await app._roll('1d6');
    } else {
      const c1 = await app._choose('Nearly killed: reduce characteristic by 1D6', PHYS_OPTS);
      state.chars[c1] -= await app._roll('1d6');
      const others = ['str', 'dex', 'end'].filter(c => c !== c1);
      const mode = await app._choose('Nearly killed: distribute remaining penalties', [
        { value: 'split', label: `${others[0].toUpperCase()} and ${others[1].toUpperCase()} each −2` },
        { value: 'one', label: 'One takes −4' },
      ]);
      if (mode === 'split') {
        state.chars[others[0]] -= 2;
        state.chars[others[1]] -= 2;
      } else {
        const c2 = await app._choose(
          'Nearly killed: which takes −4',
          others.map(c => ({ value: c, label: c.toUpperCase() + ' −4' }))
        );
        state.chars[c2] -= 4;
      }
    }
    await this.checkCrisis(app);
  }

  async _applyAgingEffect(app, result) {
    const state = app.charState;
    const idx = Math.min(7, Math.max(0, result + 6));
    const entry = AGING_TABLE[idx];
    if (!entry) {
      app._log('Aging effect', 'No effect.');
      return;
    }
    state.log.push(`Aging roll ${result}: reducing characteristics.`);
    for (const amt of entry.phys.filter(n => n > 0)) {
      const c = await app._choose(`Aging: reduce characteristic by ${amt}`, PHYS_OPTS);
      state.chars[c] -= amt;
    }
    if (entry.mental > 0) {
      const c = await app._choose('Aging: reduce mental characteristic by 1', MENT_OPTS);
      state.chars[c]--;
    }
    await this.checkCrisis(app);
  }

  async _applyRankSkill(app, careerName, rank) {
    const state = app.charState;
    const r = CAREERS[careerName].ranks[rank];
    if (r?.skill) {
      await this._addSkillAtLevel(app, r.skill, r.level);
      state.log.push(`Rank ${rank} skill: ${r.skill}-${r.level}`);
      app._log(`Rank ${rank} skill`, `${r.skill}-${r.level}`);
    }
  }
}
