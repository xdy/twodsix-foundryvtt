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

  static DEFAULT_OPTIONS =  {
    classes: ["twodsix", "sheet", "robot-actor"],
    dragDrop: [{dragSelector: ".item", dropSelector: null}],
    position: {
      width: 'auto',
      height: 600
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-robot"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      rollReaction: this._onRollReaction,
      rollMorale: this._onRollMorale
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/robot-sheet.html",
      //scrollable: ['']
    }
  };


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

}
