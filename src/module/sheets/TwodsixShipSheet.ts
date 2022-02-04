import { TwodsixShipSheetData, TwodsixShipSheetSettings } from "../../types/twodsix";
import { ShipPosition, ShipPositionActorIds, Ship, Component } from "../../types/template";
import { getDataFromDropEvent } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TwodsixShipPositionSheet } from "./TwodsixShipPositionSheet";

export class TwodsixShipSheet extends AbstractTwodsixActorSheet {

  /** @override */
  getData(): TwodsixShipSheetData {
    const context = <TwodsixShipSheetData>super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(this.actor.items, context);

    context.shipPositions = this.actor.items.filter((item:TwodsixItem)=>item.type==="ship_position").map((shipPosition:TwodsixItem) => {
      const shipPositionActorIds = Object.entries(<ShipPositionActorIds>(<Ship>this.actor.data.data).shipPositionActorIds).filter(([, shipPositionId]) => shipPositionId === shipPosition.id);
      if (shipPositionActorIds.length > 0) {
        const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
        (<ShipPosition>shipPosition.data.data).actors = <TwodsixActor[]>actorIds.map(actorId => game.actors?.get(actorId));
      } else {
        (<ShipPosition>shipPosition.data.data).actors = [];
      }
      const actions = (<ShipPosition>shipPosition.data.data).actions ?? [];
      (<ShipPosition>shipPosition.data.data).sortedActions = Object.entries(actions).map(([id, ret]) => {
        ret.id = id;
        return ret;
      });
      (<ShipPosition>shipPosition.data.data).sortedActions?.sort((a, b) => (a.order > b.order) ? 1 : -1);
      return shipPosition;
    });
    context.shipPositions.sort((a:TwodsixItem,b:TwodsixItem) => (<ShipPosition>a.data.data).order-(<ShipPosition>b.data.data).order);

    context.settings = <TwodsixShipSheetSettings>{
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn')
    };

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
      const action = (<ShipPosition>shipPosition?.data?.data)?.actions[actionId];
      if (action) {
        const extra = {
          actor: game.actors?.get(actorId),
          ship: this.actor,
          event: event
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
  }

  private _onShipPositionCreate():void {
    const shipPositions = this.actor.items.filter(item => item.type === "ship_position");
    this.actor.createEmbeddedDocuments("Item", [{"type": "ship_position", name: "New Position", order: shipPositions.length}]);
  }

  private _onShipPositionEdit(event:Event):void {
    if (event.currentTarget !== null) {
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

      (<ShipPosition>(<TwodsixItem>this.actor.items.get(shipPositionId)).data.data).actors?.forEach((actor:TwodsixActor) => {
        if (actor.id && actor.id in (<Ship>this.actor.data.data).shipPositionActorIds) {
          this.actor.update({[`data.shipPositionActorIds.-=${actor.id}`]: null});
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
      itemSelected?.update({"data.status": stateTransitions[(<Component>itemSelected.data.data)?.status]});
    }
  }
  private _onDeckplanClick() {
    if ((<Ship>this.actor.data.data)?.deckPlan) {
      game.scenes?.get((<Ship>this.actor.data.data).deckPlan)?.view();
    }
  }

  private _onDeckplanUnlink() {
    if ((<Ship>this.actor.data.data)?.deckPlan) {
      this.actor.update({"data.deckPlan": ""});;
    }
  }

  _onDragStart(event: DragEvent):void {
    if (event.dataTransfer !== null && event.target !== null && $(event.target).data("drag") === "actor") {
      const actor = game.actors?.get($(event.target).data("id"));
      event.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor?.data,
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
      const data = getDataFromDropEvent(event);

      if (data.type === "Actor" && (data.data?.type === "traveller" || game.actors?.get(data.id)?.type === "traveller")) {
        const actorId = data.id;
        const currentShipPositionId = (<Ship>this.actor.data.data).shipPositionActorIds[actorId];
        if (event.target !== null && $(event.target).parents(".ship-position").length === 1) {
          const shipPositionId = $(event.target).parents(".ship-position").data("id");
          await this.actor.update({[`data.shipPositionActorIds.${actorId}`]: shipPositionId});
          this.actor.items.get(shipPositionId)?.sheet?.render();
        } else {
          await this.actor.update({[`data.shipPositionActorIds.-=${actorId}`]: null});
        }
        this.actor.items.get(currentShipPositionId)?.sheet?.render();
      } else if (data.type === "Item" && (data.data?.type === "skills" || game.items?.get(data.id)?.type === "skills") && event.target !== null && $(event.target).parents(".ship-position").length === 1) {
        const shipPositionId = $(event.target).parents(".ship-position").data("id");
        const shipPosition = <TwodsixItem>this.actor.items.get(shipPositionId);

        let skillData:TwodsixItem|undefined;
        if (data.id) {
          skillData = game.items?.get(data.id);
        } else {
          skillData = game.actors?.get(data.actorId)?.items.get(data.data._id);
        }
        if (skillData) {
          await TwodsixShipPositionSheet.createActionFromSkill(shipPosition, skillData);
        }
      } else {
        return super._onDrop(event);
      }
    } catch (err) {
      // console.warn(err); // uncomment when debugging
      return false;
    }
  }
}
