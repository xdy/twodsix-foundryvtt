// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { ShipPosition, ShipPositionActorIds, Ship } from "../../types/template";
import { getDataFromDropEvent, getDocFromDropData } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import TwodsixActor from "../entities/TwodsixActor";
import { TwodsixShipPositionSheet } from "./TwodsixShipPositionSheet";
import TwodsixItem from "../entities/TwodsixItem";

export class TwodsixShipSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  static DEFAULT_OPTIONS =  {
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
      itemLink: this._onDocumentLink
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

  /** @override */
  async _prepareContext(options):any {
    const context = await super._prepareContext(options);
    context.dtypes = ["String", "Number", "Boolean"];
    if ((<Ship>this.actor.system).shipPositionActorIds) {
      context.shipPositions = (<TwodsixActor>this.actor).itemTypes.ship_position.map((shipPosition: TwodsixItem) => {
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

    Object.assign(context.settings, {
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn'),
      showBandwidth: game.settings.get('twodsix', 'showBandwidth'),
      showWeightUsage: game.settings.get('twodsix', 'showWeightUsage'),
      useShipAutoCalc: game.settings.get('twodsix', 'useShipAutoCalcs'),
      showComponentSummaryIcons: game.settings.get('twodsix', 'showComponentSummaryIcons'),
      allowDragDropOfListsShip: game.settings.get('twodsix', 'allowDragDropOfListsShip'),
      maxComponentHits: game.settings.get('twodsix', 'maxComponentHits'),
      jDriveLabel: game.settings.get('twodsix', 'jDriveLabel') || "TWODSIX.Ship.JDrive",
      showComponentRating: game.settings.get('twodsix', 'showComponentRating'),
      showComponentDM: game.settings.get('twodsix', 'showComponentDM'),
      showCost: game.settings.get('twodsix', 'showCost'),
      showCombatPosition: game.settings.get('twodsix', 'showCombatPosition'),
      singleComponentClass: (`components-stored-single` +
                                (game.settings.get('twodsix', 'showComponentRating') ? ` rating` : ` no-rating`) +
                                (game.settings.get('twodsix', 'showComponentDM') ? ` dm`:` no-dm`) +
                                (game.settings.get('twodsix', 'showCost') ? ` cost`:` no-cost`)),
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

  async _onRender(context:Context, options:any): void {
    await super._onRender(context, options);

    //Set special class for FVTT window-content section so that it overlaps with header
    if (this.options.sheetType === 'TwodsixShipSheet') {
      this.element.querySelector(".window-content").classList.add("overlap-header");
      this.element.querySelector(".window-header").classList.add("transparent-header-ship");
    }
  }

  static _onExecuteAction(ev: Event, target:HTMLElement): Promise<boolean | any> {
    if (target !== null) {
      let actorId:string;
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

  static performShipAction(ev: Event, positionId: string, actorId: string, actionId: string, shipActor:TwodsixActor): boolean {
    if (!actorId) {
      ui.notifications.warn("TWODSIX.Ship.ActorMustBeSelectedForAction", {localize: true});
      return false;
    }
    const shipPosition = shipActor.items.get(positionId);
    const action = (<ShipPosition>shipPosition?.system)?.actions[actionId];
    if (action) {
      const component = shipActor.items.find(item => item.id === action.component);
      const extra = {
        actor: game.actors?.get(actorId),
        ship: shipActor,
        component: <TwodsixItem>component,
        event: ev,
        actionName: action.name,
        positionName: shipPosition?.name ?? "",
        diceModifier: ""
      };

      TwodsixShipActions.availableMethods[action.type].action(action.command, extra);
      return true;
    }
  }

  static _onShipPositionCreate():void {
    const shipPositions = this.actor.itemTypes.ship_position;
    this.actor.createEmbeddedDocuments("Item", [{"type": "ship_position", name: "New Position", order: shipPositions.length}]);
  }

  static async _onShipPositionEdit(ev:Event, target: HTMLElement):Promise<void> {
    if (target !== null) {
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
      const shipPositionId = target.closest(".ship-position").dataset.id;
      const positionItem = this.actor?.items?.get(shipPositionId);
      await positionItem?.sheet.render({force: true});
    }
  }

  static async _onShipPositionDelete(ev:Event, target:HTMLElement): Promise<void> {
    if (target !== null && await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("TWODSIX.Ship.DeletePosition")},
      content: game.i18n.localize("TWODSIX.Ship.ConfirmDeletePosition")
    })) {
      const shipPositionId = target.closest(".ship-position").dataset.id;

      (<ShipPosition>(<TwodsixItem>this.actor.items.get(shipPositionId)).system).actors?.forEach(async (actor:TwodsixActor) => {
        if (actor.id && actor.id in (<Ship>this.actor.system).shipPositionActorIds) {
          if (actor.id) {
            await this.actor.update({ [`system.shipPositionActorIds.-=${actor.id}`]: null });
          }
        }
      });
      await this.actor.deleteEmbeddedDocuments("Item", [shipPositionId]);
    }
  }

  static async _onShipPositionCopy(ev:Event, target:HTMLElement): Promise<void> {
    if (target !== null) {
      const shipPositionId:string = target.closest(".ship-position").dataset.id;
      const positionItem:TwodsixItem = this.actor?.items?.get(shipPositionId);
      const posData = foundry.utils.duplicate(positionItem);
      await TwodsixItem.create(posData, {});
    }
  }

  static _onShipActorClick(ev:Event, target:HTMLElement) {
    if (target) {
      const hasClass = target.classList.contains("force-border");
      target.closest(".ship-position-box").querySelectorAll(".ship-position-actor-token")?.forEach((token: HTMLElement) => {
        if (target !== token) {
          token.classList.remove("force-border");
        } else if (!hasClass) {
          target.classList.add("force-border");
        }
      });
    }
  }

  static _onToggleComponent(ev:Event, target: HTMLElement):void {
    if (target) {
      const li = target.closest(".item");
      const itemSelected = this.actor.items.get(li.dataset.itemId);
      if (!itemSelected) {
        return;
      }
      const type = target.dataset.type;
      if (type === "status") {
        const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
        const newState = ev.shiftKey ? (itemSelected.system.status === "off" ? "operational" : "off") : stateTransitions[itemSelected.system.status];
        itemSelected.update({"system.status": newState});
      } else if (type === "popup") {
        itemSelected.update({"system.isExtended": !itemSelected.system.isExtended});
      }
    }
  }

  static _onAdjustFuelType() {
    this.actor.update({"system.shipStats.fuel.isRefined": !(<Ship>this.actor.system).shipStats.fuel.isRefined});
  }

  static async _onDeckplanClick() {
    if ((<Ship>this.actor.system)?.deckPlan) {
      const deckPlan = game.scenes?.get((<Ship>this.actor.system).deckPlan);
      await deckPlan?.view();
    }
  }

  static _onDeckplanUnlink() {
    if ((<Ship>this.actor.system)?.deckPlan) {
      this.actor.update({"system.deckPlan": ""});;
    }
  }

  _onDragStart(ev: DragEvent):void {
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

  async _onDrop(ev:DragEvent):Promise<boolean | any> {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer === null || ev.target === null) {
      return false;
    }

    try {
      const dropData:any = getDataFromDropEvent(ev);
      if (dropData.type === 'html' || dropData.type === 'pdf') {
        await super._onDrop(ev);
        return true;
      } else if (dropData.type === 'damageItem') {
        //ui.notifications.warn("TWODSIX.Warnings.CantAutoDamage", {localize: true});
        return (<TwodsixActor>this.actor).handleDamageData(dropData.payload, false);
      }
      const droppedObject:any = await getDocFromDropData(dropData);

      if (["traveller", "robot"].includes(droppedObject.type)) {
        const actorId = droppedObject._id;
        const currentShipPositionId = (<Ship>this.actor.system).shipPositionActorIds[actorId];
        if (ev.target !== null && ev.target?.closest(".ship-position")) {
          const shipPositionId = ev.target.closest(".ship-position").dataset.id;
          await this.actor.update({[`system.shipPositionActorIds.${actorId}`]: shipPositionId});
          this.actor.items.get(shipPositionId)?.sheet?.render();
        } else {
          await this.actor.update({[`system.shipPositionActorIds.-=${actorId}`]: null});
        }
        this.actor.items.get(currentShipPositionId)?.sheet?.render();
        return true;
      } else if ((droppedObject.type === "skills") && ev.target !== null && ev.target?.closest(".ship-position")) {
        //check for double drop trigger, not clear why this occurs
        if (ev.currentTarget.className === "ship-position-box") {
          const shipPositionId = ev.target.closest(".ship-position").dataset.id;
          const shipPosition = <TwodsixItem>this.actor.items.get(shipPositionId);
          await TwodsixShipPositionSheet.createActionFromSkill(shipPosition, droppedObject);
          return true;
        } else {
          return false;
        }
      } else if (["vehicle", "ship"].includes(droppedObject.type)) {
        await this._addVehicleCraftToComponents(droppedObject, dropData.uuid);
        return true;
      } else if (droppedObject.type === "animal") {
        ui.notifications.warn("TWODSIX.Warnings.AnimalsCantHoldPositions", {localize: true});
        return false;
      } else if (["equipment", "weapon", "armor", "augment", "storage", "tool", "consumable", "computer", "junk"].includes(droppedObject.type)) {
        await this.processDroppedItem(ev, droppedObject);
        return true;
      } else if (ev.currentTarget.className === 'ship-position-box ship-position-add-box' && droppedObject.type === 'ship_position') {
        return false; //avoid double add
      } else {
        await super._onDrop(ev);
        return true;
      }
    } catch (err) {
      console.warn(err); // uncomment when debugging
      return false;
    }
  }
  async _addVehicleCraftToComponents(droppedObject: any, uuid: string): Promise <void> {
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
  static async _onDocumentLink(ev:Event, target: HTMLElement): Promise<void> {
    const documentUuid = target.dataset.uuid;
    const selectedDocument = await fromUuid(documentUuid);
    selectedDocument?.sheet?.render({force: true});
  }
}
