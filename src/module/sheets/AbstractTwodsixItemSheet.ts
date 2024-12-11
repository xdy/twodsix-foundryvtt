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

  public _onRender(context:any, options: any):void {
    super._onRender(context, options);
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
