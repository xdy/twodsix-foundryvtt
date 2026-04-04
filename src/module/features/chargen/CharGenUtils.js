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
