// Item type tests for the twodsix system.
// Verifies key item types with schema validation, then batch-tests all 17.

const { test, expect } = require('@playwright/test');
const { registerWorldHooks, createTestItem } = require('./helpers');

test.describe('twodsix item types', () => {
  const getPage = registerWorldHooks(test, { label: 'twodsix item types', timeout: 60000 });

  test('create weapon item with damage and range fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Weapon', 'weapon', {
      damage: '3d6',
      range: '100m',
      weaponType: 'ranged',
      damageType: 'bullet',
      magazineSize: 30,
      ammo: 25,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        damage: sys.damage,
        range: sys.range,
        weaponType: sys.weaponType,
        damageType: sys.damageType,
        magazineSize: sys.magazineSize,
        ammo: sys.ammo,
        hasRangeBand: 'rangeBand' in sys,
        hasRateOfFire: 'rateOfFire' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('weapon');
    expect(info.damage).toBe('3d6');
    expect(info.range).toBe('100m');
    expect(info.weaponType).toBe('ranged');
    expect(info.damageType).toBe('bullet');
    expect(info.magazineSize).toBe(30);
    expect(info.ammo).toBe(25);
    expect(info.hasRangeBand).toBe(true);
    expect(info.hasRateOfFire).toBe(true);
  });

  test('create armor item with protection fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Armor', 'armor', {
      armor: 5,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      return {
        type: item.type,
        armor: item.system.armor,
        isEquipped: item.system.equipped,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('armor');
    expect(info.armor).toBe(5);
    expect(info.isEquipped).toBe('backpack');
  });

  test('create equipment item with quantity/weight', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Equipment', 'equipment', {
      weight: 2.5,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      return {
        type: item.type,
        quantity: item.system.quantity,
        weight: item.system.weight,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('equipment');
    expect(info.quantity).toBe(1);
    expect(info.weight).toBe(2.5);
  });

  test('create consumable item', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Consumable', 'consumable', {
      currentCount: 3,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      return {
        type: item.type,
        currentCount: item.system.currentCount,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('consumable');
    expect(info.currentCount).toBe(3);
  });

  test('delete item removes it from world', async () => {
    const page = getPage();
    const result = await page.evaluate(async () => {
      const item = await Item.create({ name: 'Delete Me', type: 'equipment' });
      const id = item.id;
      const before = game.items.size;
      await item.delete();
      return { before, after: game.items.size, gone: game.items.get(id) === undefined };
    });

    expect(result.after).toBe(result.before - 1);
    expect(result.gone).toBe(true);
  });

  test('create skills item with value, characteristic, and rolltype fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Skill', 'skills', {
      value: 1,
      characteristic: 'intelligence',
      rolltype: 'Skill',
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        value: sys.value,
        characteristic: sys.characteristic,
        rolltype: sys.rolltype,
        hasSubtype: 'subtype' in sys,
        hasDifficulty: 'difficulty' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('skills');
    expect(info.value).toBe(1);
    expect(info.characteristic).toBe('intelligence');
    expect(info.rolltype).toBe('Skill');
    expect(info.hasSubtype).toBe(true);
    expect(info.hasDifficulty).toBe(true);
  });

  test('create trait item with value and subtype fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Trait', 'trait', {
      value: 2,
      subtype: 'physical',
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        value: sys.value,
        subtype: sys.subtype,
        hasValue: 'value' in sys,
        hasSubtype: 'subtype' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('trait');
    expect(info.value).toBe(2);
    expect(info.subtype).toBe('physical');
    expect(info.hasValue).toBe(true);
    expect(info.hasSubtype).toBe(true);
  });

  test('create augment item with weight, quantity, and equipped fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Augment', 'augment', {
      weight: 1.5,
      quantity: 3,
      equipped: 'equipped',
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        weight: sys.weight,
        quantity: sys.quantity,
        equipped: sys.equipped,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('augment');
    expect(info.weight).toBe(1.5);
    expect(info.quantity).toBe(3);
    expect(info.equipped).toBe('equipped');
  });

  test('create component item with techLevel, weight, and quantity fields', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Component', 'component', {
      techLevel: 12,
      weight: 5,
      quantity: 2,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        techLevel: sys.techLevel,
        weight: sys.weight,
        quantity: sys.quantity,
        hasSubtype: 'subtype' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('component');
    expect(info.techLevel).toBe(12);
    expect(info.weight).toBe(5);
    expect(info.quantity).toBe(2);
    expect(info.hasSubtype).toBe(true);
  });

  test('create computer item with techLevel field', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Computer', 'computer', {
      techLevel: 10,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        techLevel: sys.techLevel,
        hasTechLevel: 'techLevel' in sys,
        hasProcessingPower: 'processingPower' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('computer');
    expect(info.techLevel).toBe(10);
    expect(info.hasTechLevel).toBe(true);
    expect(info.hasProcessingPower).toBe(true);
  });

  test('create spell item with value field and description', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Spell', 'spell', {
      value: 3,
      description: 'A powerful incantation',
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        value: sys.value,
        hasValue: 'value' in sys,
        hasDescription: 'description' in sys,
        hasDamage: 'damage' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('spell');
    expect(info.value).toBe(3);
    expect(info.hasValue).toBe(true);
    expect(info.hasDescription).toBe(true);
    expect(info.hasDamage).toBe(true);
  });

  test('create psiAbility item with value field', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Psi Ability', 'psiAbility', {
      value: 2,
      psiCost: 5,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        value: sys.value,
        psiCost: sys.psiCost,
        hasValue: 'value' in sys,
        hasPsiCost: 'psiCost' in sys,
        hasRange: 'range' in sys,
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('psiAbility');
    expect(info.value).toBe(2);
    expect(info.psiCost).toBe(5);
    expect(info.hasValue).toBe(true);
    expect(info.hasPsiCost).toBe(true);
    expect(info.hasRange).toBe(true);
  });

  const weightQuantityCases = [
    { type: 'tool', name: 'Test Tool', data: { weight: 3, quantity: 1 }, expWeight: 3, expQuantity: 1 },
    { type: 'storage', name: 'Test Storage', data: { quantity: 5, weight: 10 }, expWeight: 10, expQuantity: 5 },
    { type: 'junk', name: 'Test Junk', data: { quantity: 7, weight: 2 }, expWeight: 2, expQuantity: 7 },
  ];
  for (const { type, name, data, expWeight, expQuantity } of weightQuantityCases) {
    // eslint-disable-next-line no-loop-func
    test(`create ${type} item with weight and quantity fields`, async () => {
      const page = getPage();
      const itemId = await createTestItem(page, name, type, data);
      const info = await page.evaluate((id) => {
        const item = game.items.get(id);
        if (!item) return null;
        return { type: item.type, weight: item.system.weight, quantity: item.system.quantity };
      }, itemId);
      expect(info).not.toBeNull();
      expect(info.type).toBe(type);
      expect(info.weight).toBe(expWeight);
      expect(info.quantity).toBe(expQuantity);
    });
  }

  test('create ship_position item and verify it exists in items', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Ship Position', 'ship_position', {
      order: 1,
    });

    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) {
        return null;
      }
      const sys = item.system;
      return {
        type: item.type,
        order: sys.order,
        hasActions: 'actions' in sys,
        hasOrder: 'order' in sys,
        inCollection: game.items.has(id),
      };
    }, itemId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('ship_position');
    expect(info.order).toBe(1);
    expect(info.hasActions).toBe(true);
    expect(info.hasOrder).toBe(true);
    expect(info.inCollection).toBe(true);
  });

  test('create career item', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Career', 'career', {});
    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) return null;
      return { type: item.type };
    }, itemId);
    expect(info).not.toBeNull();
    expect(info.type).toBe('career');
  });

  test('create species item', async () => {
    const page = getPage();
    const itemId = await createTestItem(page, 'Test Species', 'species', {});
    const info = await page.evaluate((id) => {
      const item = game.items.get(id);
      if (!item) return null;
      return { type: item.type };
    }, itemId);
    expect(info).not.toBeNull();
    expect(info.type).toBe('species');
  });
});
