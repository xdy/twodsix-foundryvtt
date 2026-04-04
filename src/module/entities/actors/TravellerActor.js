import { updateFinances } from '../../hooks/updateFinances';
import { stackArmorValues } from '../../utils/actorDamage';
import { deleteIdFromShipPositions } from './actor-base.js';
import { CreatureActor } from './CreatureActor.js';

/** @typedef {import("../TwodsixItem").default} TwodsixItem */

/**
 * Actor document class for traveller-type actors (player characters and NPCs).
 * @extends {CreatureActor}
 */
export class TravellerActor extends CreatureActor {

  /** @override */
  _getDefaultImage() {
    return game.settings.get("twodsix", "themeStyle") === "western"
      ? 'systems/twodsix/assets/icons/bandit.png'
      : 'systems/twodsix/assets/icons/default_actor.png';
  }

  /** @override */
  _applyPreCreateTypeData(changeData) {
    if (game.settings.get("twodsix", "defaultTokenSettings")) {
      foundry.utils.mergeObject(changeData, {
        prototypeToken: {
          displayName: CONST.TOKEN_DISPLAY_MODES.OWNER,
          displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
          sight: {
            enabled: true,
            visonMode: "basic",
            brightness: 1
          },
          disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
          bar1: {
            attribute: "hits"
          }
        }
      });
    }
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);

    const financeDiff = {
      finances: data?.system?.finances ? foundry.utils.diffObject(this.system._source.finances, data.system.finances) : {},
      financeValues: data?.system?.financeValues ? foundry.utils.diffObject(this.system._source.financeValues, data.system.financeValues) : {}
    };
    if (!foundry.utils.isEmpty(financeDiff.finances) || !foundry.utils.isEmpty(financeDiff.financeValues)) {
      updateFinances(this, data, financeDiff);
    }

    return allowed;
  }

  /** @override */
  async _onDelete() {
    if (this.id) {
      await deleteIdFromShipPositions(this.id);
    }
  }

  /** @override */
  async _prepareActorDerivedData() {
    await super._prepareActorDerivedData();

    const {system} = this;
    if (!system.characteristics || !system.hits || !system.encumbrance) {
      return;
    }

    // Apply armor values for traveller
    const armorValues = this.getArmorValues();
    system.primaryArmor.value = armorValues.primaryArmor;
    system.secondaryArmor.value = armorValues.secondaryArmor;
    system.radiationProtection.value = armorValues.radiationProtection;
    system.layersWorn = armorValues.layersWorn;
    system.wearingNonstackable = armorValues.wearingNonstackable;
    system.armorType = armorValues.CTLabel;
    system.armorDM = armorValues.armorDM || 0;
    system.reflectOn = armorValues.reflectOn;
    system.protectionTypes = armorValues.protectionTypes.length > 0 ? ": " + armorValues.protectionTypes.map(x => game.i18n.localize(x)).join(', ') : "";
    system.totalArmor = armorValues.totalArmor;
    system.primaryArmor.base = system.primaryArmor.value;
    if (this.overrides.system?.primaryArmor?.value) {
      system.totalArmor += this.overrides.system.primaryArmor.value - system.primaryArmor.base;
    }
  }

  /** @override */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    if (droppedItem.type === 'skills') {
      return await this._addDroppedSkills(droppedItem);
    } else if (!["component", "ship_position", "career", "chargen_ruleset"].includes(droppedItem.type)) {
      return await this._addDroppedEquipment(droppedItem);
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }

  /**
   * Toggle the equipped state of an item, syncing associated consumables and warning about non-stackable armor.
   * @param {TwodsixItem} item - The item to toggle.
   * @returns {Promise<void>}
   */
  async toggleItemEquipped(item) {
    const newState = getNewEquippedState(item);
    const itemUpdates = [{_id: item.id, "system.equipped": newState}];
    for (const consumableId of item.system.consumables) {
      const consumable = this.items.get(consumableId);
      if (consumable) {
        itemUpdates.push({_id: consumable.id, "system.equipped": newState});
      }
    }
    await this.updateEmbeddedDocuments("Item", itemUpdates);
    if (this.system.layersWorn > 1 && this.system.wearingNonstackable && item.type === 'armor') {
      ui.notifications.warn("TWODSIX.Warnings.WearingMultipleLayers", {localize: true});
    }
  }

  /** @override */
  getDerivedDataKeys() {
    const derivedData = super.getDerivedDataKeys();
    derivedData.push(
      "encumbrance.max",
      "encumbrance.value",
      "primaryArmor.value",
      "secondaryArmor.value",
      "radiationProtection.value",
      "conditions.encumberedEffect",
      "conditions.woundedEffect"
    );
    return [...new Set(derivedData)];
  }

  /** @override */
  getSecondaryProtectionValue(damageType) {
    if (damageType !== "NONE" && damageType !== "" && damageType) {
      const armorItems = this.itemTypes.armor;
      const useMaxArmorValue = game.settings.get('twodsix', 'useMaxArmorValue');
      let returnValue = 0;

      for (const armor of armorItems) {
        if (armor.system.equipped === "equipped" && armor.system.secondaryArmor.protectionTypes.includes(damageType)) {
          if (useMaxArmorValue) {
            returnValue = Math.max(armor.system.secondaryArmor.value, returnValue);
          } else {
            returnValue = stackArmorValues(returnValue, armor.system.secondaryArmor.value);
          }
        }
      }
      return returnValue;
    }
    return 0;
  }
}

/**
 * Determine the new equipped state after toggling.
 * @param {TwodsixItem} itemSelected   The item to change the equipped state.
 * @returns {string} The new equipped state based on old one and display setting
 */
function getNewEquippedState(itemSelected) {
  const currentState = itemSelected.system.equipped;
  if (!currentState) {
    return 'backpack';
  } else {
    switch (game.settings.get('twodsix', 'equippedToggleStates')) {
      case 'all':
        return {
          'vehicle': 'ship',
          'ship': 'base',
          'base': 'backpack',
          'backpack': 'equipped',
          'equipped': 'vehicle'
        }[currentState];
      case 'core':
        return {
          'vehicle': 'backpack',
          'ship': 'backpack',
          'base': 'backpack',
          'backpack': 'equipped',
          'equipped': 'backpack'
        }[currentState];
      case 'default':
      default:
        return {
          'vehicle': 'backpack',
          'ship': 'backpack',
          'base': 'backpack',
          'backpack': 'equipped',
          'equipped': 'ship'
        }[currentState];
    }
  }
}
