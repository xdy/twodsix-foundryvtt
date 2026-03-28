import { CreatureActor } from './CreatureActor.js';

/** @typedef {import("../TwodsixItem").default} TwodsixItem */

/**
 * Actor document class for animal-type actors.
 * @extends {CreatureActor}
 */
export class AnimalActor extends CreatureActor {

  /** @override */
  _getDefaultImage() {
    return game.settings.get("twodsix", "themeStyle") === "western"
      ? 'systems/twodsix/assets/icons/buffalo-head.svg'
      : 'systems/twodsix/assets/icons/alien-bug.svg';
  }

  /** @override */
  _applyPreCreateTypeData(changeData) {
    foundry.utils.mergeObject(changeData, {
      system: {
        characteristics: {
          education: {label: 'Instinct', displayShortLabel: 'INS'},
          socialStanding: {label: 'Pack', displayShortLabel: 'PAK'}
        }
      }
    });
  }

  /**
   * Roll reaction for this animal and post result to chat.
   * @returns {Promise<void>}
   */
  async rollReaction() {
    if (!this.isOwner) {
      ui.notifications.warn("TWODSIX.Warnings.LackPermissionToRoll", {localize: true});
      return;
    }

    const reaction = this.system.reaction;
    let rollString = "2d6";
    if (this.system.conditions?.woundedEffect) {
      rollString += " + @conditions.woundedEffect";
    }
    const roll = await (new Roll(rollString, this.getRollData()).roll({messageMode: "gm"}));

    if (isNaN(reaction.flee) || isNaN(reaction.attack) || reaction.flee >= reaction.attack) {
      ui.notifications.warn("TWODSIX.Warnings.InvalidReactionInputs", {localize: true});
      return;
    }

    let flavor;
    if (roll.total >= reaction.attack) {
      flavor = game.i18n.localize("TWODSIX.Animal.AttacksMessage");
    } else if (roll.total <= reaction.flee) {
      flavor = game.i18n.localize("TWODSIX.Animal.FleesMessage");
    } else {
      flavor = game.i18n.localize("TWODSIX.Animal.NoReactionMessage");
    }
    await roll.toMessage({
      title: game.i18n.localize("TWODSIX.Animal.Reaction"),
      speaker: ChatMessage.getSpeaker({alias: this.name}),
      flavor: flavor,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    }, {messageMode: "gm"});
  }

  /**
   * Roll morale for this animal and post result to chat.
   * @returns {Promise<void>}
   */
  async rollMorale() {
    if (!this.isOwner) {
      ui.notifications.warn("TWODSIX.Warnings.LackPermissionToRoll", {localize: true});
      return;
    }

    let rollString = "2d6";
    if (this.system.conditions?.woundedEffect) {
      rollString += " + @conditions.woundedEffect";
    }
    if (this.system.moraleDM) {
      rollString += " + @moraleDM";
    }
    const roll = await new Roll(rollString, this.getRollData()).roll({messageMode: "gm"});

    let flavor;
    if (roll.total <= 5) {
      flavor = game.i18n.localize("TWODSIX.Animal.Retreat");
    } else if (roll.total <= 8) {
      flavor = game.i18n.localize("TWODSIX.Animal.FightingWithdrawal");
    } else if (roll.total <= 11) {
      flavor = game.i18n.localize("TWODSIX.Animal.KeepFighting");
    } else if (roll.total <= 15) {
      flavor = game.i18n.localize("TWODSIX.Animal.Advance");
    } else {
      flavor = game.i18n.localize("TWODSIX.Animal.FightToTheDeath");
    }
    await roll.toMessage({
      title: game.i18n.localize("TWODSIX.Animal.MoraleRoll"),
      speaker: ChatMessage.getSpeaker({alias: this.name}),
      flavor: flavor,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      rolls: [roll]
    }, {messageMode: "gm"});
  }

  /** @override */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    if (droppedItem.type === 'skills') {
      return this._addDroppedSkills(droppedItem);
    } else if (["weapon", "trait"].includes(droppedItem.type)) {
      return await this._addDroppedEquipment(droppedItem);
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }
}
