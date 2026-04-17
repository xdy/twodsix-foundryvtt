import { enrichContextFields } from '../utils/sheetUtils';
import { AbstractTwodsixActorSheet } from './AbstractTwodsixActorSheet';

export class TwodsixAnimalSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {

  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixAnimalSheet",
    classes: ["twodsix", "sheet", "animal-actor"],
    dragDrop: [{dragSelector: ".item-name", dropSelector: null}],
    position: {
      width: 720,
      height: 470
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-hippo"
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
      template: "systems/twodsix/templates/actors/animal-sheet.hbs",
      //scrollable: ['']
    }
  };

  /**
   * @returns {Promise<void>}
   */
  static async _onRollReaction() {
    await this.actor.rollReaction();
  }

  /**
   * @returns {Promise<void>}
   */
  static async _onRollMorale() {
    await this.actor.rollMorale();
  }

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
      useHits: game.settings.get('twodsix', 'animalsUseHits'),
      animalsUseLocations: game.settings.get('twodsix', 'animalsUseLocations'),
      displayReactionMorale: game.settings.get('twodsix', 'displayReactionMorale'),
      useAllAnimalTypes: game.settings.get('twodsix', 'animalTypesIndependentofNiche')
    });

    return context;
  }
}
