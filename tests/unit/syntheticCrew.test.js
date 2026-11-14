import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../src/module/config', () => ({
  TWODSIX: {
    CHARACTERISTICS: { intelligence: 'INT' },
    DIFFICULTIES: { standard: { Average: { mod: 0, target: 8 } } },
    ROLLTYPES: { Normal: { key: 'Normal', formula: '2d6' } },
    SHIP_ACTION_TYPE: { skillRoll: 'skillRoll', fireEnergyWeapons: 'fireEnergyWeapons', chatMessage: 'chatMessage', executeMacro: 'executeMacro' },
    TARGET_DM: {},
    TimeUnits: {}
  },
  COMPONENT_SUBTYPES: {}
}));
vi.mock('../../src/module/utils/actorDamage', () => ({}));
vi.mock('../../src/module/utils/migration-utils', () => ({}));
vi.mock('../../src/module/utils/sheetUtils', () => ({
  getDifficultiesSelectObject: () => ({}),
  getRollTypeSelectObject: () => ({})
}));
vi.mock('../../src/module/utils/targetModifiers', () => ({ getTargetDMSelectObject: () => ({}) }));
vi.mock('../../src/module/utils/ItemTemplate', () => ({ default: class {} }));
vi.mock('../../src/module/utils/showStatusIcons', () => ({}));
vi.mock('../../src/module/hooks/timeIntegration', () => ({}));
vi.mock('../../src/module/i18n', () => ({}));
vi.mock('../../src/module/entities/TwodsixActiveEffect', () => ({}));
vi.mock('../../src/module/data/items/componentData.js', () => ({ ComponentData: class {} }));
vi.mock('../../src/module/sheets/TwodsixVehicleSheet', () => ({ getControlledTraveller: vi.fn() }));

let ActorBase;
let createSyntheticCrew;
let TwodsixRollSettings;
let getInitialSettingsFromFormula;
let TwodsixDiceRoll;
let BaseComponentItem;
let SkillItem;
let onChatCardAction;
let getControlledTraveller;
let TwodsixShipActions;

const settings = {
  difficultyListUsed: 'standard',
  ruleset: 'CE',
  rangeModifierType: 'none',
  messageMode: 'public',
  useDegreesOfSuccess: 'none',
  absoluteCriticalEffectValue: 100,
  componentDamageDM: -1
};

beforeAll(async () => {
  globalThis.Actor = class {
    constructor(source) {
      this.name = source.name;
      this.type = source.type;
      this.flags = source.flags ?? {};
      this.system = {
        ...source.system,
        characteristics: {
          ...Object.fromEntries(['strength', 'dexterity', 'endurance', 'education', 'socialStanding', 'psionicStrength', 'alternative1', 'alternative2'].map(key => [key, { displayShortLabel: key, mod: 0 }])),
          intelligence: { key: 'intelligence', shortLabel: 'INT', displayShortLabel: 'INT', mod: 0 }
        },
        conditions: {}
      };
      this.appliedEffects = [];
      const skills = (source.items ?? []).map(data => {
        const skill = Object.assign(new SkillItem(), data, {
          id: data._id,
          uuid: null,
          actor: this,
          getFlag: (scope, key) => data.flags?.[scope]?.[key]
        });
        skill.prepareData();
        return skill;
      });
      this.items = {
        get: id => skills.find(skill => skill.id === id),
        getName: name => skills.find(skill => skill.name === name)
      };
      this._skills = skills;
    }

    get itemTypes() {
      return { skills: this._skills };
    }
    getFlag(scope, key) {
      return this.flags?.[scope]?.[key];
    }
    getActiveTokens() {
      return [];
    }
  };
  globalThis.Item = class {
    prepareData() {}
  };
  globalThis.game = {
    i18n: { localize: key => ({
      'TWODSIX.Actor.Skills.Untrained': 'Untrained',
      'TWODSIX.Ship.UncrewedSkillName': 'Default Crew Skill',
      'TWODSIX.Ship.UncrewedPositionName': 'Uncrewed _POSITION_NAME_'
    })[key] ?? key, format: key => key },
    settings: { get: (_scope, key) => settings[key] },
    user: { isGM: true },
    messages: { get: vi.fn() }
  };
  globalThis.foundry = {
    utils: { randomID: () => 'skill-id' },
    applications: {
      sidebar: { tabs: { ChatLog: class {} }, apps: { ChatPopout: class {} } },
      api: { DialogV2: { wait: vi.fn() } },
      handlebars: { renderTemplate: vi.fn() }
    }
  };
  globalThis.CONFIG = { ChatMessage: { modes: {} }, Item: { dataModels: { skills: { schema: { getInitialValue: () => ({ value: -3 }) } } } } };
  globalThis.ui = { notifications: { error: vi.fn(), warn: vi.fn() } };
  globalThis.fromUuidSync = vi.fn();
  globalThis.fromUuid = vi.fn();
  globalThis.ChatMessage = { getSpeaker: vi.fn(), create: vi.fn() };
  globalThis.CONST = { CHAT_MESSAGE_STYLES: { OTHER: 0 } };
  globalThis.Roll = class {
    constructor(formula, data) {
      this.formula = formula;
      this.data = data;
      this.total = globalThis.Roll.totalValue ?? 10;
      this.dice = [{ results: [{ result: 3, active: true }, { result: 4, active: true }] }];
      this.toMessage = vi.fn();
    }
    async evaluate() {
      if (globalThis.Roll.diceTotal !== undefined) {
        this.dice = [{ results: [{ result: 1, active: true }, { result: globalThis.Roll.diceTotal - 1, active: true }] }];
        this.total = globalThis.Roll.diceTotal;
        for (const match of this.formula.matchAll(/([+-])\s*@(\w+)/g)) {
          this.total += (match[1] === '-' ? -1 : 1) * this.data[match[2]];
        }
      }
      return this;
    }
  };

  ({ default: ActorBase } = await import('../../src/module/entities/actors/actor-base.js'));
  CONFIG.Actor = { documentClass: ActorBase };
  ({ createSyntheticCrew } = await import('../../src/module/utils/syntheticCrew.js'));
  ({ TwodsixRollSettings, getInitialSettingsFromFormula } = await import('../../src/module/utils/TwodsixRollSettings.js'));
  ({ TwodsixDiceRoll } = await import('../../src/module/utils/TwodsixDiceRoll.js'));
  ({ SkillItem } = await import('../../src/module/entities/items/SkillItem.js'));
  ({ BaseComponentItem } = await import('../../src/module/entities/items/components/BaseComponentItem.js'));
  ({ onChatCardAction } = await import('../../src/module/entities/TwodsixChat.js'));
  ({ getControlledTraveller } = await import('../../src/module/sheets/TwodsixVehicleSheet.js'));
  ({ TwodsixShipActions } = await import('../../src/module/utils/TwodsixShipActions.js'));
});

beforeEach(() => {
  vi.resetAllMocks();
  settings.automateDamageRollOnHit = false;
  Roll.totalValue = 10;
  Roll.diceTotal = undefined;
  game.user.isGM = true;
});

function crew(level) {
  const actor = createSyntheticCrew({ name: 'Pilot', system: { crewSkillLevel: level } });
  actor._prepareSkillProxy();
  return actor;
}

function savedCrew(level) {
  const actor = crew(level);
  actor.flags = {};
  actor.uuid = 'Actor.saved';
  actor.getUntrainedSkill().uuid = `Actor.saved.Item.${actor.getUntrainedSkill().id}`;
  actor.getUntrainedSkill().prepareData();
  actor._prepareSkillProxy();
  return actor;
}

function actionExtra(actor, component, overrides = {}) {
  return { actor, component, ship: { uuid: 'Actor.ship' }, event: { shiftKey: true }, ...overrides };
}

function weaponComponent() {
  const component = new BaseComponentItem();
  Object.assign(component, {
    name: 'Laser',
    type: 'component',
    uuid: 'Actor.ship.Item.laser',
    system: { isArmament: true, rollModifier: 2, hits: 1, useConsumableForAttack: true, ammoLink: 'none' },
    consumeAmmo: vi.fn().mockResolvedValue(true),
    rollDamage: vi.fn()
  });
  return component;
}

function acceptRollDialog(selectedSkill) {
  foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => {
    const dialogData = foundry.applications.handlebars.renderTemplate.mock.calls.at(-1)[1];
    const selected = Object.hasOwn(dialogData.skillsList, dialogData.initialSkill)
      ? dialogData.initialSkill : Object.keys(dialogData.skillsList)[0];
    const elements = {
      difficulty: { value: 'Average' },
      rollType: { value: 'Normal' },
      messageMode: { value: 'public' },
      'rollModifiers.characteristic': { value: dialogData.initialChoice },
      'rollModifiers.selectedSkill': { value: selectedSkill ?? selected },
      'rollModifiers.item': { value: String(dialogData.rollModifiers.item) },
      'rollModifiers.componentDamage': { value: String(dialogData.rollModifiers.componentDamage) },
      'rollModifiers.other': { value: '0' }
    };
    buttons[0].callback(null, null, { element: { querySelector: () => ({ elements }) } });
  });
}

describe('uncrewed ship skill rolls', () => {
  test.each([3, 0, -2])('shows the prepared default crew skill and level %i in the roll dialog', async level => {
    const actor = crew(level);
    const initial = getInitialSettingsFromFormula('Silly', actor);
    await TwodsixRollSettings.create(true, initial, initial.skill, null, actor);

    const dialogData = foundry.applications.handlebars.renderTemplate.mock.calls[0][1];
    expect(initial.skill.uuid).toBeNull();
    expect(dialogData.initialSkill).toBe(initial.skill.id);
    expect(dialogData.skillsList[initial.skill.id]).toBe(`Default Crew Skill (${level})`);
    expect(foundry.applications.api.DialogV2.wait.mock.calls[0][0].window.title).toBe('Default Crew Skill');
  });

  test('ordinary actors continue to localize their untrained skill', () => {
    const actor = savedCrew(3);
    expect(actor.getUntrainedSkill().name).toBe('Untrained');
  });

  test.each([3, 0, -2])('uses crew skill level %i for an unknown action skill', async level => {
    const actor = crew(level);
    const initial = getInitialSettingsFromFormula('Pilot/INT 8+', actor);
    expect(initial.skill.name).toBe('Default Crew Skill');
    expect(initial.skill).toBe(actor.getUntrainedSkill());
    const options = await TwodsixRollSettings.create(false, {
      ...initial, flags: { actorUUID: '', shipUUID: 'Actor.ship' }
    }, initial.skill, null, actor);
    const roll = new TwodsixDiceRoll(options, actor, initial.skill);
    await roll.createRoll();
    expect(roll.roll.data.actualSkillValue).toBe(level);
    expect(roll.roll.formula).toContain(level < 0 ? ' - @skillValue' : ' + @skillValue');
    expect(options.flags.actorUUID).toBe('');
    expect(options.flags.shipUUID).toBe('Actor.ship');
    expect(options.flags.itemUUID).toBe('');
  });

  test.each([3, 0, -2])('applies level %i after accepting the actual ship skill dialog', async level => {
    const actor = crew(level);
    Roll.diceTotal = 5;
    acceptRollDialog();

    const result = await TwodsixShipActions.skillRoll('Silly', actionExtra(actor, null, { event: { shiftKey: false } }));
    expect(result.skill).toBe(actor.getUntrainedSkill());
    expect(result.roll.data.actualSkillValue).toBe(level);
    expect(result.roll.total).toBe(5 + level);
    expect(result.roll.toMessage.mock.calls[0][0].flavor).toContain('Default Crew Skill');
    expect(fromUuidSync).not.toHaveBeenCalled();
  });

  test.each([3, 0, -2])('applies level %i after accepting a component skill dialog', async level => {
    const actor = crew(level);
    const component = weaponComponent();
    Roll.diceTotal = 5;
    acceptRollDialog();
    const result = await TwodsixShipActions.skillRoll('Silly', actionExtra(actor, component, { event: { shiftKey: false } }));
    expect(result.skill).toBe(actor.getUntrainedSkill());
    expect(result.roll.data.actualSkillValue).toBe(level);
    expect(result.roll.total).toBe(6 + level);
    expect(component.consumeAmmo).toHaveBeenCalledWith(component, 1);
    expect(fromUuidSync).not.toHaveBeenCalled();
  });

  test('saved actor dialog retains UUID selection and skill modifier', async () => {
    const actor = savedCrew(3);
    const skill = actor.getUntrainedSkill();
    Roll.diceTotal = 5;
    fromUuidSync.mockReturnValue(skill);
    acceptRollDialog();
    const result = await TwodsixShipActions.skillRoll('Silly', actionExtra(actor, null, { event: { shiftKey: false } }));
    const dialogData = foundry.applications.handlebars.renderTemplate.mock.calls[0][1];
    expect(dialogData.initialSkill).toBe(skill.uuid);
    expect(dialogData.skillsList[skill.uuid]).toBe('Untrained (3)');
    expect(fromUuidSync).toHaveBeenCalledWith(skill.uuid);
    expect(result.roll.total).toBe(8);
  });

  test('an unresolved selection reports an error without consuming ammunition', async () => {
    const actor = crew(3);
    const component = weaponComponent();
    acceptRollDialog('missing-skill');
    const result = await TwodsixShipActions.skillRoll('Silly', actionExtra(actor, component, { event: { shiftKey: false } }));
    expect(result).toBeUndefined();
    expect(ui.notifications.error).toHaveBeenCalledWith('TWODSIX.Errors.NoSkillForSkillRoll', { localize: true });
    expect(component.consumeAmmo).not.toHaveBeenCalled();
  });

  test('saved actor retains its named skill and resolvable skill UUID', async () => {
    const actor = savedCrew(1);
    const skill = { name: 'Pilot', uuid: 'Actor.saved.Item.pilot', system: { value: 4, characteristic: 'NONE' }, actor };
    actor._skills.push(skill);
    actor._prepareSkillProxy();
    fromUuidSync.mockReturnValue(skill);
    const initial = getInitialSettingsFromFormula('Pilot 8+', actor);
    const options = await TwodsixRollSettings.create(false, initial, initial.skill, null, actor);
    const roll = new TwodsixDiceRoll(options, actor, initial.skill);
    await roll.createRoll();
    expect(roll.roll.data.actualSkillValue).toBe(4);
    expect(options.flags.itemUUID).toBe(skill.uuid);
    expect(options.flags.actorUUID).toBe(actor.uuid);
  });

  test('a ship skill action rolls the temporary skill without resolving its UUID', async () => {
    const actor = crew(3);
    const skill = actor.getUntrainedSkill();
    skill.skillRoll = vi.fn(async (_showDialog, options) => {
      const roll = new TwodsixDiceRoll(options, actor, skill);
      await roll.createRoll();
      return roll;
    });
    const result = await TwodsixShipActions.skillRoll('Pilot/INT 8+', actionExtra(actor));
    expect(result.roll.data.actualSkillValue).toBe(3);
    expect(result.rollSettings.flags.itemUUID).toBe('');
    expect(result.rollSettings.flags.actorUUID).toBe('');
    expect(result.rollSettings.flags.shipUUID).toBe('Actor.ship');
    expect(result.rollSettings.flags.tokenUUID).toBe('');
    expect(result.rollSettings.flags.syntheticCrewName).toBe('Uncrewed Pilot');
    expect(fromUuidSync).not.toHaveBeenCalled();
  });

  test('does not substitute the original skill for a different unresolved selection', () => {
    const actor = crew(3);
    const skill = actor.getUntrainedSkill();
    const roll = new TwodsixDiceRoll({ rollModifiers: { selectedSkill: 'Actor.other.Item.missing' } }, actor, skill);
    expect(roll.skill).toBeNull();
  });

  test('component resolves the passed actor, or the UUID when none is passed', async () => {
    const actor = crew(3);
    const component = new BaseComponentItem();
    const direct = await component._resolveSkillAndItem({ rollContext: { actor }, skillName: 'Default Crew Skill', flags: { actorUUID: '' } });
    expect(direct.workingActor).toBe(actor);
    expect(direct.skill).toBe(actor.getUntrainedSkill());
    expect(fromUuid).not.toHaveBeenCalled();
    fromUuid.mockResolvedValue(actor);
    const resolved = await component._resolveSkillAndItem({ skillName: 'Default Crew Skill', flags: { actorUUID: 'Actor.saved' } });
    expect(resolved.workingActor).toBe(actor);
    expect(fromUuid).toHaveBeenCalledWith('Actor.saved');
  });

  test('component actions pass the temporary actor and retain the component UUID', async () => {
    const actor = crew(3);
    const component = { type: 'component', uuid: 'Actor.ship.Item.component', system: {}, skillRoll: vi.fn().mockResolvedValue({ effect: 1 }) };
    const result = await TwodsixShipActions.skillRoll('Pilot/INT 8+', actionExtra(actor, component));
    const options = component.skillRoll.mock.calls[0][1];
    expect(result.effect).toBe(1);
    expect(options.rollContext).toEqual({ actor });
    expect(options.flags.itemUUID).toBe(component.uuid);
    expect(options.flags.actorUUID).toBe('');
    expect(options.flags.shipUUID).toBe('Actor.ship');
  });

  test('uncrewed token flags contain a token UUID rather than the ship actor UUID', async () => {
    const actor = crew(3);
    const component = { type: 'component', uuid: 'Actor.ship.Item.component', system: {}, skillRoll: vi.fn().mockResolvedValue({ effect: 1 }) };
    await TwodsixShipActions.skillRoll('Pilot/INT 8+', actionExtra(actor, component, {
      ship: { uuid: 'Actor.ship', token: { uuid: 'Scene.scene.Token.ship' } }
    }));
    expect(component.skillRoll.mock.calls[0][1].flags.tokenUUID).toBe('Scene.scene.Token.ship');
  });

  test('characteristic actions return their result for weapon automation', async () => {
    const actor = crew(3);
    actor.characteristicRoll = vi.fn().mockResolvedValue({ effect: 2 });
    const result = await TwodsixShipActions.skillRoll('None/INT 8+', actionExtra(actor));
    expect(result.effect).toBe(2);
    expect(actor.characteristicRoll.mock.calls[0][0].flags.actorUUID).toBe('');
    expect(actor.characteristicRoll.mock.calls[0][0].flags.shipUUID).toBe('Actor.ship');
  });

  test('dialog skill changes retain the temporary skill without UUID resolution', async () => {
    const actor = crew(3);
    const skill = actor.getUntrainedSkill();
    const otherSkill = {
      id: 'other-skill', uuid: null, name: 'Backup', actor,
      system: { value: 5, characteristic: 'INT' }
    };
    actor._skills.push(otherSkill);
    actor._prepareSkillProxy();
    const options = new TwodsixRollSettings({}, skill, null, actor);
    let onChange;
    const characteristic = { value: 'NONE' };
    const title = { innerText: 'Default Crew Skill' };
    const dialog = { element: { querySelector: selector => ({
      '.select-skill': { addEventListener: (_event, callback) => {
        onChange = callback;
      } },
      '[name="rollModifiers.characteristic"]': characteristic,
      '[name="rollModifiers.selectedSkill"]': { value: otherSkill.id },
      '.window-title': title
    })[selector] } };
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ render }) => {
      render({}, dialog);
      onChange();
    });
    await options._throwDialog('Default Crew Skill', skill);
    expect(characteristic.value).toBe('INT');
    expect(title.innerText).toBe('Backup');
    expect(fromUuidSync).not.toHaveBeenCalled();
  });

  test('uses the selected temporary skill rather than the original skill', async () => {
    const actor = crew(3);
    const otherSkill = {
      id: 'other-skill', uuid: null, name: 'Backup', actor,
      system: { value: 5, characteristic: 'NONE' }, getFlag: () => false
    };
    actor._skills.push(otherSkill);
    actor._prepareSkillProxy();
    Roll.diceTotal = 5;
    acceptRollDialog(otherSkill.id);
    const result = await TwodsixShipActions.skillRoll('Silly', actionExtra(actor, null, { event: { shiftKey: false } }));
    expect(result.skill).toBe(otherSkill);
    expect(result.roll.total).toBe(10);
    expect(fromUuidSync).not.toHaveBeenCalled();
  });

  test.each([true, false])('component skill rolls keep their skill and modifiers (uncrewed: %s)', async uncrewed => {
    const actor = uncrewed ? crew(3) : savedCrew(3);
    if (!uncrewed) {
      const skill = { name: 'Pilot', uuid: 'Actor.saved.Item.pilot', system: { value: 4, characteristic: 'NONE' }, actor };
      actor._skills.push(skill);
      actor._prepareSkillProxy();
      fromUuidSync.mockReturnValue(skill);
    }
    const component = weaponComponent();
    const result = await TwodsixShipActions.skillRoll('Pilot/INT 8+', actionExtra(actor, component));
    expect(result.skill.name).toBe(uncrewed ? 'Default Crew Skill' : 'Pilot');
    expect(result.roll.data.actualSkillValue).toBe(uncrewed ? 3 : 4);
    expect(result.roll.data.item).toBe(2);
    expect(component.consumeAmmo).toHaveBeenCalledWith(component, 1);
    expect(result.rollSettings.flags.actorUUID).toBe(uncrewed ? '' : actor.uuid);
  });
});

describe('characteristic-only component actions', () => {
  test.each([true, false])('dialog keeps characteristic-only rolls skill-free (component: %s)', async withComponent => {
    const actor = crew(3);
    const component = withComponent ? weaponComponent() : null;
    Roll.diceTotal = 5;
    acceptRollDialog();
    const result = await TwodsixShipActions.skillRoll('None/INT 8+', actionExtra(actor, component, { event: { shiftKey: false } }));
    expect(result.skill).toBeNull();
    expect(result.roll.data.actualSkillValue).toBeUndefined();
    expect(result.roll.total).toBe(withComponent ? 6 : 5);
  });

  test.each([true, false])('uses component modifiers and ammunition without a skill (uncrewed: %s)', async uncrewed => {
    const actor = uncrewed ? crew(3) : savedCrew(3);
    if (!uncrewed) {
      actor.system.characteristics.intelligence.mod = 2;
    }
    const component = weaponComponent();
    const result = await TwodsixShipActions.skillRoll('None/INT 8+', actionExtra(actor, component));

    expect(result.skill).toBeNull();
    expect(result.item).toBe(component);
    expect(result.roll.data.actualSkillValue).toBeUndefined();
    expect(result.roll.data.characteristic).toBe(uncrewed ? 0 : 2);
    expect(result.roll.data.item).toBe(2);
    expect(result.roll.data.componentDamage).toBe(1);
    expect(component.consumeAmmo).toHaveBeenCalledWith(component, 1);
    const message = result.roll.toMessage.mock.calls[0][0];
    expect(message.flavor).toContain('data-action="damage"');
    expect(message.flags['twodsix.itemUUID']).toBe(component.uuid);
    expect(message.flags['twodsix.actorUUID']).toBe(uncrewed ? '' : actor.uuid);
    expect(message.flags['twodsix.shipUUID']).toBe(uncrewed ? 'Actor.ship' : '');
    expect(message.flags['twodsix.syntheticCrewName']).toBe(uncrewed ? actor.name : '');
    if (uncrewed) {
      expect(message.speaker).toEqual({ scene: null, token: null, actor: null, alias: actor.name });
    } else {
      expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
    }
  });

  test('automatically rolls damage after a characteristic-only weapon hit', async () => {
    settings.automateDamageRollOnHit = true;
    const actor = crew(3);
    const component = weaponComponent();
    await TwodsixShipActions.fireEnergyWeapons('None/INT 8+', actionExtra(actor, component));
    expect(component.consumeAmmo).toHaveBeenCalledWith(component, 1);
    expect(component.rollDamage).toHaveBeenCalledWith('public', '', true, false, 2);
  });

  test('uses linked ammunition for automatic damage after a hit', async () => {
    settings.automateDamageRollOnHit = true;
    const actor = crew(3);
    const component = weaponComponent();
    component.system.ammoLink = 'ammo';
    const ammo = { rollDamage: vi.fn() };
    const ship = { uuid: 'Actor.ship', items: { get: vi.fn().mockReturnValue(ammo) } };
    await TwodsixShipActions.fireEnergyWeapons('None/INT 8+', actionExtra(actor, component, { ship }));
    expect(ship.items.get).toHaveBeenCalledWith('ammo');
    expect(ammo.rollDamage).toHaveBeenCalledWith('public', '', true, false, 2);
    expect(component.rollDamage).not.toHaveBeenCalled();
  });

  test('does not automatically roll damage on a miss', async () => {
    settings.automateDamageRollOnHit = true;
    Roll.totalValue = 5;
    const actor = crew(3);
    const component = weaponComponent();
    await TwodsixShipActions.fireEnergyWeapons('None/INT 8+', actionExtra(actor, component));
    expect(component.consumeAmmo).toHaveBeenCalledWith(component, 1);
    expect(component.rollDamage).not.toHaveBeenCalled();
    expect(ChatMessage.create).toHaveBeenCalled();
  });

  test('does not roll or deal damage when component ammunition cannot be consumed', async () => {
    settings.automateDamageRollOnHit = true;
    const actor = crew(3);
    const component = weaponComponent();
    component.consumeAmmo.mockResolvedValue(false);
    const result = await TwodsixShipActions.fireEnergyWeapons('None/INT 8+', actionExtra(actor, component));
    expect(result).toBe(false);
    expect(component.rollDamage).not.toHaveBeenCalled();
  });

  test('cancelling the roll dialog does not consume ammunition', async () => {
    const actor = crew(3);
    const component = weaponComponent();
    const result = await TwodsixShipActions.skillRoll('None/INT 8+', actionExtra(actor, component, {
      event: { shiftKey: false }
    }));
    expect(result).toBe(false);
    expect(component.consumeAmmo).not.toHaveBeenCalled();
  });
});

describe('ship roll chat buttons', () => {
  function chatMessage(flags) {
    const message = { getFlag: (_scope, key) => flags[key] };
    game.messages.get.mockReturnValue(message);
    return { closest: () => ({ dataset: { messageId: 'message' } }) };
  }

  test('chain rolls do not resolve a temporary skill UUID', async () => {
    const target = chatMessage({ actorUUID: 'Actor.ship', itemUUID: 'Actor.temporary.Item.skill' });
    target.dataset = { action: 'chain' };
    fromUuid.mockResolvedValue({ isOwner: true });
    await onChatCardAction({ preventDefault() {}, shiftKey: false }, target);
    expect(fromUuid).toHaveBeenCalledTimes(1);
    expect(fromUuid).toHaveBeenCalledWith('Actor.ship');
    expect(ui.notifications.warn).toHaveBeenCalledWith('TWODSIX.Warnings.NoActorSelected', { localize: true });
  });

  test('damage still resolves and rolls the persistent component', async () => {
    const target = chatMessage({ actorUUID: '', shipUUID: 'Actor.ship', syntheticCrewName: 'Uncrewed Pilot', itemUUID: 'Actor.ship.Item.weapon', effect: 2 });
    target.dataset = { action: 'damage' };
    const component = { rollDamage: vi.fn() };
    fromUuid.mockImplementation(async uuid => uuid === 'Actor.ship' ? { isOwner: true } : component);
    await onChatCardAction({ preventDefault() {}, shiftKey: false }, target);
    expect(fromUuid).toHaveBeenCalledWith('Actor.ship.Item.weapon');
    expect(component.rollDamage).toHaveBeenCalledWith('public', '', true, true, 2);
  });

  test('checks ship ownership before allowing uncrewed damage', async () => {
    game.user.isGM = false;
    const target = chatMessage({ actorUUID: '', shipUUID: 'Actor.ship', syntheticCrewName: 'Uncrewed Pilot', itemUUID: 'Actor.ship.Item.weapon' });
    target.dataset = { action: 'damage' };
    fromUuid.mockResolvedValue({ isOwner: false });
    await onChatCardAction({ preventDefault() {}, shiftKey: false }, target);
    expect(fromUuid).toHaveBeenCalledTimes(1);
    expect(fromUuid).toHaveBeenCalledWith('Actor.ship');
  });

  test('warns when the ship for an uncrewed card no longer exists', async () => {
    const target = chatMessage({ actorUUID: '', shipUUID: 'Actor.missing', syntheticCrewName: 'Uncrewed Pilot' });
    target.dataset = { action: 'damage' };
    fromUuid.mockResolvedValue(null);
    await onChatCardAction({ preventDefault() {}, shiftKey: false }, target);
    expect(ui.notifications.warn).toHaveBeenCalledWith('TWODSIX.Errors.SourceActorNotFound', { localize: true });
  });

  test('normal cards keep using the actor UUID for permissions', async () => {
    const target = chatMessage({ actorUUID: 'Actor.crew', shipUUID: 'Actor.ship', itemUUID: 'Actor.ship.Item.weapon' });
    target.dataset = { action: 'damage' };
    const component = { rollDamage: vi.fn() };
    fromUuid.mockImplementation(async uuid => uuid === 'Actor.crew' ? { isOwner: true } : component);
    await onChatCardAction({ preventDefault() {}, shiftKey: false }, target);
    expect(fromUuid).toHaveBeenNthCalledWith(1, 'Actor.crew');
    expect(component.rollDamage).toHaveBeenCalled();
  });

  test('an uncrewed opposed-roll winner is identified by the crew name, not the ship', async () => {
    const target = chatMessage({ actorUUID: '', shipUUID: 'Actor.ship', itemUUID: '', syntheticCrewName: 'Uncrewed Pilot', effect: 4 });
    target.dataset = { action: 'opposed' };
    const actor = savedCrew(1);
    const skill = actor.getUntrainedSkill();
    skill.skillRoll = vi.fn().mockResolvedValue({ effect: 2 });
    getControlledTraveller.mockReturnValue(actor);
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => {
      buttons[0].callback(null, null, { element: { querySelector: () => ({ value: skill.uuid }) } });
    });
    fromUuid.mockImplementation(async uuid => uuid === 'Actor.ship' ? { name: 'Ship' } : skill);
    await onChatCardAction({ preventDefault() {}, shiftKey: true }, target);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Uncrewed Pilot TWODSIX.Chat.Roll.WinsRoll'
    }));
  });
});
