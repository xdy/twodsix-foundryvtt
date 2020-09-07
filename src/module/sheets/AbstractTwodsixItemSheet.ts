export class AbstractTwodsixItemSheet extends ItemSheet {

  protected handleContentEditable(html:JQuery<HTMLElement>) {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
  }
}
