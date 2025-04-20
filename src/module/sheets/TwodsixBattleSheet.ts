// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TwodsixShipSheet } from "./TwodsixShipSheet";
//import { TWODSIX } from "../config";

export class TwodsixBattleSheet extends foundry.applications.api.HandlebarsApplicationMixin(TwodsixShipSheet) {
  static DEFAULT_OPTIONS =  {
    sheetType: "TwodsixBattleSheet",
    classes: ["twodsix", "battle", "actor"],
    position: {
      width: 850,
      height: 730
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-rocket"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      positionClick: this._onPositionClick
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/battle-sheet.hbs",
      scrollable: ["battle-content-container"]
    }
  };

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.dragDrop = [{dragSelector: ".item", dropSelector: null}];
    return applicationOptions;
  }

  /** @override */
  async _prepareContext(options):any {
    const context = await super._prepareContext(options);

    // Reset autocalc values to _source values
    if (game.settings.get("twodsix", "useShipAutoCalcs"))  {
      context.actor.system.shipStats.bandwidth.value = this.actor.system._source.shipStats.bandwidth.value;
      context.actor.system.shipStats.bandwidth.max = this.actor.system._source.shipStats.bandwidth.max;
      context.actor.system.shipStats.power.value = this.actor.system._source.shipStats.power.value;
      context.actor.system.shipStats.power.max = this.actor.system._source.shipStats.power.max;
    }

    //Build Position Data context
    const positionData = [];
    const allPositions = this.actor.itemTypes.ship_position.sort(comparePositions);
    for (const position of allPositions) {
      const actions = {};
      let defaultAction = "";
      for (const action in position.system.actions) {
        //const actionIcon = getActionIcon(position.system.actions[action].type);
        Object.assign(actions, {[action]: position.system.actions[action].name});
        //Object.assign(actions, {[action]: [`${position.system.actions[action].name} `, actionIcon]});
        if (!defaultAction) {
          defaultAction = action;
        }
      }
      const actors = {};
      let defaultActor = "";
      for (const actor of position.system.actors) {
        Object.assign(actors, {[actor.id]: actor.name});
        if (!defaultActor) {
          defaultActor = actor.id;
        }
      }
      positionData.push({id: position.id, name: position.name, actions: actions, actors: actors, defaultActor: defaultActor, defaultAction: defaultAction});
    }
    Object.assign(context, {positionData: positionData});

    //Build filtered components data
    const componentsToIgnore = game.settings.get('twodsix', 'componentsIgnored');
    context.container.nonCargoForDamage = context.container.nonCargo?.filter( (comp) => !(componentsToIgnore.includes(comp.system.subtype)));

    return context;
  }

  static _onPositionClick(ev: Event, target:HTMLElement) {
    if (target !== null) {
      const li = target.closest(".item");
      const selectedPositionId = li?.dataset.itemId;
      let selectedActorId = "";
      let selectedActionId = "";
      if (selectedPositionId) {
        if (li?.querySelector("[name='selectedActor']").length > 0) {
          selectedActorId = li.querySelector("[name='selectedActor']")?.value;
        }
        if (li?.querySelector("[name='selectedAction']").length > 0) {
          selectedActionId = li.querySelector("[name='selectedAction']")?.value;
        }
      }
      TwodsixShipSheet.performShipAction(ev, selectedPositionId, selectedActorId, selectedActionId, this.actor);
    }
  }
}

function comparePositions(a,b) {
  return a.system.order - b.system.order;
}

/*function getActionIcon(actionType) {
  switch (actionType) {
    case TWODSIX.SHIP_ACTION_TYPE.skillRoll:
      return `<i class="fa-solid fa-dice-d6"></i>`;
    case TWODSIX.SHIP_ACTION_TYPE.chatMessage:
      return `<i class="fa-solid fa-comment"></i>`;
    case TWODSIX.SHIP_ACTION_TYPE.fireEnergyWeapons:
      return `<i class="fa-solid fa-crosshairs"></i>`;
    case TWODSIX.SHIP_ACTION_TYPE.executeMacro:
      return `<i class="fa-solid fa-code"></i>`;
    default:
      return "";
  }
}*/
