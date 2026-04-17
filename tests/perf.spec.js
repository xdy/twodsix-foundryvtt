// Performance profiling tests for twodsix system.
// Playwright tracing enabled in config for deep debugging.

const { test, expect } = require('@playwright/test');
const { registerWorldHooks } = require('./helpers');

test.describe('twodsix performance profiling', () => {
  const getPage = registerWorldHooks(test, { label: 'twodsix performance profiling', timeout: 120000 });

  test('actor creation is fast (< 500ms)', async () => {
    const page = getPage();
    const duration = await page.evaluate(async () => {
      const start = performance.now();
      await Actor.create({ name: 'Perf Actor', type: 'traveller' });
      return performance.now() - start;
    });

    console.log(`Actor.create: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThan(500);
  });

  test('item creation is fast (< 300ms)', async () => {
    const page = getPage();
    const duration = await page.evaluate(async () => {
      const start = performance.now();
      await Item.create({ name: 'Perf Item', type: 'skill', system: { value: 1 } });
      return performance.now() - start;
    });

    console.log(`Item.create: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThan(300);
  });

  test('dice roll + chat message is fast (< 200ms)', async () => {
    const page = getPage();
    const duration = await page.evaluate(async () => {
      const start = performance.now();
      const roll = await new Roll('2d6+3').evaluate();
      await roll.toMessage({ flavor: 'perf test' });
      return performance.now() - start;
    });

    console.log(`Roll + chat message: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThan(200);
  });
});
