import TwodsixItem from './item-base.js';

/**
 * Document class for skills item type.
 * Skills act as their own skill for rolls and apply untrained skill value correction.
 * @extends {TwodsixItem}
 */
export class SkillItem extends TwodsixItem {

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
    if (game.settings.get('twodsix', 'hideUntrainedSkills') && !this.getFlag('twodsix', 'untrainedSkill') && this.system.value < 0) {
      await this.updateSource({"system.value": 0});
    }
    return allowed;
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    // Enforce unique skill names within an actor
    if (data.name !== undefined && this.actor) {
      const uniqueName = this.actor.generateUniqueSkillName(data.name);
      if (uniqueName !== data.name) {
        data.name = uniqueName;
      }
    }
    return allowed;
  }

  /** @override */
  async _resolveSkillAndItem(_tmpSettings) {
    return { skill: this, item: undefined, workingActor: this.actor };
  }
}
