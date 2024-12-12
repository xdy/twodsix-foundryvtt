// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { isDisplayableSkill } from "../utils/sheetUtils";
import { sortByItemName } from "../utils/utils";

/**
 * Extend the basic ItemSheetV2 with some very simple modifications
 * @extends {ItemSheetV2}
 */
export abstract class AbstractTwodsixItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2) {
  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  public _onRender(context:any, options: any):void {
    super._onRender(context, options);
    this.#dragDrop.forEach((d) => d.bind(this.element));
  }

  async _prepareContext(options):any {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system; //convenience access to item.system data
    context.owner = this.actor;
    if (this.actor){
      //build Skills Pick List
      const skillsList: TwodsixItem[] = [];
      for (const skill of context.owner.itemTypes.skills) {
        if (isDisplayableSkill(<TwodsixItem>skill) || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
          skillsList.push(<TwodsixItem>skill);
        }
      }
      context.skillsList = sortByItemName(skillsList);
    }
    return context;
  }

  /*******************
   *
   * Drag Drop Handling
   *
   * Code mainly from https://github.com/MetaMorphic-Digital/draw-steel/blob/main/src/module/apps/item-sheet.mjs
   * and Foundry Wiki
   *******************/

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers(): DragDrop[] {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new DragDrop(d);
    });
  }

  /** The following pieces set up drag handling and are unlikely to need modification  */

  /**
   * Returns an array of DragDrop instances
   * @type {DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /** @override */
  _canDragDrop(/*selector*/) {
    //console.log("got to drop check", selector);
    return this.isEditable;
  }

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(/*selector*/) {
    //console.log("got to start", selector);
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(/*event: Event*/) {}

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(/*event: Event*/) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(/*event*/) {}

}

export function onPasteStripFormatting(event): void {
  if (event.originalEvent && event.originalEvent.clipboardData && event.originalEvent.clipboardData.getData) {
    event.preventDefault();
    const text = event.originalEvent.clipboardData.getData('text/plain');
    window.document.execCommand('insertText', false, text);
  } else if (event.clipboardData && event.clipboardData.getData) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    window.document.execCommand('insertText', false, text);
  }
}
