import { TWODSIX } from '../../config';
import { TwodsixRollSettings } from '../../utils/TwodsixRollSettings';
import TwodsixItem from './item-base.js';

/**
 * Document class for psiAbility item type.
 * PSI abilities are weightless but can have skill links and consumables.
 * Routes doSkillTalentRoll to doPsiAction instead of a generic skill roll.
 * @extends {TwodsixItem}
 */
export class PsiAbilityItem extends TwodsixItem {

  /** @override */
  _getDefaultIcon() {
    return 'systems/twodsix/assets/icons/extra-lucid.svg';
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }
    const updates = {};

    //Remove any attached consumables
    if (this.system.consumables?.length > 0) {
      Object.assign(updates, {"system.consumables": []});
    }
    Object.assign(updates, {"system.useConsumableForAttack": ""});

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
  async _buildRollSettings(showThrowDialog, skill, item, workingActor) {
    const workingSettings = {};
    if (this.system.difficulty) {
      Object.assign(workingSettings, {difficulty: TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')][this.system.difficulty]});
    }
    return TwodsixRollSettings.create(showThrowDialog, workingSettings, skill, item, workingActor);
  }

  /** @override */
  async doSkillTalentRoll(showThrowDiag, _tmpSettings) {
    if (['core', 'alternate'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
      ui.notifications.warn("TWODSIX.Warnings.NotUsingPsiStrength", {localize: true});
    } else {
      await this.doPsiAction(showThrowDiag);
    }
  }
}
