// SOCCharGenLogic.js — The Sword of Cepheus character generation logic
import { calcModFor } from '../../../../utils/sheetUtils.js';
import { addSign } from '../../../../utils/utils.js';
import { BaseCharGenLogic, isJoatSkillName } from '../../BaseCharGenLogic.js';
import { clampMusterBenefit1d6, sumCareerMusterRollCountFromCareers } from '../../charGenMusterShared.js';
import { adjustChar, CHARGEN_DIED, ensureChargenOverlay } from '../../CharGenState.js';
import { resolveTraitPackChain } from '../../CharGenPackResolver.js';
import {
  assignCharacteristicPoolFromChoices,
  buildChargenSocServiceSpecialistTables,
  filterChargenSkillColumnUnderCap,
  getSkillLevel,
  localizedAllCharOptsForAssignment,
  localizedPhysicalOpts,
  nextLevelAfterImprove,
  optionsFromCareerNames,
  optionsFromStrings,
} from '../../CharGenUtils.js';
import { formatAutoHandledSuffix, reportAutoHandled, reportSubRow } from '../../EventReport.js';
import {
  SOC_AGING_TABLE,
  SOC_BACKGROUNDS,
  SOC_CASCADE_SKILLS,
  SOC_INJURY_TABLE,
  SOC_LIFE_EVENT_TABLES,
  SOC_MARTIAL_CAREERS,
  SOC_POINT_BUY_MAXIMUM_VALUE,
  SOC_POINT_BUY_MINIMUM_VALUE,
  SOC_POINTBUY_MAX_POINTS,
  SOC_PREREQUISITES,
  SOC_SKILL_NAME_MAP,
  SOC_SKILL_PACKAGES,
  SOC_SORCERY_MISHAP_TABLE,
  SOC_STANDARD_CHARACTERISTIC_ARRAY,
  SOC_STARTING_AGE,
  SOC_TERM_YEARS,
  SOC_UNUSUAL_EVENTS,
} from './SOCCharGenConstants.js';
import { SOC_HUMAN_CAREER_NAMES, SOC_SPECIES_CAREER_NAMES, } from './SOCSpeciesData.js';
import { getSpeciesAgingRollBonus } from '../../speciesProfile.js';
import { loadSpeciesChoicesForRuleset } from '../../SpeciesRegistry.js';

const SOC_MAX_TERMS = 7;

export class SOCCharGenLogic extends BaseCharGenLogic {
  /**
   * Species line for `system.species` when exporting the actor (non-human / revenant only).
   * @param {object} state
   * @returns {string}
   */
  getActorSpeciesLabelForActor(state) {
    if (!state) {
      return '';
    }
    ensureChargenOverlay(state);
    const spec = state.chargenOverlay?.soc?.chargenSpecies;
    if (!spec) {
      return '';
    }
    if (spec.mode === 'human' || spec.mode == null) {
      return '';
    }
    if (spec.mode === 'revenant') {
      return state.chargenOverlay.soc.speciesProfile?.displayName ?? 'Revenant';
    }
    return state.chargenOverlay.soc.speciesProfile?.displayName ?? String(spec.profileId ?? '');
  }

  resetData() {
    super.resetData();
    this.careers = {};
    this.careerNames = [];
    this.agingTable = [];
    this.lifeEventTables = [];
    this.unusualEvents = [];
    this.skillPackages = [];
    this.namedChargenTables = {};
    this.traitPackNames = [];
  }

  _assignRulesetConstants(careers, careerNames, ruleset) {
    this.careers = careers;
    this.careerNames = careerNames;
    this.agingTable = SOC_AGING_TABLE;
    this.lifeEventTables = SOC_LIFE_EVENT_TABLES;
    this.unusualEvents = SOC_UNUSUAL_EVENTS;
    this.skillPackages = SOC_SKILL_PACKAGES;
    this.cascadeSkills = SOC_CASCADE_SKILLS;
    this.skillNameMap = SOC_SKILL_NAME_MAP;
    this.namedChargenTables = {
      sorceryMishap: SOC_SORCERY_MISHAP_TABLE,
    };

    this.traitPackNames = resolveTraitPackChain(ruleset);
  }

  /**
   * @param {string|null|undefined} creationMode
   * @returns {import('../../characteristicsRules.js').CharacteristicsUiRules}
   */
  resolveCharacteristicsUiRules(creationMode) {
    const isPointBuy = creationMode === 'soc-pointbuy';
    return {
      isPointBuy,
      inputMin: isPointBuy ? SOC_POINT_BUY_MINIMUM_VALUE : 1,
      inputMax: isPointBuy ? SOC_POINT_BUY_MAXIMUM_VALUE : 15,
      pointBuyTargetTotal: isPointBuy ? SOC_POINTBUY_MAX_POINTS : null,
    };
  }

  /**
   * @param {Record<string, number>} chars
   * @param {string[]} keys
   * @param {string|null|undefined} creationMode
   */
  async rollPointBuyCharacteristics(chars, keys, creationMode) {
    if (creationMode !== 'soc-pointbuy') {
      return;
    }
    const min = SOC_POINT_BUY_MINIMUM_VALUE;
    const max = SOC_POINT_BUY_MAXIMUM_VALUE;
    const targetTotal = SOC_POINTBUY_MAX_POINTS;
    for (const k of keys) {
      chars[k] = min;
    }
    let remaining = targetTotal - min * keys.length;
    while (remaining > 0) {
      const idx = (await new Roll(`1d${keys.length}`).roll()).total - 1;
      const k = keys[idx];
      if (chars[k] < max) {
        chars[k]++;
        remaining--;
      }
    }
  }

  async run(app) {
    await this.loadData(app.charState.ruleset);
    const state = app.charState;
    state.age = SOC_STARTING_AGE;

    await this.stepSOCIdentity(app);
    await this.stepSOCSpeciesPath(app);
    await this.applySocSpeciesCharacteristicAdjustments(app);
    await this.stepSOCGnomeStartingSpells(app);
    if (this._socUsesBackground(app.charState)) {
      await this.stepBackground(app);
    } else {
      this._logSocSkippedBackground(app);
    }

    const termsToServe = await this.stepTermCount(app);
    let currentCareerName = null;
    let currentCareerRecord = null;

    for (let term = 1; term <= termsToServe; term++) {
      if (!currentCareerName || state.retireFromCareer) {
        state.retireFromCareer = false;
        currentCareerName = await this.stepCareerSelection(app);
        currentCareerRecord = {
          name: currentCareerName,
          terms: 0,
          rank: 0,
          rankTitle: null,
          mishap: false,
          assignment: currentCareerName,
        };
        state.careers.push(currentCareerRecord);
      }

      const career = this.careers[currentCareerName];
      state.totalTerms++;
      state.currentTermInCareer = currentCareerRecord.terms + 1;
      currentCareerRecord.terms++;

      const ageStart = state.age;
      const { termEntry } = this.logTermStart(app, {
        careerName: currentCareerName,
        termInCareer: state.currentTermInCareer,
        totalTerm: state.totalTerms,
        ageStart,
      });

      if (state.totalTerms === 1) {
        await this.stepFirstTermServiceSkills(app, career);
        await this.stepSkillChoices(app, career, 2, { term: state.totalTerms, firstTerm: true });
      } else {
        await this.stepSkillChoices(app, career, state.totalTerms <= 3 ? 2 : 1, { term: state.totalTerms });
      }

      const { event, roll } = await this.stepCareerEvent(app, career, currentCareerName);
      if (event) {
        await this._dispatchEvent(app, event, roll, currentCareerName, termEntry);
      }

      await this.stepAging(app);
      if (state.died) {
        break;
      }
    }

    if (!state.died) {
      await this.stepMusterOutAll(app);
      // SRD: Revenant — apply undead characteristic modifiers after human career and mustering out.
      await this.applySocRevenantPostMusterCharacteristics(app);
      await this.stepSkillPackage(app);
      await this.stepTraitSelection(app, state.totalTerms);
      await this.stepSkillCap(app);
    }
  }

  async stepSOCIdentity(app) {
    const state = app.charState;
    const method = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Steps.CharMethod'),
      [
        { value: 'array', label: game.i18n.localize('TWODSIX.CharGen.SOC.Steps.CharMethodArray') },
        { value: 'roll', label: game.i18n.localize('TWODSIX.CharGen.SOC.Steps.CharMethodRoll') },
        {
          value: 'pointbuy',
          label: game.i18n.format('TWODSIX.CharGen.SOC.Steps.CharMethodPointBuy', { points: SOC_POINTBUY_MAX_POINTS }),
        },
      ],
      { preserveOptionOrder: true },
    );
    state.creationMode = method === 'pointbuy' ? 'soc-pointbuy' : method;
    if (method === 'array') {
      await assignCharacteristicPoolFromChoices(app, localizedAllCharOptsForAssignment(), SOC_STANDARD_CHARACTERISTIC_ARRAY, opt =>
        game.i18n.format('TWODSIX.CharGen.Steps.AssignValueToCharacteristic', { label: opt.label }),
      );
      await this.stepIdentity(app, { characteristicsStep: async () => {} });
      return;
    }
    await this.stepIdentity(app);
  }

  _socSpeciesMode(state) {
    return ensureChargenOverlay(state).soc.chargenSpecies?.mode ?? 'human';
  }

  _socActiveProfile(state) {
    return ensureChargenOverlay(state).soc.speciesProfile ?? undefined;
  }

  _socUsesBackground(state) {
    const m = this._socSpeciesMode(state);
    return m === 'human' || m === 'revenant';
  }

  _socCareerNamePool(state) {
    const m = this._socSpeciesMode(state);
    if (m === 'species_career') {
      const careerName = this._socActiveProfile(state)?.careerName;
      if (careerName) {
        return [careerName];
      }
      return this.careerNames.filter(n => SOC_SPECIES_CAREER_NAMES.has(n));
    }
    return this.careerNames.filter(n => SOC_HUMAN_CAREER_NAMES.has(n));
  }

  async stepSOCSpeciesPath(app) {
    const state = app.charState;
    const mode = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Species.ChooseMode'),
      [
        { value: 'human', label: game.i18n.localize('TWODSIX.CharGen.SOC.Species.ModeHuman') },
        { value: 'species_career', label: game.i18n.localize('TWODSIX.CharGen.SOC.Species.ModeSpeciesCareer') },
        { value: 'hybrid', label: game.i18n.localize('TWODSIX.CharGen.SOC.Species.ModeHybrid') },
        { value: 'revenant', label: game.i18n.localize('TWODSIX.CharGen.SOC.Species.ModeRevenant') },
      ],
      { preserveOptionOrder: true },
    );

    if (mode === 'human') {
      ensureChargenOverlay(state).soc.chargenSpecies = { mode: 'human', profileId: null };
      state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Species.LogHuman'));
      return;
    }

    const packChoices = await loadSpeciesChoicesForRuleset('SOC');

    if (mode === 'revenant') {
      ensureChargenOverlay(state).soc.chargenSpecies = { mode: 'revenant', profileId: 'revenant' };
      const revChoice = packChoices.find(c => c.name === 'Revenant');
      const rev = revChoice ? {
        displayName: revChoice.name,
        agingRollBonus: revChoice.agingRollBonus ?? 0,
        abilityLines: revChoice.abilityLines ?? [],
        careerName: null,
      } : null;
      ensureChargenOverlay(state).soc.speciesProfile = rev ? {
        id: 'revenant',
        displayName: rev.displayName,
        agingRollBonus: rev.agingRollBonus ?? 0,
        abilityLines: rev.abilityLines ?? [],
        centaurStrEndDice: false,
        gnomeStartingSpells: 0,
        careerName: rev.careerName,
      } : null;
      if (revChoice) {
        ensureChargenOverlay(state).soc.species = {
          id: revChoice.id,
          name: revChoice.name,
          packId: revChoice.packId ?? '',
          grantedTraitNames: revChoice.grantedTraitNames ?? [],
        };
      }
      state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Species.LogRevenantIntro'));
      for (const line of rev?.abilityLines ?? []) {
        state.log.push(`  ${line}`);
      }
      return;
    }

    const selectableIds = packChoices.filter(c => c.name !== 'Revenant').map(c => c.id);
    const speciesId = await app._choose(game.i18n.localize('TWODSIX.CharGen.SOC.Species.ChooseSpecies'), [
      ...selectableIds.map(id => {
        const c = packChoices.find(p => p.id === id);
        return { value: id, label: c?.name ?? id };
      }),
    ]);

    const speciesChoice = packChoices.find(c => c.id === speciesId);
    const name = speciesChoice?.name ?? speciesId;
    const chargenExt = speciesChoice?.chargenExtensions ?? {};

    const profileData = {
      id: speciesId,
      displayName: name,
      agingRollBonus: speciesChoice?.agingRollBonus ?? 0,
      abilityLines: speciesChoice?.abilityLines ?? [],
      centaurStrEndDice: !!chargenExt.centaurStrEndDice,
      gnomeStartingSpells: Number(chargenExt.gnomeStartingSpells) || 0,
      careerName: chargenExt.socCareerName ?? null,
    };

    ensureChargenOverlay(state).soc.chargenSpecies = { mode, profileId: speciesId };
    ensureChargenOverlay(state).soc.speciesProfile = profileData;
    ensureChargenOverlay(state).soc.species = {
      id: speciesId,
      name,
      packId: speciesChoice?.packId ?? '',
      grantedTraitNames: speciesChoice?.grantedTraitNames ?? [],
    };

    if (name) {
      state.homeworldDescriptors.push(name);
    }
    state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Species.LogSpeciesHeader', { name }));
    for (const line of (speciesChoice?.abilityLines ?? [])) {
      state.log.push(`  ${line}`);
      ensureChargenOverlay(state).soc.chargenNotes.push(`${name}: ${line}`);
    }
    if (mode === 'hybrid') {
      state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Species.LogHybridTradeoff'));
      ensureChargenOverlay(state).soc.chargenNotes.push(game.i18n.localize('TWODSIX.CharGen.SOC.Species.LogHybridTradeoff'));
    }
  }

  _logSocSkippedBackground(app) {
    const state = app.charState;
    const profile = this._socActiveProfile(state);
    const label = profile?.displayName ?? game.i18n.localize('TWODSIX.CharGen.SOC.Species.NonHuman');
    state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Species.LogNoBackground', { species: label }));
  }

  async applySocSpeciesCharacteristicAdjustments(app) {
    const state = app.charState;
    const mode = this._socSpeciesMode(state);
    if (mode === 'human' || mode === 'revenant') {
      return;
    }
    const profile = this._socActiveProfile(state);
    if (!profile) {
      return;
    }
    if (profile.centaurStrEndDice) {
      const dStr = await app._roll('1d6');
      const dEnd = await app._roll('1d6');
      const overlay = ensureChargenOverlay(state).soc;
      overlay.centaurDice = { str: dStr, end: dEnd };
      state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Species.LogCentaurDice', { dStr, dEnd }));
    }
    state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Species.LogAppliedMods'));
  }

  async applySocRevenantPostMusterCharacteristics(app) {
    const state = app.charState;
    if (this._socSpeciesMode(state) !== 'revenant') {
      return;
    }
    state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Species.LogRevenantMods'));
  }

  async stepSOCGnomeStartingSpells(app) {
    const state = app.charState;
    const profile = this._socActiveProfile(state);
    const n = profile?.gnomeStartingSpells ?? 0;
    if (n <= 0) {
      return;
    }
    const spells = [];
    for (let i = 0; i < n; i++) {
      const label = game.i18n.format('TWODSIX.CharGen.SOC.Species.GnomeSpellPrompt', { current: i + 1, max: n });
      const spellHtml = `<p>${label}</p><input type="text" name="spell" style="width:100%" autofocus />`;
      let spell = '';
      try {
        spell = await foundry.applications.api.DialogV2.prompt({
          window: { title: game.i18n.localize('TWODSIX.CharGen.SOC.Species.GnomeSpellTitle'), icon: 'fa-solid fa-wand-magic-sparkles' },
          content: spellHtml,
          buttons: [
            {
              action: 'ok',
              label: game.i18n.localize('TWODSIX.CharGen.SOC.Species.GnomeSpellOk'),
              callback: (_event, target) => String(target.form.elements.spell?.value ?? '').trim(),
            },
          ],
        });
      } catch {
        spell = '';
      }
      if (spell) {
        spells.push(spell);
      }
    }
    if (!spells.length) {
      const line = game.i18n.localize('TWODSIX.CharGen.SOC.Species.GnomeSpellsDeferred');
      state.log.push(line);
      ensureChargenOverlay(state).soc.chargenNotes.push(line);
      return;
    }
    const line = game.i18n.format('TWODSIX.CharGen.SOC.Species.GnomeSpellsLine', { list: spells.join('; ') });
    state.log.push(line);
    ensureChargenOverlay(state).soc.chargenNotes.push(line);
  }

  async stepBackground(app) {
    const state = app.charState;
    const backgroundName = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Steps.ChooseBackground'),
      SOC_BACKGROUNDS.map(b => ({ value: b.name, label: `${b.name} (${b.skills.join(', ')})` })),
    );
    const background = SOC_BACKGROUNDS.find(b => b.name === backgroundName);
    const skill = await app._choose(
      game.i18n.format('TWODSIX.CharGen.SOC.Steps.BackgroundSkillPick', { background: backgroundName }),
      optionsFromStrings(background.skills),
    );
    await this._addSkillAtLevel(app, skill, 1);
    state.homeworldDescriptors.push(backgroundName);
    const mapped = this.skillNameMap[skill] ?? skill;
    state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.BackgroundSkill', { background: backgroundName, skill: mapped }));
  }

  async stepTermCount(app) {
    const options = [];
    for (let i = 1; i <= SOC_MAX_TERMS; i++) {
      const termWord = game.i18n.localize(i === 1 ? 'TWODSIX.CharGen.TermWord.one' : 'TWODSIX.CharGen.TermWord.many');
      options.push({
        value: String(i),
        label: game.i18n.format('TWODSIX.CharGen.SOC.Steps.TermCountLabel', { n: i, termWord }),
      });
    }
    const selected = await app._choose(game.i18n.localize('TWODSIX.CharGen.SOC.Steps.ChooseTotalTerms'), options, {
      preserveOptionOrder: true,
    });
    return Math.max(1, Math.min(SOC_MAX_TERMS, parseInt(selected, 10) || 1));
  }

  async stepCareerSelection(app) {
    const state = app.charState;
    const mode = this._socSpeciesMode(state);
    const rawPool = this._socCareerNamePool(state);
    const pool = rawPool.filter(name => this.careerNames.includes(name));
    if (mode === 'species_career' && !pool.length) {
      const expected = this._socActiveProfile(state)?.careerName ?? '';
      ui.notifications?.error?.(
        game.i18n.format('TWODSIX.CharGen.SOC.Species.SpeciesCareerMissingFromPack', { career: expected || '?' }),
      );
      throw new Error(`twodsix | SOC chargen: species career "${expected}" not found in loaded careers.`);
    }
    const baseList = pool.length ? pool : this.careerNames;
    const eligible = baseList.filter(name => this._meetsPrerequisite(state, name));
    const pickFrom = eligible.length ? eligible : baseList;
    if (!pickFrom.length) {
      ui.notifications?.error?.(game.i18n.localize('TWODSIX.CharGen.SOC.Species.NoCareersInPool'));
      throw new Error('twodsix | SOC chargen: no careers available for current species rules.');
    }
    const careerName = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Species.ChooseCareer'),
      optionsFromCareerNames(pickFrom),
    );
    if (!state.previousCareers.includes(careerName)) {
      state.previousCareers.push(careerName);
    }
    return careerName;
  }

  _meetsPrerequisite(state, careerName) {
    const prereq = SOC_PREREQUISITES[careerName];
    return !prereq || (state.chars[prereq.char] ?? 0) >= prereq.target;
  }

  async stepFirstTermServiceSkills(app, career) {
    const mainSkill = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Steps.FirstTermServiceSkill'),
      optionsFromStrings(career.service, { sort: false }),
      { preserveOptionOrder: true },
    );
    for (const skill of career.service) {
      await this._addSkillAtLevel(app, skill, skill === mainSkill ? 1 : 0);
    }
    const mappedMain = this.skillNameMap[mainSkill] ?? mainSkill;
    app.charState.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.ServiceSkillsLine', { skill: mappedMain }));
  }

  async stepSkillChoices(app, career, count, { term, firstTerm = false } = {}) {
    let charPickUsed = false;
    for (let i = 0; i < count; i++) {
      const tables = buildChargenSocServiceSpecialistTables(app.charState.chars, { includeCharRow: !charPickUsed });

      const table = await app._choose(
        game.i18n.format('TWODSIX.CharGen.SOC.Steps.SkillChoicePrompt', { term, current: i + 1, total: count }),
        tables,
        { preserveOptionOrder: true },
      );
      if (table === 'char') {
        const key = await app._choose(
          game.i18n.localize('TWODSIX.CharGen.SOC.Steps.IncreaseCharPlus1'),
          localizedAllCharOptsForAssignment(),
          { preserveOptionOrder: true },
        );
        adjustChar(app.charState, key, 1);
        charPickUsed = true;
        app.charState.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.CharPlus1', { char: key.toUpperCase() }));
        continue;
      }

      let skills = [...career[table]];
      if (firstTerm) {
        skills = filterChargenSkillColumnUnderCap(skills, app.charState, this.skillNameMap);
      }
      const tableLabel = tables.find(t => t.value === table)?.label ?? table;
      const skill = await app._choose(
        game.i18n.format('TWODSIX.CharGen.SOC.Steps.ChooseSkillFromTable', { table: tableLabel }),
        optionsFromStrings(skills, { sort: false }),
        { preserveOptionOrder: true },
      );
      const result = await this._addOrImproveSkill(app, skill);
      if (result) {
        app.charState.log.push(
          game.i18n.format('TWODSIX.CharGen.SOC.Logs.GainedSkill', { name: result.name, level: result.level }),
        );
      }
    }
  }

  async stepCareerEvent(app, career, careerName) {
    if (app.autoAll && app._canShowChargenRandomRoll()) {
      const roll = await app._roll('2d6');
      return { roll, event: (career.eventTable || []).find(e => e.roll === roll) };
    }

    const mode = await app._choose(
      game.i18n.format('TWODSIX.CharGen.SOC.Steps.CareerEventPrompt', { career: careerName }),
      [
        { value: 'roll', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.CareerEventRoll') },
        { value: 'select', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.CareerEventSelect') },
      ],
      { preserveOptionOrder: true },
    );

    if (mode !== 'select') {
      const roll = await app._roll('2d6');
      return { roll, event: (career.eventTable || []).find(e => e.roll === roll) };
    }

    const selected = await app._choose(
      game.i18n.format('TWODSIX.CharGen.SOC.Steps.SelectCareerEvent', { career: careerName }),
      [...(career.eventTable || [])]
        .sort((a, b) => a.roll - b.roll)
        .map(event => ({
          value: String(event.roll),
          label: `${event.roll}: ${this._humanizeTaggedDescription(event.description)}`,
        })),
      { preserveOptionOrder: true },
    );
    const roll = parseInt(selected, 10);
    return { roll, event: (career.eventTable || []).find(e => e.roll === roll) };
  }

  async stepAging(app) {
    const state = app.charState;
    state.age += SOC_TERM_YEARS;
    if (state.totalTerms < 4) {
      state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.AgeNow', { age: state.age }));
      return;
    }
    const speciesBonus = getSpeciesAgingRollBonus(this._socActiveProfile(state));
    const roll = await app._roll('2d6');
    const result = roll + speciesBonus - state.totalTerms;
    const speciesDm = speciesBonus
      ? game.i18n.format('TWODSIX.CharGen.SOC.Aging.SpeciesDmSuffix', { dm: addSign(speciesBonus) })
      : '';
    app._log(
      'Aging',
      game.i18n.format('TWODSIX.CharGen.SOC.Aging.LogLine', {
        roll,
        speciesDm,
        terms: state.totalTerms,
        result,
        age: state.age,
      }),
    );
    if (result <= 0) {
      const idx = Math.min(7, Math.max(0, result + 6));
      const entry = this.agingTable[idx];
      if (entry) {
        state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Logs.AgingReduce'));
        await this.applyAgingEntryReductions(app, entry, {
          physPromptFormatKey: 'TWODSIX.CharGen.Aging.ReducePhysicalCharBy',
        });
      }
    }
  }

  async _handleCrisis(app, zeroChars) {
    const state = app.charState;
    const roll = await app._roll('2d6');
    const success = roll >= 6;
    app._log(
      'Aging crisis',
      game.i18n.format('TWODSIX.CharGen.SOC.Logs.AgingCrisisDetail', {
        roll,
        outcome: success
          ? game.i18n.localize('TWODSIX.CharGen.Outcome.Survived')
          : game.i18n.localize('TWODSIX.CharGen.Outcome.Died'),
      }),
    );
    if (success) {
      zeroChars.forEach(c => (state.chars[c] = 1));
      state.retireFromCareer = true;
      state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Logs.SurvivedCrisis'));
    } else {
      state.died = true;
      state.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Logs.DiedCrisis'));
      throw CHARGEN_DIED;
    }
  }

  _humanizeTag(tag) {
    if (tag.startsWith('CHECK:')) {
      const [, skill, target = '8'] = tag.split(':');
      return game.i18n.format('TWODSIX.CharGen.SOC.Tag.CheckLabel', { skill, target });
    }
    if (tag.startsWith('MATERIAL:')) {
      return tag.slice(9);
    }
    if (tag.startsWith('CASH_ROLL:')) {
      return tag.slice(10).replaceAll('*', ' x ') + ' ' + game.i18n.localize('TWODSIX.CharGen.SOC.CurrencyAbbreviation');
    }
    if (tag === 'ALLY') {
      return game.i18n.localize('TWODSIX.CharGen.SOC.Tag.Ally');
    }
    if (tag.startsWith('ALLY:')) {
      return game.i18n.format('TWODSIX.CharGen.SOC.Tag.AllyTyped', { label: tag.slice(6) });
    }
    if (tag.startsWith('ENEMY:')) {
      return game.i18n.format('TWODSIX.CharGen.SOC.Tag.EnemyTyped', { label: tag.slice(6) });
    }
    if (tag === 'LIFE_EVENT') {
      return game.i18n.localize('TWODSIX.CharGen.SOC.Tag.LifeEvent');
    }
    if (tag.startsWith('LIFE_EVENT:')) {
      return game.i18n.format('TWODSIX.CharGen.SOC.Tag.LifeEventTyped', { name: tag.slice(11) });
    }
    if (tag === 'UNUSUAL_EVENT') {
      return game.i18n.localize('TWODSIX.CharGen.SOC.Tag.UnusualEvent');
    }
    if (tag === 'INJURY') {
      return game.i18n.localize('TWODSIX.CharGen.SOC.Tag.Injury');
    }
    if (tag.startsWith('INJURY_WORST_OF')) {
      const n = tag.split(':')[1] || '2';
      return game.i18n.format('TWODSIX.CharGen.Checks.InjuryWorstOfHuman', { n });
    }
    if (tag.startsWith('TABLE_ROLL:')) {
      return game.i18n.format('TWODSIX.CharGen.Checks.TableRollHuman', { id: tag.slice('TABLE_ROLL:'.length) });
    }
    if (tag.startsWith('PICK_CAREER_COLUMN:')) {
      return game.i18n.format('TWODSIX.CharGen.Checks.PickCareerColumnHuman', { column: tag.slice('PICK_CAREER_COLUMN:'.length) });
    }
    if (tag === 'BENEFIT_ROLL') {
      return game.i18n.localize('TWODSIX.CharGen.SOC.Tag.ExtraBenefitRoll');
    }
    if (tag === 'LOSE_BENEFIT_ROLL') {
      return game.i18n.localize('TWODSIX.CharGen.SOC.Tag.LoseBenefitRoll');
    }
    return super._humanizeTag(tag);
  }

  async _applyRulesetTag(app, tag, description, careerName, report = null) {
    const state = app.charState;
    // ALLY / ALLY: / ENEMY / ENEMY: — handled in BaseCharGenLogic._applyCommonTag
    if (tag === 'INJURY') {
      await this.stepInjury(app, careerName, report);
    } else if (tag.startsWith('TABLE_ROLL:')) {
      await this.stepNamedChargenTableRoll(app, tag.slice('TABLE_ROLL:'.length), careerName, report);
    } else if (tag.startsWith('PICK_CAREER_COLUMN:')) {
      await this.stepPickCareerColumnSkill(app, careerName, tag.slice('PICK_CAREER_COLUMN:'.length), report);
    } else if (tag === 'LIFE_EVENT') {
      await this.stepLifeEvent(app, report);
    } else if (tag.startsWith('LIFE_EVENT:')) {
      await this.stepLifeEvent(app, report, tag.slice(11));
    } else if (tag === 'UNUSUAL_EVENT') {
      await this.stepUnusualEvent(app, report);
    } else if (tag === 'BENEFIT_ROLL') {
      state.extraBenefitRolls++;
      reportAutoHandled(report, game.i18n.localize('TWODSIX.CharGen.SOC.Tag.ExtraBenefitRoll'));
    } else if (tag === 'LOSE_BENEFIT_ROLL') {
      const minExtraBenefitRolls = -Math.max(state.totalTerms + state.careers.length, 0);
      state.extraBenefitRolls = Math.max(state.extraBenefitRolls - 1, minExtraBenefitRolls);
      reportAutoHandled(report, game.i18n.localize('TWODSIX.CharGen.SOC.Tag.LoseBenefitRoll'));
    } else if (tag === 'LOSE_ALL_BENEFITS') {
      state.extraBenefitRolls = -Math.max(state.totalTerms + state.careers.length, 0);
      reportAutoHandled(report, game.i18n.localize('TWODSIX.CharGen.SOC.Tag.LoseAllBenefitRolls'));
    } else if (tag.startsWith('BENEFIT_DM:')) {
      const dm = parseInt(tag.split(':')[1], 10) || 0;
      state.benefitDMs.push(dm);
      reportAutoHandled(report, `Benefit DM +${dm}`);
    } else if (tag.startsWith('MATERIAL:')) {
      const material = tag.slice(9);
      state.materialBenefits.push(material);
      reportAutoHandled(report, material);
    } else if (tag.startsWith('CASH_ROLL:')) {
      const amount = await this._rollCashExpression(app, tag.slice(10));
      state.cashBenefits += amount;
      reportAutoHandled(report, `${amount.toLocaleString()} ${game.i18n.localize('TWODSIX.CharGen.SOC.CurrencyAbbreviation')}`);
    } else if (tag === 'PHYS_MINUS2') {
      const key = await app._choose(
        game.i18n.localize('TWODSIX.CharGen.SOC.Tag.InjuryReducePhys2'),
        localizedPhysicalOpts(),
        { preserveOptionOrder: true },
      );
      adjustChar(state, key, -2, { min: 1 });
      reportSubRow(report, `${key.toUpperCase()} -2`);
    } else if (tag === 'STR_MINUS1_AND_END_MINUS1') {
      adjustChar(state, 'str', -1, { min: 0 });
      adjustChar(state, 'end', -1, { min: 0 });
      reportAutoHandled(report, 'STR -1 and END -1');
    } else if (tag === 'SOC_PLUS1') {
      adjustChar(state, 'soc', 1);
      reportAutoHandled(report, 'SOC +1');
      state.log.push('SOC +1.');
    } else if (tag === 'SOC_MINUS1') {
      adjustChar(state, 'soc', -1);
      reportAutoHandled(report, 'SOC −1');
      state.log.push('SOC −1.');
    } else if (tag === 'END_CAREER') {
      state.retireFromCareer = true;
      reportAutoHandled(report, 'Career ends');
      return true;
    } else {
      await this._applyCompoundTag(app, tag, description, careerName, report);
    }
    return false;
  }

  async _applyCompoundTag(app, tag, description, careerName, report) {
    // Prefix-based dispatch
    if (tag.startsWith('INJURY_WORST_OF')) {
      return this._handleTagInjuryWorstOf(app, tag, careerName, report);
    }
    if (tag.startsWith('ALLY_ROLL:')) {
      return this._handleTagAllyRoll(app, tag, report);
    }

    // Exact-match dispatch — prefer a map-based lookup for clarity.
    const handler = SOC_COMPOUND_TAG_HANDLERS[tag];
    if (handler) {
      return handler.call(this, app, tag, description, careerName, report);
    }
  }

  async _handleTagAllyToEnemy(app, _tag, description, _careerName, report) {
    const ally = (app.charState.allies?.length ? app.charState.allies.shift() : null)
      ?? (app.charState.friends?.length ? app.charState.friends.shift() : null);
    const enemy = ally || this._eventPrefix(description) || 'Enemy';
    app.charState.enemies.push(enemy);
    reportAutoHandled(report, ally ? `Ally became Enemy: ${ally}` : `Enemy: ${enemy}`);
  }

  async _handleTagLoseAlly(app, _tag, _description, _careerName, report) {
    const ally = (app.charState.allies?.length ? app.charState.allies.shift() : null)
      ?? (app.charState.friends?.length ? app.charState.friends.shift() : null);
    reportAutoHandled(report, ally ? `Lost Ally: ${ally}` : 'No Ally to lose');
  }

  async _handleTagAllyRoll(app, tag, report) {
    const count = await this._rollExpression(app, tag.slice(11));
    if (!Array.isArray(app.charState.allies)) {
      app.charState.allies = [];
    }
    for (let i = 0; i < count; i++) {
      app.charState.allies.push(`Ally ${app.charState.allies.length + 1}`);
    }
    reportAutoHandled(report, `${count} Allies`);
  }

  async _handleTagStolenGoods(app, _tag, description, careerName, report) {
    const { success } = await this._rollSkillOrCharCheck(app, 'Streetwise', 8);
    await this._addSkillAtLevel(app, 'Streetwise', 1);
    await this._applyRulesetTag(app, success ? 'CASH_ROLL:1d6*10' : 'LOSE_BENEFIT_ROLL', description, careerName, report);
  }

  async _handleTagDuel(app, _tag, description, careerName, report) {
    const { success } = await this._rollSkillOrCharCheck(app, 'Melee Combat', 8);
    await this._applyRulesetTag(app, success ? 'SOC_PLUS1' : 'INJURY', description, careerName, report);
    if (!success) {
      await this._applyRulesetTag(app, 'SOC_MINUS1', description, careerName, report);
    }
    await this.applyEventTags(app, { description: '', effects: [{ connector: 'or', tags: ['SKILL:Battle:1', 'SKILL:Deception:1'] }] }, careerName);
  }

  async _handleTagSlaver(app, _tag, description, careerName, report) {
    const { success } = await this._rollSkillOrCharCheck(app, 'Deception', 8);
    await this._applyRulesetTag(app, success ? 'BENEFIT_ROLL' : 'ENEMY', description, careerName, report);
    await this._applyRulesetTag(app, 'SOC_MINUS1', description, careerName, report);
  }

  async _handleTagCrewThief(app, _tag, description, careerName, report) {
    const { success } = await this._rollSkillOrCharCheck(app, 'Deception', 8);
    await this._applyRulesetTag(app, success ? 'BENEFIT_ROLL' : 'LOSE_BENEFIT_ROLL', description, careerName, report);
    if (!success) {
      await this._applyRulesetTag(app, 'ENEMY', description, careerName, report);
    }
  }

  async _handleTagScholarCrime(app, _tag, description, careerName, report) {
    const skill = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Steps.ChooseCriminalWorkCheck'),
      optionsFromStrings(['Insight', 'Healing', 'Natural Philosophy']),
    );
    const { success } = await this._rollSkillOrCharCheck(app, skill, 8);
    if (success) {
      await this._addOrImproveSkill(app, skill);
      await this._applyRulesetTag(app, 'CASH_ROLL:1d6*10', description, careerName, report);
    } else {
      await this._applyRulesetTag(app, 'LOSE_BENEFIT_ROLL', description, careerName, report);
      await this._applyRulesetTag(app, 'ENEMY', description, careerName, report);
    }
  }

  async _handleTagInjuryWorstOf(app, tag, careerName, report) {
    const n = Math.max(2, parseInt(tag.split(':')[1], 10) || 2);
    await this.stepInjuryPickWorstOfN(app, careerName, n, report);
  }

  /**
   * Multi-tag compound handler: each child tag is dispatched through
   * {@link #_applySingleTag} so characteristic, skill, social, and muster tags are
   * all resolved by the existing ruleset pipeline.
   */
  async _handleCompoundTagExpansion(app, _tag, description, careerName, report, childTags, eventCtx = {}) {
    for (const childTag of childTags) {
      await this._applySingleTag(app, childTag, description, careerName, report, eventCtx);
    }
  }

  _eventPrefix(description) {
    const first = String(description || '').split('.')[0];
    return this._humanizeTaggedDescription(first).replace(/\s+/g, ' ').trim();
  }

  async _rollSocInjuryOutcome(app, careerName) {
    const state = app.charState;
    const roll = await app._roll('2d6');
    const endMod = calcModFor(state.chars.end ?? 0);
    const martialPenalty = SOC_MARTIAL_CAREERS.has(careerName) ? -1 : 0;
    const total = roll + endMod + martialPenalty;
    const effect = total - 8;
    const entry = SOC_INJURY_TABLE.find(e => effect >= e.min && effect <= e.max) || SOC_INJURY_TABLE.at(-1);
    const summary = `2D6(${roll})${addSign(endMod)}(END)${addSign(martialPenalty)}=${total}; Effect ${addSign(effect)} -> ${entry.description}`;
    return { roll, total, effect, entry, summary };
  }

  async _applySocInjuryEntry(app, entry, careerName, parentReport = null, eventCtx = {}) {
    const state = app.charState;
    app._log('Injury', entry.description);
    state.log.push(`Injury: ${entry.description}`);
    reportSubRow(parentReport, `Injury: ${entry.description}`);
    for (const t of entry.effects) {
      await this._applySingleTag(app, t, entry.description, careerName, parentReport, eventCtx);
    }
    await this.checkCrisis(app);
  }

  async stepInjury(app, careerName, parentReport = null) {
    const o = await this._rollSocInjuryOutcome(app, careerName);
    app._log('Injury', o.summary);
    await this._applySocInjuryEntry(app, o.entry, careerName, parentReport);
  }

  /** Roll injury N times, then apply the worse outcome (lower effect band = worse). */
  async stepInjuryPickWorstOfN(app, careerName, n, parentReport = null) {
    const outcomes = [];
    for (let i = 0; i < n; i++) {
      outcomes.push(await this._rollSocInjuryOutcome(app, careerName));
    }
    let worstIdx = 0;
    for (let i = 1; i < outcomes.length; i++) {
      if (outcomes[i].effect < outcomes[worstIdx].effect) {
        worstIdx = i;
      }
    }
    const labels = outcomes.map((o, i) => ({
      value: String(i),
      label: game.i18n.format('TWODSIX.CharGen.Checks.InjuryWorstOption', { index: i + 1, desc: o.entry.description }),
    }));
    const chosen = await app._choose(game.i18n.localize('TWODSIX.CharGen.Checks.InjuryWorstPrompt'), labels, {
      preserveOptionOrder: true,
    });
    const idx = parseInt(chosen, 10);
    const pick = outcomes[Number.isFinite(idx) && outcomes[idx] ? idx : worstIdx];
    for (const o of outcomes) {
      app.charState.log.push(`Injury roll option: ${o.summary}`);
      reportSubRow(parentReport, `Option: ${o.entry.description}`);
    }
    app._log('Injury (worst of N)', pick.summary);
    await this._applySocInjuryEntry(app, pick.entry, careerName, parentReport);
  }

  async stepNamedChargenTableRoll(app, tableId, careerName, parentReport = null) {
    const rows = this.namedChargenTables?.[tableId];
    if (!rows?.length) {
      ui.notifications?.warn?.(game.i18n.format('TWODSIX.CharGen.Checks.NamedTableMissing', { id: tableId }));
      return;
    }
    const roll = await app._roll('2d6');
    const row = rows.find(r => r.roll === roll) || rows.find(r => r.roll === 7) || rows[0];
    const report = await this.applyEventTags(app, row, careerName);
    const headline = this._humanizeTaggedDescription(row.description);
    const line = game.i18n.format('TWODSIX.CharGen.Checks.NamedTableLine', { id: tableId, roll, headline });
    app.charState.log.push(line);
    reportSubRow(parentReport, line);
    if (!report.allAutoHandled) {
      for (const subRow of report.subRows) {
        reportSubRow(parentReport, `  ${subRow}`);
        app.charState.log.push(`  ${subRow}`);
      }
    }
  }

  async stepPickCareerColumnSkill(app, careerName, columnKey, parentReport = null) {
    const career = this.careers[careerName];
    const col = career?.[columnKey];
    if (!career || !Array.isArray(col) || !col.length) {
      ui.notifications?.warn?.(game.i18n.format('TWODSIX.CharGen.Checks.CareerColumnMissing', { career: careerName, column: columnKey }));
      return;
    }
    const skill = await app._choose(
      game.i18n.format('TWODSIX.CharGen.Checks.PickCareerColumn', { column: columnKey }),
      optionsFromStrings(col, { sort: false }),
      { preserveOptionOrder: true },
    );
    const result = await this._addOrImproveSkill(app, skill);
    if (result) {
      const msg = `${columnKey}: ${result.name}-${result.level}`;
      app.charState.log.push(msg);
      reportAutoHandled(parentReport, msg);
    }
  }

  async stepLifeEvent(app, parentReport = null, forcedTable = null) {
    const tableName =
      forcedTable ||
      (await app._choose(
        game.i18n.localize('TWODSIX.CharGen.SOC.Steps.ChooseLifeEventTable'),
        this.lifeEventTables.map(t => ({ value: t.name, label: t.name })),
        { preserveOptionOrder: true },
      ));
    const table = this.lifeEventTables.find(t => t.name === tableName) || this.lifeEventTables[0];
    const roll = await app._roll('2d6');
    const event = table.events.find(e => e.roll === roll);
    if (event) {
      const report = await this._resolveEvent(app, event, '');
      const headline = this._formatEventHeadline(event, report);
      const line = game.i18n.format('TWODSIX.CharGen.SOC.Logs.LifeEventLine', {
        table: table.name,
        roll,
        headline,
      });
      reportSubRow(parentReport, line);
      app.charState.log.push(line);
      for (const subRow of report.subRows) {
        reportSubRow(parentReport, `  ${subRow}`);
        app.charState.log.push(`  ${subRow}`);
      }
    }
  }

  async stepUnusualEvent(app, parentReport = null) {
    const roll = await app._roll('2d6');
    const event = this.unusualEvents.find(e => e.roll === roll);
    if (event) {
      const report = await this._resolveEvent(app, event, '');
      const headline = this._formatEventHeadline(event, report);
      const line = game.i18n.format('TWODSIX.CharGen.SOC.Logs.UnusualEventLine', { roll, headline });
      reportSubRow(parentReport, line);
      app.charState.log.push(line);
      for (const subRow of report.subRows) {
        reportSubRow(parentReport, `  ${subRow}`);
        app.charState.log.push(`  ${subRow}`);
      }
    }
  }

  async _dispatchEvent(app, event, rollResult, careerName, termEntry) {
    const report = await this._resolveEvent(app, event, careerName);
    const cleanHeadline = this._formatEventHeadline(event, report);
    app._log(game.i18n.format('TWODSIX.CharGen.SOC.Logs.EventShortLabel', { roll: rollResult }), cleanHeadline);
    app.charState.log.push(
      game.i18n.format('TWODSIX.CharGen.SOC.Logs.EventLine', { roll: rollResult, text: cleanHeadline }),
    );
    termEntry.events.push(cleanHeadline);
    if (!report.allAutoHandled) {
      for (const row of report.subRows) {
        termEntry.events.push(`  ${row}`);
      }
    }
  }

  _formatEventHeadline(_event, report) {
    return report.allAutoHandled
      ? `${report.headline}${formatAutoHandledSuffix(report)}`
      : report.headline;
  }

  async stepMusterOutAll(app) {
    const state = app.charState;
    let totalRolls = sumCareerMusterRollCountFromCareers(state);
    totalRolls += state.extraBenefitRolls;
    totalRolls = Math.max(0, totalRolls);
    state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.MusterHeader', { n: totalRolls }));

    const raisedByBenefit = new Set();
    for (let i = 0; i < totalRolls; i++) {
      const careerRecord = await this._chooseMusterCareer(app);
      const career = this.careers[careerRecord.name];
      const options = [
        { value: 'cash', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.MusterCash') },
        { value: 'material', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.MusterMaterial') },
        { value: 'skill', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.MusterSkill') },
      ];
      const choice = await app._choose(
        game.i18n.format('TWODSIX.CharGen.SOC.Muster.BenefitPrompt', { current: i + 1, total: totalRolls }),
        options,
        { preserveOptionOrder: true },
      );
      if (choice === 'skill') {
        await this.stepBenefitSkill(app, raisedByBenefit);
        continue;
      }

      const dm = state.benefitDMs.length ? state.benefitDMs.shift() : 0;
      const roll = await app._roll('1d6');
      const finalRoll = clampMusterBenefit1d6(roll, dm);
      if (choice === 'cash') {
        const amount = career.cash[finalRoll - 1] ?? 0;
        state.cashBenefits += amount;
        state.log.push(
          game.i18n.format('TWODSIX.CharGen.SOC.Logs.MusterCashLine', {
            roll,
            dm: addSign(dm),
            amount: amount.toLocaleString(),
            currency: game.i18n.localize('TWODSIX.CharGen.SOC.CurrencyAbbreviation'),
          }),
        );
      } else {
        const benefit = career.material[finalRoll - 1];
        await this.applySharedMaterialBenefit(app, benefit, 'silent');
        state.log.push(
          game.i18n.format('TWODSIX.CharGen.SOC.Logs.MusterMaterialLine', {
            roll,
            dm: addSign(dm),
            benefit,
          }),
        );
      }
    }
  }

  async _chooseMusterCareer(app) {
    const careers = app.charState.careers.filter(c => c.terms > 0);
    if (careers.length === 1) {
      return careers[0];
    }
    const selected = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Muster.ChooseCareer'),
      careers.map((career, idx) => ({
        value: String(idx),
        label: game.i18n.format('TWODSIX.CharGen.SOC.Muster.CareerOption', { name: career.name, terms: career.terms }),
      })),
      { preserveOptionOrder: true },
    );
    return careers[parseInt(selected, 10) || 0] || careers[0];
  }

  async stepBenefitSkill(app, raisedByBenefit) {
    const available = this._allKnownSkills().filter(skill => !raisedByBenefit.has(skill));
    if (!available.length) {
      app.charState.log.push(game.i18n.localize('TWODSIX.CharGen.SOC.Logs.BenefitSkillUnavailable'));
      return;
    }
    const skill = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Muster.BenefitSkillPrompt'),
      optionsFromStrings(available),
    );
    const resolved = await this._resolveSkillName(app, skill);
    await this.improveSkill(app, resolved);
    raisedByBenefit.add(resolved);
    app.charState.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.BenefitSkillLine', { skill: resolved }));
  }

  async stepSkillPackage(app) {
    const packageName = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.SOC.Muster.SkillPackageTitle'),
      [
        { value: 'none', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.SkillPackageNone') },
        ...this.skillPackages.map(pkg => ({ value: pkg.name, label: pkg.name })),
      ],
      { preserveOptionOrder: true },
    );
    if (packageName === 'none') {
      return;
    }
    const pkg = this.skillPackages.find(p => p.name === packageName);
    const skill = await app._choose(
      game.i18n.format('TWODSIX.CharGen.SOC.Muster.SkillPackagePick', { pack: packageName }),
      optionsFromStrings(pkg.skills, { sort: false }),
      { preserveOptionOrder: true },
    );
    await this._addSkillAtLevel(app, skill, 1);
    app.charState.log.push(
      game.i18n.format('TWODSIX.CharGen.SOC.Logs.SkillPackageLine', { pack: packageName, skill }),
    );
  }

  async stepTraitSelection(app, totalTerms) {
    const state = app.charState;
    const mode = this._socSpeciesMode(state);
    const baseTraits = Math.ceil(totalTerms / 2);
    const numTraits = mode === 'human' || mode === 'revenant' ? baseTraits : Math.max(0, baseTraits - 1);
    if (numTraits <= 0) {
      return;
    }

    const available = [];
    for (const packName of this.traitPackNames) {
      const pack = game.packs.get(packName);
      if (pack) {
        const docs = await pack.getDocuments();
        available.push(...docs.filter(d => d.type === 'trait'));
      }
    }

    // Deduplicate by name
    const uniqueAvailable = [];
    const names = new Set();
    for (const t of available) {
      if (!names.has(t.name)) {
        uniqueAvailable.push(t);
        names.add(t.name);
      }
    }
    uniqueAvailable.sort((a, b) => a.name.localeCompare(b.name));

    const options = [
      ...uniqueAvailable.map(t => ({ value: t.name, label: t.name })),
      { value: 'enter-later', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.TraitEnterLater') },
    ];

    for (let i = 0; i < numTraits; i++) {
      const traitName = await app._choose(
        game.i18n.format('TWODSIX.CharGen.SOC.Traits.SelectPrompt', { current: i + 1, total: numTraits }),
        options,
        { preserveOptionOrder: true },
      );
      if (traitName === 'enter-later') {
        state.traits.push('Trait to choose');
      } else {
        state.traits.push(traitName);
        app._log(game.i18n.localize('TWODSIX.CharGen.SOC.Logs.Trait'), traitName);
        state.log.push(game.i18n.format('TWODSIX.CharGen.SOC.Logs.TraitSelected', { name: traitName }));
      }
    }
  }

  async stepSkillCap(app) {
    const state = app.charState;
    const cap = (state.chars.int ?? 0) + (state.chars.edu ?? 0);
    let total = this._positiveSkillTotal(state);
    while (total > cap) {
      const reducible = [...state.skills.entries()]
        .filter(([, level]) => level > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([skill, level]) => ({ value: skill, label: `${skill}-${level}` }));
      const skill = await app._choose(
        game.i18n.format('TWODSIX.CharGen.SOC.SkillCap.ReducePrompt', { cap, total }),
        reducible,
        { preserveOptionOrder: true },
      );
      state.skills.set(skill, Math.max(0, (state.skills.get(skill) ?? 0) - 1));
      total = this._positiveSkillTotal(state);
    }
  }

  _positiveSkillTotal(state) {
    return [...state.skills.values()].reduce((acc, level) => acc + Math.max(0, level), 0);
  }

  _allKnownSkills() {
    const skills = new Set();
    for (const career of Object.values(this.careers)) {
      for (const skill of [...(career.service || []), ...(career.specialist || []), ...(career.advanced || [])]) {
        skills.add(this.skillNameMap[skill] ?? skill);
      }
    }
    return [...skills];
  }

  async _rollCashExpression(app, expression) {
    if (expression === '1d6*10') {
      return (await app._roll('1d6')) * 10;
    }
    if (expression === '1d6*100') {
      return (await app._roll('1d6')) * 100;
    }
    return 0;
  }

  async _rollExpression(app, expression) {
    if (expression === '1d3+1') {
      return (await app._roll('1d3')) + 1;
    }
    return await app._roll(expression);
  }

  async _addOrImproveSkill(app, rawName) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return null;
    }
    if (isJoatSkillName(name)) {
      app.charState.joat = Math.max(app.charState.joat ?? 0, 1);
      return { name, level: app.charState.joat };
    }
    const cur = getSkillLevel(app.charState, name);
    const level = nextLevelAfterImprove(cur);
    app.charState.skills.set(name, level);
    return { name, level };
  }
}

/**
 * Map of SOC compound tag name → handler method.
 * Multi-tag entries (ALLY_AND_LOSE_BENEFIT, ENEMY_AND_BENEFIT, etc.) expand through
 * {@link SOCCharGenLogic#_handleCompoundTagExpansion} which re-dispatches each child tag
 * through the full {@link BaseCharGenLogic#_applySingleTag} pipeline.
 * Single-tag entries (STR_MINUS1, DEX_MINUS1, INT_MINUS1, END_MINUS1, EDU_PLUS2)
 * are handled by {@link BaseCharGenLogic#_applyCharacteristicTag} and do not need
 * entries here.
 */
const SOC_COMPOUND_TAG_HANDLERS = Object.freeze({
  ALLY_TO_ENEMY: SOCCharGenLogic.prototype._handleTagAllyToEnemy,
  LOSE_ALLY: SOCCharGenLogic.prototype._handleTagLoseAlly,
  STOLEN_GOODS: SOCCharGenLogic.prototype._handleTagStolenGoods,
  DUEL: SOCCharGenLogic.prototype._handleTagDuel,
  SLAVER: SOCCharGenLogic.prototype._handleTagSlaver,
  CREW_THIEF: SOCCharGenLogic.prototype._handleTagCrewThief,
  SCHOLAR_CRIME: SOCCharGenLogic.prototype._handleTagScholarCrime,
  ALLY_AND_LOSE_BENEFIT: function _compound(app, tag, description, careerName, report) {
    return this._handleCompoundTagExpansion(app, tag, description, careerName, report, ['ALLY', 'LOSE_BENEFIT_ROLL']);
  },
  ENEMY_AND_BENEFIT: function _compound(app, tag, description, careerName, report) {
    return this._handleCompoundTagExpansion(app, tag, description, careerName, report, ['ENEMY', 'BENEFIT_ROLL']);
  },
  BENEFIT_ROLL_AND_ENEMY: function _compound(app, tag, description, careerName, report) {
    return this._handleCompoundTagExpansion(app, tag, description, careerName, report, ['BENEFIT_ROLL', 'ENEMY']);
  },
  INJURY_AND_ENEMY: function _compound(app, tag, description, careerName, report) {
    return this._handleCompoundTagExpansion(app, tag, description, careerName, report, ['INJURY', 'ENEMY']);
  },
  LOSE_BENEFIT_AND_SOC: function _compound(app, tag, description, careerName, report) {
    return this._handleCompoundTagExpansion(app, tag, description, careerName, report, ['LOSE_BENEFIT_ROLL', 'SOC_PLUS1']);
  },
  SOC_PLUS1_AND_ENEMY: function _compound(app, tag, description, careerName, report) {
    return this._handleCompoundTagExpansion(app, tag, description, careerName, report, ['SOC_PLUS1', 'ENEMY']);
  },
});
