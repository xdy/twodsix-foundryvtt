// CDEECharGenLogic.js — Cepheus Deluxe Enhanced Edition character generation logic
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign } from '../../utils/utils.js';
import { BaseCharGenLogic } from './BaseCharGenLogic.js';
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
import { CHARACTERISTIC_KEYS, CHARGEN_DIED } from './CharGenState.js';
import { chooseWeapon } from './CharGenUtils.js';
import { ALL_CHAR_OPTS, MENT_OPTS, PHYS_OPTS, resolveCharKey } from './SharedCharGenConstants.js';

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
    const charMethod = await app._choose('Choose Characteristic Generation Method', [
      { value: 'array', label: 'Standard Array [10, 9, 8, 7, 6, 5]' },
      { value: 'pointbuy', label: 'Point-Buy (42 points)' },
    ]);
    state.creationMode = charMethod;

    if (charMethod === 'array') {
      await this.stepCDEECharacteristicsArray(app);
    } else {
      await app._chooseCharacteristics();
    }

    // 2. Identity
    await this.stepIdentity(app);

    await this.stepOptionalRules(app);

    // 3. Homeworld
    await this.stepHomeworld(app);

    // 4. Career Selection Loop
    let lastCareerWasMilitary = false;
    while (true) {
      const careerName = await app._choose(
        'Choose your career',
        this.careerNames.map(n => ({ value: n, label: n }))
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
        termOptions.push({ value: i, label: `${i} term${i > 1 ? 's' : ''}` });
      }
      const selection = await app._choose(
        `Choose number of terms to serve in ${careerName} (max ${remainingTerms})`,
        termOptions
      );
      const numTerms = parseInt(selection, 10);
      const careerStartTerm = state.totalTerms + 1;

      // 6. Zero-level skills
      if (state.careers.length === 0) {
        const zeroSkills = career.isMilitary ? this.zeroLevelMilitary : this.zeroLevelCivilian;
        for (const sk of zeroSkills) {
          await this._addSkillAtLevel(app, sk, 0);
        }
        state.log.push(`Zero-level skills (${career.isMilitary ? 'Military' : 'Civilian'}): ${zeroSkills.join(', ')}`);
      } else {
        // Subsequent careers: pick ONE service skill at level 0
        const sk = await app._choose(
          'New career: pick one service skill to start at level 0',
          career.service.sort().map(s => ({ value: s, label: s }))
        );
        await this._addSkillAtLevel(app, sk, 0);
        state.log.push(`New career (${careerName}) basic training: ${sk}-0`);
      }

      // 7. Career term loop
      for (let term = 1; term <= numTerms; term++) {
        state.totalTerms++;
        state.currentTermInCareer = term;
        const ageStart = state.age;
        app._log(game.i18n.format('TWODSIX.CharGen.Events.TermLog', { career: careerName, term: term }), game.i18n.format('TWODSIX.CharGen.Events.AgeLog', { start: ageStart, end: ageStart + 3 }));
        state.log.push(game.i18n.format('TWODSIX.CharGen.Events.TermHeader', { career: careerName, term: term, start: ageStart, end: ageStart + 3 }));
        const termEntry = this.startTermHistoryEntry(state, {
          careerName,
          totalTerm: state.totalTerms,
          ageStart,
          startedVerb: term === 1 ? game.i18n.localize('TWODSIX.CharGen.Events.Began') : game.i18n.localize('TWODSIX.CharGen.Events.Continued'),
        });

        if (careerStartTerm === 1 && term === 1) {
          const mainSkill = await app._choose(
            'First term: pick one service skill to start at level 1',
            career.service.sort().map(s => ({ value: s, label: s }))
          );
          for (const sk of career.service) {
            await this._addSkillAtLevel(app, sk, sk === mainSkill ? 1 : 0);
          }
          state.log.push(`Service skills: ${mainSkill}-1, others at 0.`);
          await this.stepSkillsAndTraining(app, careerName, 2, { term: 1 });
        } else if (term <= 3) {
          await this.stepSkillsAndTraining(app, careerName, 2);
        } else {
          await this.stepSkillsAndTraining(app, careerName, 1);
        }

        const roll = await app._roll('2d6');
        const event = (career.eventTable || []).find(e => e.roll === roll);
        if (event) {
          const cleanDesc = event.description.replace(/\[.*?\]/g, '').trim();
          app._log(`Event (${roll})`, cleanDesc);
          state.log.push(`Event (${roll}): ${cleanDesc}`);
          termEntry.events.push(cleanDesc);
          await this.applyEventTags(app, event.description, careerName);
        }

        if (term % 2 === 0) {
          state.currentRank++;
          const rankInfo = career.ranks[state.currentRank];
          if (rankInfo) {
            app._log('Rank Increase', `Now ${rankInfo.title || `Rank ${state.currentRank}`}`);
            state.log.push(`Rank increased to ${state.currentRank} (${rankInfo.title || 'no title'}).`);
            if (rankInfo.skill) {
              await this._addSkillAtLevel(app, rankInfo.skill, rankInfo.level);
              state.log.push(`Rank skill: ${rankInfo.skill}-${rankInfo.level}`);
            }
          }
        }

        await this.stepAging(app);

        if (state.died) {
          break;
        }
      }

      if (state.died) {
        break;
      }

      const careerRecord = {
        name: careerName,
        terms: numTerms,
        rank: state.currentRank,
        mishap: false,
      };
      state.careers.push(careerRecord);
      lastCareerWasMilitary = career.isMilitary;

      if (state.optionalRules.switchingCareers && state.totalTerms < 7) {
        const switchChoice = await app._choose(
          `Total terms served: ${state.totalTerms}. Switch career?`,
          [
            { value: 'switch', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.SwitchCareer') },
            { value: 'finish', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.Finish') },
          ]
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
      await this.stepSkillPackage(app);
      await this.stepTraitSelection(app, state.totalTerms);
    }
  }

  async stepCDEECharacteristicsArray(app) {
    const values = [10, 9, 8, 7, 6, 5];
    const state = app.charState;

    for (let i = 0; i < ALL_CHAR_OPTS.length; i++) {
      const selection = await app._choose(
        `Assign value to ${ALL_CHAR_OPTS[i].label}`,
        values.map(v => ({ value: v, label: String(v) }))
      );
      const val = parseInt(selection, 10);
      state.chars[ALL_CHAR_OPTS[i].value] = val;
      const idx = values.indexOf(val);
      if (idx !== -1) {
        values.splice(idx, 1);
      }
    }
  }

  async stepHomeworld(app) {
    const state = app.charState;
    const type = await app._choose(
      'Choose Homeworld Type',
      this.homeworldTypes.map(t => ({ value: t.name, label: `${t.name} (${t.skills.join(', ')})` }))
    );
    const hw = this.homeworldTypes.find(t => t.name === type);
    const skill = await app._choose(
      `Homeworld (${type}): pick one skill at level 1`,
      [...hw.skills].sort().map(s => ({ value: s, label: `${s}-1` }))
    );
    await this._addSkillAtLevel(app, skill, 1);
    state.log.push(`Homeworld: ${type}, Skill: ${skill}-1`);
  }

  async stepSkillsAndTraining(app, careerName, numRolls, { term = 0 } = {}) {
    const career = this.careers[careerName];
    const canAdv = app.charState.chars.edu >= 8;

    for (let i = 0; i < numRolls; i++) {
      const tables = [
        { value: 'service', label: 'Service Skills' },
        { value: 'specialist', label: 'Specialist Skills' },
      ];
      if (canAdv) {
        tables.push({ value: 'advanced', label: `Advanced Education (Edu ${app.charState.chars.edu})` });
      }
      tables.push({ value: 'char', label: 'Characteristic +1' });

      const tbl = await app._choose(`Term ${app.charState.currentTermInCareer}: Skill choice ${i + 1}/${numRolls}`, tables);

      if (tbl === 'char') {
        const opts = CHARACTERISTIC_KEYS.map(k => ({ value: k, label: k.toUpperCase() }));
        const c = await app._choose('Increase characteristic by +1', opts);
        app.charState.chars[c]++;
        app._log('Characteristic', `${c.toUpperCase()} +1`);
      } else {
        const skills = career[tbl].sort();
        const sk = await app._choose(`Choose skill from ${tables.find(t => t.value === tbl).label}`, skills.map(s => ({ value: s, label: s })));

        if (term === 1) {
          const cur = app.charState.skills.get(this.skillNameMap[sk] ?? sk) ?? -1;
          if (cur >= 2) {
            app._log('Warning', `${sk} is already level 2 — cap in effect for term 1.`);
            i--;
            continue;
          }
        }
        await this._addOrImproveSkill(app, sk, skills);
      }
    }
  }

  async stepAging(app) {
    const state = app.charState;
    state.age += 4;
    if (state.totalTerms < 4) {
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
    app._log('Aging', `${roll}−${state.totalTerms} terms${agingDM ? addSign(agingDM) : ''}=${result} (age ${state.age})`);

    if (result <= 0) {
      const idx = Math.min(7, Math.max(0, result + 6));
      const entry = this.agingTable[idx];
      if (entry) {
        state.log.push('Aging effect: reducing characteristics.');
        for (const amt of entry.phys.filter(n => n > 0)) {
          const c = await app._choose(`Aging: reduce physical characteristic by ${amt}`, PHYS_OPTS);
          state.chars[c] -= amt;
        }
        if (entry.mental > 0) {
          const c = await app._choose('Aging: reduce mental characteristic by 1', MENT_OPTS);
          state.chars[c]--;
        }
        await this.checkCrisis(app);
      }
    }
  }

  async _handleCrisis(app, zeroChars) {
    const state = app.charState;
    const roll = await app._roll('2d6');
    const success = roll >= 6;
    app._log('Crisis', `2D6=${roll} vs 6+ → ${success ? 'Survived' : 'Died'}`);

    if (success) {
      zeroChars.forEach(c => (state.chars[c] = 1));
      state.log.push('Survived crisis — must retire.');
    } else {
      state.died = true;
      state.log.push('DIED during aging crisis.');
      throw CHARGEN_DIED;
    }
  }

  async applyEventTags(app, description, careerName) {
    const state = app.charState;
    const tags = this._parseTags(description);

    for (const tag of tags) {
      if (await this._applyCommonTag(app, tag, description)) {
        continue;
      }

      if (tag.startsWith('CHOOSE_SKILL:')) {
        const skills = tag.split(':')[1].split(',');
        const sk = await app._choose('Event: pick one skill', skills.map(s => ({ value: s, label: s })));
        await this._addOrImproveSkill(app, sk, skills);
      } else if (tag.startsWith('CHECK:')) {
        const parts = tag.split(':');
        const skill = parts[1];
        const target = parseInt(parts[2]) || 8;
        const roll = await app._roll('2d6');
        const mod = calcModFor(state.skills.get(skill) ?? -1);
        const total = roll + mod;
        const success = total >= target;
        app._log('Event Check', `${skill} ${target}+: ${roll}${addSign(mod)}=${total} → ${success ? 'Success' : 'Fail'}`);
      } else if (tag === 'INJURY') {
        await this.stepInjury(app);
      } else if (tag === 'LIFE_EVENT') {
        await this.stepLifeEvent(app);
      } else if (tag === 'PRISON') {
        await this.stepPrison(app);
      } else if (tag === 'RANK_UP') {
        state.currentRank++;
      } else if (tag.startsWith('BENEFIT_DM:')) {
        state.benefitDMs.push(parseInt(tag.split(':')[1]));
      } else if (tag === 'FREE_SKILL') {
        // Mock selection for now
        app._log('Free Skill', 'Gain any one skill at level 1.');
      } else if (tag === 'BENEFIT_ROLL') {
        state.benefitDMs.push(0); // Mock extra benefit roll by adding a 0 DM
      }
    }
  }

  async stepInjury(app) {
    const state = app.charState;
    if (state.optionalRules.ironMan) {
      app._log('Iron Man', 'Injury is fatal!');
      state.died = true;
      throw CHARGEN_DIED;
    }
    const roll = await app._roll('2d6');
    const endMod = calcModFor(state.chars.end ?? 0);
    const effect = roll + endMod - 6;
    const entry = this.injuryTable.find(e => e.effect === effect) || this.injuryTable[0];
    app._log('Injury', `2D6(${roll})${addSign(endMod)}(END) vs 6+: Effect ${addSign(effect)} → ${entry.description}`);
    state.log.push(`Injury: ${entry.description}`);
    await this.applyEventTags(app, entry.description);
    await this.checkCrisis(app);
  }

  async stepLifeEvent(app) {
    const roll = await app._roll('2d6');
    const event = this.lifeEvents.find(e => e.roll === roll);
    if (event) {
      app._log('Life Event', event.description);
      await this.applyEventTags(app, event.description);
    }
  }

  async stepPrison(app) {
    const state = app.charState;
    state.prisonTerms++;
    const sk = await app._choose('Prison: pick one skill', this.prisonSkills.map(s => ({ value: s, label: s })));
    await this._addOrImproveSkill(app, sk);

    const roll = await app._roll('2d6');
    const event = this.prisonEvents.find(e => e.roll === roll);
    if (event) {
      app._log('Prison Event', event.description);
      await this.applyEventTags(app, event.description);
    }
  }

  async stepMusterOutAll(app) {
    const state = app.charState;
    if (state.died) {
      return;
    }

    let totalRolls = state.careers.reduce((acc, c) => acc + (1 + c.terms), 0);
    totalRolls -= state.prisonTerms;
    totalRolls -= state.careerChanges;
    totalRolls = Math.max(0, totalRolls);

    app._log('Muster Out', `Total benefit rolls: ${totalRolls}`);
    state.log.push(`── Muster Out Benefits (total rolls: ${totalRolls}) ──`);

    for (let i = 0; i < totalRolls; i++) {
      let careerName = state.careers[0].name;
      if (state.careers.length > 1) {
        careerName = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.OptionalRules.ChooseMusterCareer'),
          state.careers.map(c => ({ value: c.name, label: c.name }))
        );
      }
      const career = this.careers[careerName];
      const careerRecord = state.careers.find(c => c.name === careerName);

      const opts = [
        { value: 'cash', label: 'Cash' },
        { value: 'material', label: 'Material benefit' },
      ];
      if (careerRecord.rank < 6) {
        opts.push({ value: 'rank', label: 'Purchase Rank (1 roll = 1 rank + 1 bonus skill)' });
      }

      const choice = await app._choose(`Muster out benefit ${i + 1}/${totalRolls}`, opts);

      if (choice === 'rank') {
        careerRecord.rank++;
        const rankInfo = career.ranks[careerRecord.rank];
        app._log('Rank Purchased', `Now ${rankInfo?.title || `Rank ${careerRecord.rank}`} in ${careerName}`);
        if (rankInfo?.skill) {
          await this._addOrImproveSkill(app, rankInfo.skill);
        }
        state.log.push(`Purchased rank ${careerRecord.rank} in ${careerName} with benefit roll.`);
        continue;
      }

      const carousingMod = calcModFor(state.skills.get('Carousing') ?? -1);
      const dm = i < state.benefitDMs.length ? state.benefitDMs[i] : 0;

      let cashDM = 0;
      if (choice === 'cash') {
        const roll2d6 = await app._roll('2d6');
        const socVal = state.chars.soc ?? 0;
        if (roll2d6 + carousingMod >= 10 || socVal >= 10) {
          cashDM = 1;
        } else if (roll2d6 + carousingMod < 7) {
          cashDM = -1;
        }
      }

      const roll1d6 = await app._roll('1d6');
      const finalRoll = Math.min(6, Math.max(1, roll1d6 + dm + cashDM));

      if (choice === 'cash') {
        const amt = career.cash[finalRoll - 1];
        state.cashBenefits += amt;
        state.log.push(`Cash (roll ${roll1d6}${addSign(dm + cashDM)}): Cr${amt.toLocaleString()}`);
      } else {
        const benefit = career.material[finalRoll - 1];
        const charKey = resolveCharKey(benefit);
        if (charKey) {
          state.chars[charKey]++;
        } else if (benefit === 'Weapon') {
          await chooseWeapon(app);
        } else {
          state.materialBenefits.push(benefit);
        }
        state.log.push(`Material (roll ${roll1d6}${addSign(dm)}): ${benefit}`);
      }
    }
  }

  async stepSkillPackage(app) {
    const state = app.charState;
    const pkgName = await app._choose('Select Skill Package', [
      { value: 'none', label: 'None' },
      ...this.skillPackages.map(p => ({ value: p.name, label: p.name })),
    ]);
    if (pkgName === 'none') {
      return;
    }

    const pkg = this.skillPackages.find(p => p.name === pkgName);
    for (const sk of pkg.skills) {
      await this._addOrImproveSkill(app, sk);
    }
    state.log.push(`Selected Skill Package: ${pkgName}`);
  }

  async stepTraitSelection(app, numTerms) {
    const state = app.charState;
    const numTraits = Math.ceil(numTerms / 2);
    if (numTraits <= 0) {
      return;
    }

    const traitPack = game.packs.get(this.traitPackName) || game.packs.get('twodsix.cepheus-deluxe-items');
    if (!traitPack) {
      app._log('Error', `Trait pack ${this.traitPackName} not found.`);
      return;
    }
    const docs = await traitPack.getDocuments();
    const availableTraits = docs.filter(d => d.type === 'trait').sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < numTraits; i++) {
      const traitName = await app._choose(
        `Select Trait ${i + 1}/${numTraits}`,
        availableTraits.map(t => ({ value: t.name, label: t.name }))
      );
      state.traits.push(traitName);
      app._log('Trait', traitName);
      state.log.push(`Selected Trait: ${traitName}`);
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
    const cur = state.skills.get(name) ?? -1;
    const newLevel = cur < 0 ? 1 : cur + 1;

    if (state.optionalRules.skillLimits && newLevel > 3) {
      const choices = [
        { value: 'ignore', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.IgnoreLimit') },
        { value: 'other', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.PickDifferent') },
        { value: 'skip', label: game.i18n.localize('TWODSIX.CharGen.OptionalRules.SkipSkill') },
      ];
      const choice = await app._choose(
        `${name} is at level ${cur}. ${game.i18n.localize('TWODSIX.CharGen.OptionalRules.SkillLimits')}`,
        choices
      );

      if (choice === 'ignore') {
        await super._addOrImproveSkill(app, name);
      } else if (choice === 'other') {
        const alts = (alternativeSkills || Array.from(state.skills.keys())).filter(s => s !== name);
        if (alts.length === 0) {
          app._log('Skill Limit', 'No alternative skills available.');
          return;
        }
        const other = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.OptionalRules.PickDifferent'),
          alts.map(s => ({ value: s, label: s }))
        );
        await this._addOrImproveSkill(app, other, alts);
      } else {
        app._log('Skill Limit', `Skipped gaining ${name}`);
      }
    } else {
      await super._addOrImproveSkill(app, name);
    }
  }
}
