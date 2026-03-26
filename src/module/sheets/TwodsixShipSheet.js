/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */

import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getDocFromDropData } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TwodsixShipPositionSheet } from "./TwodsixShipPositionSheet";

export class TwodsixShipSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixShipSheet",
    classes: ["twodsix", "ship", "actor"],
    position: {
      width: 944,
      height: 820
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-rocket"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    dragDrop: [
      //{dropSelector: ".ship-positions-list", dragSelector: ".drag"}, UNKNOWN NEED
      {dropSelector: ".ship-position-box", dragSelector: ".ship-position-actor-token"},
      {dragSelector: ".item", dropSelector: null}
    ],
    actions: {
      editPosition: this._onShipPositionEdit,
      deletePosition: this._onShipPositionDelete,
      copyPosition: this._onShipPositionCopy,
      selectShipActor: this._onShipActorClick,
      executeAction: this._onExecuteAction,
      createPosition: this._onShipPositionCreate,
      toggleComponent: this._onToggleComponent,
      selectDeckplan: this._onDeckplanClick,
      deleteDeckplan: this._onDeckplanUnlink,
      adjustFuelType: this._onAdjustFuelType,
      itemLink: this._onDocumentLink,
      toggleWeight: this._toggleWeight
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/ship-sheet.hbs",
      scrollable: ["", ".ship-tabs-info", ".ship-positions", ".ship-crew", ".ship-component", ".ship-storage", ".storage-wrapper", ".finances", ".ship-notes", ".overlap-header"]
    }
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "shipPositions"},
        {id: "shipCrew"},
        {id: "shipComponent"},
        {id: "shipStorage"},
        {id: "shipCargo"},
        {id: "shipFinance"},
        {id: "shipNotes"}
      ],
      initial: "shipPositions"
    }
  };

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {null|void}
   */
  static _onExecuteAction(ev, target) {
    if (target !== null) {
      let actorId;
      const shipPosEl = target.closest(".ship-position");
      const shipPosActors = shipPosEl.querySelectorAll(".ship-position-actor-token");
      if (shipPosActors.length === 1) {
        actorId = shipPosActors[0].dataset.id;
      } else if (shipPosActors.length === 0) {
        ui.notifications.warn("TWODSIX.Ship.NoActorsForAction", {localize: true});
        return null;
      } else {
        actorId = shipPosEl.querySelector(".ship-position-actor-token.force-border")?.dataset.id;
      }

      const actionId = target.dataset.id;
      const shipPositionId = shipPosEl.dataset.id;
      TwodsixShipSheet.performShipAction(ev, shipPositionId, actorId, actionId, this.actor);
    }
  }

  /**
   * @param {Event} ev
   * @param {string} positionId
   * @param {string} actorId
   * @param {string} actionId
   * @param {TwodsixActor} shipActor
   * @returns {boolean|void}
   */
  static performShipAction(ev, positionId, actorId, actionId, shipActor) {
    if (!actorId) {
      ui.notifications.warn("TWODSIX.Ship.ActorMustBeSelectedForAction", {localize: true});
      return false;
    }
    const shipPosition = shipActor.items.get(positionId);
    const action = (shipPosition?.system)?.actions[actionId];
    if (action) {
      const component = shipActor.items.find(item => item.id === action.component);
      const extra = {
        actor: game.actors?.get(actorId),
        ship: shipActor,
        component: component,
        event: ev,
        actionName: action.name,
        positionName: shipPosition?.name ?? "",
        diceModifier: ""
      };

      TwodsixShipActions.availableMethods[action.type].action(action.command, extra);
      return true;
    }
  }

  /**
   * @returns {void}
   */
  static _onShipPositionCreate() {
    const shipPositions = this.actor.itemTypes.ship_position;
    this.actor.createEmbeddedDocuments("Item", [{
      "type": "ship_position",
      name: "New Position",
      order: shipPositions.length
    }]);
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onShipPositionEdit(ev, target) {
    if (target !== null) {
      // get rid of missing actors
      if (this.actor) {
        const shipActor = this.actor;
        for (const actorId in (shipActor.system)?.shipPositionActorIds) {
          const actor = game.actors?.get(actorId);
          if (actor === undefined) {
            await shipActor.update({[`system.shipPositionActorIds.${actorId}`]: _del});
          }
        }
      }
      const shipPositionId = target.closest(".ship-position").dataset.id;
      const positionItem = this.actor?.items?.get(shipPositionId);
      await positionItem?.sheet.render({force: true});
    }
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onShipPositionDelete(ev, target) {
    if (target !== null && (await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("TWODSIX.Ship.DeletePosition")},
      content: game.i18n.localize("TWODSIX.Ship.ConfirmDeletePosition")
    }))) {
      const shipPositionId = target.closest(".ship-position").dataset.id;

      ((this.actor.items.get(shipPositionId)).system).actors?.forEach(async (actor) => {
        if (actor.id && actor.id in (this.actor.system).shipPositionActorIds) {
          if (actor.id) {
            await this.actor.update({[`system.shipPositionActorIds.${actor.id}`]: _del});
          }
        }
      });
      await this.actor.deleteEmbeddedDocuments("Item", [shipPositionId]);
    }
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onShipPositionCopy(ev, target) {
    if (target !== null) {
      const shipPositionId = target.closest(".ship-position").dataset.id;
      const positionItem = this.actor?.items?.get(shipPositionId);
      const posData = foundry.utils.duplicate(positionItem);
      await TwodsixItem.create(posData, {});
    }
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onShipActorClick(ev, target) {
    if (target) {
      const hasClass = target.classList.contains("force-border");
      target.closest(".ship-position-box").querySelectorAll(".ship-position-actor-token")?.forEach((token) => {
        if (target !== token) {
          token.classList.remove("force-border");
        } else if (!hasClass) {
          target.classList.add("force-border");
        }
      });
    }
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onToggleComponent(ev, target) {
    if (target) {
      const li = target.closest(".item");
      const itemSelected = this.actor.items.get(li.dataset.itemId);
      if (!itemSelected) {
        return;
      }
      const type = target.dataset.type;
      if (type === "status") {
        const stateTransitions = {
          "operational": "damaged",
          "damaged": "destroyed",
          "destroyed": "off",
          "off": "operational"
        };
        const newState = ev.shiftKey ? (itemSelected.system.status === "off" ? "operational" : "off") : stateTransitions[itemSelected.system.status];
        itemSelected.update({"system.status": newState});
      } else if (type === "popup") {
        itemSelected.update({"system.isExtended": !itemSelected.system.isExtended});
      }
    }
  }

  /**
   * @returns {void}
   */
  static _onAdjustFuelType() {
    this.actor.update({"system.shipStats.fuel.isRefined": !(this.actor.system).shipStats.fuel.isRefined});
  }

  /**
   * @returns {Promise<void>}
   */
  static async _onDeckplanClick() {
    if ((this.actor.system)?.deckPlan) {
      const deckPlan = game.scenes?.get((this.actor.system).deckPlan);
      await deckPlan?.view();
    }
  }

  /**
   * @returns {Promise<void>}
   */
  static async _toggleWeight() {
    (this.actor).update({"system.showWeightUsage": !(this.actor).system.showWeightUsage});
  }

  /**
   * @returns {void}
   */
  static _onDeckplanUnlink() {
    if ((this.actor.system)?.deckPlan) {
      this.actor.update({"system.deckPlan": ""});
      ;
    }
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onDocumentLink(ev, target) {
    const documentUuid = target.dataset.uuid;
    const selectedDocument = await fromUuid(documentUuid);
    selectedDocument?.sheet?.render({force: true});
  }

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.dtypes = ["String", "Number", "Boolean"];
    if ((this.actor.system).shipPositionActorIds) {
      context.shipPositions = (this.actor).itemTypes.ship_position.map((shipPosition) => {
        const shipPositionActorIds = Object?.entries((this.actor.system).shipPositionActorIds)?.filter(([, shipPositionId]) => shipPositionId === shipPosition.id);
        if (shipPositionActorIds?.length > 0) {
          const actorIds = shipPositionActorIds.map(([actorId,]) => actorId);
          (shipPosition.system).actors = actorIds.map(actorId => game.actors?.get(actorId)).filter(x => x !== undefined);
        } else {
          (shipPosition.system).actors = [];
        }
        const actions = (shipPosition.system).actions ?? [];
        (shipPosition.system).sortedActions = Object.entries(actions).map(([id, ret]) => {
          ret.id = id;
          return ret;
        });
        (shipPosition.system).sortedActions?.sort((a, b) => (a.order > b.order) ? 1 : -1);
        return shipPosition;
      });
      context.shipPositions.sort((a, b) => (a.system).order - (b.system).order);
    } else {
      context.shipPositions = [];
    }

    const useShipAutoCalc = game.settings.get('twodsix', 'useShipAutoCalcs');
    const showCost = game.settings.get('twodsix', 'showCost') && useShipAutoCalc;

    Object.assign(context.settings, {
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn'),
      showSingleCargoColumn: game.settings.get('twodsix', 'showSingleCargoColumn'),
      showBandwidth: game.settings.get('twodsix', 'showBandwidth'),
      showWeightUsage: (this.actor).system.showWeightUsage ?? game.settings.get('twodsix', 'showWeightUsage'),
      useShipAutoCalc,
      showComponentSummaryIcons: game.settings.get('twodsix', 'showComponentSummaryIcons'),
      allowDragDropOfListsShip: game.settings.get('twodsix', 'allowDragDropOfListsShip'),
      //maxComponentHits: game.settings.get('twodsix', 'maxComponentHits'),
      mDriveLabel: game.settings.get('twodsix', 'mDriveLabel') || "TWODSIX.Ship.MDrive",
      jDriveLabel: game.settings.get('twodsix', 'jDriveLabel') || "TWODSIX.Ship.JDrive",
      showComponentRating: game.settings.get('twodsix', 'showComponentRating'),
      showComponentDM: game.settings.get('twodsix', 'showComponentDM'),
      showCost,
      showCombatPosition: game.settings.get('twodsix', 'showCombatPosition'),
      singleComponentClass: (`components-stored-single` +
        (game.settings.get('twodsix', 'showComponentRating') ? ` rating` : ` no-rating`) +
        (game.settings.get('twodsix', 'showComponentDM') ? ` dm` : ` no-dm`) +
        (showCost ? ` cost` : ` no-cost`)),
      useMCr: game.settings.get('twodsix', 'showCommonFundsMCr')
    });

    if (context.settings.useProseMirror) {
      const TextEditorImp = foundry.applications.ux.TextEditor.implementation;
      context.richText = {
        cargo: await TextEditorImp.enrichHTML(this.actor.system.cargo, {secrets: this.document.isOwner}),
        financeNotes: await TextEditorImp.enrichHTML(this.actor.system.financeNotes, {secrets: this.document.isOwner}),
        notes: await TextEditorImp.enrichHTML(this.actor.system.notes, {secrets: this.document.isOwner})
      };
    }

    return context;
  }

  /**
   * @override
   * @param {object} context
   * @param {object} options
   * @returns {Promise<void>}
   */
  async _onRender(context, options) {
    await super._onRender(context, options);

    //Set special class for FVTT window-content section so that it overlaps with header
    if (this.options.sheetType === 'TwodsixShipSheet') {
      this.element.querySelector(".window-content").classList.add("overlap-header");
      this.element.querySelector(".window-header").classList.add("transparent-header-ship");
    }
  }

  /**
   * @param {DragEvent} ev
   * @returns {void}
   */
  _onDragStart(ev) {
    if (ev.dataTransfer !== null && ev.target !== null && ev.target.dataset?.drag === "actor") {
      const actor = game.actors?.get(ev.target.dataset.id);
      ev.dataTransfer.setData("text/plain", JSON.stringify({
        "type": "Actor",
        "data": actor,  //Not Certain if this should be system instead
        "actorId": actor?.id, //Why did this refer to ship actor previously?
        "id": actor?.id, //Necesssary?
        "uuid": actor?.uuid
      }));
    } else if (ev.target?.classList.contains("ship-position-action")) {
      return;
    } else {
      super._onDragStart(ev);
    }
  }

  /**
   * @param {DragEvent} ev
   * @returns {Promise<boolean>}
   */
  async _onDrop(ev) {
    // Only handle ship-specific drops here. Delegate all other drops to AbstractTwodsixActorSheet.
    ev.preventDefault();
    if (ev.dataTransfer === null || ev.target === null) {
      return false;
    }

    try {
      const dropData = getDataFromDropEvent(ev);
      // If dropData is a type not handled by this sheet, delegate immediately
      if (!dropData || ["html", "pdf", "JournalEntry", "ActiveEffect", "Folder", "ItemList", "Scene", "trade-cargo", "damageItem"].includes(dropData.type)) {
        return await super._onDrop(ev);
      }

      const droppedObject = await getDocFromDropData(dropData);

      if (droppedObject && ["traveller", "robot"].includes(droppedObject.type)) {
        return await this._addCrewToSheet(droppedObject, ev);
      } else if (droppedObject && (droppedObject.type === "skills") && ev.target !== null && ev.target?.closest(".ship-position")) {
        if (ev.currentTarget.className === "ship-position-box") {
          const shipPositionId = ev.target.closest(".ship-position").dataset.id;
          const shipPosition = this.actor.items.get(shipPositionId);
          await TwodsixShipPositionSheet.createActionFromSkill(shipPosition, droppedObject);
          return true;
        } else {
          return false;
        }
      } else if (droppedObject && ["vehicle", "ship"].includes(droppedObject.type)) {
        await this._addVehicleCraftToComponents(droppedObject, dropData.uuid);
        return true;
      } else if (droppedObject && droppedObject.type === "animal") {
        ui.notifications.warn("TWODSIX.Warnings.AnimalsCantHoldPositions", {localize: true});
        return false;
      } else if (droppedObject && ["equipment", "weapon", "armor", "augment", "storage", "tool", "consumable", "computer", "junk"].includes(droppedObject.type)) {
        await this.processDroppedItem(ev, droppedObject);
        return true;
      } else if (ev.currentTarget.className === 'ship-position-box ship-position-add-box' && droppedObject && droppedObject.type === 'ship_position') {
        return false; //avoid double add
      } else {
        // Delegate all other drops to AbstractTwodsixActorSheet
        return await super._onDrop(ev);
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  /**
   * @param {TwodsixActor} droppedObject
   * @param {DragEvent} ev
   * @returns {Promise<boolean>}
   */
  async _addCrewToSheet(droppedObject, ev) {
    const onTab = ev.target?.closest(".tab")?.dataset?.tab;
    if (onTab === "shipPositions") {
      // Try to add dropped actor to closest ship position
      const actorId = droppedObject._id;
      const currentShipPositionId = (this.actor.system).shipPositionActorIds[actorId];
      if (ev.target !== null && ev.target?.closest(".ship-position")) {
        const shipPositionId = ev.target.closest(".ship-position").dataset.id;
        await this.actor.update({[`system.shipPositionActorIds.${actorId}`]: shipPositionId});
        this.actor.items.get(shipPositionId)?.sheet?.render();
      } else {
        await this.actor.update({[`system.shipPositionActorIds.${actorId}`]: _del});
      }
      this.actor.items.get(currentShipPositionId)?.sheet?.render();
      return true;
    } else if (onTab === "shipCrew") {
      // Try to add actor's name to closest crew designator
      const crewPositionName = ev.target.name ?? ev.target.dataset?.edit;
      if (crewPositionName?.includes("crewLabel")) {
        return false;
      }
      let nameToAdd = droppedObject.name;
      if (crewPositionName && nameToAdd) {
        if (["marine", "gunner", "engineer"].includes(crewPositionName.replace("system.crew.", ""))) {
          // Multi crew boxes
          const listedNames = foundry.utils.getProperty(this.actor, crewPositionName);
          if (listedNames?.includes(nameToAdd)) {
            return false;
          } else if (listedNames) {
            nameToAdd = `${listedNames}, ${nameToAdd}`;
          }
        }
        await this.actor.update({[crewPositionName]: nameToAdd});
        return true;
      }
      return false;
    } else {
      return false;
    }
  }

  /**
   * @param {TwodsixActor} droppedObject
   * @param {string} uuid
   * @returns {Promise<void>}
   */
  async _addVehicleCraftToComponents(droppedObject, uuid) {
    const useAutoCalcs = game.settings.get('twodsix', 'useShipAutoCalcs');

    const newComponent = {
      name: droppedObject.name,
      img: droppedObject.img,
      type: "component",
      system: {
        docReference: droppedObject.type === "ship" ? "" : droppedObject.system.docReference,
        price: droppedObject.type === "ship"
          ? (useAutoCalcs && droppedObject.system.calcShipStats?.cost?.shipValue
            ? droppedObject.system.calcShipStats.cost.shipValue
            : droppedObject.system.shipValue)
          : droppedObject.system.cost,
        quantity: 1,
        status: "operational",
        subtype: "vehicle",
        techLevel: droppedObject.system.techLevel,
        weight: droppedObject.type === "ship" ? (() => {
          return (useAutoCalcs && droppedObject.system.calcShipStats?.mass?.max)
            ? droppedObject.system.calcShipStats.mass.max
            : droppedObject.system.shipStats.mass.max;
        })() : droppedObject.system.weight,
        actorLink: uuid
      }
    };
    await this.actor.createEmbeddedDocuments("Item", [newComponent]);
  }
}
