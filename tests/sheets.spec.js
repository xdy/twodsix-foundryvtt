// Visual regression tests for twodsix sheet layouts.
// Baselines in tests/snapshots/ — regenerate with: pnpm run test:headed -- --update-snapshots

const { test, expect } = require('@playwright/test');
const { registerWorldHooks, createTestActor, createTestItem } = require('./helpers');
const SNAPSHOT_OPTS = { maxDiffPixels: 3000 };
const ACTOR_SHEET_SEL = '.application.sheet.twodsix.actor';
const ITEM_SHEET_SEL = '.application.sheet.twodsix.item';

async function openSheetAndScreenshot(page, docId, docType, snapshotName) {
  await page.evaluate(async ({ docId, docType }) => {
    const doc = docType === 'actor' ? game.actors.get(docId) : game.items.get(docId);
    if (!doc) {
      return;
    }
    doc.sheet.render(true);
    await new Promise(r => setTimeout(r, 500));
  }, { docId, docType });

  const selector = docType === 'actor' ? ACTOR_SHEET_SEL : ITEM_SHEET_SEL;
  const sheet = page.locator(selector).first();
  await sheet.waitFor({ state: 'visible', timeout: 5000 });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveScreenshot(snapshotName, SNAPSHOT_OPTS);

  await page.evaluate(async ({ docId, docType }) => {
    const doc = docType === 'actor' ? game.actors.get(docId) : game.items.get(docId);
    doc?.sheet?.close();
  }, { docId, docType });
}

test.describe('twodsix sheet visual regression', () => {
  const getPage = registerWorldHooks(test, { label: 'twodsix sheet visual regression', timeout: 60000 });

  test('traveller sheet renders with characteristics', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Visual Traveller', 'traveller', {
      characteristics: {
        strength: { value: 7 },
        dexterity: { value: 8 },
        endurance: { value: 6 },
        intelligence: { value: 9 },
        education: { value: 10 },
        socialStanding: { value: 5 },
      },
    });
    await openSheetAndScreenshot(page, actorId, 'actor', 'traveller-sheet.png');
  });

  test('ship sheet renders with vehicle controls', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Visual Ship', 'ship', {
      shipStats: {
        hull: { value: 40, min: 0, max: 40 },
        fuel: { value: 100, min: 0, max: 100 },
        power: { value: 60, min: 0, max: 60 },
      },
      crew: { captain: 'Alex', pilot: 'Bryn', engineer: 'Cade' },
    });
    await openSheetAndScreenshot(page, actorId, 'actor', 'ship-sheet.png');
  });

  test('weapon item sheet renders with damage/range fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Visual Weapon', 'weapon', {
      damage: '3d6',
      range: '100m',
      weaponType: 'ranged',
      damageType: 'bullet',
      magazineSize: 30,
      ammo: 25,
    });
    await openSheetAndScreenshot(page, itemId, 'item', 'weapon-item-sheet.png');
  });
});
