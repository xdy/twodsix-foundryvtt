// CharGenUtils.js — Shared utilities used by multiple ruleset logic files
import { LanguageType } from '../../utils/nameGenerator.js';
import { CHARACTERISTIC_KEYS } from './CharGenState.js';
import { ALL_CHAR_OPTS } from './SharedCharGenConstants.js';
import { PackType, resolvePack } from './CharGenPackResolver.js';

const CHAR_LABEL_I18N = {
  str: 'TWODSIX.CharGen.Physical.Strength',
  dex: 'TWODSIX.CharGen.Physical.Dexterity',
  end: 'TWODSIX.CharGen.Physical.Endurance',
  int: 'TWODSIX.CharGen.Mental.Intelligence',
  edu: 'TWODSIX.CharGen.Mental.Education',
  soc: 'TWODSIX.CharGen.Mental.SocialStanding',
};

/**
 * Physical characteristic options for _choose prompts (localized labels).
 * @returns {{ value: string, label: string }[]}
 */
export function localizedPhysicalOpts() {
  return [
    { value: 'str', label: game.i18n.localize(CHAR_LABEL_I18N.str) },
    { value: 'dex', label: game.i18n.localize(CHAR_LABEL_I18N.dex) },
    { value: 'end', label: game.i18n.localize(CHAR_LABEL_I18N.end) },
  ];
}

/**
 * Mental characteristic options for _choose prompts (localized labels).
 * @returns {{ value: string, label: string }[]}
 */
export function localizedMentalOpts() {
  return [
    { value: 'int', label: game.i18n.localize(CHAR_LABEL_I18N.int) },
    { value: 'edu', label: game.i18n.localize(CHAR_LABEL_I18N.edu) },
    { value: 'soc', label: game.i18n.localize(CHAR_LABEL_I18N.soc) },
  ];
}

/**
 * All six characteristics with localized full names (for assignment UIs).
 * @returns {{ value: string, label: string }[]}
 */
export function localizedAllCharOptsForAssignment() {
  return ALL_CHAR_OPTS.map(o => ({
    value: o.value,
    label: game.i18n.localize(CHAR_LABEL_I18N[o.value]),
  }));
}

/**
 * Build choice rows from string values (optional sort).
 * @param {string[]} strings
 * @param {{ sort?: boolean }} [opts]
 * @returns {{ value: string, label: string }[]}
 */
export function optionsFromStrings(strings, { sort = true } = {}) {
  const arr = sort ? [...strings].sort((a, b) => a.localeCompare(b)) : [...strings];
  return arr.map(s => ({ value: s, label: s }));
}

/**
 * Career names as choice rows (sorted).
 * @param {string[]} names
 * @returns {{ value: string, label: string }[]}
 */
export function optionsFromCareerNames(names) {
  return [...names].sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n }));
}

/**
 * Service / specialist / optional advanced education / characteristic +1 menu used by CDEE term skill picks.
 * CE uses a different model (personal development + 1d6 on a column); do not use this for CE.
 * @param {{ edu?: number }} chars
 * @returns {{ value: string, label: string }[]}
 */
export function buildChargenCdeeServiceSpecialistTables(chars) {
  const canAdv = (chars.edu ?? 0) >= 8;
  const tables = [
    { value: 'service', label: game.i18n.localize('TWODSIX.CharGen.Skills.ServiceSkills') },
    { value: 'specialist', label: game.i18n.localize('TWODSIX.CharGen.Skills.SpecialistSkills') },
  ];
  if (canAdv) {
    tables.push({
      value: 'advanced',
      label: game.i18n.format('TWODSIX.CharGen.Skills.AdvancedEducationWithScore', { edu: chars.edu }),
    });
  }
  tables.push({ value: 'char', label: game.i18n.localize('TWODSIX.CharGen.Steps.CDEECharacteristicPlusOne') });
  return tables;
}

/**
 * Same shape as {@link buildChargenCdeeServiceSpecialistTables} for SoC (plain advanced label; characteristic row optional once per term block).
 * @param {{ edu?: number }} chars
 * @param {{ includeCharRow: boolean }} opts
 * @returns {{ value: string, label: string }[]}
 */
export function buildChargenSocServiceSpecialistTables(chars, { includeCharRow }) {
  const tables = [
    { value: 'service', label: game.i18n.localize('TWODSIX.CharGen.Skills.ServiceSkills') },
    { value: 'specialist', label: game.i18n.localize('TWODSIX.CharGen.Skills.SpecialistSkills') },
  ];
  if ((chars.edu ?? 0) >= 8) {
    tables.push({ value: 'advanced', label: game.i18n.localize('TWODSIX.CharGen.Skills.AdvancedEducation') });
  }
  if (includeCharRow) {
    tables.push({ value: 'char', label: game.i18n.localize('TWODSIX.CharGen.SOC.Options.CharacteristicPlus1') });
  }
  return tables;
}

/**
 * First-term filter for CDEE/SOC skill columns: prefer skills still below `cap` when any exist.
 * @param {string[]} skills
 * @param {{ skills: Map<string, number> }} state
 * @param {Record<string, string>} skillNameMap
 * @param {{ cap?: number }} [opts]
 * @returns {string[]}
 */
export function filterChargenSkillColumnUnderCap(skills, state, skillNameMap, { cap = 2 } = {}) {
  const available = skills.filter(skill => {
    const resolved = skillNameMap[skill] ?? skill;
    return (state.skills.get(resolved) ?? -1) < cap;
  });
  return available.length ? available : skills;
}

/**
 * Assign each characteristic in `charOpts` a distinct value from the shrinking `remainingValues` pool.
 * @param {CharGenApp} app
 * @param {{ value: string, label: string }[]} charOpts
 * @param {number[]} remainingValues - mutable copy recommended; values are removed as assigned
 * @param {(opt: { value: string, label: string }, index: number) => string} promptFor - row label for each pick
 */
export async function assignCharacteristicPoolFromChoices(app, charOpts, remainingValues, promptFor) {
  const state = app.charState;
  const values = [...remainingValues];
  for (let i = 0; i < charOpts.length; i++) {
    const opt = charOpts[i];
    const selection = await app._choose(
      promptFor(opt, i),
      values.map(v => ({ value: String(v), label: String(v) })),
      { preserveOptionOrder: true },
    );
    const val = parseInt(selection, 10);
    state.chars[opt.value] = val;
    const idx = values.indexOf(val);
    if (idx !== -1) {
      values.splice(idx, 1);
    }
  }
}

/**
 * @param {Object} state - charState
 * @param {string} skillName
 * @returns {number} Traveller-style level (-1 = untrained UI sentinel)
 */
export function getSkillLevel(state, skillName) {
  return state.skills.has(skillName) ? state.skills.get(skillName) : -1;
}

/**
 * Level after one "improve skill" step (from -1 to 1, else +1).
 * @param {number} current
 * @returns {number}
 */
export function nextLevelAfterImprove(current) {
  return current < 0 ? 1 : current + 1;
}

/**
 * Apply one improve step if the new level would not exceed `max`.
 * @returns {boolean} true if skill was increased
 */
export function improveSkillCappedInState(state, skillName, { max = 3 } = {}) {
  const cur = getSkillLevel(state, skillName);
  const next = nextLevelAfterImprove(cur);
  if (next > max) {
    return false;
  }
  state.skills.set(skillName, next);
  return true;
}

/**
 * Present a gender selection choice.
 * @param {CharGenApp} app
 * @returns {Promise<string>} 'Male', 'Female', or 'Other'
 */
export async function chooseGender(app) {
  return app._choose(game.i18n.localize('TWODSIX.CharGen.Gender.SelectGender'), [
    { value: 'Male', label: game.i18n.localize('TWODSIX.CharGen.Gender.Male') },
    { value: 'Female', label: game.i18n.localize('TWODSIX.CharGen.Gender.Female') },
    { value: 'Other', label: game.i18n.localize('TWODSIX.CharGen.Gender.Other') },
  ]);
}

/**
 * Offer the player a chance to swap two characteristics.
 * Modifies app.charState.chars in place.
 * @param {CharGenApp} app
 */
export async function chooseCharacteristicSwap(app) {
  const swap = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.SwapCharacteristics'), [
    { value: 'yes', label: game.i18n.localize('TWODSIX.CharGen.Options.YesSwapTwoValues') },
    { value: 'no', label: game.i18n.localize('TWODSIX.CharGen.Options.NoKeepAsRolled') },
  ]);
  if (swap !== 'yes') {
    return;
  }
  const state = app.charState;
  const charOpts = CHARACTERISTIC_KEYS.map(k => ({ value: k, label: `${k.toUpperCase()}: ${state.chars[k]}` }));
  const c1 = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.SwapFirstChar'), charOpts, {
    preserveOptionOrder: true,
  });
  const c2 = await app._choose(
    game.i18n.localize('TWODSIX.CharGen.Steps.SwapSecondChar'),
    charOpts.filter(o => o.value !== c1),
    { preserveOptionOrder: true },
  );
  const tmp = state.chars[c1];
  state.chars[c1] = state.chars[c2];
  state.chars[c2] = tmp;
  app._log('Swap', `${c1.toUpperCase()} ↔ ${c2.toUpperCase()}`);
}

/**
 * Present a language selection choice.
 * @param {CharGenApp} app
 */
export async function chooseLanguage(app) {
  const opts = Object.entries(LanguageType).map(([label, value]) => ({ label, value: String(value) }));
  const value = await app._choose(game.i18n.localize('TWODSIX.CharGen.App.Language'), opts);
  if (app.charState) {
    app.charState.languageType = parseInt(value);
  }
}

/**
 * Present a name choice as an editable text field.
 * Dice button generates a random name and continues.
 * @param {CharGenApp} app
 */
export async function chooseName(app) {
  const value = await app._chooseName();
  app.charName = value;
}

/**
 * Ask whether to serve another term in the current career.
 * @param {CharGenApp} app
 * @param {string} careerName
 * @returns {Promise<string>} 'yes' or 'no'
 */
export async function promptContinueInCareer(app, careerName) {
  return app._choose(game.i18n.format('TWODSIX.CharGen.Steps.Reenlistment', { career: careerName }), [
    { value: 'yes', label: game.i18n.localize('TWODSIX.CharGen.Options.YesServeAnother') },
    { value: 'no', label: game.i18n.localize('TWODSIX.CharGen.Options.NoLeave') },
  ]);
}

/**
 * Present a weapon selection choice from the items compendium.
 * Filters weapons by the character's combat skills and optionally by max price.
 * If the character has previously chosen weapons, also offers skill upgrades.
 * @param {CharGenApp} app
 * @param {Object} [opts]
 * @param {number|null} [opts.maxPrice=null] - Maximum weapon price (null for no limit)
 */
export async function chooseWeapon(app, { maxPrice = null } = {}) {
  const state = app.charState;
  const pack = resolvePack(state.ruleset, PackType.ITEMS);
  if (!pack) {
    state.materialBenefits.push('Weapon');
    state.log.push('Material: Weapon (no compendium found)');
    app._log('Benefit', 'Weapon (no compendium found)');
    return;
  }

  const index = await pack.getIndex({ fields: ['system.associatedSkillName', 'system.price'] });

  let weaponDocs = index.filter(i => {
    if (i.type !== 'weapon') {
      return false;
    }
    const skill = i.system?.associatedSkillName || '';
    return skill.includes('Gun Combat') || skill.includes('Melee Combat');
  });

  // Filter by character's combat skills (fall back to all if no matching skills)
  const combatSkills = [...state.skills.keys()].filter(
    s => s.startsWith('Gun Combat') || s.startsWith('Melee Combat'),
  );
  if (combatSkills.length > 0) {
    const parentGroups = [...new Set(combatSkills.map(s => s.split('(')[0].trim()))];
    const filtered = weaponDocs.filter(w => {
      const skill = w.system?.associatedSkillName || '';
      return parentGroups.some(g => skill.includes(g));
    });
    if (filtered.length > 0) {
      weaponDocs = filtered;
    }
  }

  if (maxPrice != null) {
    weaponDocs = weaponDocs.filter(w => (w.system?.price ?? 0) <= maxPrice);
  }

  const options = [];

  // Skill upgrade options for previously chosen weapons
  if (state.chosenWeapons.length > 0) {
    const uniqueSkills = [...new Set(state.chosenWeapons.map(w => w.skill).filter(Boolean))];
    for (const skillName of uniqueSkills) {
      options.push({
        value: `SKILL:${skillName}`,
        label: game.i18n.format('TWODSIX.CharGen.Steps.WeaponSkillPlusOne', { name: skillName }),
      });
    }
  }

  for (const w of weaponDocs) {
    options.push({
      value: `WEAPON:${w._id}`,
      label: game.i18n.format('TWODSIX.CharGen.Steps.WeaponWithName', { name: w.name }),
    });
  }
  options.sort((a, b) => a.label.localeCompare(b.label));

  if (!options.length) {
    state.materialBenefits.push('Weapon');
    state.log.push('Material: Weapon (no matching weapons found)');
    app._log('Benefit', 'Weapon (no matching weapons found)');
    return;
  }

  const choice = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.ChooseWeaponBenefit'), options);

  if (choice.startsWith('SKILL:')) {
    const skillName = choice.substring(6);
    const cur = state.skills.get(skillName) ?? 0;
    state.skills.set(skillName, cur + 1);
    state.materialBenefits.push(`Weapon Skill: ${skillName} +1`);
    state.log.push(`Material: Weapon Skill: ${skillName} +1`);
    app._log('Weapon Skill', `${skillName} +1`);
  } else {
    const weaponId = choice.substring(7);
    const weapon = weaponDocs.find(d => d._id === weaponId);
    if (weapon) {
      const skill = weapon.system?.associatedSkillName || '';
      state.chosenWeapons.push({ id: weapon._id, name: weapon.name, skill });
      state.log.push(`Material: Weapon: ${weapon.name}`);
      app._log('Weapon', weapon.name);
    }
  }
}
