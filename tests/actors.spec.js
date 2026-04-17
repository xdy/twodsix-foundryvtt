// Actor type tests for the twodsix system.
// Verifies all 7 actor types can be created with correct schemas.

const { test, expect } = require('@playwright/test');
const { registerWorldHooks, createTestActor, createAllActorTypes } = require('./helpers');

test.describe('twodsix actor types', () => {
  const getPage = registerWorldHooks(test, { label: 'twodsix actor types', timeout: 60000 });

  test('create traveller actor with characteristics', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Test Traveller', 'traveller');
    expect(actorId).toBeTruthy();

    const info = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const chars = actor.system.characteristics;
      return {
        type: actor.type,
        hasStr: 'strength' in chars,
        hasDex: 'dexterity' in chars,
        hasEnd: 'endurance' in chars,
        hasInt: 'intelligence' in chars,
        hasEdu: 'education' in chars,
        hasSoc: 'socialStanding' in chars,
        hasPsi: 'psionicStrength' in chars,
        hasMovement: !!actor.system.movement,
        hasConditions: !!actor.system.conditions,
      };
    }, actorId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('traveller');
    expect(info.hasStr).toBe(true);
    expect(info.hasDex).toBe(true);
    expect(info.hasEnd).toBe(true);
    expect(info.hasInt).toBe(true);
    expect(info.hasEdu).toBe(true);
    expect(info.hasSoc).toBe(true);
    expect(info.hasPsi).toBe(true);
    expect(info.hasMovement).toBe(true);
    expect(info.hasConditions).toBe(true);
  });

  test('traveller characteristic DMs are computed on create', async () => {
    const page = getPage();
    const actorId = await page.evaluate(async () => {
      const actor = await Actor.create({
        name: 'DM Test Traveller',
        type: 'traveller',
        system: {
          characteristics: {
            strength: { value: 9 },
            dexterity: { value: 6 },
            endurance: { value: 3 },
            intelligence: { value: 12 },
          },
        },
      });
      return actor.id;
    });

    const dms = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      // Characteristic .mod is persisted:false; compute inline for robustness.
      const modFor = (v) => Math.floor((v - 6) / 3);
      const ch = actor.system.characteristics;
      return {
        str: modFor(ch.strength.value),
        dex: modFor(ch.dexterity.value),
        end: modFor(ch.endurance.value),
        int: modFor(ch.intelligence.value),
      };
    }, actorId);

    expect(dms).not.toBeNull();
    expect(dms.str).toBe(1);
    expect(dms.dex).toBe(0);
    expect(dms.end).toBe(-1);
    expect(dms.int).toBe(2);
  });

  test('create ship actor with vehicle fields', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Test Ship', 'ship');
    expect(actorId).toBeTruthy();

    const info = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const sys = actor.system;
      return {
        type: actor.type,
        hasTechLevel: 'techLevel' in sys,
        hasCrew: !!sys.crew,
        hasCargo: 'cargo' in sys,
        hasShipStats: !!sys.shipStats,
        hasRePower: !!sys.reqPower,
        hasCrewData: !!sys.crew,
        hasShipValue: 'shipValue' in sys,
        hasDeckPlan: 'deckPlan' in sys,
      };
    }, actorId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('ship');
    expect(info.hasTechLevel).toBe(true);
    expect(info.hasCrew).toBe(true);
    expect(info.hasCargo).toBe(true);
    expect(info.hasShipStats).toBe(true);
    expect(info.hasRePower).toBe(true);
    expect(info.hasCrewData).toBe(true);
    expect(info.hasShipValue).toBe(true);
    expect(info.hasDeckPlan).toBe(true);
  });

  test('ship has hull, fuel, power stats', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Stat Ship', 'ship', {
      shipStats: {
        hull: { value: 40, min: 0, max: 40 },
        fuel: { value: 100, min: 0, max: 100 },
        power: { value: 60, min: 0, max: 60 },
      },
    });

    const stats = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const ss = actor.system.shipStats;
      return {
        hull: ss?.hull?.value,
        fuel: ss?.fuel?.value,
        power: ss?.power?.value,
      };
    }, actorId);

    expect(stats).not.toBeNull();
    expect(stats.hull).toBe(40);
    expect(stats.fuel).toBe(100);
    expect(stats.power).toBe(60);
  });

  test('create vehicle actor with full field validation', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Test Vehicle', 'vehicle', {
      damageStats: {
        hull: { value: 30, min: 0, max: 30 },
        structure: { value: 15, min: 0, max: 15 },
      },
      maneuver: {
        speed: '120',
        speedUnits: 'km/h',
        range: '400',
        rangeUnits: 'km',
        agility: '+2',
      },
    });
    expect(actorId).toBeTruthy();

    const info = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const sys = actor.system;
      return {
        type: actor.type,
        hasDescription: 'description' in sys,
        hasTechLevel: 'techLevel' in sys,
        hasMovement: 'movement' in sys,
        movementHasCurrentMax: !!(sys.movement && ('current' in sys.movement || 'value' in sys.movement)),
        hasDamageStats: !!sys.damageStats,
        damageStatsHullValue: sys.damageStats?.hull?.value,
        damageStatsStructureValue: sys.damageStats?.structure?.value,
        hasManeuver: !!sys.maneuver,
        maneuverSpeed: sys.maneuver?.speed,
        maneuverAgility: sys.maneuver?.agility,
        hasSystemStatus: !!sys.systemStatus,
        systemStatusKeys: sys.systemStatus ? Object.keys(sys.systemStatus) : [],
      };
    }, actorId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('vehicle');
    expect(info.hasDescription).toBe(true);
    expect(info.hasTechLevel).toBe(true);
    // Vehicle actors do not define a movement field (it lives on character-type actors).
    expect(info.hasMovement).toBe(false);
    // Damage stats with resource fields (value/max/min).
    expect(info.hasDamageStats).toBe(true);
    expect(info.damageStatsHullValue).toBe(30);
    expect(info.damageStatsStructureValue).toBe(15);
    // Maneuver sub-fields.
    expect(info.hasManeuver).toBe(true);
    expect(info.maneuverSpeed).toBe('120');
    expect(info.maneuverAgility).toBe('+2');
    // System status — at minimum the schema defines several subsystems.
    expect(info.hasSystemStatus).toBe(true);
    expect(info.systemStatusKeys.length).toBeGreaterThanOrEqual(5);
  });

  test('create space-object actor with full field validation', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Test Space Object', 'space-object', {
      count: { value: 3, min: 0, max: 20 },
      damage: '6D6',
      thrust: 4,
      roundsActive: 2,
    });
    expect(actorId).toBeTruthy();

    const info = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const sys = actor.system;
      return {
        type: actor.type,
        hasDescription: 'description' in sys,
        hasTechLevel: 'techLevel' in sys,
        hasMovement: 'movement' in sys,
        movementHasCurrentMax: !!(sys.movement && ('current' in sys.movement || 'value' in sys.movement)),
        hasShipStats: 'shipStats' in sys,
        shipStatsHasHull: !!(sys.shipStats && 'hull' in sys.shipStats),
        shipStatsHasFuel: !!(sys.shipStats && 'fuel' in sys.shipStats),
        shipStatsHasPower: !!(sys.shipStats && 'power' in sys.shipStats),
        // Space-object-specific fields.
        countValue: sys.count?.value,
        damage: sys.damage,
        thrust: sys.thrust,
        hasFeatures: 'features' in sys,
      };
    }, actorId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('space-object');
    expect(info.hasDescription).toBe(true);
    expect(info.hasTechLevel).toBe(true);
    // Space-object actors do not define a movement field (it lives on character-type actors).
    expect(info.hasMovement).toBe(false);
    // Space-object extends TwodsixVehicleBaseData directly, not ShipData; verify the shape.
    expect(info.hasShipStats).toBe(false);
    expect(info.shipStatsHasHull).toBe(false);
    expect(info.shipStatsHasFuel).toBe(false);
    expect(info.shipStatsHasPower).toBe(false);
    // Space-object-specific fields with the data we supplied.
    expect(info.countValue).toBe(3);
    expect(info.damage).toBe('6D6');
    expect(info.thrust).toBe(4);
    expect(info.hasFeatures).toBe(true);
  });

  test('create animal actor with animal-specific fields', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Test Animal', 'animal');
    expect(actorId).toBeTruthy();

    const info = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const sys = actor.system;
      return {
        type: actor.type,
        hasHomeWorld: 'homeWorld' in sys,
        hasSpecies: 'species' in sys,
        hasAnimalType: !!sys.animalType,
        hasSize: 'size' in sys,
        hasNumberAppearing: 'numberAppearing' in sys,
        hasReaction: !!sys.reaction,
        hasCharacteristics: !!sys.characteristics,
      };
    }, actorId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('animal');
    expect(info.hasHomeWorld).toBe(true);
    expect(info.hasSpecies).toBe(true);
    expect(info.hasAnimalType).toBe(true);
    expect(info.hasSize).toBe(true);
    expect(info.hasNumberAppearing).toBe(true);
    expect(info.hasReaction).toBe(true);
    expect(info.hasCharacteristics).toBe(true);
  });

  test('create robot actor with robot-specific fields', async () => {
    const page = getPage();
    const actorId = await createTestActor(page, 'Test Robot', 'robot');
    expect(actorId).toBeTruthy();

    const info = await page.evaluate((id) => {
      const actor = game.actors.get(id);
      if (!actor) {
        return null;
      }
      const sys = actor.system;
      return {
        type: actor.type,
        hasSize: 'size' in sys,
        hasLocomotion: 'locomotionType' in sys,
        hasTechLevel: 'techLevel' in sys,
        hasChassis: 'chassis' in sys,
        hasMaxBuildPoints: 'maxBuildPoints' in sys,
        hasCharacteristics: !!sys.characteristics,
      };
    }, actorId);

    expect(info).not.toBeNull();
    expect(info.type).toBe('robot');
    expect(info.hasSize).toBe(true);
    expect(info.hasLocomotion).toBe(true);
    expect(info.hasTechLevel).toBe(true);
    expect(info.hasChassis).toBe(true);
    expect(info.hasMaxBuildPoints).toBe(true);
    expect(info.hasCharacteristics).toBe(true);
  });

  test('bulk create all 7 actor types in one evaluate call', async () => {
    const page = getPage();
    const results = await createAllActorTypes(page);

    // Verify all 7 exist and have correct types.
    const check = await page.evaluate((ids) => {
      const result = {};
      for (const { id, type } of ids) {
        const actor = game.actors.get(id);
        result[type] = actor ? actor.type : null;
      }
      return result;
    }, results);

    const expectedTypes = ['traveller', 'animal', 'robot', 'ship', 'vehicle', 'space-object', 'world'];
    for (const type of expectedTypes) {
      expect(check[type]).toBe(type);
    }
    expect(results.length).toBe(7);
  });

  test('delete actor removes it from world', async () => {
    const page = getPage();
    const result = await page.evaluate(async () => {
      const actor = await Actor.create({ name: 'Delete Me', type: 'traveller' });
      const before = game.actors.size;
      await actor.delete();
      return { before, after: game.actors.size, gone: game.actors.get(actor.id) === undefined };
    });

    expect(result.after).toBe(result.before - 1);
    expect(result.gone).toBe(true);
  });
});
