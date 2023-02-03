// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

//import { SpaceObject } from "src/types/template";
import {TwodsixSpaceObjectSheetData, TwodsixSpaceObjectSheetSettings } from "src/types/twodsix";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { openPDFReference, deletePDFReference, confirmRollFormula } from "../utils/sheetUtils";
import TwodsixActor from "../entities/TwodsixActor";
import { TWODSIX } from "../config";
import { simplifyRollFormula } from "../utils/dice";
import { getDiceResults } from "../entities/TwodsixItem";

export class TwodsixSpaceObjectSheet extends AbstractTwodsixActorSheet {
  /** @override */
  getData(): TwodsixSpaceObjectSheetData {
    const context = <any>super.getData();
    context.system = this.actor.system;
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(<TwodsixActor>this.actor, context);
    context.settings = <TwodsixSpaceObjectSheetSettings>{
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

  static get defaultOptions():ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "space-object", "actor"],
      template: "systems/twodsix/templates/actors/space-object-sheet.html",
      width: 'auto',
      height: 'auto',
      resizable: true,
    });
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find('.roll-damage').on('click', this.onRollDamage.bind(this, this.actor));
    html.find('.open-link').on('click', openPDFReference.bind(this, [this.actor.system.docReference]));
    html.find('.delete-link').on('click', deletePDFReference.bind(this));
  }

  private async onRollDamage(actor:TwodsixActor) {
    let rollFormula = await confirmRollFormula(actor.system.damage, game.i18n.localize("TWODSIX.Damage.DamageFormula"));
    rollFormula = rollFormula.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
    rollFormula = simplifyRollFormula(rollFormula);
    let damage = <Roll>{};

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
      dice: getDiceResults(damage), //damage.terms[0]["results"]
      armorPiercingValue: 0,
      damage: (damage.total && damage.total > 0) ? damage.total : 0
    });

    const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);
    const transfer = JSON.stringify(
      {
        type: 'damageItem',
        payload: contentData
      }
    );
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
        "twodsix.tokenUUID": (<Actor>this.actor).getActiveTokens()[0]?.document.uuid ?? ""
      }
    });
  }
}
