import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";

export class TwodsixShipSheet extends ActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType():string {
    return this.actor.data.type;
  }

  /** @override */
  getData():any {
    const data:any = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'ship') {
      data.storage = data.actor.items;
      AbstractTwodsixActorSheet._prepareItemContainers(data);
    }

    return data;
  }


  /** @override */
  static get defaultOptions():FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "ship", "actor"],
      template: "systems/twodsix/templates/actors/ship-sheet.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "crew"}],
      scrollY: [".ship-crew", ".ship-storage", ".storage-wrapper", ".ship-notes"]
    });
  }
}
