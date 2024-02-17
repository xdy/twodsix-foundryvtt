// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import { Animal } from "src/types/template";
import { getDamageTypes } from "../utils/sheetUtils";
import { setCharacteristicDisplay } from "./TwodsixActorSheet";
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
      AbstractTwodsixActorSheet._prepareItemContainers(actor, returnData);
      //Prepare characteristic display values
      setCharacteristicDisplay(returnData);
    }

    // Add relevant data from system settings
    returnData.settings = {
      ShowRangeBandAndHideRange: ['CE_Bands', 'CT_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType')),
      rangeTypes: game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands' ? TWODSIX.CT_WEAPON_RANGE_TYPES.short : TWODSIX.CE_WEAPON_RANGE_TYPES.short,
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
      showReferences: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showSpells: game.settings.get('twodsix', 'showSpells'),
      animalsUseHits: game.settings.get('twodsix', 'animalsUseHits'),
      dontShowStatBlock: (game.settings.get("twodsix", "showLifebloodStamina") | game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')),
      animalsUseLocations: game.settings.get('twodsix', 'animalsUseLocations'),
      displayReactionMorale: game.settings.get('twodsix', 'displayReactionMorale'),
      hideUntrainedSkills: game.settings.get('twodsix', 'hideUntrainedSkills'),
      useAllAnimalTypes: game.settings.get('twodsix', 'animalTypesIndependentofNiche'),
      damageTypes: getDamageTypes(false),
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showActorReferences: game.settings.get('twodsix', 'showActorReferences'),
      useCTData: game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands' || game.settings.get('twodsix', 'ruleset') === 'CT'
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
      resizable: true,
      dragDrop: [{dragSelector: ".item", dropSelector: null}]
    });
  }

  public activateListeners(html: JQuery): void {
    super.activateListeners(html);
    html.find('.roll-reaction').on('click', this._onRollReaction.bind(this));
    html.find('.roll-morale').on('click', this._onRollMorale.bind(this));
  }

  protected async _onRollReaction(): Promise<void> {
    const reaction = (<Animal>this.actor.system).reaction;
    let rollString = "2d6";
    if (this.actor.system.woundedEffect) {
      rollString += " + @woundedEffect";
    }
    const roll = await new Roll(rollString, this.actor.getRollData()).roll({async: true, rollMode: CONST.DICE_ROLL_MODES.PRIVATE});

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
          flavor: flavor,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        },
        {rollMode: CONST.DICE_ROLL_MODES.PRIVATE}
      );
    }
  }

  protected async _onRollMorale(): Promise<void> {
    let rollString = "2d6";
    if (this.actor.system.woundedEffect) {
      rollString += " + @woundedEffect";
    }
    if (this.actor.system.moraleDM) {
      rollString += " + @moraleDM";
    }
    const roll = await new Roll(rollString, this.actor.getRollData()).roll({async: true, rollMode: CONST.DICE_ROLL_MODES.PRIVATE});

    let flavor = "";
    if (roll.total <= 5) {
      flavor = game.i18n.localize("TWODSIX.Animal.Retreat");
    } else if (roll.total <=8) {
      flavor = game.i18n.localize("TWODSIX.Animal.FightingWithdrawal");
    } else if (roll.total <= 11) {
      flavor = game.i18n.localize("TWODSIX.Animal.KeepFighting");
    } else if (roll.total <= 15) {
      flavor = game.i18n.localize("TWODSIX.Animal.Advance");
    } else {
      flavor = game.i18n.localize("TWODSIX.Animal.FightToTheDeath");
    }
    await roll.toMessage(
      { speaker: ChatMessage.getSpeaker({ alias: this.actor.name}),
        flavor: flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [roll]
      },
      {rollMode: CONST.DICE_ROLL_MODES.PRIVATE}
    );
  }
}
