// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TwodsixShipSheet } from "./TwodsixShipSheet";

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
    return context;
  }

  static get defaultOptions():ActorSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix", "battle", "actor"],
      template: "systems/twodsix/templates/actors/battle-sheet.html",
      width: 850,
      height: 700,
      resizable: true,
      scrollY: ["battle-content-container"],
      dragDrop: [
        {dragSelector: ".item", dropSelector: null}
      ]
    });
  }
}
