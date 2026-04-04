// CharGenUtils.js — Shared utilities used by multiple ruleset logic files
import { LanguageType } from '../../utils/nameGenerator.js';
import { CHARACTERISTIC_KEYS } from './CharGenState.js';

/**
 * Present a gender selection choice.
 * @param {CharGenApp} app
 * @returns {Promise<string>} 'Male', 'Female', or 'Other'
 */
export async function chooseGender(app) {
  return app._choose('Select Gender', [
    { value: 'Male',   label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other',  label: 'Other' },
  ]);
}

/**
 * Offer the player a chance to swap two characteristics.
 * Modifies app.charState.chars in place.
 * @param {CharGenApp} app
 */
export async function chooseCharacteristicSwap(app) {
  const swap = await app._choose(
    'Swap two characteristics?',
    [
      { value: 'yes', label: 'Yes — swap two values' },
      { value: 'no',  label: 'No — keep as rolled' },
    ]
  );
  if (swap !== 'yes') {
    return;
  }
  const state = app.charState;
  const charOpts = CHARACTERISTIC_KEYS.map(k => ({ value: k, label: `${k.toUpperCase()}: ${state.chars[k]}` }));
  const c1 = await app._choose('Swap: first characteristic', charOpts);
  const c2 = await app._choose('Swap: second characteristic', charOpts.filter(o => o.value !== c1));
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
  const opts = Object.entries(LanguageType)
    .map(([label, value]) => ({ label, value: String(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const value = await app._choose('Language', opts);
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
 * Present a weapon selection choice from the items compendium.
 * Filters weapons by the character's combat skills and optionally by max price.
 * If the character has previously chosen weapons, also offers skill upgrades.
 * @param {CharGenApp} app
 * @param {Object} [opts]
 * @param {number|null} [opts.maxPrice=null] - Maximum weapon price (null for no limit)
 */
export async function chooseWeapon(app, { maxPrice = null } = {}) {
  const state = app.charState;
  const packName = `twodsix.${state.ruleset.toLowerCase()}-srd-items`;
  const pack = game.packs.get(packName) || game.packs.get('twodsix.ce-srd-items');
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
    s => s.startsWith('Gun Combat') || s.startsWith('Melee Combat')
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
      options.push({ value: `SKILL:${skillName}`, label: `Skill: ${skillName} +1` });
    }
  }

  for (const w of weaponDocs) {
    options.push({ value: `WEAPON:${w._id}`, label: `Weapon: ${w.name}` });
  }
  options.sort((a, b) => a.label.localeCompare(b.label));

  if (!options.length) {
    state.materialBenefits.push('Weapon');
    state.log.push('Material: Weapon (no matching weapons found)');
    app._log('Benefit', 'Weapon (no matching weapons found)');
    return;
  }

  const choice = await app._choose('Choose weapon benefit', options);

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
