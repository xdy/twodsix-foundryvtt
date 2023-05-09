import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import {confirmRollFormula, deletePDFReference, openPDFReference} from "../utils/sheetUtils";
import {TWODSIX} from "../config";
import {simplifyRollFormula} from "../utils/dice";
import {getDiceResults} from "../entities/TwodsixItem";

export class TwodsixSpaceObjectSheet extends AbstractTwodsixActorSheet {
  /** @override */
  getData() {
    const context = super.getData();
    context.system = this.actor.system;
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(this.actor, context);
    context.settings = {
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs')
    };
    if (game.settings.get('twodsix', 'useProseMirror')) {
      context.richText = {
        description: TextEditor.enrichHTML(context.system.description, {async: false}),
        notes: TextEditor.enrichHTML(context.system.notes, {async: false})
      };
    }
    context.config = TWODSIX;
    return context;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "space-object", "actor"],
      template: "systems/twodsix/templates/actors/space-object-sheet.html",
      width: 'auto',
      height: 'auto',
      resizable: true,
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.roll-damage').on('click', this.onRollDamage.bind(this, this.actor));
    html.find('.open-link').on('click', openPDFReference.bind(this, this.actor.system.docReference));
    html.find('.delete-link').on('click', deletePDFReference.bind(this));
  }

  async onRollDamage(actor) {
    let rollFormula = await confirmRollFormula(actor.system.damage, game.i18n.localize("TWODSIX.Damage.DamageFormula"));
    rollFormula = rollFormula.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
    rollFormula = simplifyRollFormula(rollFormula);
    let damage = {};
    if (Roll.validate(rollFormula)) {
      damage = new Roll(rollFormula, this.actor?.system);
      await damage.evaluate({async: true}); // async: true will be default in foundry 0.10
    } else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.InvalidRollFormula"));
      return;
    }
    const contentData = {};
    const flavor = game.i18n.localize("TWODSIX.Damage.Damage");
    Object.assign(contentData, {
      flavor: flavor,
      roll: damage,
      dice: getDiceResults(damage),
      armorPiercingValue: 0,
      damageValue: (damage.total && damage.total > 0) ? damage.total : 0,
      damageType: ""
    });
    const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);
    const transfer = JSON.stringify({
      type: 'damageItem',
      payload: contentData
    });
    await damage.toMessage({
      speaker: this.actor ? ChatMessage.getSpeaker({actor: this.actor}) : null,
      content: html,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [damage],
      flags: {
        "core.canPopout": true,
        "transfer": transfer,
        "twodsix.itemUUID": "",
        "twodsix.rollClass": "Damage",
        "twodsix.tokenUUID": this.actor.getActiveTokens()[0]?.document.uuid ?? ""
      }
    });
  }
}
