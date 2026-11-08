import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let TravellerData;
let parseLocaleNumber;
let parseStrictLocaleNumber;
let migrateStringToNumber;
let updateFinances;

vi.mock('../../src/module/data/actors/character-base.js', () => ({
  TwodsixActorBaseData: class {
    static migrateData(source) {
      return source;
    }
  }
}));

function mergeObject(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] ??= {};
      mergeObject(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

beforeAll(async () => {
  vi.stubGlobal('foundry', {
    data: {fields: {}},
    utils: {mergeObject, isEmpty: value => !value || Object.keys(value).length === 0}
  });
  vi.stubGlobal('game', {i18n: {lang: 'en'}});
  ({TravellerData} = await import('../../src/module/data/actors/travellerData.js'));
  ({parseLocaleNumber, parseStrictLocaleNumber, migrateStringToNumber} = await import('../../src/module/data/commonSchemaUtils.js'));
  ({updateFinances} = await import('../../src/module/hooks/updateFinances.js'));
});

beforeEach(() => {
  game.i18n.lang = 'en';
});

afterAll(() => vi.unstubAllGlobals());

function updateCash(currentValue, currentText, input) {
  const actor = {
    type: 'traveller',
    system: {financeValues: {cash: currentValue}, finances: {cash: currentText}}
  };
  const update = {system: {finances: {cash: input}}};
  updateFinances(actor, update, {finances: {cash: input}, financeValues: {}});
  return update.system;
}

describe('localized finance round trips', () => {
  for (const locale of ['en', 'de', 'es', 'fr', 'sv', 'ru']) {
    it(`round-trips values and signed deltas in ${locale}`, () => {
      game.i18n.lang = locale;
      const localized = new Intl.NumberFormat(locale).format(600000);
      const parsed = TravellerData.getParsedFinanceText(`${localized} Cr`);
      expect(parseLocaleNumber(parsed.num)).toBe(600000);
      expect(parseStrictLocaleNumber(parsed.num)).toBe(600000);
      expect(updateCash(0, '0', `${localized} Cr`).financeValues.cash).toBe(600000);

      const decimal = new Intl.NumberFormat(locale).format(1234.5);
      expect(parseLocaleNumber(decimal)).toBe(1234.5);
      expect(parseStrictLocaleNumber(decimal)).toBe(1234.5);
      expect(updateCash(100, '100 Cr', `+${decimal} Cr`).financeValues.cash).toBe(1334.5);
      expect(updateCash(100, '100 Cr', '-150 Cr').financeValues.cash).toBe(-50);

      const negative = TravellerData.convertNumberToFormattedText(-50, 'Cr');
      expect(TravellerData.getParsedFinanceText(negative)).toBeDefined();
    });
  }
});

describe('finance parsing', () => {
  it.each([' ', '\u00a0', '\u202f'])('accepts Swedish grouping space %j', space => {
    game.i18n.lang = 'sv';
    const result = updateCash(600000, '600 000', `600${space}000 Cr`);
    expect(result.financeValues.cash).toBe(600000);
  });

  it.each(['\t', '\n'])('rejects whitespace %j inside a grouped number', space => {
    game.i18n.lang = 'sv';
    expect(TravellerData.getParsedFinanceText(`600${space}000 Cr`)).toBeUndefined();
  });

  it.each([
    ['100 Cr', ''],
    ['+Cr 100', '+'],
    ['-100 Cr', '-'],
    ['−100 Cr', '-']
  ])('returns the normalized sign for %s', (input, sign) => {
    const parsed = TravellerData.getParsedFinanceText(input);
    expect(parsed.sign).toBe(sign);
    expect(parsed).not.toHaveProperty('pre');
  });

  it.each(['1..2', '1e3', '12,34', '1,234,56', '1,234.5.6'])(
    'rejects malformed English input %s',
    input => {
      expect(TravellerData.getParsedFinanceText(`${input} Cr`)).toBeUndefined();
      expect(parseStrictLocaleNumber(input)).toBeNaN();
    }
  );

  it('supports legacy currency prefixes and non-ASCII or punctuated suffixes', () => {
    expect(TravellerData.getParsedFinanceText('Cr 1,000').num).toBe('1,000');
    expect(TravellerData.getParsedFinanceText('100 crédits/an').units).toBe('crédits/an');
    expect(updateCash(50, '50 Cr', '+Cr 100').financeValues.cash).toBe(150);
  });
});

describe('finance formatting', () => {
  it('displays a small balance in a smaller unit instead of rounding to zero', () => {
    expect(TravellerData.convertNumberToFormattedText(0.1, 'MCr')).toBe('0.1 Cr');
    expect(TravellerData.convertNumberToFormattedText(1e-10, 'Cr')).toBe('0.0000000001 Cr');
    expect(TravellerData.convertNumberToFormattedText(0, 'MCr')).toBe('0 MCr');
  });
});

describe('numeric migration parsing', () => {
  it('keeps shared numeric migration working with localized numbers', () => {
    game.i18n.lang = 'es';
    const source = {price: '600.000,5'};
    migrateStringToNumber(source, 'price');
    expect(source.price).toBe(600000.5);
  });

  it('preserves permissive numeric parsing for legacy migrations', () => {
    const source = {price: '1e3 Cr', weight: '12.5 tons'};
    migrateStringToNumber(source, 'price');
    migrateStringToNumber(source, 'weight');
    expect(source).toEqual({price: 1000, weight: 12.5});
  });

  it('distinguishes permissive legacy parsing from strict validation', () => {
    expect(parseLocaleNumber('1,23 Cr')).toBe(123);
    expect(parseStrictLocaleNumber('1,23 Cr')).toBeNaN();
    expect(parseLocaleNumber('1e3')).toBe(1000);
    expect(parseStrictLocaleNumber('1e3')).toBeNaN();
    expect(parseLocaleNumber('')).toBeNaN();
    expect(parseStrictLocaleNumber('')).toBeNaN();
  });
});

describe('finance updates', () => {
  it('recognizes the Swedish minus sign as a delta', () => {
    game.i18n.lang = 'sv';
    expect(updateCash(100, '100 Cr', '−150 Cr').financeValues.cash).toBe(-50);
  });

  it('retains the current units for an unqualified delta', () => {
    const result = updateCash(2000000, '2 MCr', '+1000');
    expect(result.financeValues.cash).toBe(2001000);
    expect(result.finances.cash).toBe('2.001 MCr');
  });

  it('drops invalid direct updates rather than persisting inconsistent text', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = updateCash(100, '100 Cr', '1..2 Cr');
      expect(result.finances.cash).toBeUndefined();
      expect(result.financeValues.cash).toBeUndefined();
      expect(warning).toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it('only changes finance fields present in the diff', () => {
    const actor = {
      type: 'traveller',
      system: {financeValues: {cash: 100, debt: 200}, finances: {cash: '100 Cr', debt: '200 Cr'}}
    };
    const update = {system: {finances: {cash: '+10', debt: '200 Cr', 'financial-notes': 'notes'}}};
    updateFinances(actor, update, {finances: {cash: '+10', 'financial-notes': 'notes'}, financeValues: {}});
    expect(update.system.financeValues).toEqual({cash: 110});
    expect(update.system.finances.debt).toBe('200 Cr');
    expect(update.system.finances['financial-notes']).toBe('notes');
  });

  it('rejects deltas whose result overflows', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = updateCash(1e308, '0', `+${'1' + '0'.repeat(308)}`);
      expect(result.finances.cash).toBeUndefined();
      expect(result.financeValues.cash).toBeUndefined();
      expect(warning).toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it('updates formatted text when numeric finance values change', () => {
    const actor = {
      type: 'traveller',
      system: {financeValues: {cash: 1000000}, finances: {cash: '1 MCr'}}
    };
    const update = {system: {financeValues: {cash: 0.1}}};
    updateFinances(actor, update, {finances: {}, financeValues: {cash: 0.1}});
    expect(update.system.finances.cash).toBe('0.1 Cr');
  });

  it('synchronizes different text and numeric fields in the same update', () => {
    const actor = {
      type: 'traveller',
      system: {financeValues: {cash: 100, debt: 200}, finances: {cash: '100 Cr', debt: '200 Cr'}}
    };
    const update = {system: {finances: {cash: '+10'}, financeValues: {debt: 250}}};
    updateFinances(actor, update, {finances: {cash: '+10'}, financeValues: {debt: 250}});
    expect(update.system.financeValues).toEqual({cash: 110, debt: 250});
    expect(update.system.finances).toEqual({cash: '110 Cr', debt: '250 Cr'});
  });

  it('prioritizes changed text over an explicitly supplied value for the same field', () => {
    const actor = {
      type: 'traveller',
      system: {financeValues: {cash: 100}, finances: {cash: '100 Cr'}}
    };
    const update = {system: {finances: {cash: '+10'}, financeValues: {cash: 500}}};
    updateFinances(actor, update, {finances: {cash: '+10'}, financeValues: {cash: 500}});
    expect(update.system.financeValues.cash).toBe(110);
    expect(update.system.finances.cash).toBe('110 Cr');
  });

  it('synchronizes a numeric update when only financial notes changed', () => {
    const actor = {
      type: 'traveller',
      system: {financeValues: {cash: 100}, finances: {cash: '100 Cr'}}
    };
    const update = {system: {finances: {'financial-notes': 'notes'}, financeValues: {cash: 250}}};
    updateFinances(actor, update, {finances: {'financial-notes': 'notes'}, financeValues: {cash: 250}});
    expect(update.system.finances).toEqual({'financial-notes': 'notes', cash: '250 Cr'});
  });
});
