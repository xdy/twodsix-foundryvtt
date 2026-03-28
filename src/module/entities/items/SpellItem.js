import { TwodsixRollSettings } from '../../utils/TwodsixRollSettings';
import TwodsixItem from './item-base.js';

/**
 * Document class for spell item type.
 * Spells are weightless but link to a sorcery skill, use level-based difficulty tables,
 * and may draw an AOE template on roll.
 * @extends {TwodsixItem}
 */
export class SpellItem extends TwodsixItem {

  /** @override */
  _getDefaultIcon() {
    return 'systems/twodsix/assets/icons/spell-book.svg';
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }
    const updates = {};
    const defaultSkill = game.settings.get("twodsix", "sorcerySkill") ?? "";
    Object.assign(updates, {
      'system.associatedSkillName': defaultSkill,
      'system.useConsumableForAttack': ""
    });

    //Try to set linked skill
    if (this.actor) {
      if (this.system.associatedSkillName === '') {
        Object.assign(updates, {"system.skill": this.actor.system.untrainedSkill});
      } else {
        const tempSkill = this.actor.getBestSkill(this.system.associatedSkillName, false);
        Object.assign(updates, {"system.skill": tempSkill?.id ?? this.actor.system.untrainedSkill});
      }
    }

    await this.updateSource(updates);
    return allowed;
  }

  /** @override */
  async _resolveSkillAndItem(_tmpSettings) {
    const skillList = `${game.settings.get("twodsix", "sorcerySkill")}|${this.system?.associatedSkillName}`;
    const skill = this.actor?.getBestSkill(skillList, false) ?? null;
    return { skill, item: this, workingActor: this.actor };
  }

  /** @override */
  async _buildRollSettings(showThrowDialog, skill, item, workingActor) {
    const workingSettings = {difficulties: {}};
    for (let i = 1; i <= game.settings.get("twodsix", "maxSpellLevel"); i++) {
      const levelKey = game.i18n.localize("TWODSIX.Items.Spells.Level") + " " + i;
      Object.assign(workingSettings.difficulties, {[levelKey]: {mod: -i, target: i + 6}});
    }
    const level = game.i18n.localize("TWODSIX.Items.Spells.Level") + " " + (this.system.value > Object.keys(workingSettings.difficulties).length ? Object.keys(workingSettings.difficulties).length : this.system.value);
    Object.assign(workingSettings, {difficulty: workingSettings.difficulties[level]});
    await this.drawItemTemplate();
    return TwodsixRollSettings.create(showThrowDialog, workingSettings, skill, item, workingActor);
  }
}
