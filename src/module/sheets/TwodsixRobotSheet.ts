// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import { getDamageTypes } from "../utils/sheetUtils";
import { setCharacteristicDisplay } from "./TwodsixActorSheet";

export class TwodsixRobotSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType(): string {
    return this.actor.type;
  }

  /** @override */
  async getData(): any {
    const returnData: any = super.getData();
    returnData.system = returnData.actor.system;
    returnData.container = {};
    if (game.settings.get('twodsix', 'useProseMirror')) {
      returnData.richText = {
        description: await TextEditor.enrichHTML(returnData.system.description),
        notes: await TextEditor.enrichHTML(returnData.system.notes)
      };
    }

    returnData.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.type == 'robot') {
      const actor: TwodsixActor = <TwodsixActor>this.actor;
      const untrainedSkill = actor.getUntrainedSkill();
      if (untrainedSkill) {
        returnData.untrainedSkill = untrainedSkill;
      }
      AbstractTwodsixActorSheet._prepareItemContainers(actor, returnData);
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
      robotsUseHits: game.settings.get('twodsix', 'robotsUseHits'),
      dontShowStatBlock: (game.settings.get("twodsix", "showLifebloodStamina") | game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')),
      hideUntrainedSkills: game.settings.get('twodsix', 'hideUntrainedSkills'),
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
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "robot-actor"],
      template: "systems/twodsix/templates/actors/robot-sheet.html",
      width: 'auto',
      height: 600,
      resizable: true,
      dragDrop: [{dragSelector: ".item", dropSelector: null}]
    });
  }
}
