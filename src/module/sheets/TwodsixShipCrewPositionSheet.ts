export class TwodsixShipCrewPositionSheet extends ItemSheet {
  // @ts-ignore
  static get defaultOptions(): FormApplicationOptions {
    // @ts-ignore
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "item"],
      template: "systems/twodsix/templates/items/ship_crew_position-sheet.html",
      submitOnClose: true,
      submitOnChange: true,
      dragDrop: [{ dropSelector: null }]
    });
  }

  public activateListeners(html:JQuery):void {
    super.activateListeners(html);
    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }
    
    html.find('.crew_position-action-create').on('click', this._onCreateAction.bind(this));
    html.find('.crew_position-action-delete').on('click', this._onDeleteAction.bind(this));
    html.find('.crew_position-action-field').on('change', this._onUpdateActionName.bind(this));

    
  }

  private _onUpdateActionName(event:Event) {
    const actionIndex = $(event.currentTarget).parents(".crew_position-action").data("index");
    const actions = duplicate(this.item.data.data.actions);
    actions[actionIndex][$(event.currentTarget).data("field")] = $(event.currentTarget).val();
    this.item.update({"data.actions": actions})
  }

  private _onCreateAction(event:Event) {
    const actions = this.item.data.data.actions.concat([{ "name": "", "type": "skill", "value": "" }]);
    this.item.update({ "data.actions": actions })
  }

  private _onDeleteAction(event: Event) {

  }

  async submit(options) {
    $(".crew_position-action-field").trigger("change")
    return super.submit(options);
  }

  async _updateObject(event, formData): Promise<void> {
    // super._updateObject(event, formData);
    console.log(event, formData)
  }


}