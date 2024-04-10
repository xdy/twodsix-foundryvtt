// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {Vehicle, Component } from "src/types/template";
import {TwodsixVehicleSheetData, TwodsixVehicleSheetSettings } from "src/types/twodsix";
import TwodsixItem from "../entities/TwodsixItem";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import TwodsixActor from "../entities/TwodsixActor";

export class TwodsixVehicleSheet extends AbstractTwodsixActorSheet {

  /** @override */
  getData(): TwodsixVehicleSheetData {
    const context = <TwodsixVehicleSheetData>super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(<TwodsixActor>this.actor, context);
    context.settings = <TwodsixVehicleSheetSettings>{
      showHullAndArmor: game.settings.get('twodsix', 'showHullAndArmor'),
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showActorReferences: game.settings.get('twodsix', 'showActorReferences'),
      showRangeSpeedNoUnits: game.settings.get('twodsix', 'showRangeSpeedNoUnits'),
      maxComponentHits: game.settings.get('twodsix', 'maxComponentHits')
    };

    return context;
  }

  static get defaultOptions():ActorSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix", "vehicle", "actor"],
      template: "systems/twodsix/templates/actors/vehicle-sheet.html",
      width: 835,
      height: 698,
      resizable: true,
    });
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find(".component-toggle").on("click", this._onToggleComponent.bind(this));
    //html.find('.roll-damage').on('click', onRollDamage.bind(this));
    html.find('.rollable').on('click', this._onRollWrapperVehicle(this._onSkillRollVehicle));
    html.find(".adjust-counter").on("click", this._onAdjustCounter.bind(this));
  }

  private _onToggleComponent(event:Event):void {
    if (event.currentTarget) {
      const vehicleSystem = event.currentTarget["dataset"]["key"];
      const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
      if (vehicleSystem) {
        const newState = event.shiftKey ? ((<Vehicle>this.actor.system).systemStatus[vehicleSystem] === "off" ? "operational" : "off") : stateTransitions[(<Vehicle>this.actor.system).systemStatus[vehicleSystem]];
        this.actor.update({[`system.systemStatus.${vehicleSystem}`]: newState});
      } else {
        const li = $(event.currentTarget).parents(".item");
        const itemSelected:Component = this.actor.items.get(li.data("itemId"));
        if (itemSelected) {
          const newState = event.shiftKey ? (itemSelected.system.status === "off" ? "operational" : "off") : stateTransitions[itemSelected.system.status];
          itemSelected?.update({"system.status": newState});
        }
      }
    }
  }

  private _onRollWrapperVehicle(func: (event, showTrowDiag: boolean) => Promise<void>): (event) => void {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();

      const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showTrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];

      func.bind(this)(event, showTrowDiag);
    };
  }
  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onSkillRollVehicle(event, showThrowDiag: boolean): Promise<void> {
    //Get Controlled actor
    const selectedActor = getControlledTraveller();

    if (selectedActor) {
      let skill = <TwodsixItem>selectedActor.items.getName((<Vehicle>this.actor.system).skillToOperate);
      if(!skill) {
        skill = selectedActor.items.find((itm: TwodsixItem) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained") && itm.type === "skills") as TwodsixItem;
      }
      const tmpSettings = {
        rollModifiers: {other: (<Vehicle>this.actor.system).maneuver.agility ? parseInt((<Vehicle>this.actor.system).maneuver.agility) : 0},
        event: event
      };
      const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDiag, tmpSettings, skill, undefined, selectedActor);
      if (!settings.shouldRoll) {
        return;
      }
      await skill?.skillRoll(showThrowDiag, settings);
    }
  }
}

export function getControlledTraveller(): TwodsixActor | void {
  if (game.user?.isGM !== true) {
    if (game.user?.character) {
      return <TwodsixActor>game.user.character;
    } else {
      const playerId = game.userId;
      if (playerId !== null) {
        const character = game.actors?.find(a => (a.permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER ) && (a.type === "traveller") && !!a.getActiveTokens()[0]);
        if (character != null) {
          return <TwodsixActor>game.actors?.get(character.id);
        }
      }
    }
  } else {
    // For GM, select actor as the selected traveller token
    if (canvas.tokens?.controlled !== undefined) {
      const selectedToken = canvas.tokens?.controlled.find(ct => ct.actor?.type === "traveller");//<Actor>(canvas.tokens?.controlled[0].actor);
      if (selectedToken) {
        return <TwodsixActor>(selectedToken.actor);
      }
    }
  }
}

