import {TwodsixRolls} from "../utils/TwodsixRolls";
import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import TwodsixItem from "../entities/TwodsixItem";
import {UpdateData} from "../migration";

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

    html.find('.roll-damage').on('click', (this._onRollDamage.bind(this)));

    html.find('.stat-damage').on('change', this._limitDamage.bind(this));
    html.find('.special-damage').on('change', this._limitDamage.bind(this));
  }

  private _updateHits():void {
    for (const cha of Object.values(this.actor.data.data.characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
    }
    const updateData = <UpdateData>{};
    const characteristics = this.actor.data.data.characteristics;
    updateData['data.hits.value'] = characteristics["endurance"].current + characteristics["strength"].current + characteristics["dexterity"].current;
    updateData['data.hits.max'] = characteristics["endurance"].value + characteristics["strength"].value + characteristics["dexterity"].value;
    try {
      this.actor.update(updateData);
    } catch (e) {
      console.log(e);
    }
  }

  private _limitDamage(event:Event):void {
    const characteristicString = $(event.currentTarget).parents('.stat:first,.special:first').attr('data-characteristic');
    const characteristic = this.actor.data.data.characteristics[characteristicString];
    const input = $(event.currentTarget).children("");
    if (input.val() > characteristic.value) {
      input.val(characteristic.value);
    } else if (input.val() < 0) {
      input.val(0);
    }
    characteristic.damage = input.val();
    this._updateHits();
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private _onRoll(event:Event):void {
    event.preventDefault();
    event.stopPropagation();
    TwodsixRolls.handleSkillRoll(event, this.actor);
  }

  /**
   * Handle clickable damage rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private _onRollDamage(event:Event):void {
    event.preventDefault();
    event.stopPropagation();
    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    const item = this.actor.getOwnedItem(itemId) as TwodsixItem;
    TwodsixRolls.rollDamage(item, true, 0, this.actor, true);
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



