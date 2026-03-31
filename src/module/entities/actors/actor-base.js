import { COMPONENT_SUBTYPES, TWODSIX } from '../../config';
import { getDamageCharacteristics, getParryValue, stackArmorValues, Stats } from '../../utils/actorDamage';
import { applyToAllActors } from '../../utils/migration-utils';
import { getDamageTypes } from '../../utils/sheetUtils';
import { TwodsixDiceRoll } from '../../utils/TwodsixDiceRoll';
import { TwodsixRollSettings } from '../../utils/TwodsixRollSettings';
import { assignDefaultImage, getKeyByValue, simplifySkillName, sortByItemName } from '../../utils/utils';
import { TwodsixActiveEffect } from '../TwodsixActiveEffect';

/** @typedef {import("@common/documents/user.mjs").BaseUser} BaseUser */
/** @typedef {import("../TwodsixItem").default} TwodsixItem */
/** @typedef {import("../items/EquipmentItem").EquipmentItem} EquipmentItem */
/** @typedef {import("../items/WeaponItem").WeaponItem} WeaponItem */
/** @typedef {import("../items/ArmorItem").ArmorItem} ArmorItem */
/** @typedef {import("../items/AugmentItem").AugmentItem} AugmentItem */
/** @typedef {import("../items/StorageItem").StorageItem} StorageItem */
/** @typedef {import("../items/ToolItem").ToolItem} ToolItem */
/** @typedef {import("../items/JunkItem").JunkItem} JunkItem */
/** @typedef {import("../items/SkillItem").SkillItem} SkillItem */
/** @typedef {import("../items/SpellItem").SpellItem} SpellItem */
/** @typedef {import("../items/TraitItem").TraitItem} TraitItem */
/** @typedef {import("../items/ConsumableItem").ConsumableItem} ConsumableItem */
/** @typedef {import("../items/ComponentItem").ComponentItem} ComponentItem */
/** @typedef {import("../items/ShipPositionItem").ShipPositionItem} ShipPositionItem */
/** @typedef {import("../items/ComputerItem").ComputerItem} ComputerItem */
/** @typedef {import("../items/PsiAbilityItem").PsiAbilityItem} PsiAbilityItem */

/**
 * @extends {Actor}
 */
export default class TwodsixActor extends Actor {
  /** @type {boolean} */
  _applyingStatusEffects = false;

  /**
   * Type-safe access to item collections by type.
   * @type {{
   *   equipment: EquipmentItem[],
   *   weapon: WeaponItem[],
   *   armor: ArmorItem[],
   *   augment: AugmentItem[],
   *   storage: StorageItem[],
   *   tool: ToolItem[],
   *   junk: JunkItem[],
   *   skills: SkillItem[],
   *   spell: SpellItem[],
   *   trait: TraitItem[],
   *   consumable: ConsumableItem[],
   *   component: ComponentItem[],
   *   ship_position: ShipPositionItem[],
   *   computer: ComputerItem[],
   *   psiAbility: PsiAbilityItem[]
   * }}
   * @override
   */
  get itemTypes() {
    return super.itemTypes;
  }

  /**
   * @returns {void}
   */
  static resetUntrainedSkill() {
    applyToAllActors(async (actor) => {
      if (["traveller", "animal", "robot"].includes(actor.type)) {
        await correctMissingUntrainedSkill(actor);
        const itemUpdates = [];
        for (const item of actor.items) {
          const twodsixItem=/** @type {TwodsixItem} */(item);
          if (!["skills", "trait"].includes(twodsixItem.type)) {
            const skill = actor.items.get(twodsixItem.system.skill);
            if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
              //CHECK FOR ASSOCIATED SKILL NAME AS FIRST OPTION
              const associatedSkill = actor.getBestSkill(twodsixItem.system.associatedSkillName, false);
              itemUpdates.push({_id: twodsixItem.id, "system.skill": associatedSkill?.id ?? ""});
            }
          }
        }
        if (itemUpdates.length > 0) {
          actor.updateEmbeddedDocuments('Item', itemUpdates);
        }
      }
    });
  }

  /**
   * @returns {void}
   */
  static setUntrainedSkillForItems() {
    applyToAllActors(async (actor) => {
      if (["traveller", "animal", "robot"].includes(actor.type)) {
        await correctMissingUntrainedSkill(actor);
        const itemUpdates = [];
        const untrainedSkill = actor.getUntrainedSkill();
        for (const item of actor.items) {
          if (!["skills", "trait"].includes(item.type)) {
            const attachedSkill = await actor.items.get(item.system.skill);
            if (!attachedSkill || (untrainedSkill.system.value === actor.system.skills[simplifySkillName(attachedSkill?.name)]) && !attachedSkill?.getFlag("twodsix", "untrainedSkill")) {
              //CHECK FOR ASSOCIATED SKILL NAME AS FIRST OPTION
              const associatedSkill = actor.getBestSkill(item.system.associatedSkillName, false);
              itemUpdates.push({_id: item.id, "system.skill": associatedSkill?.id ?? untrainedSkill.id});
            }
          }
        }
        if (itemUpdates.length > 0) {
          await actor.updateEmbeddedDocuments('Item', itemUpdates);
        }
      }
    });
  }

  /** @override */
  /**
   * Perform preliminary operations before an Actor of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   * @param {object} data               The initial data object provided to the document creation request.
   * @param {object} options            Additional options which modify the creation request.
   * @param {BaseUser} userId                 The User requesting the document creation.
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   * @see {Document#_preCreate}
   */
  async _preCreate(data, options, userId) {
    const allowed = await super._preCreate(data, options, userId);
    if (allowed === false) {
      return false;
    }

    const updates = {};
    assignDefaultImage(this, updates, data, this._getDefaultImage());
    await this.updateSource(updates);

    return allowed;
  }

  /**
   * Get the default image path for this actor type.
   * @returns {string}
   * @protected
   */
  _getDefaultImage() {
    const cls = CONFIG.Actor.documentClasses[this.type];
    if (cls && cls.prototype._getDefaultImage !== TwodsixActor.prototype._getDefaultImage) {
      return cls.prototype._getDefaultImage.call(this);
    }
    return foundry.documents.BaseActor.DEFAULT_ICON;
  }

  /**
   * Perform preliminary operations before a Document of this type is updated.
   * Pre-update operations only occur for the client which requested the operation.
   * @param {object} data            The data object that is changed - NOT always relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {BaseUser} user   The User requesting the document update
   * @returns {Promise<boolean|void>}   A return value of false indicates the update operation should be cancelled.
   * @see {Document#_preUpdate}
   */
  async _preUpdate(data, options, user) {
    return super._preUpdate(data, options, user);
  }

  /**
   * Perform follow-up operations after a Document of this type is updated.
   * Post-update operations occur for all clients after the update is broadcast.
   * @param {object} changed            The differential data that was changed relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onUpdate}
   */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
  }

  /**
   * @returns {Promise<void>}
   */
  async _onDelete() {
    // Base no-op. Subclasses override when cleanup is needed.
  }

  /**
   * Augment the basic actor data with additional dynamic data.
   * Subclasses override this to provide type-specific derived data.
   * @returns {void}
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    this._prepareSkillProxy();
  }

  /**
   * Initializes the system.skills Proxy to allow easy skill lookup by name.
   * This is done in the base class to ensure it's available as early as possible.
   * @protected
   */
  _prepareSkillProxy() {
    const {system} = this;
    if (!system) {
      return;
    }

    const untrainedSkill = this.getUntrainedSkill();
    const untrainedValue = untrainedSkill?.system.value ?? CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
    const actorSkills = this.itemTypes.skills.map(
      (skill) => [simplifySkillName(skill.name ?? ""), Math.max(skill.system.value, untrainedValue)]
    );

    const handler = {
      has: (target, property) => {
        return property[property.length - 1] !== "_" ? true : property.slice(0, -1) in target;
      },
      get: (target, property) => {
        if (property[property.length - 1] === "_") {
          const newName = property.slice(0, -1);
          return newName in target && target[newName] > 0 ? target[newName] : 0;
        } else {
          return property in target ? target[property] : untrainedValue;
        }
      }
    };

    system.skills = new Proxy(Object.fromEntries(actorSkills), handler);

    // If we're missing the untrained skill ID in system data but we found the item, sync it back to source.
    // This handles the gap between item creation and system data update during _preCreate.
    if (!system.untrainedSkill && untrainedSkill?.id) {
      system.untrainedSkill = untrainedSkill.id;
    }
  }

  /**
   * Method to evaluate the armor and radiation protection values for all armor worn.
   * @returns {object} An object of the total for primaryArmor, secondaryArmor, and radiationProteciton
   */
  getArmorValues() {
    const returnValue = {
      primaryArmor: 0,
      secondaryArmor: 0,
      radiationProtection: 0,
      layersWorn: 0,
      wearingNonstackable: false,
      CTLabel: "nothing",
      armorDM: 0,
      reflectOn: false,
      protectionTypes: [],
      totalArmor: 0
    };
    const armorItems = this.itemTypes.armor;
    const useMaxArmorValue = game.settings.get('twodsix', 'useMaxArmorValue');
    const damageTypes = getDamageTypes(false);
    const ruleset = game.settings.get('twodsix', 'ruleset');
    let reflectDM = 0;

    for (const armor of armorItems) {
      if (armor.system.equipped === "equipped") {
        if (armor.system.armorType === 'reflec') {
          returnValue.reflectOn = true;
          reflectDM = armor.system.armorDM;
        } else {
          returnValue.CTLabel = armor.system.armorType;
          returnValue.armorDM = armor.system.armorDM;
        }

        returnValue.layersWorn += 1;
        if (armor.system.nonstackable) {
          returnValue.wearingNonstackable = true;
        }

        // Skip armor value calculations for CT ruleset
        if (ruleset === "CT") {
          continue;
        }

        // For non-CT rulesets, calculate armor values
        const protectionDetails = armor.system.secondaryArmor.protectionTypes.map((type) => `${damageTypes[type]}`);

        protectionDetails.forEach((type) => {
          if (!returnValue.protectionTypes.includes(type)) {
            returnValue.protectionTypes.push(type);
          }
        });

        const totalArmor = stackArmorValues(armor.system.secondaryArmor.value, armor.system.armor);

        if (useMaxArmorValue) {
          returnValue.primaryArmor = Math.max(armor.system.armor, returnValue.primaryArmor);
          if (totalArmor > returnValue.totalArmor) {
            returnValue.secondaryArmor = armor.system.secondaryArmor.value;
            returnValue.totalArmor = totalArmor;
          }
          returnValue.radiationProtection = Math.max(armor.system.radiationProtection.value, returnValue.radiationProtection);
        } else {
          returnValue.primaryArmor = stackArmorValues(returnValue.primaryArmor, armor.system.armor);
          returnValue.secondaryArmor = stackArmorValues(returnValue.secondaryArmor, armor.system.secondaryArmor.value);
          returnValue.totalArmor = stackArmorValues(returnValue.totalArmor, totalArmor);
          returnValue.radiationProtection += armor.system.radiationProtection.value;
        }
      }
    }

    // Case where only wearing reflec
    if (returnValue.reflectOn && returnValue.CTLabel === 'nothing') {
      returnValue.CTLabel = 'reflec';
      returnValue.armorDM = reflectDM;
    }

    return returnValue;
  }

  /**
   * Method to evaluate the secondary armor value depending on the damge type and actor type. Returns the effective value
   * for the secondary armor.
   * @param {string} damageType  The damage type key to check against secondary armor
   * @returns {number} The value added to effective armor due to secondary armor
   */
  getSecondaryProtectionValue(damageType) {
    return 0;
  }

  /**
   * Calculate the maximum encumbrance for this actor, using the configured formula and optionally excluding the encumbrance bonus.
   *
   * The formula is defined in system settings ('maxEncumbrance') and may reference any actor data (e.g., STR mod, skills).
   * If the Item Piles module is active and the actor is a merchant, returns Infinity.
   *
   * @param {boolean} [includeOffset=true]  Whether to include system.encumbrance.bonus in the calculation.
   * @returns {number} The calculated maximum encumbrance (clamped to zero or above).
   */
  getMaxEncumbrance(includeOffset = true) {
    //Ignore encumbrance if an active ItemPiles Shop
    if (game.modules.get("item-piles")?.active) {
      if (this.getFlag("item-piles", "data.enabled") && this.getFlag("item-piles", "data.type") === "merchant") {
        return Infinity;
      }
    }

    let maxEncumbrance = 0;
    const encumbFormula = game.settings.get('twodsix', 'maxEncumbrance');
    if (Roll.validate(encumbFormula)) {
      const rollData = foundry.utils.deepClone(this.system);
      if (game.settings.get('twodsix', 'ruleset') === 'CT') {
        const encumberedEffect = this.effects.find(eff => eff.statuses.has('encumbered'));
        if (encumberedEffect) {
          for (const change of encumberedEffect.system.changes) {
            const rollKey = change.key.replace('system.', '');
            foundry.utils.mergeObject(rollData, {[rollKey]: foundry.utils.getProperty(this, change.key) - parseInt(change.value)});
          }
        }
      }
      maxEncumbrance = Roll.safeEval(Roll.replaceFormulaData(encumbFormula, rollData, {missing: "0", warn: false}));
    }
    if (includeOffset) {
      maxEncumbrance += this.system.encumbrance.offset || 0;
    }
    return Math.max(maxEncumbrance, 0);
  }

  /**
   * @returns {number}
   */
  getActorEncumbrance() {
    let encumbrance = 0;
    const actorItems = this.items.filter(i => ![...TWODSIX.WeightlessItems, "ship_position", "storage"].includes(i.type));
    for (const item of actorItems) {
      encumbrance += getEquipmentWeight(item);
    }
    return encumbrance;
  }

  /**
   * @param {object} damagePayload
   * @param {boolean} [showDamageDialog]
   * @returns {Promise<void>}
   */
  async damageActor(damagePayload, showDamageDialog = true) {
    if (!damagePayload?.damageValue || damagePayload.damageValue < 0) {
      console.log("Invalid damage value");
      return;
    }
    if (showDamageDialog) {
      const damageData = foundry.utils.duplicate(damagePayload);
      Object.assign(damageData, {
        damageId: "damage-" + foundry.utils.randomID(),
        actor: this,
        targetUuid: this.uuid
      });
      game.socket?.emit("system.twodsix", ["createDamageDialog", damageData]);
      Hooks.call('createDamageDialog', damageData);
    } else {
      const canOnlyBeBlocked = damagePayload.canBeBlocked && !damagePayload.canBeParried;
      const parryArmor = damagePayload.canBeParried || damagePayload.canBeBlocked ? await getParryValue(this, canOnlyBeBlocked) : 0;
      const stats = new Stats(this, damagePayload.damageValue, damagePayload.armorPiercingValue, damagePayload.damageType, damagePayload.damageLabel, parryArmor, canOnlyBeBlocked, damagePayload.dice);
      await stats.applyDamage();
    }
  }

  /**
   * @param {object} charDiff
   * @returns {number}
   */
  getDeltaHits(charDiff) {
    const newCharacteristics = foundry.utils.mergeObject(foundry.utils.duplicate(this.system.characteristics), charDiff);
    const updatedHitValues = this.getCurrentHits(newCharacteristics);
    const deltaHits = this.system.hits.value - updatedHitValues.value;
    if (deltaHits !== 0 && game.settings.get("twodsix", "showHitsChangesInChat")) {
      const appliedType = deltaHits > 0 ? game.i18n.localize("TWODSIX.Actor.damage") : game.i18n.localize("TWODSIX.Actor.healing");
      const actionWord = game.i18n.localize("TWODSIX.Actor.Applied");
      ChatMessage.create({
        flavor: `${actionWord} ${appliedType}: ${Math.abs(deltaHits)}`,
        speaker: ChatMessage.getSpeaker({actor: this}),
        whisper: ChatMessage.getWhisperRecipients("GM")
      });
    }
    return isNaN(deltaHits) ? 0 : deltaHits;
  };

  /**
   * @param {object} currentCharacteristics
   * @returns {{value: number, max: number, lastDelta: number}}
   */
  getCurrentHits(currentCharacteristics) {
    const hitsCharacteristics = getDamageCharacteristics(this.type);
    return Object.entries(currentCharacteristics).reduce((hits, [key, chr]) => {
      if (hitsCharacteristics.includes(key)) {
        hits.value += chr.value - chr.damage;
        hits.max += chr.value;
      }
      return hits;
    }, {value: 0, max: 0, lastDelta: 0});
  }

  /**
   * @param {string} characteristic
   * @returns {number}
   */
  getCharacteristicModifier(characteristic) {
    if (characteristic === 'NONE') {
      return 0;
    }
    const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
    return (this.system).characteristics[keyByValue].mod;
  }

  /**
   * @param {object} tmpSettings
   * @param {boolean} showThrowDialog
   * @param {boolean} [showInChat]
   * @returns {Promise<TwodsixDiceRoll | undefined>}
   */
  async characteristicRoll(tmpSettings, showThrowDialog, showInChat = true) {
    //Set charactersitic label
    if (!tmpSettings.rollModifiers?.characteristic) {
      ui.notifications.error("TWODSIX.Errors.NoCharacteristicForRoll", {localize: true});
      return;
    }
    //Select Difficulty if needed
    if (!tmpSettings.difficulty) {
      const difficultyObject = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
      tmpSettings.difficulty = game.settings.get('twodsix', 'ruleset') === 'CU' ? difficultyObject.Routine : difficultyObject.Average;
    }
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, undefined, undefined, this);
    if (!settings.shouldRoll) {
      return;
    }

    const diceRoll = new TwodsixDiceRoll(settings, this);
    await diceRoll.evaluateRoll();
    if (showInChat) {
      await diceRoll.sendToChat(settings.difficulties);
    }
    return diceRoll;
  }

  /**
   * @returns {TwodsixItem | undefined}
   */
  getUntrainedSkill() {
    const untrainedSkill = this.items.get(this.system.untrainedSkill);
    if (untrainedSkill) {
      return untrainedSkill;
    }
    return this.itemTypes.skills?.find(sk => (sk.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) || sk.getFlag("twodsix", "untrainedSkill"));
  }

  /**
   * @returns {object | undefined}
   */
  createUntrainedSkillData() {
    if (this.getUntrainedSkill()) {
      return;
    }
    return buildUntrainedSkillData();
  }

  /**
   * @returns {object | undefined}
   */
  createUnarmedData() {
    if (this.items?.getName(game.i18n.localize("TWODSIX.Items.Weapon.Unarmed"))) {
      return;
    }
    const bandSetting = game.settings.get('twodsix', 'rangeModifierType');
    let rangeSetting = "";
    if (bandSetting === 'CT_Bands') {
      rangeSetting = "hands";
    } else if (bandSetting === 'CE_Bands') {
      rangeSetting = "closeQuarters";
    } else if (bandSetting === 'CU_Bands') {
      rangeSetting = "personal";
    }
    return {
      "name": game.i18n.localize("TWODSIX.Items.Weapon.Unarmed"),
      "type": "weapon",
      "img": "systems/twodsix/assets/icons/unarmed.svg",
      "system": {
        "armorPiercing": 0,
        "description": game.i18n.localize("TWODSIX.Items.Weapon.UnarmedDescription"),
        "type": "weapon",
        "damage": game.settings.get("twodsix", "unarmedDamage") || "1d6",
        "quantity": 1,
        "skill": this.getUntrainedSkill()?.id || "",
        "equipped": "equipped",
        "damageType": game.settings.get('twodsix', 'ruleset') === 'CU' ? "melee" : "bludgeoning",
        "range": "Melee",
        "rangeBand": rangeSetting,
        "handlingModifiers": game.settings.get('twodsix', 'ruleset') === 'CT' ? "STR 6/-2 9/1" : ""
      }
    };
  }

  /**
   * @param {string} attribute    The characteristic attribute (full name) being changed or generic "hits" attribute
   * @param {number} value  The change to the attribute (either a delta or direct value)
   * @param {boolean} isDelta Whether the value is a delta or an absolute number
   * @param {boolean} isBar Whether the value is a bar on token
   * @returns {Promise}
   */
  async modifyTokenAttribute(attribute, value, isDelta, isBar) {
    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
  }

  /**
   * Function to add a dropped skill to an actor
   * @param {TwodsixItem} skill    The skill document
   * @returns {Promise<boolean>} A boolean promise of whether the drop was sucessful
   */
  async _addDroppedSkills(skill) {
    // Handle item sorting within the same Actor SHOULD NEVER DO THIS
    const sameActor = this.items.get(skill._id);
    if (sameActor) {
      console.log(`Twodsix | Moved Skill ${skill.name} to another position in the skill list`);
      return false;
    }

    //Check for pre-existing skill by same name
    const matching = this.items.find(it => it.name === skill.name && it.type === "skills");

    if (matching) {
      console.log(`Twodsix | Skill ${skill.name} already on character ${this.name}.`);
      //Increase skill value
      let updateValue = matching.system.value + 1;
      if (game.settings.get('twodsix', 'hideUntrainedSkills') && updateValue < 0) {
        updateValue = 0;
      }
      await matching.update({"system.value": updateValue});
      return false;
    }

    const addedSkill = (await this.createEmbeddedDocuments("Item", [foundry.utils.duplicate(skill)]))[0];
    if (addedSkill.system.value < 0 || !addedSkill.system.value) {
      if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
        const skillValue = CONFIG.Item.dataModels.skills.schema.getInitialValue().value ?? -3;
        addedSkill.update({"system.value": skillValue});
      } else {
        addedSkill.update({"system.value": 0});
      }
    }
    console.log(`Twodsix | Added Skill ${addedSkill.name} to character`);
    return (!!addedSkill);
  }

  /**
   * Method to add a dropped item to an actor
   * @param {TwodsixItem} item  The original item document
   * @returns {Promise<boolean>} A boolean promise of whether the drop was sucessful
   */
  async _addDroppedEquipment(item) {
    // Handle item sorting within the same Actor
    const sameActor = this.items.get(item._id);
    if (sameActor) {
      return false;
    }

    let numberToMove = item.system?.quantity ?? 1;

    //Handle moving items from another actor if enabled by settings
    if (item.actor && game.settings.get("twodsix", "transferDroppedItems")) {
      if (item.system.quantity > 1) {
        numberToMove = await getMoveNumber(item);
        if (numberToMove >= item.system.quantity) {
          await item.update({"system.equipped": "ship"});
          numberToMove = item.system.quantity;
          await item.delete();
        } else if (numberToMove === 0) {
          return false;
        } else {
          await item.update({'system.quantity': (item.system.quantity - numberToMove)});
        }
      } else if (item.system.quantity === 1) {
        await item.update({"system.equipped": "ship"});
        await item.delete();
      } else {
        return false;
      }
    }

    // Item already exists on actor
    let dupItem = {};
    if (item.type === "component") {
      dupItem = this.items.find(it => it.name === item.name && it.type === item.type && it.system.subtype === item.system.subtype);
    } else {
      dupItem = this.items.find(it => it.name === item.name && it.type === item.type);
    }

    if (dupItem) {
      console.log(`Twodsix | Item ${item.name} already on character ${this.name}.`);
      if (dupItem.type !== "skills" && dupItem.type !== "trait" && dupItem.type !== "ship_position") {
        const newQuantity = dupItem.system.quantity + numberToMove;
        await dupItem.update({"system.quantity": newQuantity});
      }
      return false;
    }

    // Create the owned item
    const itemCopy = foundry.utils.duplicate(item); //VERY IMPORTANT MUST MUTATE A COPY - OTHERWISE ORIGINAL DOCUMENT IS INVALID
    itemCopy.system.quantity = numberToMove;
    itemCopy.system.equipped = "backpack";
    if (Object.hasOwn(itemCopy, '_id')) {
      delete itemCopy._id;
    }
    if (Object.hasOwn(itemCopy, 'uuid')) {
      delete itemCopy.uuid;
    }

    // Prepare effects
    if (itemCopy.effects?.length > 0) {
      for (const effect of itemCopy.effects) {
        effect.disabled = false;
        effect.transfer = game.settings.get('twodsix', "useItemActiveEffects");
      }
    }

    //Link an actor skill with names defined by item.associatedSkillName
    itemCopy.system.skill = this.getBestSkill(itemCopy.system.associatedSkillName, false)?.id ?? this.getUntrainedSkill()?.id;

    //Remove any attached consumables
    itemCopy.system.consumables = [];
    itemCopy.system.useConsumableForAttack = '';

    //Remove consumable references
    if (itemCopy.type === "consumable") {
      itemCopy.system.parentName = "";
      itemCopy.system.parentType = "";
    }

    //Create Item
    const addedItem = (await this.createEmbeddedDocuments("Item", [itemCopy]))[0];
    console.log(`Twodsix | Added Item ${addedItem.name} to character`);
    return (!!addedItem);
  }

  /**
   * Handle a dropped item on this actor. Base fallback — subclasses override with type-specific routing.
   * @param {TwodsixItem} droppedItem   The dropped item document
   * @returns {Promise<boolean>}        True if item was successfully handled, false otherwise
   */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }

  /**
   * Handle a dropped ActiveEffect on the Actor.
   * @param {TwodsixActiveEffect} droppedEffect         Dropped ActiveEffect
   * @returns {Promise<boolean>}
   *
   */
  async handleDroppedActiveEffect(droppedEffect) {
    if (!droppedEffect || (droppedEffect.target === this)) {
      return false;
    }
    const keepId = !this.effects.has(droppedEffect.id);
    await TwodsixActiveEffect.create(droppedEffect.toObject(), {parent: this, keepId});
    return true;
  }

  /**
   * Handle a dropped Folder on the Actor.
   * @param {FolderData} folder         Extracted folder document
   * @returns {Promise<void>}
   *
   */
  async handleDroppedFolder(folder) {
    if (folder?.type === "Item" && folder?.contents.length > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: {title: game.i18n.localize("TWODSIX.Warnings.AddMultipleItems")},
        content: game.i18n.localize("TWODSIX.Warnings.ConfirmDrop")
      });
      if (confirmed) {
        for (const it of folder.contents) {
          const itemToDrop = it.uuid.startsWith("Compendium") ? await fromUuid(it.uuid) : it;
          await this.handleDroppedItem(itemToDrop);
        }
      }
    } else {
      ui.notifications.warn("TWODSIX.Warnings.CantDropFolder", {localize: true});
    }
  }

  /**
   * Handle a dropped list of items (names or uuid's) onto the Actor.
   * @param {string} list         Comma separated list of item names or uuid's
   * @returns {Promise<void>}
   * @async
   */
  async handleDroppedList(list) {
    const itemReferences = list.split(",").map(str => str.trim());
    for (const itemRef of itemReferences) {
      //Look for item could be an item name or UUID
      const newItem = foundry.utils.parseUuid(itemRef)?.id ? (await fromUuid(itemRef)) : game.items.getName(itemRef);

      if (newItem?.name) {
        await this.handleDroppedItem(newItem);
      } else {
        ui.notifications.warn(`${game.i18n.localize("TWODSIX.Warnings.CantFindItem")}: ${itemRef}`);
      }
    }
  }

  /**
   * Method to handle a dropped damage payload. Base fallback — subclasses override for type-specific damage.
   * @param {any} damagePayload The damage paylod being dropped (includes damage amount, AP value and damage type & label)
   * @param {boolean} showDamageDialog Whethter to show apply damage dialog
   * @returns {boolean}
   */
  async handleDamageData(damagePayload, showDamageDialog) {
    if (!this.isOwner && !showDamageDialog) {
      ui.notifications.error("TWODSIX.Warnings.LackPermissionToDamage", {localize: true});
      return false;
    }
    ui.notifications.warn("TWODSIX.Warnings.CantAutoDamage", {localize: true});
    return false;
  }

  /**
   * Normalize a cargo component item into a trade cargoRow object for trade logic.
   * Used for drag-and-drop cargo transfers between world and ship actors so that it can use
   * same handling as handleDroppedCargo that trade chat and report does
   *
   * @param {TwodsixItem} item - The cargo component item to normalize.
   * @returns {object|null} Normalized cargoRow object or null if not a cargo component.
   */
  buildCargoRowFromItem(item) {
    if (!item || item.type !== "component" || item.system?.subtype !== COMPONENT_SUBTYPES.CARGO) {
      return null;
    }

    return {
      name: item.name,
      illegal: item.system.isIllegal || false,
      quantity: item.system.quantity || 0,
      buyPricePerTon: item.system.buyPricePerTon || 0,
      sellPricePerTon: item.system.sellPricePerTon || 0,
      buyPriceMod: item.system.buyPriceMod || 100,
      sellPriceMod: item.system.sellPriceMod || 100
    };
  }

  /**
   * Apply transformations to this Actor's data caused by Active Effects.
   *
   * @param {string} phase Restrict application to these data paths; when omitted, applies only to
   *                              non-derived keys (base pass).
   * @returns {void}
   * @override This overrides the core FVTT method to account for modifying derived data in multiple passes
   */
  applyActiveEffects(phase) {
    const allEffects = this.appliedEffects ?? [];
    if (phase === "custom") {
      // Only custom logic for "custom" phase
      TwodsixActiveEffect.applyAllCustomEffects(this, allEffects, phase);
    } else if (phase === "encumbMax") {
      // Only consider effects with at least one encumbMax change
      const encumbMaxEffects = allEffects.filter(eff =>
        (eff.system?.changes || []).some(change => change.phase === phase)
      );
      const hasNonCustom = encumbMaxEffects.some(eff =>
        (eff.system?.changes || []).some(change => change.type !== "custom")
      );
      if (hasNonCustom) {
        super.applyActiveEffects(phase);
      }
      // Always apply custom effects for encumbMax
      const customEffects = encumbMaxEffects.filter(eff =>
        (eff.system?.changes || []).some(change => change.type === "custom")
      );
      if (customEffects.length > 0) {
        TwodsixActiveEffect.applyAllCustomEffects(this, customEffects, phase);
      }
    } else {
      super.applyActiveEffects(phase || "initial");
    }
  }

  /**
   * Build a list of system data keys that are considered "derived data" for this actor.
   * Subclasses override to provide type-specific keys.
   * @returns {string[]} An array of string keys representing derived data paths for this actor.
   */
  getDerivedDataKeys() {
    return [];
  }

  /**
   * Display changes to health as scrolling combat text.
   * Adapt the font size relative to the Actor's HP total to emphasize more significant blows.
   * @param {number} damageApplied  The change in hit points that was applied
   * @returns {void}
   */
  scrollDamage(damageApplied) {
    if (!damageApplied) {
      return;
    }
    const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
    for (const t of tokens) {
      const pct = Math.clamp(Math.abs(damageApplied) / this.system.hits.max, 0, 1);
      canvas.interface.createScrollingText(t.center, (-damageApplied).signedString(), {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
        fontSize: 22 + (32 * pct), // Range between [22, 54]
        fill: -damageApplied < 0 ? 16711680 : 65280,
        stroke: 0x000000,
        strokeThickness: 4,
        jitter: 0.25
      });
    }
  }

  /**
   * Get skills level pairs.
   * @return {object} an object with skill name /level pairs
   */
  getSkillNameList() {
    const returnObject = {};
    const skillsArray = sortByItemName(this.itemTypes.skills);
    if (!skillsArray || !this.system.skills) {
      console.warn("TWODSIX - No skills to list!");
      return returnObject;
    } else {
      if (skillsArray.length > Object.keys(this.system.skills).length) {
        ui.notifications.warn("TWODSIX.Warnings.SkillsWithDuplicateNames", {localize: true});
      }
      for (const skill of skillsArray) {
        if (!game.settings.get('twodsix', 'hideUntrainedSkills')
          || (skill.system.value >= 0 || this.system.skills[simplifySkillName(skill.name)] >= 0)
          || (skill.getFlag("twodsix", "untrainedSkill"))
          || (skill._id === this.system.untrainedSkill)) {
          Object.assign(returnObject, {[skill.uuid]: `${skill.name} (${this.system.skills[simplifySkillName(skill.name)]})`});
        }
      }
    }
    return returnObject;
  }

  /**
   * Generate a unique skill name for actor based on input name by adding numbers to end of string
   * @param {string} skillName   Input Item Name
   * @returns {string} Unique skill name based on skillName
   * @static
   */
  generateUniqueSkillName(skillName) {
    let uniqueName = skillName;
    const skills = this.system.skills;
    if (!skills) {
      return uniqueName;
    }
    while (simplifySkillName(uniqueName + "_") in skills) {
      const match = uniqueName.match(/(.*?)(\s*)(\d+)$/);
      if (match) {
        const baseName = match[1];
        const space = match[2];
        const number = parseInt(match[3], 10);
        uniqueName = `${baseName}${space}${number + 1}`;
      } else {
        uniqueName = `${uniqueName} 2`;
      }
    }
    return uniqueName;
  }

  /**
   * Method stub to execute a ship action as a method from Token Action HUD.
   * Overridden by ShipActor.
   * @param {object} action
   * @param {object} extra
   * @returns {void}
   */
  doShipAction(action, extra) {
    // Base no-op. ShipActor overrides.
  }

  /**
   * Returns skill with highest value from an actor based on a list of skills
   * @param {string} skillList A string of skills separated by pipe, e.g. "Admin | Combat"
   * @param {boolean} includeChar Whether to include default charactrisic in selection
   * @returns {TwodsixItem|undefined} the skill document selected
   */
  getBestSkill(skillList, includeChar) {
    if (skillList === undefined) {
      return undefined;  //return if associatedSkillName doesn't exist (skillList is undefined, empty string is OK).
    }
    let skill = undefined;
    const skillOptions = skillList.split("|").map(str => str.trim());
    /* add qualified skill objects to an array*/
    const skillObjects = this.itemTypes.skills?.filter((itm) => skillOptions.includes(itm.name));
    // find the most advantageous skill to use from the collection
    if (skillObjects?.length > 0) {
      skill = skillObjects.reduce((prev, current) => {
        //use this.system.skills[simplfiedSkillName] not system.value to account for Active Effects
        const prevValue = (this.system.skills ? this.system.skills[simplifySkillName(prev.name)] : prev.system.value) + (includeChar ? this.getCharMoD(prev.system.characteristic) : 0);
        const currentValue = (this.system.skills ? this.system.skills[simplifySkillName(current.name)] : current.system.value) + (includeChar ? this.getCharMoD(current.system.characteristic) : 0);
        return (prevValue > currentValue) ? prev : current;
      });
    }
    // If skill missing, try to use Untrained
    if (!skill) {
      skill = this.itemTypes.skills.find((itm) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained"));
    }
    return skill;
  }

  /**
   * Returns characteristic modifier based on the core short label (not the display label)
   * @param {string} charShort A string of the core short characteristic label (uncustomized). This is the static label and not the display label.
   * @returns {number} the characteristic value
   */
  getCharMoD(charShort) {
    if (charShort !== 'NONE' && charShort) {
      const key = getKeyByValue(TWODSIX.CHARACTERISTICS, charShort);
      return this.system.characteristics[key]?.mod ?? 0;
    } else {
      return 0;
    }
  }

  /**
   * Removes (damages) psionic characteristic and spreads excess to regular damage
   * @param {number} psiCost The number of psi points to remove
   */
  async removePsiPoints(psiCost) {
    if (psiCost > 0) {
      const netPoints = Math.min(this.system.characteristics.psionicStrength.current, psiCost);
      await this.update({'system.characteristics.psionicStrength.damage': this.system.characteristics.psionicStrength.damage + netPoints});
      if (netPoints < psiCost) {
        await this.damageActor({
          damageValue: psiCost - netPoints,
          armorPiercingValue: 9999,
          damageType: "psionic",
          damageLabel: game.i18n.localize("TWODSIX.DamageType.Psionic"),
          canBeParried: false
        }, false);
      }
    }
  }

  /**
   * Computes the maximum Jump and Thrust ratings based on installed drive components.
   * Subclasses override for ship and space-object types.
   * @returns {{ jump: number, thrust: number }}
   */
  _getDriveRatings() {
    let jump = 0;
    let thrust = 0;
    const parseRating = value => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const direct = Number(value);
        if (Number.isFinite(direct)) {
          return direct;
        }
        const match = value.match(/-?\d+(?:\.\d+)?/);
        if (match) {
          const parsed = Number(match[0]);
          return Number.isFinite(parsed) ? parsed : 0;
        }
      }
      return 0;
    };

    this.itemTypes.component.filter(
      (it) => it.system.subtype === COMPONENT_SUBTYPES.DRIVE && !["off", "destroyed"].includes(it.system.status)
    ).forEach((drive) => {
      const validRating = parseRating(drive.system.rating);
      if (drive.isMDriveComponent()) {
        thrust = Math.max(thrust, validRating);
      } else if (drive.isJDriveComponent()) {
        jump = Math.max(jump, validRating);
      }
    });
    return {jump, thrust};
  }

  /**
   * Override getRollData.
   * Subclasses override for type-specific roll data.
   * @returns {object}
   * @override
   */
  getRollData() {
    return super.getRollData();
  }
}

/**
 * Calculates the power draw for a ship component.
 * @param {TwodsixItem} item the ship component
 * @return {number} the power draw of the ship component (power units)
 */
export function getPower(item) {
  if (["operational", "damaged"].includes(item.system.status)) {
    const pf = item.system.powerDraw || 0;
    if (item.system.powerBasis === 'perUnit') {
      let quant = item.system.quantity || 1;
      if (item.system.isArmament && item.system.availableQuantity) {
        quant = parseInt(item.system.availableQuantity);
      }
      return (quant * pf);
    } else if (item.system.powerBasis === 'perHullTon') {
      // Check setting: use calcShipStats only if auto-calc is enabled
      const useAutoCalcs = game.settings.get('twodsix', 'useShipAutoCalcs');
      const massMax = (useAutoCalcs && item.actor?.system.calcShipStats?.mass?.max)
        ? item.actor.system.calcShipStats.mass.max
        : (item.actor?.system.shipStats.mass.max ?? 0);
      return pf * massMax;
    } else if (item.system.powerBasis === 'perCompTon') {
      return pf * getWeight(item);
    }
  }
  return 0;
}

/**
 * Calculates the displacement weight for a ship component.
 * @param {TwodsixItem} item the ship component
 * @return {number} the displacement of the ship component (dtons)
 */
export function getWeight(item) {
  const quant = item.system.quantity ?? 1;
  let wf = 0;
  if (item.system.weightIsPct) {
    // Check setting: use calcShipStats only if auto-calc is enabled
    const useAutoCalcs = game.settings.get('twodsix', 'useShipAutoCalcs');
    const massMax = (useAutoCalcs && item.actor?.system.calcShipStats?.mass?.max)
      ? item.actor.system.calcShipStats.mass.max
      : (item.actor?.system.shipStats.mass.max ?? 0);
    wf = (item.system.weight ?? 0) / 100 * massMax;
  } else {
    wf = item.system.weight ?? 0;
  }
  return (wf * quant);
}

/**
 * A function to delete a player actor from ship positions when that player actor is deleted.
 * @param {string} actorId the id of the actor deleted
 * @return {void}
 * @function
 */
export async function deleteIdFromShipPositions(actorId) {
  const allShips = (game.actors?.contents.filter(actor => actor.type === "ship") ?? []);

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink && token.actor.type === "ship") {
        allShips.push(token.actor);
      }
    }
  }

  for (const ship of allShips) {
    if ((ship.system).shipPositionActorIds[actorId]) {
      await ship.update({[`system.shipPositionActorIds.${actorId}`]: _del});
    }
  }
}

/**
 * Calculates the carried weight for personal equipment. Includes offset for worn armor.
 * @param {Component} item the equipment carried
 * @return {number} the weight of the carried item
 * @function
 */
function getEquipmentWeight(item) {
  if (!TWODSIX.WeightlessItems.includes(item.type)) {
    if (["backpack", "equipped"].includes(item.system.equipped)) {
      let q = item.system.quantity || 0;
      const w = item.system.weight || 0;
      if (item.type === "armor" && item.system.equipped === "equipped") {
        if (item.system.isPowered) {
          q = Math.max(0, q - 1);
        } else {
          q = Math.max(0, q - 1 + Number(game.settings.get("twodsix", "weightModifierForWornArmor")));
        }
      }
      return (q * w);
    }
  }
  return 0;
}

/**
 * A function that opens a dialog to determined the quantity moved when transfering an item.
 * @param {Component} item the equipment being transfered
 * @return {number} the quantity transfered
 * @function
 */
async function getMoveNumber(itemData) {
  const returnNumber = await foundry.applications.api.DialogV2.prompt({
    window: {
      title: "TWODSIX.Actor.Items.QuantityToTransfer",
      icon: "fa-solid fa-clipboard-question"
    },
    content:
      `<div style="display: flex; align-items: center; gap: 2ch; justify-content: center;"><img src="` + itemData.img + `" data-tooltip = "` + itemData.name + `" width="50" height="50"> ` + itemData.name + `</div>` +
      `<div><label for='amount'>` + game.i18n.localize("TWODSIX.Actor.Items.Amount") + `</label><input type="number" name="amount" value="` +
      itemData.system.quantity + `" max="` + itemData.system.quantity + `" min = "0"></input></div>`,
    ok:
      {
        icon: "fa-solid fa-arrow-right-arrow-left",
        label: "TWODSIX.Actor.Items.Transfer",
        default: true,
        callback: (event, button/*, dialog*/) => button.form.elements.amount.valueAsNumber
      }
  });
  return parseInt(returnNumber || 0);
}

/**
 * A function to check and correct when an actor is missing the Untrained skill.
 * @param {TwodsixActor} actor the actor being checked
 * @return {void}
 */
export async function correctMissingUntrainedSkill(actor) {
  if (["traveller", "robot", "animal"].includes(actor.type)) {
    //Check for missing untrained skill
    const untrainedSkill = actor.getUntrainedSkill();
    if (!untrainedSkill) {
      console.log(`TWODSIX: Fixing missing untrained skill in ${actor.id} (${actor.name}).`);
      const existingSkill = await actor.itemTypes.skills?.find(sk => (sk.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) || sk.getFlag("twodsix", "untrainedSkill"));
      if (existingSkill) {
        await actor.update({"system.untrainedSkill": existingSkill.id});
      } else {
        const untrainedSkillData = actor.createUntrainedSkillData();
        if (untrainedSkillData) {
          await actor.createEmbeddedDocuments("Item", [untrainedSkillData]);
          await actor.update({"system.untrainedSkill": untrainedSkillData['_id']});
        }
      }
    } else if (!untrainedSkill.getFlag("twodsix", "untrainedSkill")) {
      console.log(`TWODSIX: Fixing missing untrained flag in ${actor.id} (${actor.name}).`);
      await untrainedSkill.setFlag("twodsix", "untrainedSkill", true);
    }
  }
}

/**
 * @returns {object}
 */
function buildUntrainedSkillData() {
  return {
    "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
    "type": "skills",
    "_id": foundry.utils.randomID(),
    "system": {"characteristic": "NONE"},
    "flags": {'twodsix': {'untrainedSkill': true}},
    "img": "./systems/twodsix/assets/icons/jack-of-all-trades.svg"
  };
}

/**
 * @param {object} changed
 * @returns {boolean}
 */
export function isEncumbranceChange(changed) {
  if (changed.system?.characteristics?.strength) {
    return true;
  } else if (changed.system?.characteristics?.endurance && ['CEATOM', "BARBARIC"].includes(game.settings.get('twodsix', 'ruleset'))) {
    return true;
  }
  return false;
}
