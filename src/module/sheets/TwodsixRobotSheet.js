import { enrichContextFields } from '../utils/sheetUtils';
import { AbstractTwodsixActorSheet } from './AbstractTwodsixActorSheet';

export class TwodsixRobotSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {

  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixRobotSheet",
    classes: ["twodsix", "sheet", "robot-actor"],
    dragDrop: [{dragSelector: ".item-name", dropSelector: null}],
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
      template: "systems/twodsix/templates/actors/robot-sheet.hbs",
      //scrollable: ['']
    }
  };


  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    await enrichContextFields(this.document, context, ['description', 'notes']);

    // Add relevant data from system settings
    Object.assign(context.settings, {
      useHits: game.settings.get('twodsix', 'robotsUseHits')
    });

    return context;
  }

}
