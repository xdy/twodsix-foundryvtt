import { isDisplayableSkill } from "../utils/sheetUtils";

export abstract class AbstractTwodsixItemSheet extends ItemSheet {

  protected handleContentEditable(html:JQuery):void {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
    html.find('div[contenteditable="true"][data-edit]').on(
      'paste',
      onPasteStripFormatting.bind(this)
    );
  }


  public activateListeners(html:JQuery):void {
    super.activateListeners(html);
  }

  getData():any {
    // @ts-ignore
    const data = super.getData().item;
    data.owner = this.actor;
    if (data.owner){
      //build Skills Pick List
      const skillsList: Item[] = [];
      for (const skill of data.owner.itemTypes.skills) {
        if (isDisplayableSkill(<Item>skill) || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
          skillsList.push(<Item>skill);
        }
      }
      data.skillsList = skillsList.sort((a:any,b:any) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
    }
    return data;
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
