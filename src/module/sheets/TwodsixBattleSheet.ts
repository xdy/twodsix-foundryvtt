// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TwodsixShipSheet } from "./TwodsixShipSheet";
//import { TWODSIX } from "../config";

export class TwodsixBattleSheet extends TwodsixShipSheet {
  /** @override */
  async getData() {
    const context = await super.getData();

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

  static get defaultOptions():ActorSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix", "battle", "actor"],
      template: "systems/twodsix/templates/actors/battle-sheet.html",
      width: 850,
      height: 730,
      resizable: true,
      scrollY: ["battle-content-container"],
      dragDrop: [
        {dragSelector: ".item", dropSelector: null}
      ]
    });
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find(".position-name").on("click", this._onPositionClick.bind(this));
  }

  _onPositionClick(event) {
    if (event.currentTarget !== null) {
      const li = $(event.currentTarget).parents(".item");
      const selectedPositionId = li.data("itemId");
      let selectedActorId = "";
      let selectedActionId = "";
      if (selectedPositionId) {
        if ($(event.currentTarget).parent().find("[name='selectedActor']").length > 0) {
          selectedActorId = $(event.currentTarget).parent().find("[name='selectedActor']")[0]?.value;
        }
        if ($(event.currentTarget).parent().find("[name='selectedAction']").length > 0) {
          selectedActionId = $(event.currentTarget).parent().find("[name='selectedAction']")[0]?.value;
        }
      }
      this.performShipAction(selectedPositionId, selectedActorId, selectedActionId);
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
