/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */

import { confirmRollFormula, enrichContextFields } from '../utils/sheetUtils';
import { AbstractTwodsixActorSheet } from './AbstractTwodsixActorSheet';

export class TwodsixSpaceObjectSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixSpaceObjectSheet",
    classes: ["twodsix", "space-object", "actor"],
    dragDrop: [{dragSelector: ".item", dropSelector: null}],
    position: {
      width: 'auto',
      height: 'auto'
    },
    window: {
      resizable: false,
      icon: "fa-solid fa-satellite"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      rollSODamage: this._onRollSODamage,
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/space-object-sheet.hbs",
      //scrollable: ['']
    }
  };

  /**
   * @returns {Promise<void>}
   */
  static async _onRollSODamage() {
    let rollFormula = await confirmRollFormula(this.actor.system.damage, game.i18n.localize("TWODSIX.Damage.DamageFormula"));
    rollFormula = rollFormula.replace(/dd/ig, "d6*10"); // Parse for a destructive damage roll DD = d6*10
    await this.actor.rollDamage(rollFormula);
  }

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    await enrichContextFields(this.document, context, ['description', 'notes']);
    return context;
  }
}
