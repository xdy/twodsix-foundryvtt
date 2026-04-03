// CUCharGenLogic.js — Cepheus Universal character generation logic
// Handles three creation modes: career (term-by-term), random, and design.
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign } from '../../utils/utils.js';
import { BaseCharGenLogic } from './BaseCharGenLogic.js';
import { CHARACTERISTIC_KEYS } from './CharGenState.js';
import { chooseCharacteristicSwap, chooseGender } from './CharGenUtils.js';

// ─── MODULE-LEVEL DATA (loaded from CU pack) ──────────────────────────────────

let CU_CAREERS = {};
let CU_CAREER_NAMES = [];
let CU_SKILL_TABLES = {};       // {tableName: string[6]}
let CU_RISK_FAIL_EVENTS = [];   // [{threshold, description}] sorted desc
let CU_RISK_SUCCESS_EVENTS = [];
let CU_PROMO_FAIL_EVENTS = [];
let CU_PROMO_SUCCESS_EVENTS = [];
let CU_BENEFITS_TABLE = [];     // [{threshold, description}]

/**
 * CU character generation logic.
 * Extends BaseCharGenLogic with Cepheus Universal-specific rules.
 */
export class CUCharGenLogic extends BaseCharGenLogic {
  constructor() {
    super();
  }

  resetData() {
    super.resetData();
    CU_CAREERS = {};
    CU_CAREER_NAMES = [];
    CU_SKILL_TABLES = {};
    CU_RISK_FAIL_EVENTS = [];
    CU_RISK_SUCCESS_EVENTS = [];
    CU_PROMO_FAIL_EVENTS = [];
    CU_PROMO_SUCCESS_EVENTS = [];
    CU_BENEFITS_TABLE = [];
  }

  async loadData(ruleset) {
    this.resetData();

    const careersPackName = `twodsix.${ruleset.toLowerCase()}-srd-careers`;
    const careersPack = game.packs.get(careersPackName);
    if (!careersPack) {
      throw new Error(`Failed to load CU career data: ${careersPackName} not found.`);
    }
    const careerDocs = await careersPack.getDocuments();
    CU_CAREERS = careerDocs.reduce((acc, doc) => {
      if (!doc?.name || !doc?.system || typeof doc.system !== 'object') {
        console.warn(`twodsix | CharGen: skipping invalid CU career entry in ${careersPack.collection}.`, doc);
        return acc;
      }
      acc[doc.name] = doc.system;
      return acc;
    }, {});
    CU_CAREER_NAMES = Object.keys(CU_CAREERS).sort();
    if (!CU_CAREER_NAMES.length) {
      throw new Error(`Failed to load CU career data: no valid careers found in ${careersPack.collection}.`);
    }

    const chargenPackName = `twodsix.${ruleset.toLowerCase()}-srd-chargen-ruleset`;
    const chargenPack = game.packs.get(chargenPackName);
    if (!chargenPack) {
      throw new Error(`Failed to load CU chargen ruleset: ${chargenPackName} not found.`);
    }
    const chargenDocs = await chargenPack.getDocuments();
    const rulesetItem = chargenDocs.find(d => d.system.ruleset === ruleset) ?? chargenDocs[0];
    if (!rulesetItem) {
      throw new Error(`Failed to find CU chargen ruleset item in ${chargenPackName}.`);
    }
    const rd = rulesetItem.system;

    CU_SKILL_TABLES = Object.fromEntries((rd.skillCategoryTables ?? []).map(t => [t.name, t.entries]));

    const sortDesc = arr => [...arr].sort((a, b) => b.threshold - a.threshold);
    CU_RISK_FAIL_EVENTS    = sortDesc(rd.riskFailEvents ?? []);
    CU_RISK_SUCCESS_EVENTS = sortDesc(rd.riskSuccessEvents ?? []);
    CU_PROMO_FAIL_EVENTS   = sortDesc(rd.promotionFailEvents ?? []);
    CU_PROMO_SUCCESS_EVENTS = sortDesc(rd.promotionSuccessEvents ?? []);
    CU_BENEFITS_TABLE      = sortDesc(rd.benefitsTable ?? []);
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
    const state = app.charState;

    // 1. Characteristics
    await app._chooseCharacteristics(app);
    if (state.died) {
      return;
    }

    // CU allows swapping two characteristics after rolling
    await chooseCharacteristicSwap(app);

    // 2. Gender & name
    state.gender = await chooseGender(app);
    await app._rollName();

    // 3. Career loop
    state.cashBenefits += 1000; // CU starting cash
    let isFirstCareer = true;

    while (true) {
      if (state.died) {
        return;
      }

      // Career selection (no qualification roll in CU)
      let careerName;
      if (isFirstCareer) {
        careerName = await app._choose(
          'Choose your career',
          CU_CAREER_NAMES.map(n => ({ value: n, label: n }))
        );
      } else {
        // Second+ career: Remain roll with bonuses
        const prevCareer = state.careers.at(-1);
        const prevCareerData = CU_CAREERS[prevCareer?.name];
        const prefBonus = prevCareerData && (state.chars[prevCareerData.preferredChar] ?? 0) >= 10 ? 1 : 0;
        const autoSkillBonus = prevCareerData && state.skills.has(prevCareerData.autoSkill) ? 1 : 0;
        const entryRoll = await app._roll('2d6');
        const entryTotal = entryRoll + state.totalTerms - prefBonus - autoSkillBonus;
        const canEnter = entryTotal < 12;
        app._log(
          'Second Career Entry',
          `2D6(${entryRoll})+${state.totalTerms} terms${prefBonus ? '-1(pref)' : ''}${autoSkillBonus ? '-1(autoSkill)' : ''}=${entryTotal} vs <12 → ${canEnter ? '✓ Accepted' : '✗ Rejected'}`
        );
        if (!canEnter) {
          app._log('Career', 'Entry roll failed — cannot start another career.');
          break;
        }
        careerName = await app._choose(
          'Choose your next career',
          CU_CAREER_NAMES.map(n => ({ value: n, label: n }))
        );
      }
      if (state.died) {
        return;
      }

      // Run terms for this career
      const careerRecord = await this._runCUCareerTerms(app, careerName);
      state.careers.push(careerRecord);
      if (!state.previousCareers.includes(careerName)) {
        state.previousCareers.push(careerName);
      }
      isFirstCareer = false;
      if (state.died) {
        return;
      }

      // Muster out
      await this.cuMusterOut(app, careerRecord, careerRecord.extraBenefitRolls);
      if (state.died) {
        return;
      }

      // Offer another career
      const another = await this.promptAnotherCareer(app, state.totalTerms);
      if (another !== 'yes') {
        break;
      }
    }
  }

  async runRandomMode(app) {
    const state = app.charState;

    // 1. Characteristics (roll 2D6 each, optional swap)
    await app._chooseCharacteristics(app);
    await chooseCharacteristicSwap(app);

    // 2. Gender & name
    state.gender = await chooseGender(app);
    await app._rollName();

    // 3. Pick 2 skill category tables
    const tableNames = Object.keys(CU_SKILL_TABLES).sort();
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
    const state = app.charState;

    // 1. Characteristics (manual entry, same as CE path)
    await app._chooseCharacteristics(app);

    // 2. Gender & name
    state.gender = await chooseGender(app);
    await app._rollName();

    // 3. Pick 2 skill category tables
    const tableNames = Object.keys(CU_SKILL_TABLES).sort();
    const tableOptions = tableNames.map(n => ({ value: n, label: n }));
    const table1 = await app._choose('First skill table', tableOptions);
    const table2 = await app._choose('Second skill table', tableOptions.filter(o => o.value !== table1));
    app._log('Skill Tables', `${table1} & ${table2}`);

    // 4. Choose 6 skills from selected tables
    state.cashBenefits += 1000;
    for (const tableName of [table1, table2]) {
      const entries = (CU_SKILL_TABLES[tableName] ?? []).filter(Boolean);
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

  /** Parse simple mechanic tags from description strings like [SKILL:Bribery:1] */
  _parseTags(description) {
    const tags = [];
    const regex = /\[([^\]]+)\]/g;
    let m;
    while ((m = regex.exec(description)) !== null) {
      tags.push(m[1]);
    }
    return tags;
  }

  // ─── SKILL HELPERS ───────────────────────────────────────────────────────────

  async _addSkill(app, skillName, level) {
    const state = app.charState;
    const cur = state.skills.has(skillName) ? state.skills.get(skillName) : -Infinity;
    if (cur < level) {
      state.skills.set(skillName, level);
    }
  }

  async _rollSkillFromTable(app, tableName) {
    const entries = CU_SKILL_TABLES[tableName];
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
  async applyEventTags(app, description, careerName) {
    const state = app.charState;
    const tags = this._parseTags(description);
    let leaveCareer = false;

    for (const tag of tags) {
      if (tag === 'DIED') {
        state.died = true;
        state.log.push('Died in service.');
        app._log('Outcome', 'Died in service.');
        return true;
      }
      if (tag === 'INJURED_LEAVE') {
        const physOpts = [
          { value: 'str', label: 'Strength −1' },
          { value: 'dex', label: 'Dexterity −1' },
          { value: 'end', label: 'Endurance −1' },
        ];
        const c = await app._choose('Badly injured: choose characteristic to reduce by 1', physOpts);
        state.chars[c]--;
        state.log.push(`Injury: ${c.toUpperCase()} −1. Must leave career.`);
        await this.cuCheckCrisis(app);
        if (state.died) {
          return true;
        }
        leaveCareer = true;
      } else if (tag === 'DEBT_4X') {
        const cashBase = CU_CAREERS[careerName]?.cashBase ?? 0;
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
          await this.cuCheckCrisis(app);
          if (state.died) {
            return true;
          }
        } else {
          app._log('Mental collapse', `No effect (${roll} >7)`);
        }
      } else if (tag === 'STR_PLUS1') {
        state.chars.str++;
        app._log('Characteristic', 'STR +1');
      } else if (tag === 'DEX_PLUS1') {
        state.chars.dex++;
        app._log('Characteristic', 'DEX +1');
      } else if (tag === 'END_PLUS1') {
        state.chars.end++;
        app._log('Characteristic', 'END +1');
      } else if (tag === 'INT_PLUS1') {
        state.chars.int++;
        app._log('Characteristic', 'INT +1');
      } else if (tag === 'EDU_PLUS1') {
        state.chars.edu++;
        app._log('Characteristic', 'EDU +1');
      } else if (tag === 'SOC_PLUS1') {
        state.chars.soc++;
        app._log('Characteristic', 'SOC +1');
      } else if (tag.startsWith('SKILL:')) {
        const parts = tag.split(':');
        const skillName = parts[1];
        const level = parseInt(parts[2]) || 1;
        await this._addSkill(app, skillName, level);
        app._log('Skill', `${skillName}-${level}`);
        state.log.push(`Gained ${skillName}-${level}.`);
      } else if (tag === 'CASH_20000') {
        state.cashBenefits += 20000;
        state.log.push('Cash: +Cr20,000.');
        app._log('Cash', '+Cr20,000');
      } else if (tag === 'CONTACT') {
        const desc = description.split('[')[0].trim();
        if (desc) {
          state.contacts.push(desc);
          app._log('Contact', desc.slice(0, 60));
        }
      } else if (tag === 'FRIEND') {
        const desc = description.split('[')[0].trim();
        if (desc) {
          state.friends.push(desc);
          app._log('Friend', desc.slice(0, 60));
        }
      } else if (tag === 'ENEMY') {
        const desc = description.split('[')[0].trim();
        if (desc) {
          state.enemies.push(desc);
          app._log('Enemy', desc.slice(0, 60));
        }
      }
      // PROMO_BONUS_2 / PROMO_PENALTY_1 / EXTRA_BENEFIT handled by caller
      // AUTO_PROMO_OR_PRISON handled by caller (needs context)
      // WEAPON / AUGMENT_OR_CASH / AUGMENT_OR_END handled in benefits
    }
    return leaveCareer;
  }

  // ─── CRISIS CHECK ─────────────────────────────────────────────────────────────

  async cuCheckCrisis(app) {
    const state = app.charState;
    const zero = CHARACTERISTIC_KEYS.filter(k => (state.chars[k] ?? 0) <= 0);
    if (!zero.length) {
      return;
    }

    // CU crisis: roll 2D6 + END modifier >= 8 to survive
    const endMod = calcModFor(state.chars.end ?? 0);
    const roll = await app._roll('2d6');
    const total = roll + endMod;
    const survived = total >= 8;
    app._log('Aging Crisis', `2D6(${roll})${addSign(endMod)}(END)=${total} vs 8+ → ${survived ? '✓ Survived' : '✗ Died'}`);

    if (!survived) {
      state.died = true;
      state.log.push('Died from aging crisis.');
      return;
    }
    zero.forEach(k => {
      if ((state.chars[k] ?? 0) <= 0) {
        state.chars[k] = 1;
      }
    });
    state.log.push('Survived aging crisis — must leave career.');
  }

  // CU uses different crisis rules than CE base
  async checkCrisis(app) {
    return this.cuCheckCrisis(app);
  }

  // ─── CU AGING ─────────────────────────────────────────────────────────────────

  async cuStepAging(app, termNumber) {
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
      const c = await app._choose(`Aging: reduce characteristic by ${pts}`, [
        { value: 'str', label: `Strength −${pts}` },
        { value: 'dex', label: `Dexterity −${pts}` },
        { value: 'end', label: `Endurance −${pts}` },
      ]);
      state.chars[c] -= pts;
      state.log.push(`Aging: ${c.toUpperCase()} −${pts}.`);
    } else if (roll <= threshold1) {
      const c = await app._choose('Aging: reduce characteristic by 1', [
        { value: 'str', label: 'Strength −1' },
        { value: 'dex', label: 'Dexterity −1' },
        { value: 'end', label: 'Endurance −1' },
      ]);
      state.chars[c]--;
      state.log.push(`Aging: ${c.toUpperCase()} −1.`);
    } else {
      app._log('Aging', 'No effect.');
      state.log.push('Aging: no effect.');
      return false;
    }
    await this.cuCheckCrisis(app);
    return state.died; // true if crisis was fatal — caller should also check state.died
  }

  // ─── BENEFITS ─────────────────────────────────────────────────────────────────

  async _cuBenefitRoll(app, careerName) {
    const state = app.charState;
    const cashBase = CU_CAREERS[careerName]?.cashBase ?? 0;
    const isOfficer = CU_CAREERS[careerName]?.hasCommissioned &&
      state.careers.length > 0 && state.careers.at(-1)?.commissioned;
    const cashMultiplier = isOfficer ? (CU_CAREERS[careerName]?.officerCashMultiplier ?? 1) : 1;
    const effectiveCash = cashBase * cashMultiplier;

    const roll = await app._roll('2d6');
    const event = this._lookupEvent(CU_BENEFITS_TABLE, roll);
    if (!event) {
      app._log(`Benefit (${roll})`, 'No entry found.');
      return;
    }
    const desc = event.description;
    app._log(`Benefit (${roll})`, desc.replace(/\[.*?\]/g, '').trim());
    state.log.push(`Benefit (${roll}): ${desc}`);

    const tags = this._parseTags(desc);
    for (const tag of tags) {
      if (tag === 'CASH' || tag === 'AUGMENT_OR_CASH') {
        state.cashBenefits += effectiveCash;
        state.cashRollsUsed++;
        app._log('Cash', `+Cr${effectiveCash.toLocaleString()}`);
      } else if (tag === 'STR_PLUS1') {
        state.chars.str++; app._log('Characteristic', 'STR +1');
      } else if (tag === 'DEX_PLUS1')   {
        state.chars.dex++; app._log('Characteristic', 'DEX +1');
      } else if (tag === 'INT_PLUS1')   {
        state.chars.int++; app._log('Characteristic', 'INT +1');
      } else if (tag === 'EDU_PLUS1')   {
        state.chars.edu++; app._log('Characteristic', 'EDU +1');
      } else if (tag === 'SOC_PLUS1')   {
        state.chars.soc++; app._log('Characteristic', 'SOC +1');
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
        state.materialBenefits.push('Weapon or equipment (up to Cr5,000)');
        app._log('Benefit', 'Weapon or equipment (up to Cr5,000)');
      }
    }
  }

  async cuMusterOut(app, careerRecord, extraBenefitRolls) {
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
      await this._cuBenefitRoll(app, careerRecord.name);
      if (state.died) {
        return;
      }
    }
  }

  // ─── CAREER TERM LOOP ─────────────────────────────────────────────────────────

  /**
   * Run one career's term loop. Returns the completed career record.
   */
  async _runCUCareerTerms(app, careerName) {
    const state = app.charState;
    const career = CU_CAREERS[careerName];

    // Auto skill (level 1)
    await this._addSkill(app, career.autoSkill, 1);
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

    while (true) {
      termNumber++;
      state.totalTerms++;
      state.currentTermInCareer = termNumber;
      const ageStart = state.age;
      app._log(`${careerName} — Term ${termNumber}`, `Age ${ageStart}–${ageStart + 3}`);
      state.log.push(`── ${careerName}, Term ${termNumber} (age ${ageStart}–${ageStart + 3}) ──`);
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
        `${riskRoll}${prefMod ? '+1(pref)' : ''}=${riskTotal} vs ${riskTarget}+ → ${riskSucceeded ? `✓ Success (Effect: ${addSign(riskEffect)})` : `✗ Fail (Effect: ${addSign(riskEffect)})`}`
      );
      state.log.push(`Risk: ${riskTotal} vs ${riskTarget}+ → ${riskSucceeded ? 'Success' : 'Fail'} (Effect ${addSign(riskEffect)})`);

      const eventRoll = (await app._roll('2d6')) + riskEffect;
      const eventTable = riskSucceeded ? CU_RISK_SUCCESS_EVENTS : CU_RISK_FAIL_EVENTS;
      const event = this._lookupEvent(eventTable, eventRoll);
      if (event) {
        const cleanDesc = event.description.replace(/\[.*?\]/g, '').trim();
        app._log(riskSucceeded ? `Risk Success (${eventRoll})` : `Risk Fail (${eventRoll})`, cleanDesc);
        state.log.push(`${riskSucceeded ? 'Risk Success' : 'Risk Fail'} (${eventRoll}): ${cleanDesc}`);
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
            if (state.died) {
              break;
            }
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
          if (state.died) {
            break;
          }
          if (shouldLeave) {
            careerMishap = true;
            break;
          }
        }
      }
      if (state.died) {
        break;
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
          app._log('Commission', `${commRoll} vs 9+ → ${commSucceeded ? '✓ Commissioned' : '✗ Failed'}`);
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
        `${promoRoll}${promoTotalRoll !== promoRoll ? `(adjusted to ${promoTotalRoll})` : ''} vs ${promoTarget}+ → ${promoSucceeded ? `✓ Promoted (Effect: ${addSign(promoEffect)})` : `✗ No promotion (Effect: ${addSign(promoEffect)})`}`
      );
      const promoTable = promoSucceeded ? CU_PROMO_SUCCESS_EVENTS : CU_PROMO_FAIL_EVENTS;
      const promoEvent = this._lookupEvent(promoTable, promoEventRoll);
      if (promoEvent) {
        const cleanDesc = promoEvent.description.replace(/\[.*?\]/g, '').trim();
        app._log(promoSucceeded ? `Promo Success (${promoEventRoll})` : `Promo Fail (${promoEventRoll})`, cleanDesc);
        state.log.push(`${promoSucceeded ? 'Promo Success' : 'Promo Fail'} (${promoEventRoll}): ${cleanDesc}`);
        termEntry.events.push(cleanDesc);

        const promoTags = this._parseTags(promoEvent.description);
        if (promoTags.includes('PROMO_BONUS_2')) {
          promoBonus += 2;
        }
        if (promoTags.includes('PROMO_PENALTY_1')) {
          promoPenalty += 1;
        }
        if (promoTags.includes('EXTRA_BENEFIT')) {
          extraBenefitRolls++;
        }
        for (const tag of promoTags.filter(t => !['PROMO_BONUS_2','PROMO_PENALTY_1','EXTRA_BENEFIT'].includes(t))) {
          const dummy = `[${tag}]`;
          await this.applyEventTags(app, dummy, careerName);
          if (state.died) {
            break;
          }
        }
      }
      if (state.died) {
        break;
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
        if (state.died) {
          break;
        }
      }
      if (state.died) {
        break;
      }

      // ── AGING ─────────────────────────────────────────────────────────────────
      const agingFatal = await this.cuStepAging(app, termNumber);
      if (state.died || agingFatal) {
        break;
      }

      // ── REMAIN (re-enlistment) ─────────────────────────────────────────────────
      // Roll 2D6 + totalTerms; result must be UNDER 12 to continue
      const remainRoll = await app._roll('2d6');
      const remainTotal = remainRoll + state.totalTerms;
      const canRemain = remainTotal < 12;
      app._log('Remain', `2D6(${remainRoll})+${state.totalTerms} terms=${remainTotal} vs <12 → ${canRemain ? '✓ May continue' : '✗ Must leave'}`);

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

    const rankList = isCommissioned ? (career.commissionedRanks ?? []) : (career.ranks ?? []);
    const rankTitle = rankList[currentRank - 1]?.title ?? null;
    return {
      name: careerName,
      terms: termNumber,
      rank: currentRank,
      rankTitle,
      commissioned: isCommissioned,
      mishap: careerMishap,
      assignment: careerName,
      benefitsLost: false,
      extraBenefitRolls,
    };
  }
}
