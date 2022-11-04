// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Component, Vehicle } from "src/types/template";
import {TwodsixVehicleSheetData, TwodsixVehicleSheetSettings } from "src/types/twodsix";
import TwodsixItem, { onRollDamage} from "../entities/TwodsixItem";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { openPDFReference, deletePDFReference } from "../utils/sheetUtils";
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
      showRangeSpeedNoUnits: game.settings.get('twodsix', 'showRangeSpeedNoUnits')
    };

    return context;
  }

  static get defaultOptions():ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
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
    html.find('.roll-damage').on('click', onRollDamage.bind(this));
    html.find('.rollable').on('click', this._onRollWrapperVehicle(this._onSkillRollVehicle));
    html.find('.open-link').on('click', openPDFReference.bind(this, [this.actor.system.docReference]));
    html.find('.delete-link').on('click', deletePDFReference.bind(this));
  }

  private _onToggleComponent(event:Event):void {
    if (event.currentTarget) {
      const system = event.currentTarget["dataset"]["key"];
      const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
      if (system) {
        const newState = stateTransitions[(<Vehicle>this.actor.system).systemStatus[system]];
        this.actor.update({[`system.systemStatus.${system}`]: newState});
      } else {
        const li = $(event.currentTarget).parents(".item");
        const itemSelected = this.actor.items.get(li.data("itemId"));
        itemSelected?.update({"system.status": stateTransitions[(<Component>itemSelected.system)?.status]});
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
    const playerId = game.userId;
    if (playerId !== null) {
      const character = game.actors?.find(a => (a.permission[playerId] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER ) && (a.type === "traveller") && !!a.getActiveTokens()[0]);
      if (character != null) {
        return <TwodsixActor>game.actors?.get(character.id);
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

