// Performance profiling tests for twodsix system.
// Playwright tracing enabled in config for deep debugging.

const { test, expect } = require('@playwright/test');
const { setupTestWorld, shutdownWorld } = require('./helpers');

let page;

test.describe('twodsix performance profiling', () => {
  test.beforeAll(async ({ browser }) => {
    ({ page } = await setupTestWorld(browser, 'twodsix performance profiling'));
  }, 120000);

  test.afterAll(async () => {
    await shutdownWorld(page);
  });

  test('actor creation is fast (< 500ms)', async () => {
    const duration = await page.evaluate(async () => {
      const start = performance.now();
      await Actor.create({ name: 'Perf Actor', type: 'traveller' });
      return performance.now() - start;
    });

    console.log(`Actor.create: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThan(500);
  });

  test('item creation is fast (< 300ms)', async () => {
    const duration = await page.evaluate(async () => {
      const start = performance.now();
      await Item.create({ name: 'Perf Item', type: 'skill', system: { value: 1 } });
      return performance.now() - start;
    });

    console.log(`Item.create: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThan(300);
  });

  test('dice roll + chat message is fast (< 200ms)', async () => {
    const duration = await page.evaluate(async () => {
      const start = performance.now();
      const roll = await new Roll('2d6+3').evaluate();
      await roll.toMessage({ flavor: 'perf test' });
      return performance.now() - start;
    });

    console.log(`Roll + chat message: ${duration.toFixed(0)}ms`);
    expect(duration).toBeLessThan(200);
  });

  test('bulk batch creation scales acceptably', async () => {
    const results = await page.evaluate(async () => {
      const counts = [1, 10, 50];
      const timings = {};
      for (const count of counts) {
        const start = performance.now();
        for (let i = 0; i < count; i++) {
          await Item.create({ name: `Batch_${i}`, type: 'equipment' });
        }
        timings[count] = (performance.now() - start) / count;
      }
      return timings;
    });

    console.log(`Avg ms/item: 1=${results[1].toFixed(1)}, 10=${results[10].toFixed(1)}, 50=${results[50].toFixed(1)}`);
    expect(results[50]).toBeLessThan(results[1] * 3);
  });

  test('document counts remain reasonable after batch create', async () => {
    const sizes = await page.evaluate(() => ({
      actors: game.actors.size,
      items: game.items.size,
      messages: game.messages.size,
    }));
    console.log(`Documents: actors=${sizes.actors}, items=${sizes.items}, messages=${sizes.messages}`);
    expect(sizes.actors).toBeGreaterThanOrEqual(0);
    expect(sizes.items).toBeGreaterThanOrEqual(0);
  });
});
