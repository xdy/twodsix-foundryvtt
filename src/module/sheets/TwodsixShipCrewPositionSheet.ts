import { getDataFromDropEvent } from "../utils/sheetUtils";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";

export class TwodsixShipCrewPositionSheet extends AbstractTwodsixItemSheet {

  // @ts-ignore
  getData(): ItemSheetData {
    // @ts-ignore
    const data = super.getData();
    data.data.actions = data.data.actionIds.map(actionId => game.macros.get(actionId));
    data.data.actors = data.data.actorIds.map(actorId => game.actors.get(actorId));
    data.data.components = data.data.componentIds.map(componentId => game.items.get(componentId));
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

    html.find('.crew_position-action-delete, .crew_position-actor-delete, .crew_position-component-delete').on('click', this._onDelete.bind(this));
    html.find('.execute-action').on('click', this._executeAction.bind(this));
    
  }

  private addDocument(documentType, newId) {
    const oldDocumentIds = this.item.data.data[`${documentType}Ids`];
    if (oldDocumentIds.indexOf(newId) !== -1) {
      ui.notifications.error(game.i18n.localize(`TWODSIX.Handlebars.AlreadyExistsCrewPositions`));
      return null
    }
    
    this.item.update({ [`data.${documentType}Ids`]: oldDocumentIds.concat(newId) })
  }

  async _executeAction(event: DragEvent): Promise<boolean | any> {
    const actorId = $(`#item-${this.item.id}`).find(".actor-radio:checked").data("id")
    game.macros.get($(event.currentTarget).data("id")).execute({
      actor: game.actors.get(actorId),
      token: {"components": this.item.data.data.componentIds} // This is a bit hacky... :(
    });
  }

  async _onDrop(event: DragEvent): Promise<boolean | any> {
    const data = getDataFromDropEvent(event);

    switch (data.type) {
      case "Macro":
        this.addDocument("action", data.id)
        break;
      case "Item":
        if (game.items.get(data.id).type === "component") {
          this.addDocument("component", data.id);  
        } else {
          ui.notifications.error(game.i18n.localize(`TWODSIX.Handlebars.InvalidItemForCrewPosition`));
        }
        break;
      case "Actor":
        // @ts-ignore
        if (game.actors.get(data.id).type === "traveller") {
          this.addDocument("actor", data.id);
        } else {
          ui.notifications.error(game.i18n.localize(`TWODSIX.Handlebars.InvalidActorForCrewPosition`));
        }
        break;
      default:
        ui.notifications.error(game.i18n.localize("TWODSIX.Handlebars.InvalidDocumentForCrewPosition"));
    }
  }

  private _onDelete(event: Event) {
    const deleteId = $(event.currentTarget).data("id");
    const documentType = $(event.currentTarget).data("type");
    const documents = this.item.data.data[`${documentType}Ids`].filter((id:string) => id !== deleteId);
    this.item.update({ [`data.${documentType}Ids`]:  documents});
  }
}