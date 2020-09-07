/**
   * Extend the basic ActorSheet with some very simple modifications
   * @extends {ActorSheet}
   */
export class TwodsixNPCSheet extends ActorSheet {
  
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/npc-sheet.html",
      width: 500,
      height: 700,
      resizable: false,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }
}