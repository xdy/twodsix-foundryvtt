// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TwodsixShipSheet } from "./TwodsixShipSheet";

export class TwodsixBattleSheet extends TwodsixShipSheet {
  /** @override */
  async getData() {
    const context = super.getData();
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
