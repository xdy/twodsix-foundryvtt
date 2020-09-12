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


  protected activateListeners(html:JQuery):void {
    super.activateListeners(html);

    // Rollable abilities. Really should be in base class, but that will have to wait for issue 86
    html.find('.rollable').on('click', (this._onRoll.bind(this)));
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private _onRoll(event:Event):void {
    event.preventDefault();
    event.stopPropagation();
    TwodsixRolls.handleSkillRoll(event, this.actor);
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



