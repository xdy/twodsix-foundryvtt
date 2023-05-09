import {getDataFromDropEvent, getItemDataFromDropData} from "../utils/sheetUtils";
import {TwodsixShipActions} from "../utils/TwodsixShipActions";
import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import {TwodsixShipPositionSheet} from "./TwodsixShipPositionSheet";
import {onRollDamage} from "../entities/TwodsixItem";

export class TwodsixShipSheet extends AbstractTwodsixActorSheet {
  /** @override */
  getData() {
    const context = super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers((this.actor), context);
    if (this.actor.system.shipPositionActorIds) {
      context.shipPositions = this.actor.itemTypes.ship_position.map((shipPosition) => {
        const shipPositionActorIds = Object?.entries(this.actor.system.shipPositionActorIds)?.filter(([, shipPositionId]) => shipPositionId === shipPosition.id);
        if (shipPositionActorIds?.length > 0) {
          const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
          shipPosition.system.actors = actorIds.map(actorId => game.actors?.get(actorId)).filter(x => x !== undefined);
        } else {
          shipPosition.system.actors = [];
        }
        const actions = shipPosition.system.actions ?? [];
        shipPosition.system.sortedActions = Object.entries(actions).map(([id, ret]) => {
          ret.id = id;
          return ret;
        });
        shipPosition.system.sortedActions?.sort((a, b) => (a.order > b.order) ? 1 : -1);
        return shipPosition;
      });
      context.shipPositions.sort((a, b) => a.system.order - b.system.order);
    } else {
      context.shipPositions = [];
    }
    context.settings = {
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn'),
      showBandwidth: game.settings.get('twodsix', 'showBandwidth'),
      useFoundryStandardStyle: game.settings.get('twodsix', 'useFoundryStandardStyle'),
      showWeightUsage: game.settings.get('twodsix', 'showWeightUsage'),
      useProseMirror: game.settings.get('twodsix', 'useProseMirror'),
      useShipAutoCalc: game.settings.get('twodsix', 'useShipAutoCalcs'),
      showComponentSummaryIcons: game.settings.get('twodsix', 'showComponentSummaryIcons'),
      showComponentRating: game.settings.get('twodsix', 'showComponentRating'),
      showComponentDM: game.settings.get('twodsix', 'showComponentDM'),
      allowDragDropOfLists: game.settings.get('twodsix', 'allowDragDropOfLists'),
      maxComponentHits: game.settings.get('twodsix', 'maxComponentHits')
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

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "ship", "actor"],
      template: "systems/twodsix/templates/actors/ship-sheet.html",
      width: 825,
      height: 686,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "ship-positions"}],
      scrollY: [".ship-positions", ".ship-crew", ".ship-component", ".ship-storage", ".storage-wrapper", ".finances", ".ship-notes"],
      dragDrop: [
        //{dropSelector: ".ship-positions-list", dragSelector: ".drag"}, UNKNOWN NEED
        {
          dropSelector: ".ship-position-box",
          dragSelector: ".ship-position-actor-token"
        },
        {dragSelector: ".item", dropSelector: null}
      ]
    });
  }

  async _executeAction(event) {
    if (event.currentTarget !== null) {
      let actorId;
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
      const action = shipPosition?.system?.actions[actionId];
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

  activateListeners(html) {
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
    html.find(".adjust-counter").on("click", this._onAdjustCounter.bind(this));
    html.find(".fuel-bar").on("click", this._onAdjustFuelType.bind(this));
    html.find(".fuel-name").on("click", this._onAdjustFuelType.bind(this));
    html.find(".item-link").on("click", this._onDocumentLink.bind(this));
    html.find(".status-component").on("click", this._onDocumentLink.bind(this));
  }

  _onShipPositionCreate() {
    const shipPositions = this.actor.itemTypes.ship_position;
    this.actor.createEmbeddedDocuments("Item", [{
      "type": "ship_position",
      name: "New Position",
      order: shipPositions.length
    }]);
  }

  async _onShipPositionEdit(event) {
    if (event.currentTarget !== null) {
      // get rid of missing actors
      if (this.actor) {
        const shipActor = this.actor;
        for (const actorId in shipActor.system?.shipPositionActorIds) {
          const actor = game.actors?.get(actorId);
          if (actor === undefined) {
            await shipActor.update({[`system.shipPositionActorIds.-=${actorId}`]: null});
          }
        }
      }
      const shipPositionId = $(event.currentTarget).parents(".ship-position").data("id");
      this.actor?.items?.get(shipPositionId)?.sheet?.render(true);
    }
  }

  async _onShipPositionDelete(event) {
    if (event.currentTarget !== null && await Dialog.confirm({
      title: "Delete position",
      content: "Are you sure you want to delete this position?"
    })) {
      const shipPositionId = $(event.currentTarget).parents(".ship-position").data("id");
      this.actor.items.get(shipPositionId).system.actors?.forEach((actor) => {
        if (actor.id && actor.id in this.actor.system.shipPositionActorIds) {
          if (actor.id) {
            this.actor.update({[`system.shipPositionActorIds.-=${actor.id}`]: null});
          }
        }
      });
      this.actor.deleteEmbeddedDocuments("Item", [shipPositionId]);
    }
  }

  _onShipActorClick(event) {
    if (event.currentTarget) {
      const hasClass = $(event.currentTarget).hasClass("force-border");
      $(event.currentTarget).parents(".ship-position").find(".ship-position-actor-token").removeClass("force-border");
      if (!hasClass) {
        $(event.currentTarget).addClass("force-border");
      }
    }
  }

  _onToggleComponent(event) {
    if (event.currentTarget) {
      const li = $(event.currentTarget).parents(".item");
      const itemSelected = this.actor.items.get(li.data("itemId"));
      const type = $(event.currentTarget).data("type");
      if (type === "status") {
        const stateTransitions = {
          "operational": "damaged",
          "damaged": "destroyed",
          "destroyed": "off",
          "off": "operational"
        };
        itemSelected?.update({"system.status": stateTransitions[itemSelected.system?.status]});
      } else if (type === "popup") {
        itemSelected?.update({"system.isExtended": !itemSelected.system.isExtended});
      }
    }
  }

  _onAdjustFuelType() {
    this.actor.update({"system.shipStats.fuel.isRefined": !this.actor.system.shipStats.fuel.isRefined});
  }

  async _onDeckplanClick() {
    if (this.actor.system?.deckPlan) {
      const deckPlan = game.scenes?.get(this.actor.system.deckPlan);
      await deckPlan?.view();
    }
  }

  _onDeckplanUnlink() {
    if (this.actor.system?.deckPlan) {
      this.actor.update({"system.deckPlan": ""});

    }
  }

  async _onAdjustCounter(event) {
    const modifier = parseInt(event.currentTarget["dataset"]["value"], 10);
    const field = $(event.currentTarget).parents(".combined-buttons").data("field");
    const li = $(event.currentTarget).parents(".item");
    const itemSelected = this.actor.items.get(li.data("itemId"));
    if (itemSelected && field) {
      if (field === "hits") {
        const newHits = itemSelected.system.hits + modifier;
        if (newHits <= game.settings.get('twodsix', 'maxComponentHits') && newHits >= 0) {
          await itemSelected.update({"system.hits": newHits});
        }
        if (newHits === game.settings.get('twodsix', 'maxComponentHits')) {
          await itemSelected.update({"system.status": "destroyed"});
        } else if (newHits > 0 && itemSelected.system.status !== "off") {
          await itemSelected.update({"system.status": "damaged"});
        } else if (newHits === 0 && itemSelected.system.status !== "off") {
          await itemSelected.update({"system.status": "operational"});
        }
      } else if (field === "ammo") {
        const newAmmo = itemSelected.system.ammunition.value + modifier;
        if (newAmmo >= 0 && newAmmo <= itemSelected.system.ammunition.max) {
          await itemSelected.update({"system.ammunition.value": newAmmo});
        }
      }
    }
  }

  _onDragStart(event) {
    if (event.dataTransfer !== null && event.target !== null && $(event.target).data("drag") === "actor") {
      const actor = game.actors?.get($(event.target).data("id"));
      event.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor,
        "actorId": this.actor.id,
        "id": $(event.target).data("id"),
        "uuid": actor?.uuid
      }));
    } else if (event.target && $(event.target).hasClass("ship-position-action")) {

    } else {
      super._onDragStart(event);
    }
  }

  async _onDrop(event) {
    event.preventDefault();
    if (event.dataTransfer === null || event.target === null) {
      return false;
    }
    try {
      const dropData = getDataFromDropEvent(event);
      if (dropData.type === 'html') {
        return false;
      }
      const droppedObject = await getItemDataFromDropData(dropData);
      if (droppedObject.type === "traveller") {
        const actorId = droppedObject._id;
        const currentShipPositionId = this.actor.system.shipPositionActorIds[actorId];
        if (event.target !== null && $(event.target).parents(".ship-position").length === 1) {
          const shipPositionId = $(event.target).parents(".ship-position").data("id");
          await this.actor.update({[`system.shipPositionActorIds.${actorId}`]: shipPositionId});
          this.actor.items.get(shipPositionId)?.sheet?.render();
        } else {
          await this.actor.update({[`system.shipPositionActorIds.-=${actorId}`]: null});
        }
        this.actor.items.get(currentShipPositionId)?.sheet?.render();
      } else if ((droppedObject.type === "skills") && event.target !== null && $(event.target).parents(".ship-position").length === 1) {
        //check for double drop trigger, not clear why this occurs
        if (event.currentTarget.className === "ship-position-box") {
          const shipPositionId = $(event.target).parents(".ship-position").data("id");
          const shipPosition = this.actor.items.get(shipPositionId);
          await TwodsixShipPositionSheet.createActionFromSkill(shipPosition, droppedObject);
        } else {
          return false;
        }
      } else if (["vehicle", "ship"].includes(droppedObject.type)) {
        await this._addVehicleCraftToComponents(droppedObject, dropData.uuid);
      } else if (droppedObject.type === "animal") {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.AnimalsCantHoldPositions"));
        return false;
      } else if (["equipment", "weapon", "armor", "augment", "storage", "tool", "consumable"].includes(droppedObject.type)) {
        // this is part of a refactor *******
        this.processDroppedItem(event, droppedObject);
      } else {
        await super._onDrop(event);
      }
    } catch (err) {
      console.warn(err); // uncomment when debugging
      return false;
    }
  }

  async _addVehicleCraftToComponents(droppedObject, uuid) {
    const newComponent = {
      name: droppedObject.name,
      img: droppedObject.img,
      type: "component",
      system: {
        docReference: droppedObject.type === "ship" ? "" : droppedObject.system.docReference,
        price: droppedObject.type === "ship" ? droppedObject.system.shipValue : droppedObject.system.cost,
        quantity: 1,
        status: "operational",
        subtype: "vehicle",
        techLevel: droppedObject.system.techLevel,
        weight: droppedObject.type === "ship" ? droppedObject.system.shipStats.mass.max : droppedObject.system.weight,
        actorLink: uuid
      }
    };
    await this.actor.createEmbeddedDocuments("Item", [newComponent]);
  }

  async _onDocumentLink(event) {
    const documentUuid = event.currentTarget["dataset"].uuid;
    const selectedDocument = await fromUuid(documentUuid);
    selectedDocument?.sheet?.render(true);
  }
}
