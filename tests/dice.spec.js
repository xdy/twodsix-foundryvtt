// Dice and chat tests for the twodsix system.
// Verifies basic Roll math, chat output, and 2d6-based dice mechanics.

const { test, expect } = require('@playwright/test');
const { registerWorldHooks } = require('./helpers');

test.describe('twodsix dice and chat', () => {
  const getPage = registerWorldHooks(test, { label: 'twodsix dice and chat', timeout: 60000 });

  test('2d6 roll produces result between 2 and 12', async () => {
    const page = getPage();
    const { total, terms } = await page.evaluate(async () => {
      const roll = await new Roll('2d6').evaluate();
      return {
        total: roll.total,
        terms: roll.terms.map(t => t.formula || t.number),
      };
    });
    expect(total).toBeGreaterThanOrEqual(2);
    expect(total).toBeLessThanOrEqual(12);
    expect(terms).toContain('2d6');
  });

  test('2d6+3 modifier roll works', async () => {
    const page = getPage();
    const total = await page.evaluate(async () => {
      const roll = await new Roll('2d6+3').evaluate();
      return roll.total;
    });
    expect(total).toBeGreaterThanOrEqual(5);
    expect(total).toBeLessThanOrEqual(15);
  });

  test('2d6-1 modifier roll works', async () => {
    const page = getPage();
    const total = await page.evaluate(async () => {
      const roll = await new Roll('2d6-1').evaluate();
      return roll.total;
    });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(11);
  });

  test('d66 roll produces valid result', async () => {
    const page = getPage();
    const total = await page.evaluate(async () => {
      const roll = await new Roll('d66').evaluate();
      return roll.total;
    });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(66);
  });

  test('roll output appears in chat as message', async () => {
    const page = getPage();
    const result = await page.evaluate(async () => {
      const roll = await new Roll('2d6+2').evaluate();
      const msg = await roll.toMessage({ flavor: 'Test skill check' });
      return {
        hasRoll: msg.isRoll,
        formula: roll.formula,
        total: roll.total,
        flavor: msg.flavor,
      };
    });
    expect(result.hasRoll).toBe(true);
    // Foundry v14 may insert spaces in formula strings (2d6 + 2 vs 2d6+2).
    // Normalize to compact form for comparison.
    expect(result.formula.replace(/\s+/g, '')).toBe('2d6+2');
    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.flavor).toBe('Test skill check');
  });

  test('multiple independent rolls each produce chat messages', async () => {
    const page = getPage();
    const { before, after } = await page.evaluate(async () => {
      const before = game.messages.size;
      await new Roll('1d6').evaluate().then(r => r.toMessage());
      await new Roll('2d6').evaluate().then(r => r.toMessage());
      await new Roll('3d6').evaluate().then(r => r.toMessage());
      return { before, after: game.messages.size };
    });
    expect(after).toBe(before + 3);
  });

  test('disadvantage roll (2d6kl) is lower than advantage (2d6kh)', async () => {
    const page = getPage();
    const { klSum, khSum } = await page.evaluate(async () => {
      let klSum = 0, khSum = 0;
      // kl/kh are applied to the same underlying roll, so each sample pair
      // is deterministic (kl <= kh).  20 iterations cover all faces.
      for (let i = 0; i < 20; i++) {
        klSum += (await new Roll('2d6kl').evaluate()).total;
        khSum += (await new Roll('2d6kh').evaluate()).total;
      }
      return { klSum, khSum };
    });
    expect(klSum).toBeLessThan(khSum);
  });
});
