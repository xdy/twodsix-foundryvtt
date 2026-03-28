import { simplifyRollFormula } from '../../utils/dice';
import { getDamageTypes } from '../../utils/sheetUtils';
import { getDiceResults } from '../TwodsixItem';
import { TwodsixVehicleBaseActor } from './TwodsixVehicleBaseActor.js';

/**
 * Actor document class for space-object-type actors (planets, asteroids, celestial bodies).
 * @extends {TwodsixVehicleBaseActor}
 */
export class SpaceObjectActor extends TwodsixVehicleBaseActor {

  /** @override */
  _getDefaultImage() {
    return game.settings.get("twodsix", "themeStyle") === "western"
      ? 'systems/twodsix/assets/icons/cactus.png'
      : 'systems/twodsix/assets/icons/default_space-object.png';
  }

  /**
   * Evaluate a damage roll and post a damage chat card.
   * The caller is responsible for confirming/resolving the formula via UI before calling this.
   * @param {string} formula - The resolved roll formula (DD already parsed to d6*10).
   * @returns {Promise<void>}
   */
  async rollDamage(formula) {
    const rollFormula = simplifyRollFormula(formula);
    if (!Roll.validate(rollFormula)) {
      ui.notifications.error("TWODSIX.Errors.InvalidRollFormula", {localize: true});
      return;
    }

    const damage = new Roll(rollFormula, this.system);
    await damage.evaluate();

    const damageLabels = getDamageTypes(true);
    const damageType = "NONE";
    const contentData = {
      flavor: game.i18n.localize("TWODSIX.Damage.Damage"),
      roll: damage,
      dice: getDiceResults(damage),
      armorPiercingValue: 0,
      damageValue: (damage.total && damage.total > 0) ? damage.total : 0,
      damageType: damageType,
      damageLabel: damageLabels[damageType] ?? ""
    };

    const html = await foundry.applications.handlebars.renderTemplate('systems/twodsix/templates/chat/damage-message.hbs', contentData);
    const transfer = JSON.stringify({type: 'damageItem', payload: contentData});
    await damage.toMessage({
      title: game.i18n.localize("TWODSIX.Damage.DamageCard"),
      speaker: ChatMessage.getSpeaker({actor: this}),
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      rolls: [damage],
      flags: {
        "core.canPopout": true,
        "twodsix.transfer": transfer,
        "twodsix.itemUUID": "",
        "twodsix.rollClass": "Damage",
        "twodsix.tokenUUID": this.getActiveTokens()[0]?.document.uuid ?? ""
      }
    });
  }

}
