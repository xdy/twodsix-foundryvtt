// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";
import { getDataFromDropEvent, getDocFromDropData } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { Ship, ShipAction, ShipPosition, ShipPositionActorIds, Skills } from "../../types/template";
import { TwodsixShipPositionSheetData } from "src/types/twodsix";

export class TwodsixShipPositionSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixItemSheet) {

  /** @override */
  static DEFAULT_OPTIONS =  {
    sheetType: "TwodsixShipPositionSheet",
    classes: ["twodsix", "sheet", "item"],
    dragDrop: [{dropSelector: null, dragSelector: ".ship-position-details-actor"}],
    position: {
      width: 'auto',
      height: 'auto'
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-gamepad"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      deleteAction: this._onDeleteAction,
      createAction: this._onCreateAction,
      deleteActor: this._onDeleteActor,
      showActor: this._onShowActor
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/items/ship_position-sheet.hbs",
      scrollable: [".ship-positions-list"]
    }
  };

  async _prepareContext(options): TwodsixShipPositionSheetData {
    const context = await super._prepareContext(options);
    context.nonCargoComponents = this.item.actor?.itemTypes.component.filter( i => i.system.subtype !== "cargo") ?? [];
    context.availableActions = TwodsixShipActions.availableMethods;
    const actions = (<ShipPosition>this.item.system).actions ?? [];
    context.sortedActions = Object.entries(actions).map(([id, ret]) => {
      ret.id = id;
      ret.placeholder = TwodsixShipActions.availableMethods[ret.type].placeholder;
      ret.tooltip = TwodsixShipActions.availableMethods[ret.type].tooltip;
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

  public static async createActionFromSkill(position:TwodsixItem, skill:TwodsixItem): Promise<void> {
    const actions = (<ShipPosition>position.system).actions;
    const skillData = (<Skills>skill.system);
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    let command = skill.name ?? "";
    if (skillData.characteristic && skillData.characteristic !== "NONE"){
      command += `/${skillData.characteristic}`;
    }
    command += ` ${difficulties[skillData.difficulty].target}+`;

    const newAction = {
      [foundry.utils.randomID()]: {
        "order": Object.keys(actions).length,
        "name": skill.name,
        "icon": skill.img ?? "",
        "type": TWODSIX.SHIP_ACTION_TYPE.skillRoll,
        "command": command,
        "component": ""
      }
    };
    const newActions = foundry.utils.duplicate(Object.assign(actions, newAction));
    await position.update({ "system.actions": newActions });
  }

  _onDragStart(event: DragEvent):void {
    if (event.dataTransfer !== null && event.target !== null && event.target.dataset.drag === "actor") {
      const actor = game.actors?.get(event.target.dataset.id);
      event.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor,  //NOT CERTAIN WHAT TO DO ABOUT THIS ONE
        "id": actor?.id,
        "uuid": actor?.uuid
      }));
    } else {
      super._onDragStart(event);
    }
  }

  async _onDrop(event: DragEvent): Promise<boolean | any> {
    event.preventDefault();
    const dropData:any = getDataFromDropEvent(event);
    const droppedObject:any = await getDocFromDropData(dropData);
    if (droppedObject.type === "skills") {
      await TwodsixShipPositionSheet.createActionFromSkill(this.item, droppedObject);
    } else if (["traveller", "robot"].includes(droppedObject.type)) {
      if (this.actor) {
        const currentShipPositionId = (<Ship>this.actor.system).shipPositionActorIds[droppedObject._id];
        await this.actor.update({[`system.shipPositionActorIds.${droppedObject._id}`]: this.item.id});
        this.render();
        if (currentShipPositionId){
          this.actor.items.get(currentShipPositionId)?.sheet?.render();
        }
      } else {
        ui.notifications.error("TWODSIX.Ship.CantDropActorIfPositionIsNotOnShip", {localize: true});
        return false;
      }
    } else {
      ui.notifications.error("TWODSIX.Ship.InvalidDocumentForShipPosition", {localize: true});
      return false;
    }
    return true;
  }

  static async _onDeleteAction(event:Event, target:HTMLElement) {
    const deleteId = target.dataset.id;
    if (deleteId) {
      await this.item.update({ [`system.actions.-=${deleteId}`]: null });
    }
  }

  static async _onDeleteActor(event:Event, target:HTMLElement) {
    const deleteId = target.dataset.id;
    if (deleteId) {
      await this.actor?.update({[`system.shipPositionActorIds.-=${deleteId}`]: null});
      this.render();
    }
  }

  static async _onCreateAction() {
    const actions = (<ShipPosition>this.item.system).actions;
    actions[foundry.utils.randomID()] = {
      "order": Object.values(actions).length === 0 ? 1 : Math.max(...Object.values(actions).map(itm => itm.order)) + 1,
      "name": game.i18n.localize("TWODSIX.Ship.NewAction"),
      "icon": "icons/svg/dice-target.svg",
      "command": "",
      "component": "",
      "type": TWODSIX.SHIP_ACTION_TYPE.chatMessage
    } as ShipAction;
    await this.item.update({ "system.actions": actions });
  }

  static _onShowActor(event:Event, target:HTMLElement) {
    const actorId = target.closest(".ship-position-details-actor").dataset.id;
    if(actorId) {
      const targetActor = game.actors.get(actorId);
      targetActor.sheet.render({force: true});
    }
  }
}
