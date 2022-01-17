import { TWODSIX } from "../config";
import { getDataFromDropEvent } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { Ship, ShipAction, ShipPosition, ShipPositionActorIds, Skills } from "../../types/template";
import { TwodsixShipPositionSheetData } from "src/types/twodsix";

export class TwodsixShipPositionSheet extends AbstractTwodsixItemSheet {

  getData(): TwodsixShipPositionSheetData {
    const context = <TwodsixShipPositionSheetData>super.getData();
    context.components = this.item.actor?.items.filter(component => component.type === "component") ?? [];
    context.availableActions = TwodsixShipActions.availableMethods;
    const actions = (<ShipPosition>this.item.data.data).actions ?? [];
    context.sortedActions = Object.entries(actions).map(([id, ret]) => {
      ret.id = id;
      ret.placeholder = TwodsixShipActions.availableMethods[ret.type].placeholder;
      return ret;
    });
    context.sortedActions.sort((a: ShipAction, b: ShipAction) => (a.order > b.order) ? 1 : -1);
    context.hasShipActor = !!this.actor;
    if (context.hasShipActor) {
      const shipPositionActorIds = Object.entries(<ShipPositionActorIds>(<Ship>this.actor?.data.data)?.shipPositionActorIds ?? {}).filter(([, shipPositionId]) => shipPositionId === this.item.id);
      if (shipPositionActorIds.length > 0) {
        const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
        context.actors = <TwodsixActor[]>actorIds.map(actorId => game.actors?.get(actorId));
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
    const actions = (<ShipPosition>position.data.data).actions;
    const skillData = (<Skills>skill.data.data);
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
    await position.update({ "data.actions": actions });
  }

  _onDragStart(event: DragEvent):void {
    if (event.dataTransfer !== null && event.target !== null && $(event.target).data("drag") === "actor") {
      const actor = game.actors?.get($(event.target).data("id"));
      event.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor?.data,
        "actorId": this.actor?.id,
        "id": $(event.target).data("id")
      }));
    } else {
      super._onDragStart(event);
    }
  }

  async _onDrop(event: DragEvent): Promise<boolean | any> {
    const data:any = getDataFromDropEvent(event);
    if (data.type === "Item" && (data.data?.type === "skills" || game.items?.get(data.id)?.type === "skills")) {
      const skillData = <TwodsixItem>game.items?.get(data.id);
      if (skillData) {
        await TwodsixShipPositionSheet.createActionFromSkill(this.item, skillData);
      }
    } else if (data.type === "Actor" && (data.data?.type === "traveller" || game.actors?.get(data.id)?.type === "traveller")) {
      if (this.actor) {
        const currentShipPositionId = (<Ship>this.actor.data.data).shipPositionActorIds[data.id];
        await this.actor.update({[`data.shipPositionActorIds.${data.id}`]: this.item.id});
        this.render();
        if (currentShipPositionId){
          this.actor.items.get(currentShipPositionId)?.sheet?.render();
        }
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.CantDropActorIfPositionIsNotOnShip"));
      }
    }else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Ship.InvalidDocumentForShipPosition"));
    }
  }

  private async _onDeleteAction(event: Event) {
    if (event.currentTarget !== null) {
      const deleteId = $(event.currentTarget).data("id");

      // await this.item.update({ [`data.actions.-=${deleteId}`]: null });
      // The code below is an ugly fix because of a bug in foundry: https://gitlab.com/foundrynet/foundryvtt/-/issues/6421
      const actions = duplicate((<ShipPosition>this.item.data.data).actions);
      delete actions[deleteId];
      await this.item.update({"data.actions": null}, {noHook: true, render: false});
      await this.item.update({ 'data.actions': actions });
    }
  }

  private async _onDeleteActor(event: Event) {
    if (event.currentTarget !== null) {
      const deleteId = $(event.currentTarget).data("id");
      await this.actor?.update({[`data.shipPositionActorIds.-=${deleteId}`]: null});
      this.render();
    }
  }

  private _onCreateAction() {
    const actions = (<ShipPosition>this.item.data.data).actions;
    actions[randomID()] = {
      "order": Object.values(actions).length === 0 ? 1 : Math.max(...Object.values(actions).map(itm => itm.order)) + 1,
      "name": game.i18n.localize("TWODSIX.Ship.NewAction"),
      "icon": "icons/svg/dice-target.svg",
      "command": "",
      "type": TWODSIX.SHIP_ACTION_TYPE.chatMessage
    } as ShipAction;
    this.item.update({ "data.actions": actions });
  }
}
