// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";

export class TwodsixRobotSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType(): string {
    return this.actor.type;
  }

  /** @override */
  async _prepareContext(options):any {
    const context = await super._prepareContext(options);

    if (game.settings.get('twodsix', 'useProseMirror')) {
      context.richText = {
        description: await TextEditor.enrichHTML(context.system.description),
        notes: await TextEditor.enrichHTML(context.system.notes)
      };
    }

    // Add relevant data from system settings
    Object.assign(context.settings, {
      useHits: game.settings.get('twodsix', 'robotsUseHits')
    });

    return context;
  }

  /** @override */
  static get defaultOptions(): ActorSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "robot-actor"],
      template: "systems/twodsix/templates/actors/robot-sheet.html",
      width: 'auto',
      height: 600,
      resizable: true,
      dragDrop: [{dragSelector: ".item", dropSelector: null}]
    });
  }
}
