import { TwodsixShipSheetData, TwodsixShipSheetSettings } from "../../types/twodsix";
import { ShipPosition, ShipPositionActorIds, Ship } from "../../types/template";
import { getDataFromDropEvent } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";

export class TwodsixShipSheet extends AbstractTwodsixActorSheet {

  /** @override */
  getData(): TwodsixShipSheetData {
    const context = <TwodsixShipSheetData>super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(this.actor.items, context);

    context.crewPositions = this.actor.items.filter((item:TwodsixItem)=>item.type==="ship_position").map((crewPosition:TwodsixItem) => {
      const shipPositionActorIds = Object.entries(<ShipPositionActorIds>(<Ship>this.actor.data.data).shipPositionActorIds).filter(([, shipPositionId]) => shipPositionId === crewPosition.id);
      if (shipPositionActorIds.length > 0) {
        const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
        (<ShipPosition>crewPosition.data.data).actors = <TwodsixActor[]>actorIds.map(actorId => game.actors?.get(actorId));
      } else {
        (<ShipPosition>crewPosition.data.data).actors = [];
      }
      (<ShipPosition>crewPosition.data.data).sortedActions = Object.entries((<ShipPosition>crewPosition.data.data).actions).map(([id, ret]) => {
        ret.id = id;
        return ret;
      });
      (<ShipPosition>crewPosition.data.data).sortedActions?.sort((a, b) => (a.order > b.order) ? 1 : -1);
      return crewPosition;
    });
    context.crewPositions.sort((a:TwodsixItem,b:TwodsixItem) => (<ShipPosition>a.data.data).order-(<ShipPosition>b.data.data).order);

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
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "crew"}],
      scrollY: [".ship-crew", ".ship-component", ".ship-storage", ".storage-wrapper", ".finances", ".ship-notes"],
      dragDrop: [
        {dropSelector: null, dragSelector: ".drag"},
        {
          dropSelector: null,
          dragSelector: ".crew-actor-token"
        }
      ]
    });
  }

  async _executeAction(event: DragEvent): Promise<boolean | any> {
    if (event.currentTarget !== null) {
      let actorId:string;
      const crewPosEl = $(event.currentTarget).parents(".crew-position");
      if ($(event.currentTarget).parents(".crew-position").find(".crew-actor-token").length === 1) {
        actorId = crewPosEl.find(".crew-actor-token").data("id");
      } else if ($(event.currentTarget).parents(".crew-position").find(".crew-actor-token").length === 0) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.NoActorsForAction"));
        return null;
      } else {
        actorId = crewPosEl.find(".crew-actor-token.force-border").data("id");
      }

      if (!actorId) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorMustBeSelectedForAction"));
        return null;
      }
      const actionId = $(event.currentTarget).data("id");
      const shipPositionId = $(event.currentTarget).parents(".crew-position").data("id");
      const shipPosition = this.actor.items.get(shipPositionId);
      const action = (<ShipPosition>shipPosition?.data?.data)?.actions[actionId];
      if (action) {
        const ship = game.actors?.get(this.actor.id ?? "");

        const extra = {
          actor: game.actors?.get(actorId),
          ship: ship,
          event: event
        };

        TwodsixShipActions.availableMethods[action.type].action(action.command, extra);
      }
    }
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find('.crew_position-edit').on('click', this._onCrewPositionEdit.bind(this));
    html.find('.crew_position-delete').on('click', this._onCrewPositionDelete.bind(this));
    html.find('.crew-actor-token').on('click', this._onCrewActorClick.bind(this));
    html.find('.crew-action').on('click', this._executeAction.bind(this));
    html.find('.create-crew-position').on('click', this._onCrewPositionCreate.bind(this));
  }

  private _onCrewPositionCreate():void {
    const shipPositions = this.actor.items.filter(item => item.type === "ship_position");
    this.actor.createEmbeddedDocuments("Item", [{"type": "ship_position", name: "New Position", order: shipPositions.length}]);
  }

  private _onCrewPositionEdit(event:Event):void {
    if (event.currentTarget !== null) {
      const crewPositionId = $(event.currentTarget).parents(".crew-position").data("id");
      this.actor?.items?.get(crewPositionId)?.sheet?.render(true);
    }
  }

  private async _onCrewPositionDelete(event:Event): Promise<void> {
    if (event.currentTarget !== null && await Dialog.confirm({
      title: "Delete position",
      content: "Are you sure you want to delete this position?"
    })) {
      const crewPositionId = $(event.currentTarget).parents(".crew-position").data("id");

      (<ShipPosition>(<TwodsixItem>this.actor.items.get(crewPositionId)).data.data).actors?.forEach((actor:TwodsixActor) => {
        if (actor.id && actor.id in (<Ship>this.actor.data.data).shipPositionActorIds) {
          this.actor.update({[`data.shipPositionActorIds.-=${actor.id}`]: null});
        }
      });
      this.actor.deleteEmbeddedDocuments("Item", [crewPositionId]);
    }
  }

  private _onCrewActorClick(event:Event) {
    if (event.currentTarget) {
      const hasClass = $(event.currentTarget).hasClass("force-border");
      $(event.currentTarget).parents(".crew-position").find(".crew-actor-token").removeClass("force-border");
      if (!hasClass) {
        $(event.currentTarget).addClass("force-border");
      }
    }
  }

  _onDragStart(event: DragEvent):void {
    if (event.dataTransfer !== null && event.target !== null) {
      event.dataTransfer.setData("text/plain", JSON.stringify({"type": "Actor", "id": $(event.target).data("id")}));
    }
  }

  async _onDrop(event:DragEvent):Promise<boolean | any> {
    event.preventDefault();

    const data = getDataFromDropEvent(event);
    if ((data.type === "Actor" && game.actors?.get(data.id)?.type === "traveller")) {
      const actorId = data.id;
      if (event.target !== null && $(event.target).parents(".crew-position").length === 1) {
        const shipPositionId = $(event.target).parents(".crew-position").data("id");
        this.actor.update({[`data.shipPositionActorIds.${actorId}`]: shipPositionId});
      } else {
        this.actor.update({[`data.shipPositionActorIds.-=${actorId}`]: null});
      }
    } else {
      return super._onDrop(event);
    }
  }
}
