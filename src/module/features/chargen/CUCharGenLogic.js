// CUCharGenLogic.js — Cepheus Universal character generation logic
// Handles three creation modes: career (term-by-term), random, and design.
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign } from '../../utils/utils.js';
import { BaseCharGenLogic } from './BaseCharGenLogic.js';
import { CHARGEN_DIED } from './CharGenState.js';
import { chooseCharacteristicSwap, chooseWeapon } from './CharGenUtils.js';
import {
  CU_BENEFITS_TABLE as CU_BENEFITS_TABLE_CONST,
  CU_PROMO_FAIL_EVENTS as CU_PROMO_FAIL_EVENTS_CONST,
  CU_PROMO_SUCCESS_EVENTS as CU_PROMO_SUCCESS_EVENTS_CONST,
  CU_RISK_FAIL_EVENTS as CU_RISK_FAIL_EVENTS_CONST,
  CU_RISK_SUCCESS_EVENTS as CU_RISK_SUCCESS_EVENTS_CONST,
  CU_SKILL_CATEGORY_TABLES
} from './CUCharGenConstants.js';
import { PHYS_OPTS } from './SharedCharGenConstants.js';

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
  }

  /**
   * Run character generation.
   * @param {CharGenApp} app - The character generation app
   * @returns {Promise<void>}
   */
  async run(app) {
    const state = app.charState;

    const mode = await app._choose(
      'CU Creation Method',
      [
        { value: 'career', label: 'Career (Term-by-Term)' },
        { value: 'random', label: 'Random' },
        { value: 'design', label: 'Design' },
      ]
    );
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
          'Choose your career',
          this.careerNames.map(n => ({ value: n, label: n }))
        );
      } else {
        // Second+ career: Remain roll with bonuses
        const prevCareer = state.careers.at(-1);
        const prevCareerData = this.careers[prevCareer?.name];
        const prefBonus = prevCareerData && (state.chars[prevCareerData.preferredChar] ?? 0) >= 10 ? 1 : 0;
        const autoSkillBonus = prevCareerData && state.skills.has(prevCareerData.autoSkill) ? 1 : 0;
        const entryRoll = await app._roll('2d6');
        const entryTotal = entryRoll + state.totalTerms - prefBonus - autoSkillBonus;
        const canEnter = entryTotal < 12;
        app._log(
          'Second Career Entry',
          `2D6(${entryRoll})+${state.totalTerms} terms${prefBonus ? '-1(pref)' : ''}${autoSkillBonus ? '-1(autoSkill)' : ''}=${entryTotal} vs <12 → ${canEnter ? 'Accepted' : 'Rejected'}`
        );
        if (!canEnter) {
          app._log('Career', 'Entry roll failed — cannot start another career.');
          break;
        }
        careerName = await app._choose(
          'Choose your next career',
          this.careerNames.map(n => ({ value: n, label: n }))
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
  }

  async runRandomMode(app) {
    await this.stepIdentity(app, {
      characteristicsStep: async (app) => {
        await app._chooseCharacteristics();
        await chooseCharacteristicSwap(app);
      },
    });

    // 3. Pick 2 skill category tables
    const state = app.charState;
    const tableNames = Object.keys(this.skillTables).sort();
    const tableOptions = tableNames.map(n => ({ value: n, label: n }));

    const rollOrPick = await app._choose(
      'How to choose skill tables?',
      [
        { value: 'pick',  label: 'Pick two tables' },
        { value: 'roll',  label: 'Roll randomly (1D6 each)' },
      ]
    );

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
      table1 = await app._choose('First skill table', tableOptions);
      table2 = await app._choose('Second skill table', tableOptions.filter(o => o.value !== table1));
      app._log('Skill Tables', `${table1} & ${table2}`);
    }

    // 4. 6 skill rolls
    state.cashBenefits += 1000;
    const twoTableOpts = [
      { value: table1, label: table1 },
      { value: table2, label: table2 },
    ];
    for (let i = 0; i < 6; i++) {
      const chosenTable = await app._choose(`Skill roll ${i + 1}/6`, twoTableOpts);
      await this._rollSkillFromTable(app, chosenTable);
    }
  }

  async runDesignMode(app) {
    await this.stepIdentity(app);

    // 3. Pick 2 skill category tables
    const state = app.charState;
    const tableNames = Object.keys(this.skillTables).sort();
    const tableOptions = tableNames.map(n => ({ value: n, label: n }));
    const table1 = await app._choose('First skill table', tableOptions);
    const table2 = await app._choose('Second skill table', tableOptions.filter(o => o.value !== table1));
    app._log('Skill Tables', `${table1} & ${table2}`);

    // 4. Choose 6 skills from selected tables
    state.cashBenefits += 1000;
    for (const tableName of [table1, table2]) {
      const entries = (this.skillTables[tableName] ?? []).filter(Boolean);
      const opts = [...new Set(entries)].sort().map(s => ({ value: s, label: s }));
      if (!opts.length) {
        continue;
      }
      // Each table contributes 3 skill choices (6 total across 2 tables)
      for (let i = 0; i < 3; i++) {
        const skill = await app._choose(`${tableName}: choose skill ${i + 1}/3`, opts);
        await this.improveSkill(app, skill);
        app._log(`  ${tableName}`, skill);
        state.log.push(`Design: chose ${skill} from ${tableName}.`);
      }
    }
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

  async _applyRulesetTag(app, tag, description, careerName) {
    const state = app.charState;
    if (tag === 'DIED') {
      state.died = true;
      state.log.push('Died in service.');
      app._log('Outcome', 'Died in service.');
      throw CHARGEN_DIED;
    }
    if (tag === 'INJURED_LEAVE') {
      const c = await app._choose('Badly injured: choose physical characteristic to reduce by 1', PHYS_OPTS);
      state.chars[c]--;
      state.log.push(`Injury: ${c.toUpperCase()} −1. Must leave career.`);
      await this.checkCrisis(app); // throws CHARGEN_DIED on death
      return true; // leaveCareer
    } else if (tag === 'DEBT_4X') {
      const cashBase = this.careers[careerName]?.cashBase ?? 0;
      const debt = 4 * cashBase;
      state.medicalDebt += debt;
      state.log.push(`Debt: Cr${debt.toLocaleString()} added.`);
      app._log('Debt', `+Cr${debt.toLocaleString()}`);
    } else if (tag === 'INT_CRISIS') {
      const roll = await app._roll('2d6');
      if (roll <= 7) {
        state.chars.int = Math.max(0, state.chars.int - 1);
        state.log.push(`Mental collapse: INT −1 (2D6=${roll} ≤7).`);
        app._log('Mental collapse', `INT −1 (${roll})`);
        await this.checkCrisis(app); // throws CHARGEN_DIED on death
      } else {
        app._log('Mental collapse', `No effect (${roll} >7)`);
      }
    } else if (tag === 'CASH_20000') {
      state.cashBenefits += 20000;
      state.log.push('Cash: +Cr20,000.');
      app._log('Cash', '+Cr20,000');
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
      const dynamicOpts = PHYS_OPTS.map(o => ({ ...o, label: `${o.label} −${pts}` }));
      const c = await app._choose('Aging: reduce physical characteristic', dynamicOpts);
      state.chars[c] -= pts;
      state.log.push(`Aging: ${c.toUpperCase()} −${pts}.`);
    } else if (roll <= threshold1) {
      const dynamicOpts = PHYS_OPTS.map(o => ({ ...o, label: `${o.label} −1` }));
      const c = await app._choose('Aging: reduce physical characteristic', dynamicOpts);
      state.chars[c]--;
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
    const state = app.charState;
    const cashBase = this.careers[careerName]?.cashBase ?? 0;
    const isOfficer = this.careers[careerName]?.hasCommissioned &&
      state.careers.length > 0 && state.careers.at(-1)?.commissioned;
    const cashMultiplier = isOfficer ? (this.careers[careerName]?.officerCashMultiplier ?? 1) : 1;
    const effectiveCash = cashBase * cashMultiplier;

    const roll = await app._roll('2d6');
    const event = this._lookupEvent(this.benefitsTable, roll);
    if (!event) {
      app._log(`Benefit (${roll})`, 'No entry found.');
      return;
    }
    const desc = event.description;
    app._log(`Benefit (${roll})`, desc.replace(/\[.*?\]/g, '').trim());
    state.log.push(`Benefit (${roll}): ${desc}`);

    const tags = this._parseTags(desc);
    for (const tag of tags) {
      if (await this._applyCommonTag(app, tag, desc)) {
        continue;
      }

      if (tag === 'CASH' || tag === 'AUGMENT_OR_CASH') {
        state.cashBenefits += effectiveCash;
        state.cashRollsUsed++;
        app._log('Cash', `+Cr${effectiveCash.toLocaleString()}`);
      } else if (tag === 'AUGMENT_OR_END') {
        const choice = await app._choose('Benefit: Augment 5 pts or +1 End?', [
          { value: 'augment', label: 'Augment (5 points)' },
          { value: 'end',     label: '+1 Endurance' },
        ]);
        if (choice === 'end') {
          state.chars.end++;
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

  async musterOut(app, careerRecord, extraBenefitRolls) {
    const state = app.charState;
    const rank = careerRecord.rank;
    const rankBonus = rank >= 5 ? 3 : rank >= 3 ? 2 : rank >= 1 ? 1 : 0;
    const totalRolls = careerRecord.terms + rankBonus + extraBenefitRolls;
    if (totalRolls <= 0) {
      state.log.push('No benefit rolls.');
      return;
    }
    state.log.push(`Muster out: ${totalRolls} benefit roll(s) (${careerRecord.terms} terms + ${rankBonus} rank bonus + ${extraBenefitRolls} extra).`);
    for (let i = 0; i < totalRolls; i++) {
      app._log(`Benefit roll ${i + 1}/${totalRolls}`, `(${careerRecord.name}, rank ${rank})`);
      await this._benefitRoll(app, careerRecord.name);
    }
  }

  // ─── CAREER TERM LOOP ─────────────────────────────────────────────────────────

  /**
   * Run one career's term loop. Returns the completed career record.
   */
  async _runCareerTerms(app, careerName) {
    const state = app.charState;
    const career = this.careers[careerName];

    // Auto skill (level 1)
    await this.setSkillAtLeast(app, career.autoSkill, 1);
    app._log('Auto Skill', `${career.autoSkill}-1`);
    state.log.push(`Auto Skill: ${career.autoSkill}-1`);

    // For careers with choice of second table, pick once at career entry
    let skillTable2 = career.skillTable2;
    if (skillTable2 === 'choice' && career.skillTable2Options?.length) {
      skillTable2 = await app._choose(
        `${careerName}: choose second skill table`,
        career.skillTable2Options.map(t => ({ value: t, label: t }))
      );
    }

    let termNumber = 0;
    let currentRank = 0;
    let isCommissioned = false;
    let promoBonus = 0;       // accumulated DM bonus from promotion fail event
    let promoPenalty = 0;     // accumulated DM penalty from promotion fail event
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
        app._log(game.i18n.format('TWODSIX.CharGen.Events.TermLog', { career: careerName, term: termNumber }), game.i18n.format('TWODSIX.CharGen.Events.AgeLog', { start: ageStart, end: ageStart + 3 }));
        state.log.push(game.i18n.format('TWODSIX.CharGen.Events.TermHeader', { career: careerName, term: termNumber, start: ageStart, end: ageStart + 3 }));
        const termEntry = this.startTermHistoryEntry(state, {
          careerName,
          totalTerm: state.totalTerms,
          ageStart,
          startedVerb: termNumber === 1 ? 'Began' : 'Continued',
        });

        // ── RISK ──────────────────────────────────────────────────────────────────
        const riskRoll = await app._roll('2d6');
        const prefMod = (state.chars[career.preferredChar] ?? 0) >= 10 ? 1 : 0;
        const riskTotal = riskRoll + prefMod;
        const riskTarget = career.riskTarget ?? 6;
        const riskSucceeded = riskTotal >= riskTarget;
        const riskEffect = riskTotal - riskTarget; // positive = succeeded by N, negative = failed by N
        app._log(
          'Risk',
          `${riskRoll}${prefMod ? '+1(pref)' : ''}=${riskTotal} vs ${riskTarget}+ → ${riskSucceeded ? `Success (Effect: ${addSign(riskEffect)})` : `Fail (Effect: ${addSign(riskEffect)})`}`
        );
        state.log.push(`Risk: ${riskTotal} vs ${riskTarget}+ → ${riskSucceeded ? 'Success' : 'Fail'} (Effect ${addSign(riskEffect)})`);

        const eventRoll = (await app._roll('2d6')) + riskEffect;
        const eventTable = riskSucceeded ? this.riskSuccessEvents : this.riskFailEvents;
        const event = this._lookupEvent(eventTable, eventRoll);
        if (event) {
          const cleanDesc = this._humanizeTaggedDescription(event.description);
          app._log(riskSucceeded ? `Risk Success (${eventRoll})` : `Risk Fail (${eventRoll})`, cleanDesc);
          state.log.push(`${riskSucceeded ? 'Risk Success' : 'Risk Fail'} (${eventRoll}): ${cleanDesc}`);
          const riskLogBefore = state.log.length;
          termEntry.events.push(cleanDesc);

          // Special: AUTO_PROMO_OR_PRISON needs context
          if (event.description.includes('[AUTO_PROMO_OR_PRISON]')) {
            const subRoll = await app._roll('2d6');
            if (subRoll >= 4) {
              app._log('Big chance!', `Roll ${subRoll} ≥4 → auto promotion + extra skill`);
              state.log.push(`Auto promotion and extra skill roll.`);
              currentRank = Math.min(5, currentRank + 1);
              promoBonus += 99; // flag: guaranteed promotion this term (handled inline)
              // Give extra skill roll immediately
              await this._rollSkillFromTable(app, career.skillTable1);
            } else {
              app._log('Prison!', `Roll ${subRoll} <4 → SOC −1, gain criminal Contact`);
              state.chars.soc = Math.max(0, state.chars.soc - 1);
              state.contacts.push(`Criminal contact (served time in prison)`);
              state.log.push(`Imprisoned: SOC −1, gained criminal Contact.`);
            }
            // Remove this tag from further processing to avoid double-handling
            const tags = this._parseTags(event.description).filter(t => t !== 'AUTO_PROMO_OR_PRISON');
            // Process remaining tags manually
            for (const tag of tags) {
              if (tag === 'CONTACT' && cleanDesc) {
                state.contacts.push(cleanDesc);
              } else if (tag === 'FRIEND' && cleanDesc) {
                state.friends.push(cleanDesc);
              } else if (tag === 'ENEMY' && cleanDesc) {
                state.enemies.push(cleanDesc);
              }
            }
          } else {
            const shouldLeave = await this.applyEventTags(app, event.description, careerName);
            if (shouldLeave) {
              for (const outcome of state.log.slice(riskLogBefore)) {
                termEntry.events.push(`  ${outcome}`);
              }
              careerMishap = true;
              break;
            }
          }
          for (const outcome of state.log.slice(riskLogBefore)) {
            termEntry.events.push(`  ${outcome}`);
          }
        }

        // ── COMMISSION (military careers, first time, EDU 8+) ─────────────────────
        let justCommissioned = false;
        if (!isCommissioned && career.hasCommissioned && currentRank === 0 && state.chars.edu >= 8) {
          const attempt = await app._choose(
            'Commission? (9+ required, EDU 8+)',
            [
              { value: 'yes', label: 'Yes — attempt Commission (9+)' },
              { value: 'no',  label: 'No — remain enlisted' },
            ]
          );
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

        // ── PROMOTION ─────────────────────────────────────────────────────────────
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
          `${promoRoll}${promoTotalRoll !== promoRoll ? `(adjusted to ${promoTotalRoll})` : ''} vs ${promoTarget}+ → ${promoSucceeded ? `Promoted (Effect: ${addSign(promoEffect)})` : `No promotion (Effect: ${addSign(promoEffect)})`}`
        );
        const promoTable = promoSucceeded ? this.promoSuccessEvents : this.promoFailEvents;
        const promoEvent = this._lookupEvent(promoTable, promoEventRoll);
        if (promoEvent) {
          const cleanDesc = this._humanizeTaggedDescription(promoEvent.description);
          app._log(promoSucceeded ? `Promo Success (${promoEventRoll})` : `Promo Fail (${promoEventRoll})`, cleanDesc);
          state.log.push(`${promoSucceeded ? 'Promo Success' : 'Promo Fail'} (${promoEventRoll}): ${cleanDesc}`);
          const promoLogBefore = state.log.length;
          termEntry.events.push(cleanDesc);

          const promoTags = this._parseTags(promoEvent.description);
          if (promoTags.includes('PROMO_BONUS_2')) {
            promoBonus += 2;
            state.log.push('Next promotion roll: +2 bonus.');
          }
          if (promoTags.includes('PROMO_PENALTY_1')) {
            promoPenalty += 1;
            state.log.push('Next promotion roll: −1 penalty.');
          }
          if (promoTags.includes('EXTRA_BENEFIT')) {
            extraBenefitRolls++;
            state.log.push('Gained an extra benefit roll.');
          }
          for (const tag of promoTags.filter(t => !['PROMO_BONUS_2', 'PROMO_PENALTY_1', 'EXTRA_BENEFIT'].includes(t))) {
            await this.applyEventTags(app, `[${tag}]`, careerName);
          }
          for (const outcome of state.log.slice(promoLogBefore)) {
            termEntry.events.push(`  ${outcome}`);
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

        // ── SKILLS ────────────────────────────────────────────────────────────────
        const skillRolls = (termNumber === 1 ? 2 : 1)
          + (justCommissioned ? 1 : 0)
          + (justPromoted ? 1 : 0);
        const tableOptions = [
          { value: career.skillTable1, label: career.skillTable1 },
          { value: skillTable2,        label: skillTable2 },
        ].filter((t, i, arr) => t.value && arr.findIndex(x => x.value === t.value) === i);
        for (let i = 0; i < skillRolls; i++) {
          let chosenTable = career.skillTable1;
          if (tableOptions.length > 1) {
            chosenTable = await app._choose(
              `Skill roll ${i + 1}/${skillRolls}: choose table`,
              tableOptions
            );
          }
          await this._rollSkillFromTable(app, chosenTable);
        }

        // ── AGING ─────────────────────────────────────────────────────────────────
        await this.stepAging(app, termNumber); // throws CHARGEN_DIED on fatal aging

        // ── REMAIN (re-enlistment) ─────────────────────────────────────────────────
        // Roll 2D6 + totalTerms; result must be UNDER 12 to continue
        const remainRoll = await app._roll('2d6');
        const remainTotal = remainRoll + state.totalTerms;
        const canRemain = remainTotal < 12;
        app._log('Remain', `2D6(${remainRoll})+${state.totalTerms} terms=${remainTotal} vs <12 → ${canRemain ? 'May continue' : 'Must leave'}`);

        if (!canRemain) {
          state.log.push(`Remain roll failed (${remainTotal} ≥12): leaving ${careerName}.`);
          termEntry.events.push(`Left ${careerName} (remain roll failed).`);
          break;
        }

        const stay = await app._choose(
          `Continue in ${careerName} for another term?`,
          [
            { value: 'yes', label: 'Yes — serve another term' },
            { value: 'no',  label: 'No — leave now' },
          ]
        );
        if (stay !== 'yes') {
          termEntry.events.push(`Voluntarily left ${careerName}.`);
          break;
        }
      }
    } catch (err) {
      if (err !== CHARGEN_DIED) {
        throw err;
      }
      // Character died mid-career: save partial record to state then re-throw
      const record = buildRecord();
      state.careers.push(record);
      if (!state.previousCareers.includes(careerName)) {
        state.previousCareers.push(careerName);
      }
      throw CHARGEN_DIED;
    }

    return buildRecord();
  }
}
