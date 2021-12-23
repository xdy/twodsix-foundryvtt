import { getDataFromDropEvent } from "../utils/sheetUtils";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";

export class TwodsixShipCrewPositionSheet extends AbstractTwodsixItemSheet {

  // @ts-ignore
  getData(): ItemSheetData {
    // @ts-ignore
    const data = super.getData();
    data.data.components = this.item?.parent?.items.filter(component => component.type === "component") ?? [];
    data.data.components.map(component => {
      component.checked = data.data.componentIds.includes(component.id);
    })
    data.data.sorted_actions = Object.entries(data.data.actions).map((act) => {
      let ret = act[1]
      ret["id"] = act[0]
      return ret;
    })
    data.data.sorted_actions.sort((a, b) => (a.order > b.order) ? 1 : -1)
    return data;
  }

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

  public activateListeners(html: JQuery): void {
    super.activateListeners(html);
    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }

    html.find('.crew_position-action-delete').on('click', this._onDeleteAction.bind(this));
    html.find('.crew_position-action-create').on('click', this._onCreateAction.bind(this));
    html.find('.component-checkbox').on('change', this._selectComponent.bind(this));
    
  }

  async _selectComponent(event: DragEvent): Promise<boolean | any> {
    const checked = $(event.currentTarget).val() === "on";
    const componentId = $(event.currentTarget).data("id");
    const componentIds = this.item.data.data.componentIds;

    if (checked) {
      if (componentIds.indexOf(componentId) === -1) {
        this.item.update({ "data.componentIds":  componentIds.concat(componentId) })
      }
    } else {
      this.item.update({ "data.componentIds": componentIds.filter(component => component.id !== componentId) })
    }

  }

  async _onDrop(event: DragEvent): Promise<boolean | any> {
    const data = getDataFromDropEvent(event);
    if (data.type === "Macro") {
        const macro = game.macros.get(data.id);
        const actions = this.item.data.data.actions;
        actions[randomID()] = {
          "order": Object.keys(actions).length,
          "name": macro.name,
          "icon": macro.data.img,
          "command": macro.data.command
        };
        this.item.update({ "data.actions": actions })
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.ShipV2.InvalidDocumentForCrewPosition"));
    }
  }

  private _onDeleteAction(event: Event) {
    const deleteId = $(event.currentTarget).data("id");
    this.item.update({ [`data.actions.-=${deleteId}`]:  null});
  }

  private _onCreateAction(event: Event) {
    const actions = this.item.data.data.actions;
    actions[randomID()] = {
      "order": Object.keys(actions).length,
      "name": "New Action",
      "icon": "icons/svg/dice-target.svg",
      "command": ""
    };
    this.item.update({ "data.actions": actions })
  }
}