export abstract class AbstractTwodsixItemSheet extends ItemSheet {

  protected handleContentEditable(html:JQuery<HTMLElement>):void {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
  }


  protected activateListeners(html:JQuery):void {
    super.activateListeners(html);
  }

  getData():ItemSheetData<any> {
    const data = super.getData();
    data.data.owner = this.actor;

    return data;
  }
}
