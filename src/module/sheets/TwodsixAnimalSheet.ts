// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import { Animal } from "src/types/template";

export class TwodsixAnimalSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType(): string {
    return this.actor.type;
  }

  /** @override */
  getData(): any {
    const returnData: any = super.getData();
    returnData.system = returnData.actor.system;
    returnData.container = {};
    if (game.settings.get('twodsix', 'useProseMirror')) {
      returnData.richText = {
        description: TextEditor.enrichHTML(returnData.system.description, {async: false}),
        notes: TextEditor.enrichHTML(returnData.system.notes, {async: false})
      };
    }

    returnData.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.type == 'animal') {
      const actor: TwodsixActor = <TwodsixActor>this.actor;
      const untrainedSkill = actor.getUntrainedSkill();
      if (untrainedSkill) {
        returnData.untrainedSkill = untrainedSkill;
      }
      AbstractTwodsixActorSheet._prepareItemContainers(actor.items, returnData);
    }

    // Add relevant data from system settings
    returnData.settings = {
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ExperimentalFeatures: game.settings.get('twodsix', 'ExperimentalFeatures'),
      autofireRulesUsed: game.settings.get('twodsix', 'autofireRulesUsed'),
      showAlternativeCharacteristics: game.settings.get('twodsix', 'showAlternativeCharacteristics'),
      lifebloodInsteadOfCharacteristics: game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics'),
      showContaminationBelowLifeblood: game.settings.get('twodsix', 'showContaminationBelowLifeblood'),
      showLifebloodStamina: game.settings.get("twodsix", "showLifebloodStamina"),
      showHeroPoints: game.settings.get("twodsix", "showHeroPoints"),
      showIcons: game.settings.get("twodsix", "showIcons"),
      showStatusIcons: game.settings.get("twodsix", "showStatusIcons"),
      showInitiativeButton: game.settings.get("twodsix", "showInitiativeButton"),
      useProseMirror: game.settings.get('twodsix', 'useProseMirror'),
      useFoundryStandardStyle: game.settings.get('twodsix', 'useFoundryStandardStyle'),
      showReferences: game.settings.get('twodsix', 'showItemReferences'),
      showSpells: game.settings.get('twodsix', 'showSpells')
    };
    //returnData.data.settings = returnData.settings; // DELETE WHEN CONVERSION IS COMPLETE
    returnData.config = TWODSIX;

    return returnData;
  }


  /** @override */
  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "animal-actor"],
      template: "systems/twodsix/templates/actors/animal-sheet.html",
      width: 830,
      height: 500,
      resizable: true
    });
  }

  public activateListeners(html: JQuery): void {
    super.activateListeners(html);
    html.find('.roll-reaction').on('click', this._onRollReaction.bind(this));
  }

  protected async _onRollReaction(): Promise<void> {
    const reaction = (<Animal>this.actor.system).reaction;
    const roll = await new Roll("2d6").roll({async: true, rollMode: CONST.DICE_ROLL_MODES.PRIVATE});

    let flavor = "";

    if (isNaN(reaction.flee) || isNaN(reaction.attack) || reaction.flee >= reaction.attack) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.InvalidReactionInputs"));
    } else {
      if (roll.total >= reaction.attack) {
        flavor = game.i18n.localize("TWODSIX.Animal.AttacksMessage");
      } else if (roll.total <= reaction.flee) {
        flavor = game.i18n.localize("TWODSIX.Animal.FleesMessage");
      } else {
        flavor = game.i18n.localize("TWODSIX.Animal.NoReactionMessage");
      }
      await roll.toMessage(
        { speaker: ChatMessage.getSpeaker({ alias: this.actor.name}),
          flavor: flavor},
        {rollMode: CONST.DICE_ROLL_MODES.PRIVATE}
      );
    }
  }
}
