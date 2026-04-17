/**
 * trader-i18n.test.js
 * Verifies that every traderRulesetSource* setting registered by TraderSettings
 * has a corresponding name/hint pair in en.json.
 *
 * The pattern: TraderSettings.registerSettings() iterates TRADER_RULESET_SELECTORS
 * from TraderRulesetRegistry.js and calls stringChoiceSetting() for each.  That helper
 * calls registerSetting() which looks up TWODSIX.Settings.{key}.name and
 * TWODSIX.Settings.{key}.hint in the i18n bundle.  If they're missing, Foundry
 * shows the raw key string in the UI instead of a readable label.
 *
 * This test would have caught the 6 missing keys that existed at the time of writing:
 *   getSearchPenaltyPolicy, resolveEffectiveNegotiatorSkill, normalizeLocalBrokerResult,
 *   shouldResetLocalBrokerOnArrival, getInsolvencyPolicy, resolveLifeSupportPayment.
 */

import { describe, it, expect } from 'vitest';
import { TRADER_RULESET_SELECTORS, traderRulesetSourceSettingKey } from '../../src/module/features/trader/TraderRulesetRegistry.js';
import enJson from '../../static/lang/en.json' with { type: 'json' };

describe('traderRulesetSource i18n coverage', () => {
  const settingsNode = enJson?.TWODSIX?.Settings;
  if (!settingsNode) {
    throw new Error('en.json is missing TWODSIX.Settings — check the JSON structure');
  }

  const selectorMethods = TRADER_RULESET_SELECTORS.map(s => s.method);

  it('TRADER_RULESET_SELECTORS is non-empty', () => {
    expect(selectorMethods.length).toBeGreaterThan(0);
  });

  for (const method of selectorMethods) {
    const key = traderRulesetSourceSettingKey(method);
    const namePath = `TWODSIX.Settings.${key}.name`;
    const hintPath = `TWODSIX.Settings.${key}.hint`;

    it(`${key} has a .name entry in en.json`, () => {
      expect(settingsNode[key], `${namePath} is missing`).toBeDefined();
      expect(settingsNode[key].name, `${namePath} is missing`).toBeTypeOf('string');
      expect(settingsNode[key].name.length, `${namePath} is empty`).toBeGreaterThan(0);
    });

    it(`${key} has a .hint entry in en.json`, () => {
      expect(settingsNode[key], `${hintPath} is missing`).toBeDefined();
      expect(settingsNode[key].hint, `${hintPath} is missing`).toBeTypeOf('string');
      expect(settingsNode[key].hint.length, `${hintPath} is empty`).toBeGreaterThan(0);
    });
  }

  it('every selector method is covered (no extra en.json keys expected)', () => {
    // Collect the set of expected keys from the registry
    const expectedKeys = new Set(selectorMethods.map(m => traderRulesetSourceSettingKey(m)));

    // Find all keys in en.json that match the traderRulesetSource prefix
    const actualKeys = Object.keys(settingsNode).filter(k => k.startsWith('traderRulesetSource'));

    for (const actualKey of actualKeys) {
      expect(expectedKeys.has(actualKey),
        `en.json has "${actualKey}" but TRADER_RULESET_SELECTORS does not generate it. ` +
        'Either add it to TRADER_RULESET_SELECTORS or remove the stale i18n key.'
      ).toBe(true);
    }
  });
});
