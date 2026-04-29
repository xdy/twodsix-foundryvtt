// CUCharGenLogic.js — Cepheus Universal character generation logic
// Handles three creation modes: career (term-by-term), random, and design.
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign } from '../../utils/utils.js';
import { BaseCharGenLogic } from './BaseCharGenLogic.js';
import { adjustChar, CHARGEN_DIED } from './CharGenState.js';
import {
  chooseCharacteristicSwap,
  improveSkillCappedInState,
  localizedPhysicalOpts,
  optionsFromCareerNames,
} from './CharGenUtils.js';
import { runCUCareerTerms } from './cu/cuCareerTerms.js';
import {
  cuApplyDesignBonusSkill,
  cuApplyDesignCash,
  cuStepDesignAge,
  cuStepDesignCareerSkills,
  cuStepDesignCharacteristicsString,
  cuStepDesignRank,
} from './cu/cuDesignSteps.js';
import { cuBenefitRoll, cuMusterOut } from './cu/cuMusterBenefits.js';
import {
  CU_BENEFITS_TABLE as CU_BENEFITS_TABLE_CONST,
  CU_PROMO_FAIL_EVENTS as CU_PROMO_FAIL_EVENTS_CONST,
  CU_PROMO_SUCCESS_EVENTS as CU_PROMO_SUCCESS_EVENTS_CONST,
  CU_RISK_FAIL_EVENTS as CU_RISK_FAIL_EVENTS_CONST,
  CU_RISK_SUCCESS_EVENTS as CU_RISK_SUCCESS_EVENTS_CONST,
  CU_SKILL_CATEGORY_TABLES,
  CU_SKILL_NAME_MAP
} from './CUCharGenConstants.js';
import { reportAutoHandled } from './EventReport.js';

// ─── MODULE-LEVEL DATA (loaded from CU pack) ──────────────────────────────────

/**
 * CU character generation logic.
 * Extends BaseCharGenLogic with Cepheus Universal-specific rules.
 */
export class CUCharGenLogic extends BaseCharGenLogic {
  resetData() {
    super.resetData();
    this.careers = {};
    this.careerNames = [];
    this.skillTables = {};
    this.riskFailEvents = [];
    this.riskSuccessEvents = [];
    this.promoFailEvents = [];
    this.promoSuccessEvents = [];
    this.benefitsTable = [];
  }

  _assignRulesetConstants(careers, careerNames, ruleset) {
    this.careers = careers;
    this.careerNames = careerNames;

    this.skillTables = CU_SKILL_CATEGORY_TABLES;
    this.riskFailEvents = CU_RISK_FAIL_EVENTS_CONST;
    this.riskSuccessEvents = CU_RISK_SUCCESS_EVENTS_CONST;
    this.promoFailEvents = CU_PROMO_FAIL_EVENTS_CONST;
    this.promoSuccessEvents = CU_PROMO_SUCCESS_EVENTS_CONST;
    this.benefitsTable = CU_BENEFITS_TABLE_CONST;
    this.skillNameMap = CU_SKILL_NAME_MAP;
  }

  /**
   * Run character generation.
   * @param {CharGenApp} app - The character generation app
   * @returns {Promise<void>}
   */
  async run(app) {
    const state = app.charState;

    const mode = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUCreationMethod'), [
      { value: 'career', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCareerTermByTerm') },
      { value: 'random', label: game.i18n.localize('TWODSIX.CharGen.Steps.CURandom') },
      { value: 'design', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUDesign') },
    ]);
    state.creationMode = mode;

    await this.loadData(state.ruleset);

    if (mode === 'career') {
      await this.runCareerMode(app);
    } else if (mode === 'random') {
      await this.runRandomMode(app);
    } else {
      await this.runDesignMode(app);
    }
  }

  // ─── MODE ENTRY POINTS ──────────────────────────────────────────────────────

  async runCareerMode(app) {
    await this.stepIdentity(app, {
      characteristicsStep: async (app) => {
        await app._chooseCharacteristics();
        await chooseCharacteristicSwap(app);
      },
    });

    // 3. Career loop
    const state = app.charState;
    state.cashBenefits += 1000; // CU starting cash
    let isFirstCareer = true;

    while (true) {
      // Career selection (no qualification roll in CU)
      let careerName;
      if (isFirstCareer) {
        careerName = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.Steps.CUChooseCareer'),
          optionsFromCareerNames(this.careerNames),
        );
      } else {
        careerName = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.Steps.CUChooseNextCareer'),
          optionsFromCareerNames(this.careerNames),
        );
      }

      // Run terms for this career; on death it pushes a partial record and re-throws CHARGEN_DIED
      const careerRecord = await this._runCareerTerms(app, careerName);
      state.careers.push(careerRecord);
      if (!state.previousCareers.includes(careerName)) {
        state.previousCareers.push(careerName);
      }
      isFirstCareer = false;

      // Muster out
      await this.musterOut(app, careerRecord, careerRecord.extraBenefitRolls);

      // Offer another career
      const another = await this.promptAnotherCareer(app, state.totalTerms);
      if (another !== 'yes') {
        break;
      }
    }
    // settle outstanding medical/legal debt from cash benefits
    this.stepSettleDebt(app);
  }

  async runRandomMode(app) {
    await this.stepIdentity(app, {
      characteristicsStep: async (app) => {
        await app._chooseCharacteristics();
        await chooseCharacteristicSwap(app);
      },
    });

    // 3. Pick 2 skill category tables
    const tableNames = Object.keys(this.skillTables).sort();
    const tableOptions = tableNames.map(n => ({ value: n, label: n }));

    const rollOrPick = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUSkillTableMethod'), [
      { value: 'pick', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUPickTwoTables') },
      { value: 'roll', label: game.i18n.localize('TWODSIX.CharGen.Steps.CURollTwoTables') },
    ]);

    let table1, table2;
    if (rollOrPick === 'roll') {
      const r1 = await app._roll('1d6');
      table1 = tableNames[r1 - 1] ?? tableNames[0];
      let r2 = await app._roll('1d6');
      if (tableNames[r2 - 1] === table1) {
        r2 = (r2 % tableNames.length) + 1;
      }
      table2 = tableNames[r2 - 1] ?? tableNames[1];
      app._log('Skill Tables', `${table1} & ${table2} (rolled)`);
    } else {
      table1 = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUFirstSkillTable'), tableOptions);
      table2 = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.Steps.CUSecondSkillTable'),
        tableOptions.filter(o => o.value !== table1),
      );
      app._log('Skill Tables', `${table1} & ${table2}`);
    }

    // 4. 6 skill rolls
    await cuApplyDesignCash(this, app);
    const twoTableOpts = [
      { value: table1, label: table1 },
      { value: table2, label: table2 },
    ];
    for (let i = 0; i < 6; i++) {
      const chosenTable = await app._choose(
        game.i18n.format('TWODSIX.CharGen.Steps.CUSkillRollNTotal', { current: i + 1 }),
        twoTableOpts,
      );
      await this._rollSkillFromTable(app, chosenTable);
    }

    await this._applyTableBonusSkill(app, table1, table2);
  }

  async runDesignMode(app) {
    await this.stepIdentity(app, {
      characteristicsStep: async (app) => cuStepDesignCharacteristicsString(this, app),
    });

    await cuStepDesignAge(this, app);
    const careerKey = await cuStepDesignCareerSkills(this, app);
    await cuApplyDesignCash(this, app);
    await cuApplyDesignBonusSkill(this, app);
    await cuStepDesignRank(this, app, careerKey);
  }

  // ─── EVENT TABLE HELPERS ──────────────────────────────────────────────────────

  _lookupEvent(table, roll) {
    return table.find(e => roll >= e.threshold) ?? null;
  }

  // ─── SKILL HELPERS ───────────────────────────────────────────────────────────

  async _rollSkillFromTable(app, tableName) {
    const entries = this.skillTables[tableName];
    if (!entries?.length) {
      return;
    }
    const dr = await app._roll('1d6');
    const skillName = entries[dr - 1];
    if (!skillName) {
      app._log(`  ${tableName} (${dr})`, '(empty entry)');
      return;
    }
    app._log(`  ${tableName} (${dr})`, skillName);
    await this.improveSkill(app, skillName);
    app.charState.log.push(`Skill roll on ${tableName}: ${skillName}`);
  }

  async _applyTableBonusSkill(app, tableA, tableB) {
    const state = app.charState;
    const table = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUBonusSkillPickTable'), [
      { value: tableA, label: game.i18n.format('TWODSIX.CharGen.Steps.CUBonusSkillTableA', { name: tableA }) },
      { value: tableB, label: game.i18n.format('TWODSIX.CharGen.Steps.CUBonusSkillTableB', { name: tableB }) },
    ]);

    for (let attempt = 1; attempt <= 25; attempt++) {
      const dr = await app._roll('1d6');
      const entries = this.skillTables[table] ?? [];
      const skillName = entries[dr - 1];
      if (!skillName) {
        app._log('Bonus Skill', `${table} (${dr}): empty entry — rerolling`);
        continue;
      }

      if (!improveSkillCappedInState(state, skillName, { max: 3 })) {
        app._log('Bonus Skill', `${table} (${dr}): ${skillName} would exceed level 3 — rerolling`);
        continue;
      }
      const next = state.skills.get(skillName);
      app._log('Bonus Skill', `${table} (${dr}): ${skillName} → ${next}`);
      state.log.push(`Bonus skill: ${skillName} → ${next} (from ${table}, 1D6=${dr}).`);
      return;
    }

    app._log('Bonus Skill', 'Unable to grant bonus skill after many rerolls.');
    state.log.push('Bonus skill: no valid result after rerolls.');
  }

  // ─── EVENT EFFECT APPLICATORS ─────────────────────────────────────────────────

  /**
   * Apply mechanical effects encoded in event description tags.
   * Returns true if the event forces leaving the career.
   */
  _humanizeTag(tag) {
    if (tag === 'DIED') {
      return 'Died';
    }
    if (tag === 'INJURED_LEAVE') {
      return 'Injured (must leave)';
    }
    if (tag === 'DEBT_4X') {
      return 'Medical Debt';
    }
    if (tag === 'INT_CRISIS') {
      return 'Mental Crisis';
    }
    if (tag === 'CASH_20000') {
      return 'Cr20,000';
    }
    if (tag === 'AUTO_PROMO_OR_PRISON') {
      return 'Auto-Promo or Prison';
    }
    if (tag === 'PROMO_BONUS_2') {
      return 'Promo Bonus +2';
    }
    if (tag === 'PROMO_PENALTY_1') {
      return 'Promo Penalty −1';
    }
    if (tag === 'EXTRA_BENEFIT') {
      return 'Extra Benefit';
    }
    if (tag === 'CAREER_END') {
      return 'Career Ends';
    }
    if (tag === 'CASH') {
      return 'Cash';
    }
    if (tag === 'AUGMENT_OR_CASH') {
      return 'Augment or Cash';
    }
    if (tag === 'AUGMENT_OR_END') {
      return 'Augment or END +1';
    }
    if (tag === 'WEAPON') {
      return 'Weapon';
    }
    return super._humanizeTag(tag);
  }

  async _applyRulesetTag(app, tag, description, careerName, report = null) {
    const state = app.charState;
    if (tag === 'DIED') {
      state.died = true;
      state.log.push('Died in service.');
      app._log('Outcome', 'Died in service.');
      throw CHARGEN_DIED;
    }
    if (tag === 'INJURED_LEAVE') {
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUInjuredPickPhysical'), localizedPhysicalOpts());
      adjustChar(state, c, -1);
      state.log.push(`Injury: ${c.toUpperCase()} −1. Must leave career.`);
      await this.checkCrisis(app); // throws CHARGEN_DIED on death
      return true; // leaveCareer
    } else if (tag === 'DEBT_4X') {
      const cashBase = this.careers[careerName]?.cashBase ?? 0;
      const debt = 4 * cashBase;
      state.medicalDebt += debt;
      state.log.push(`Debt: Cr${debt.toLocaleString()} added.`);
      app._log('Debt', `+Cr${debt.toLocaleString()}`);
      reportAutoHandled(report, `Debt +Cr${debt.toLocaleString()}`);
    } else if (tag === 'INT_CRISIS') {
      const roll = await app._roll('2d6');
      if (roll <= 7) {
        adjustChar(state, 'int', -1);
        state.log.push(`Mental collapse: INT −1 (2D6=${roll} ≤7).`);
        app._log('Mental collapse', `INT −1 (${roll})`);
        reportAutoHandled(report, `Mental crisis: INT −1 (${roll} ≤7)`);
        await this.checkCrisis(app); // throws CHARGEN_DIED on death
      } else {
        app._log('Mental collapse', `No effect (${roll} >7)`);
        reportAutoHandled(report, `Mental crisis: no effect (${roll} >7)`);
      }
    } else if (tag === 'CASH_20000') {
      state.cashBenefits += 20000;
      state.log.push('Cash: +Cr20,000.');
      app._log('Cash', '+Cr20,000');
      reportAutoHandled(report, 'Cr20,000');
    }
    // PROMO_BONUS_2 / PROMO_PENALTY_1 / EXTRA_BENEFIT handled by caller
    // AUTO_PROMO_OR_PRISON handled by caller (needs context)
    // WEAPON / AUGMENT_OR_CASH / AUGMENT_OR_END handled in benefits
    return false;
  }

  // ─── CRISIS CHECK ─────────────────────────────────────────────────────────────

  async _handleCrisis(app, zeroChars) {
    const state = app.charState;
    // CU crisis: roll 2D6 + END modifier >= 8 to survive
    const endMod = calcModFor(state.chars.end ?? 0);
    const roll = await app._roll('2d6');
    const total = roll + endMod;
    const survived = total >= 8;
    app._log('Aging Crisis', `2D6(${roll})${addSign(endMod)}(END)=${total} vs 8+ → ${survived ? 'Survived' : 'Died'}`);

    if (!survived) {
      state.died = true;
      state.log.push('Died from aging crisis.');
      throw CHARGEN_DIED;
    }
    zeroChars.forEach(k => {
      if ((state.chars[k] ?? 0) <= 0) {
        state.chars[k] = 1;
      }
    });
    state.log.push('Survived aging crisis — must leave career.');
    state.retireFromCareer = true;
  }

  // ─── CU AGING ─────────────────────────────────────────────────────────────────

  async stepAging(app, termNumber) {
    const state = app.charState;
    state.age += 4;
    if (termNumber < 4) {
      state.log.push(`Age now ${state.age}.`);
      return false; // no aging roll before term 4
    }
    const roll = await app._roll('2d6');
    const threshold2 = termNumber <= 6 ? 4 : 6;
    const threshold1 = termNumber <= 6 ? 8 : 10;
    app._log('Aging', `2D6=${roll} (age ${state.age}): lose 2 pts on ${threshold2}-, lose 1 pt on ${threshold1}-`);

    if (roll <= threshold2) {
      const pts = 2;
      const dynamicOpts = localizedPhysicalOpts().map(o => ({
        ...o,
        label: `${o.label} −${pts}`,
      }));
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.AgingReducePhysicalBy'), dynamicOpts);
      adjustChar(state, c, -pts);
      state.log.push(`Aging: ${c.toUpperCase()} −${pts}.`);
    } else if (roll <= threshold1) {
      const dynamicOpts = localizedPhysicalOpts().map(o => ({
        ...o,
        label: `${o.label} −1`,
      }));
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.AgingReducePhysicalBy'), dynamicOpts);
      adjustChar(state, c, -1);
      state.log.push(`Aging: ${c.toUpperCase()} −1.`);
    } else {
      app._log('Aging', 'No effect.');
      state.log.push('Aging: no effect.');
      return false;
    }
    await this.checkCrisis(app); // throws CHARGEN_DIED on death
  }

  // ─── BENEFITS ─────────────────────────────────────────────────────────────────

  async _benefitRoll(app, careerName) {
    return cuBenefitRoll(this, app, careerName);
  }

  async musterOut(app, careerRecord, extraBenefitRolls) {
    return cuMusterOut(this, app, careerRecord, extraBenefitRolls);
  }

  // ─── CAREER TERM LOOP ─────────────────────────────────────────────────────────

  /**
   * Run one career's term loop. Returns the completed career record.
   */
  async _runCareerTerms(app, careerName) {
    return runCUCareerTerms(this, app, careerName);
  }
}
