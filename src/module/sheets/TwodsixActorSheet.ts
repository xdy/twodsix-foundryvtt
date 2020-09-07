import TwodsixItem from "../entities/TwodsixItem";
import {skillRollResultDisplay} from "../utils/sheetUtils";
import {TwodsixRolls} from "../utils/TwodsixRolls";
import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";

export class TwodsixActorSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType():string {
    return this.actor.data.type;
  }

  /** @override */
  getData():any {
    const data:any = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'traveller') {
      TwodsixActorSheet._prepareItemContainers(data);
    }
    this.actor.data.showEffect = game.settings.get("twodsix", "effectOrTotal");

    return data;
  }

  /** @override */
  static get defaultOptions():FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/actor-sheet.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}],
      scrollY: [".skills", ".inventory", ".finances", ".info", ".notes"]
    });
  }


  protected activateListeners(html:JQuery) {
    super.activateListeners(html);

    // Rollable abilities. Really should be in base class, but that will have to wait for issue 86
    html.find('.rollable').on('click', (this._onRoll.bind(this)));
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event:{ preventDefault:any; currentTarget:any; shiftKey?:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    const item = this.actor.getOwnedItem(itemId) as TwodsixItem;

    if (dataset.roll) {
      if (item != null && 'skills' === item.type && event.shiftKey) {
        this.advancedSkillRoll(itemId, event, dataset);
      } else {
        this.simpleSkillRoll(dataset);
      }
    }
  }

  private simpleSkillRoll(dataset:DOMStringMap) {
    const rollParts = dataset.roll.split("+");
    const flavorParts:string[] = [];
    const label = dataset.label ? game.i18n.localize("TWODSIX.Actor.Rolling") + ` ${dataset.label}` : '';
    flavorParts.push(label);
    skillRollResultDisplay(rollParts, flavorParts);
    const flavor = flavorParts.join(' ');
    const roll = new Roll(rollParts.join('+'), this.actor.data.data);

    roll.roll().toMessage({
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      flavor: flavor
    });
  }

  advancedSkillRoll(skillId:string, event:{ preventDefault:() => void; currentTarget:any; }, dataset:{ roll:string; }):Promise<any> {

    const skillData = {};
    const skills = this.getData().actor.skills;
    if (!skills.length) {
      return;
    }

    const rollParts = dataset.roll.split("+");

    const flavorParts:string[] = [];
    const skill = skills.filter(x => x._id === skillId)[0];
    flavorParts.push(`${skill.name}`);

    return TwodsixRolls.Roll({
      parts: rollParts,
      data: skillData,
      flavorParts: flavorParts,
      title: `${skill.name}`,
      speaker: ChatMessage.getSpeaker({actor: this.getData().actor}),
    });
  }

//Unused, but something like it is needed to support cascade/subskills, so letting it stay for now.
//   /**
//    * Handle skill upgrade
//    * @param {Event} event   The originating click event
//    * @private
//    */
//   _onUpgrade(event:{ preventDefault:() => void; currentTarget:any; }):void {
//     event.preventDefault();
//     const element = event.currentTarget;
//     const skillName = element.getAttribute('data-label');
//     const actorData = this.actor.data;
//     const data = actorData.data;
//     const matchingSkill = data.skills[skillName];
//     const maxSkillLevel = game.settings.get('twodsix', 'maxSkillLevel');
//
//     if (matchingSkill) {
//       if (TwodsixActorSheet.isChildSkill(matchingSkill)) {
//         if (this.parentSkillIsTrained(matchingSkill) && matchingSkill.value < maxSkillLevel) {
//           this.actor.update({[`data.skills.${skillName}.value`]: data.skills[skillName].value + 1});
//         }
//       } else if (matchingSkill.value < 0) {
//         this.actor.update({[`data.skills.${skillName}.value`]: 0});
//         if (matchingSkill.hasChildren) {
//           this.processChildren(data, skillName, 0);
//         }
//       } else if (!matchingSkill.hasChildren && matchingSkill.value < maxSkillLevel) {
//         this.actor.update({[`data.skills.${skillName}.value`]: data.skills[skillName].value + 1});
//       }
//     }
//   }
//
//   private processChildren(data:any, skillName:string, level:number) {
//     for (const [key] of Object.entries(data.skills)) {
//       if (key.startsWith(skillName + "-")) {
//         this.actor.update({[`data.skills.${key}.value`]: level});
//       }
//     }
//   }
//
//   private static isChildSkill(matchingSkill:any) {
//     return matchingSkill.childOf != null && matchingSkill.childOf != "";
//   }
//
//   private parentSkillIsTrained(matchingSkill:any) {
//     const parent = this.actor.data.data.skills[matchingSkill.childOf];
//     return parent && parent.value >= 0;
//   }
}



