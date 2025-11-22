/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */

import { getDiceResults } from "../entities/TwodsixItem";
import { simplifyRollFormula } from "../utils/dice";
import { confirmRollFormula, getDamageTypes } from "../utils/sheetUtils";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";

export class TwodsixSpaceObjectSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixSpaceObjectSheet",
    classes: ["twodsix", "space-object", "actor"],
    dragDrop: [{dragSelector: ".item", dropSelector: null}],
    position: {
      width: 'auto',
      height: 'auto'
    },
    window: {
      resizable: false,
      icon: "fa-solid fa-satellite"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      rollSODamage: this._onRollSODamage,
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/space-object-sheet.hbs",
      //scrollable: ['']
    }
  };

  /**
   * @returns {Promise<void>}
   */
  static async _onRollSODamage() {
    const actor = this.actor;
    let rollFormula = await confirmRollFormula(actor.system.damage, game.i18n.localize("TWODSIX.Damage.DamageFormula"));
    rollFormula = rollFormula.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
    rollFormula = simplifyRollFormula(rollFormula);
    let damage = {};

    if (Roll.validate(rollFormula)) {
      damage = new Roll(rollFormula, actor.system);
      await damage.evaluate(); // async: true will be default in foundry 0.10
    } else {
      ui.notifications.error("TWODSIX.Errors.InvalidRollFormula", {localize: true});
      return;
    }

    const contentData = {};
    const flavor = game.i18n.localize("TWODSIX.Damage.Damage");
    const damageLabels = getDamageTypes(true);
    const damageType = "NONE";
    Object.assign(contentData, {
      flavor: flavor,
      roll: damage,
      dice: getDiceResults(damage), //damage.terms[0]["results"]
      armorPiercingValue: 0,
      damageValue: (damage.total && damage.total > 0) ? damage.total : 0,
      damageType: damageType,
      damageLabel: damageLabels[damageType] ?? ""
    });

    const html = await foundry.applications.handlebars.renderTemplate('systems/twodsix/templates/chat/damage-message.hbs', contentData);
    const transfer = JSON.stringify(
      {
        type: 'damageItem',
        payload: contentData
      }
    );
    await damage.toMessage({
      title: game.i18n.localize("TWODSIX.Damage.DamageCard"),
      speaker: this.actor ? ChatMessage.getSpeaker({actor: actor}) : null,
      content: html,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      rolls: [damage],
      flags: {
        "core.canPopout": true,
        "twodsix.transfer": transfer,
        "twodsix.itemUUID": "",
        "twodsix.rollClass": "Damage",
        "twodsix.tokenUUID": (this.actor).getActiveTokens()[0]?.document.uuid ?? ""
      }
    });
  }

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (game.settings.get('twodsix', 'useProseMirror')) {
      const TextEditorImp = foundry.applications.ux.TextEditor.implementation;
      context.richText = {
        description: await TextEditorImp.enrichHTML(context.system.description, {secrets: this.document.isOwner}),
        notes: await TextEditorImp.enrichHTML(context.system.notes, {secrets: this.document.isOwner})
      };
    }
    return context;
  }
}
