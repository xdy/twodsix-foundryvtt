import {AbstractTwodsixItemSheet} from "./AbstractTwodsixItemSheet";

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
