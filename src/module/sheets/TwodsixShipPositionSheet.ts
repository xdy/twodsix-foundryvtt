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
      showActor: this._onShowActor,
      addActor: this._onAddActor
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
      return await TwodsixShipPositionSheet.assignActorToPosition(this, actorId);
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

  static async _onAddActor(): Promise<boolean> {
    if (!this.actor?.isOwner) {
      return false;
    }

    // Build options for the select field
    const actorOptions = game.actors
      .filter(a => a.isOwner && ["traveller", "robot"].includes(a.type))
      .map(a => ({ value: a.id, label: a.name }));
    if (!actorOptions || actorOptions.length === 0) {
      ui.notifications.warn("TWODSIX.Warnings.NoAvailableActors", { localize: true });
      return false;
    }

    // Create the select field HTML
    const html = new foundry.data.fields.StringField({
      label: game.i18n.localize("TWODSIX.Ship.Travellers"),
      required: true,
    }).toFormGroup({}, {
      options: actorOptions,
      name: "actorId",
      value: "",
    }).outerHTML;

    // Prompt user to select an actor
    const actorId = await foundry.applications.api.DialogV2.prompt({
      content: html,
      ok: {
        callback: (event, button) => button.form.elements.actorId.value,
        label: "Select",
      },
      window: {
        title: "TWODSIX.Ship.SelectActor",
        icon: "fa-solid fa-folder",
      },
    });
    if (!actorId) {
      return false;
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      return false;
    }

    return await TwodsixShipPositionSheet.assignActorToPosition(this, actorId);
  }
  static async assignActorToPosition(sheet: TwodsixShipPositionSheet, actorId:string): Promise<boolean> {
    if (sheet.actor) {
      const shipPositionActorIds = sheet.actor.system.shipPositionActorIds;
      const currentShipPositionId = shipPositionActorIds[actorId];

      // Assign actor to this ship position
      await sheet.actor.update({ [`system.shipPositionActorIds.${actorId}`]: sheet.item.id });
      sheet.render();

      // If actor was previously assigned to a different position, re-render that position's sheet
      if (currentShipPositionId) {
        const prevItem = sheet.actor.items.get(currentShipPositionId);
        prevItem?.sheet?.render();
      }
      return true;
    } else {
      ui.notifications.error("TWODSIX.Ship.CantDropActorIfPositionIsNotOnShip", { localize: true });
      return false;
    }
  }
}

