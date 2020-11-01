import {AbstractTwodsixItemSheet} from "./AbstractTwodsixItemSheet";
import {TWODSIX} from "../config";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class TwodsixItemSheet extends AbstractTwodsixItemSheet {

  /** @override */
  static get defaultOptions():FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "item"],
      width: 520,
      height: 377,
      submitOnClose: true,
      submitOnChange: true,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}]
    });
  }

  /** @override */
  get template():string {
    const path = "systems/twodsix/templates/items";
    return `${path}/${this.item.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData():ItemSheetData {
    const data = super.getData();

    // Add relevant data from system settings
    data.data.settings = {
      ShowLawLevel: game.settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ShowWeaponType: game.settings.get('twodsix', 'ShowWeaponType'),
      ShowDamageType: game.settings.get('twodsix', 'ShowDamageType'),
      ShowRateOfFire: game.settings.get('twodsix', 'ShowRateOfFire'),
      ShowRecoil: game.settings.get('twodsix', 'ShowRecoil'),
      DIFFICULTIES: TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')]
    };
    data.data.config = TWODSIX;

    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options:ApplicationPosition = {}):any {
    const position = super.setPosition(options);
    const sheetBody = (this.element as JQuery).find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html:JQuery<HTMLElement>):void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }

    this.handleContentEditable(html);
  }
}
