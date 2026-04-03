import { applyAllStatusEffects } from '../../utils/showStatusIcons';
import TwodsixItem from './item-base.js';

/**
 * Document class for physical gear item types:
 * equipment, tool, armor, augment, storage, junk, computer, consumable.
 * Handles consumable cleanup on create, skill link, prepareConsumableData, and encumbrance checks.
 * @extends {TwodsixItem}
 */
export class GearItem extends TwodsixItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }
    const updates = {};

    //Remove any attached consumables - needed for modules (like Monks Enhanced Journals) that have own drop management
    if (this.system.consumables?.length > 0) {
      Object.assign(updates, {"system.consumables": []});
    }
    Object.assign(updates, {"system.useConsumableForAttack": ""});

    //Try to set linked skill (only if not already set, e.g. by _addDroppedEquipment)
    if (this.actor && !this.system.skill) {
      if (this.system.associatedSkillName === '') {
        Object.assign(updates, {"system.skill": this.actor.getUntrainedSkill()?.id ?? this.actor.system.untrainedSkill});
      } else {
        const tempSkill = this.actor.getBestSkill(this.system.associatedSkillName, false);
        Object.assign(updates, {"system.skill": tempSkill?.id ?? this.actor.getUntrainedSkill()?.id ?? this.actor.system.untrainedSkill});
      }
    }

    await this.updateSource(updates);
    return allowed;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.prepareConsumableData();
  }

  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (game.user?.id === userId) {
      const owningActor = this.actor;
      if (owningActor && game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && owningActor.type === 'traveller' && !options?.dontSync) {
        if (changed.system) {
          if (Object.hasOwn(changed.system, "weight") || Object.hasOwn(changed.system, "quantity") || Object.hasOwn(changed.system, "equipped")) {
            await applyAllStatusEffects(owningActor, {encumbrance: true, wounded: false});
          }
        }
      }
    }
  }
}
