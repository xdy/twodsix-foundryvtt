// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";
import { getDataFromDropEvent, getItemDataFromDropData } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { Ship, ShipAction, ShipPosition, ShipPositionActorIds, Skills } from "../../types/template";
import { TwodsixShipPositionSheetData } from "src/types/twodsix";

export class TwodsixShipPositionSheet extends AbstractTwodsixItemSheet {

  getData(): TwodsixShipPositionSheetData {
    const context = <TwodsixShipPositionSheetData>super.getData();
    context.components = this.item.actor?.itemTypes.component ?? [];
    context.availableActions = TwodsixShipActions.availableMethods;
    const actions = (<ShipPosition>this.item.system).actions ?? [];
    context.sortedActions = Object.entries(actions).map(([id, ret]) => {
      ret.id = id;
      ret.placeholder = TwodsixShipActions.availableMethods[ret.type].placeholder;
      return ret;
    });
    context.sortedActions.sort((a: ShipAction, b: ShipAction) => (a.order > b.order) ? 1 : -1);
    context.hasShipActor = !!this.actor;
    if (context.hasShipActor) {
      const shipPositionActorIds = Object.entries(<ShipPositionActorIds>(<Ship>this.actor?.system)?.shipPositionActorIds ?? {}).filter(([, shipPositionId]) => shipPositionId === this.item.id);
      if (shipPositionActorIds.length > 0) {
        const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
        context.actors = <TwodsixActor[]>actorIds.map(actorId => game.actors?.get(actorId)).filter(x => x !== undefined);
      } else {
        context.actors = [];
      }
    }

    return context;
  }

  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "item"],
      template: "systems/twodsix/templates/items/ship_position-sheet.html",
      submitOnClose: true,
      scrollY: [".ship-positions-list"],
      submitOnChange: true,
      dragDrop: [{dropSelector: null, dragSelector: ".ship-position-details-actor"},]
    });
  }

  public activateListeners(html: JQuery): void {
    super.activateListeners(html);
    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }

    html.find('.ship-position-details-action-delete').on('click', this._onDeleteAction.bind(this));
    html.find('.ship-position-details-action-create').on('click', this._onCreateAction.bind(this));
    html.find('.ship-position-details-actor-delete').on('click', this._onDeleteActor.bind(this));

  }

  public static async createActionFromSkill(position:TwodsixItem, skill:TwodsixItem): Promise<void> {
    const actions = (<ShipPosition>position.system).actions;
    const skillData = (<Skills>skill.system);
    const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    let command = skill.name ?? "";
    if (skillData.characteristic && skillData.characteristic !== "NONE"){
      command += `/${skillData.characteristic}`;
    }
    command += ` ${difficulties[skillData.difficulty].target}+`;

    actions[randomID()] = {
      "order": Object.keys(actions).length,
      "name": "New action",
      "icon": skill.img ?? "",
      "type": TWODSIX.SHIP_ACTION_TYPE.skillRoll,
      "command": command
    };
    await position.update({ "system.actions": actions });
  }

  _onDragStart(event: DragEvent):void {
    if (event.dataTransfer !== null && event.target !== null && $(event.target).data("drag") === "actor") {
      const actor = game.actors?.get($(event.target).data("id"));
      event.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor,  //NOT CERTAIN WHAT TO DO ABOUT THIS ONE
        "actorId": this.actor?.id,
        "id": $(event.target).data("id")
      }));
    } else {
      super._onDragStart(event);
    }
  }

  async _onDrop(event: DragEvent): Promise<boolean | any> {
    const dropData:any = getDataFromDropEvent(event);
    const droppedObject:any = await getItemDataFromDropData(dropData);
    if (droppedObject.type === "skills") {
      await TwodsixShipPositionSheet.createActionFromSkill(this.item, droppedObject);
    } else if (droppedObject.type === "traveller") {
      if (this.actor) {
        const currentShipPositionId = (<Ship>this.actor.system).shipPositionActorIds[droppedObject._id];
        await this.actor.update({[`system.shipPositionActorIds.${droppedObject._id}`]: this.item.id});
        this.render();
        if (currentShipPositionId){
          this.actor.items.get(currentShipPositionId)?.sheet?.render();
        }
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.CantDropActorIfPositionIsNotOnShip"));
      }
    } else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Ship.InvalidDocumentForShipPosition"));
    }
  }

  private async _onDeleteAction(event: Event) {
    if (event.currentTarget !== null) {
      const deleteId = $(event.currentTarget).data("id");

      // await this.item.update({ [`system.actions.-=${deleteId}`]: null });
      // The code below is an ugly fix because of a bug in foundry: https://gitlab.com/foundrynet/foundryvtt/-/issues/6421
      const actions = duplicate((<ShipPosition>this.item.system).actions);
      delete actions[deleteId];
      await this.item.update({"system.actions": null}, {noHook: true, render: false});
      await this.item.update({"system.actions": actions });
    }
  }

  private async _onDeleteActor(event: Event) {
    if (event.currentTarget !== null) {
      const deleteId = $(event.currentTarget).data("id");
      await this.actor?.update({[`system.shipPositionActorIds.-=${deleteId}`]: null});
      this.render();
    }
  }

  private _onCreateAction() {
    const actions = (<ShipPosition>this.item.system).actions;
    actions[randomID()] = {
      "order": Object.values(actions).length === 0 ? 1 : Math.max(...Object.values(actions).map(itm => itm.order)) + 1,
      "name": game.i18n.localize("TWODSIX.Ship.NewAction"),
      "icon": "icons/svg/dice-target.svg",
      "command": "",
      "type": TWODSIX.SHIP_ACTION_TYPE.chatMessage
    } as ShipAction;
    this.item.update({ "system.actions": actions });
  }
}
