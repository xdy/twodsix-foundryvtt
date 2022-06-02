import { Component, Vehicle } from "src/types/template";
import {TwodsixVehicleSheetData, TwodsixVehicleSheetSettings } from "src/types/twodsix";
import TwodsixItem, { onRollDamage} from "../entities/TwodsixItem";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
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
      width: 835,
      height: 645,
      resizable: true,
    });
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find(".component-toggle").on("click", this._onToggleComponent.bind(this));
    html.find('.roll-damage').on('click', onRollDamage.bind(this));
    html.find('.rollable').on('click', this._onRollWrapper(this._onSkillRoll));
    html.find('.open-link').on('click', this._openPDFReference.bind(this));
  }

  private _onToggleComponent(event:Event):void {
    if (event.currentTarget) {
      const system = event.currentTarget["dataset"]["key"];
      const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
      if (system) {
        const newState = stateTransitions[(<Vehicle>this.actor.data.data).systemStatus[system]];
        this.actor.update({[`data.systemStatus.${system}`]: newState});
      } else {
        const li = $(event.currentTarget).parents(".item");
        const itemSelected = this.actor.items.get(li.data("itemId"));
        itemSelected?.update({"data.status": stateTransitions[(<Component>itemSelected.data.data)?.status]});
      }
    }
  }
  private _onRollWrapper(func: (event, showTrowDiag: boolean) => Promise<void>): (event) => void {
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
  private async _onSkillRoll(event, showThrowDiag: boolean): Promise<void> {
    //Get Controlled actor
    let selectedActor = {};
    if (game.user?.isGM !== true) {
      const playerId = game.userId;
      if (playerId !== null) {
        const character = game.actors?.filter(a => (a.data.permission[playerId] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER ) && !!a.getActiveTokens()[0])[0].data;
        if (character != null) {
          const charID = character._id;
          selectedActor = <Actor>game.actors?.get(charID);
        }
      }
    } else {
      // For GM, select doctor as the selected token
      if (canvas.tokens?.controlled !== undefined) {
        selectedActor = <Actor>(canvas.tokens?.controlled[0].actor);
      }
    }
    if (selectedActor && (<Actor>selectedActor).data.type === "traveller") {
      let skill = <TwodsixItem>(<Actor>selectedActor).data.items.getName((<Vehicle>this.actor.data.data).skillToOperate);
      if(!skill) {
        skill = (<Actor>selectedActor).data.items.filter((itm: TwodsixItem) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained") && itm.type === "skills")[0] as TwodsixItem;
      }
      const extra = {
        diceModifier: (<Vehicle>this.actor.data.data).maneuver.agility ? parseInt((<Vehicle>this.actor.data.data).maneuver.agility) : 0,
        event: event
      };
      const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDiag, extra, skill);
      if (!settings.shouldRoll) {
        return;
      }
      await skill?.skillRoll(showThrowDiag, settings);
    }
  }

  private _openPDFReference(event): void {
    event.preventDefault();
    const sourceString = (<Vehicle>this.actor.data.data).docReference;
    if (sourceString) {
      const [code, page] = sourceString.split(' ');
      const selectedPage = parseInt(page);
      if (ui["PDFoundry"]) {
        ui["PDFoundry"].openPDFByCode(code, {page: selectedPage});
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.PDFFoundryNotInstalled"));
      }
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoSpecfiedLink"));
    }
  }
}
