export abstract class AbstractTwodsixItemSheet extends ItemSheet {

  protected handleContentEditable(html:JQuery):void {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
  }


  public activateListeners(html:JQuery):void {
    super.activateListeners(html);
  }

  getData():any {
    // @ts-ignore
    const data = super.getData().data;
    data.data.owner = this.actor;

    return data;
  }
}
