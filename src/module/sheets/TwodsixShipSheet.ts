// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TwodsixShipSheetData, TwodsixShipSheetSettings } from "../../types/twodsix";
import { ShipPosition, ShipPositionActorIds, Ship, Component } from "../../types/template";
import { getDataFromDropEvent, getItemDataFromDropData } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TwodsixShipPositionSheet } from "./TwodsixShipPositionSheet";
import TwodsixItem, { onRollDamage } from "../entities/TwodsixItem";

export class TwodsixShipSheet extends AbstractTwodsixActorSheet {

  /** @override */
  getData(): TwodsixShipSheetData {
    const context = <TwodsixShipSheetData>super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(this.actor.items, context);
    if ((<Ship>this.actor.system).shipPositionActorIds) {
      context.shipPositions = this.actor.items.filter((item: TwodsixItem) => item.type === "ship_position").map((shipPosition: TwodsixItem) => {
        const shipPositionActorIds = Object?.entries(<ShipPositionActorIds>(<Ship>this.actor.system).shipPositionActorIds)?.filter(([, shipPositionId]) => shipPositionId === shipPosition.id);
        if (shipPositionActorIds?.length > 0) {
          const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
          (<ShipPosition>shipPosition.system).actors = <TwodsixActor[]>actorIds.map(actorId => game.actors?.get(actorId)).filter(x => x !== undefined);
        } else {
          (<ShipPosition>shipPosition.system).actors = [];
        }
        const actions = (<ShipPosition>shipPosition.system).actions ?? [];
        (<ShipPosition>shipPosition.system).sortedActions = Object.entries(actions).map(([id, ret]) => {
          ret.id = id;
          return ret;
        });
        (<ShipPosition>shipPosition.system).sortedActions?.sort((a, b) => (a.order > b.order) ? 1 : -1);
        return shipPosition;
      });
      context.shipPositions.sort((a: TwodsixItem, b: TwodsixItem) => (<ShipPosition>a.system).order - (<ShipPosition>b.system).order);
    } else {
      context.shipPositions = [];
    }

    context.settings = <TwodsixShipSheetSettings>{
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn'),
      useFoundryStandardStyle: game.settings.get('twodsix', 'useFoundryStandardStyle'),
      showWeightUsage: game.settings.get('twodsix', 'showWeightUsage'),
      useProseMirror: game.settings.get('twodsix', 'useProseMirror'),
      useShipAutoCalc: game.settings.get('twodsix', 'useShipAutoCalcs'),
      showComponentSummaryIcons: game.settings.get('twodsix', 'showComponentSummaryIcons')
    };

    if (context.settings.useProseMirror) {
      context.richText = {
        cargo: TextEditor.enrichHTML(this.actor.system.cargo, {async: false}),
        finances: TextEditor.enrichHTML(this.actor.system.finances, {async: false}),
        notes: TextEditor.enrichHTML(this.actor.system.notes, {async: false})
      };
    }

    return context;
  }

  static get defaultOptions():ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "ship", "actor"],
      template: "systems/twodsix/templates/actors/ship-sheet.html",
      width: 825,
      height: 674,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "ship-positions"}],
      scrollY: [".ship-positions", ".ship-crew", ".ship-component", ".ship-storage", ".storage-wrapper", ".finances", ".ship-notes"],
      dragDrop: [
        {dropSelector: null, dragSelector: ".drag"},
        {
          dropSelector: null,
          dragSelector: ".ship-position-actor-token"
        }
      ]
    });
  }

  async _executeAction(event: DragEvent): Promise<boolean | any> {
    if (event.currentTarget !== null) {
      let actorId:string;
      const shipPosEl = $(event.currentTarget).parents(".ship-position");
      if ($(event.currentTarget).parents(".ship-position").find(".ship-position-actor-token").length === 1) {
        actorId = shipPosEl.find(".ship-position-actor-token").data("id");
      } else if ($(event.currentTarget).parents(".ship-position").find(".ship-position-actor-token").length === 0) {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Ship.NoActorsForAction"));
        return null;
      } else {
        actorId = shipPosEl.find(".ship-position-actor-token.force-border").data("id");
      }

      if (!actorId) {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Ship.ActorMustBeSelectedForAction"));
        return null;
      }
      const actionId = $(event.currentTarget).data("id");
      const shipPositionId = $(event.currentTarget).parents(".ship-position").data("id");
      const shipPosition = this.actor.items.get(shipPositionId);
      const action = (<ShipPosition>shipPosition?.system)?.actions[actionId];
      if (action) {
        const extra = {
          actor: game.actors?.get(actorId),
          ship: this.actor,
          event: event,
          actionName: action.name,
          positionName: shipPosition?.name ?? "",
          diceModifier: ""
        };

        TwodsixShipActions.availableMethods[action.type].action(action.command, extra);
      }
    }
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find('.ship-position-edit').on('click', this._onShipPositionEdit.bind(this));
    html.find('.ship-position-delete').on('click', this._onShipPositionDelete.bind(this));
    html.find('.ship-position-actor-token').on('click', this._onShipActorClick.bind(this));
    html.find('.ship-position-action').on('click', this._executeAction.bind(this));
    html.find('.create-ship-position').on('click', this._onShipPositionCreate.bind(this));
    // component State toggling
    html.find(".component-toggle").on("click", this._onToggleComponent.bind(this));
    html.find(".ship-deck-link").on("click", this._onDeckplanClick.bind(this));
    html.find(".ship-deck-unlink").on("click", this._onDeckplanUnlink.bind(this));
    html.find('.roll-damage').on('click', onRollDamage.bind(this));
    html.find(".adjust-hits").on("click", this._onAdjustHitsCount.bind(this));
    html.find(".fuel-bar").on("click", this._onAdjustFuelType.bind(this));
    html.find(".fuel-name").on("click", this._onAdjustFuelType.bind(this));
    html.find(".item-link").on("click", this._onActorLink.bind(this));
  }

  private _onShipPositionCreate():void {
    const shipPositions = this.actor.items.filter(item => item.type === "ship_position");
    this.actor.createEmbeddedDocuments("Item", [{"type": "ship_position", name: "New Position", order: shipPositions.length}]);
  }

  private async _onShipPositionEdit(event:Event):Promise<void> {
    if (event.currentTarget !== null) {
      // get rid of missing actors
      if (this.actor) {
        const shipActor = <TwodsixActor>this.actor;
        for (const actorId in (<Ship>shipActor.system)?.shipPositionActorIds) {
          const actor = game.actors?.get(actorId);
          if (actor === undefined) {
            await shipActor.update({[`system.shipPositionActorIds.-=${actorId}`]: null });
          }
        }
      }
      const shipPositionId = $(event.currentTarget).parents(".ship-position").data("id");
      this.actor?.items?.get(shipPositionId)?.sheet?.render(true);
    }
  }

  private async _onShipPositionDelete(event:Event): Promise<void> {
    if (event.currentTarget !== null && await Dialog.confirm({
      title: "Delete position",
      content: "Are you sure you want to delete this position?"
    })) {
      const shipPositionId = $(event.currentTarget).parents(".ship-position").data("id");

      (<ShipPosition>(<TwodsixItem>this.actor.items.get(shipPositionId)).system).actors?.forEach((actor:TwodsixActor) => {
        if (actor.id && actor.id in (<Ship>this.actor.system).shipPositionActorIds) {
          if (actor.id) {
            this.actor.update({ [`system.shipPositionActorIds.-=${actor.id}`]: null });
          }
        }
      });
      this.actor.deleteEmbeddedDocuments("Item", [shipPositionId]);
    }
  }

  private _onShipActorClick(event:Event) {
    if (event.currentTarget) {
      const hasClass = $(event.currentTarget).hasClass("force-border");
      $(event.currentTarget).parents(".ship-position").find(".ship-position-actor-token").removeClass("force-border");
      if (!hasClass) {
        $(event.currentTarget).addClass("force-border");
      }
    }
  }

  private _onToggleComponent(event:Event):void {
    if (event.currentTarget) {
      const li = $(event.currentTarget).parents(".item");
      const itemSelected = this.actor.items.get(li.data("itemId"));
      const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
      itemSelected?.update({"system.status": stateTransitions[(<Component>itemSelected.system)?.status]});
    }
  }

  private _onAdjustFuelType() {
    this.actor.update({"system.shipStats.fuel.isRefined": !(<Ship>this.actor.system).shipStats.fuel.isRefined});
  }

  private async _onDeckplanClick() {
    if ((<Ship>this.actor.system)?.deckPlan) {
      const deckPlan = game.scenes?.get((<Ship>this.actor.system).deckPlan);
      await deckPlan?.view();
    }
  }

  private _onDeckplanUnlink() {
    if ((<Ship>this.actor.system)?.deckPlan) {
      this.actor.update({"system.deckPlan": ""});;
    }
  }

  private async _onAdjustHitsCount(event): Promise<void> {
    const modifier = parseInt(event.currentTarget["dataset"]["value"], 10);
    const li = $(event.currentTarget).parents(".item");
    const itemSelected = this.actor.items.get(li.data("itemId"));
    if (itemSelected) {
      const newHits = (<Component>itemSelected.system)?.hits + modifier;
      if (newHits <= game.settings.get('twodsix', 'maxComponentHits') && newHits >= 0) {
        await itemSelected.update({ "system.hits": newHits });
      }
      if (newHits === game.settings.get('twodsix', 'maxComponentHits')) {
        await itemSelected.update({ "system.status": "destroyed" });
      }
    }
  }

  _onDragStart(event: DragEvent):void {
    if (event.dataTransfer !== null && event.target !== null && $(event.target).data("drag") === "actor") {
      const actor = game.actors?.get($(event.target).data("id"));
      event.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor,  //Not Certain if this should be system instead
        "actorId": this.actor.id,
        "id": $(event.target).data("id")
      }));
    } else if (event.target && $(event.target).hasClass("ship-position-action")) {
      return;
    } else {
      super._onDragStart(event);
    }
  }

  async _onDrop(event:DragEvent):Promise<boolean | any> {
    event.preventDefault();
    if (event.dataTransfer === null || event.target === null) {
      return false;
    }

    try {
      const dropData:any = getDataFromDropEvent(event);
      const droppedObject:any = await getItemDataFromDropData(dropData);

      if (droppedObject.type === "traveller") {
        const actorId = droppedObject._id;
        const currentShipPositionId = (<Ship>this.actor.system).shipPositionActorIds[actorId];
        if (event.target !== null && $(event.target).parents(".ship-position").length === 1) {
          const shipPositionId = $(event.target).parents(".ship-position").data("id");
          await this.actor.update({[`system.shipPositionActorIds.${actorId}`]: shipPositionId});
          this.actor.items.get(shipPositionId)?.sheet?.render();
        } else {
          await this.actor.update({[`system.shipPositionActorIds.-=${actorId}`]: null});
        }
        this.actor.items.get(currentShipPositionId)?.sheet?.render();
      } else if ((droppedObject.type === "skills") && event.target !== null && $(event.target).parents(".ship-position").length === 1) {
        const shipPositionId = $(event.target).parents(".ship-position").data("id");
        const shipPosition = <TwodsixItem>this.actor.items.get(shipPositionId);
        await TwodsixShipPositionSheet.createActionFromSkill(shipPosition, droppedObject);
      } else if (droppedObject.type === "vehicle") {
        await this._addVehicleToComponents(droppedObject, dropData.uuid);
      } else {
        return super._onDrop(event);
      }
    } catch (err) {
      console.warn(err); // uncomment when debugging
      return false;
    }
  }
  async _addVehicleToComponents(droppedObject: any, uuid: string): Promise <void> {
    const newComponent = {
      name: droppedObject.name,
      img: droppedObject.img,
      type: "component",
      system: {
        docReference: droppedObject.system.docReference,
        price: droppedObject.system.cost,
        quantity: 1,
        status: "operational",
        subtype: "vehicle",
        techLevel: droppedObject.system.techLevel,
        weight: droppedObject.system.weight,
        actorLink: uuid
      }
    };
    await this.actor.createEmbeddedDocuments("Item", [newComponent]);
  }
  private async _onActorLink(event): Promise<void> {
    const actorUuid = event.currentTarget["dataset"].uuid;
    const selectedActor = <Actor> await fromUuid(actorUuid);
    console.log(selectedActor);
    selectedActor?.sheet?.render(true);
  }
}
