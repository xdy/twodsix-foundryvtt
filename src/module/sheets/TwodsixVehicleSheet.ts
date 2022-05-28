import { Component } from "src/types/template";
import { TwodsixVehicleSheetData, TwodsixVehicleSheetSettings } from "src/types/twodsix";
import { onRollDamage } from "../entities/TwodsixItem";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";

export class TwodsixVehicleSheet extends AbstractTwodsixActorSheet {

  /** @override */
  getData(): TwodsixVehicleSheetData {
    const context = <TwodsixVehicleSheetData>super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(this.actor.items, context);
    context.settings = <TwodsixVehicleSheetSettings>{
      showHullAndArmor: game.settings.get('twodsix', 'showHullAndArmor')
    };

    return context;
  }

  static get defaultOptions():ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "vehicle", "actor"],
      template: "systems/twodsix/templates/actors/vehicle-sheet.html",
      width: 805,
      height: 540,
      resizable: true,
    });
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find(".component-toggle").on("click", this._onToggleComponent.bind(this));
    html.find('.roll-damage').on('click', onRollDamage.bind(this));
    //html.find('.rollableSkill').on('click', this._onSkillRoll(this));
  }

  private _onSkillRoll(event:Event):void {
    console.log("Here", event);
  }

  private _onToggleComponent(event:Event):void {
    if (event.currentTarget) {
      const system = event.currentTarget["dataset"]["key"];
      const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
      if (system) {
        const newState = stateTransitions[this.actor.data.data.systemStatus[system]];
        this.actor.update({[`data.systemStatus.${system}`]: newState});
      } else {
        const li = $(event.currentTarget).parents(".item");
        const itemSelected = this.actor.items.get(li.data("itemId"));
        itemSelected?.update({"data.status": stateTransitions[(<Component>itemSelected.data.data)?.status]});
      }
    }
  }
}
