import { TWODSIX } from "../config";
import { getDataFromDropEvent } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { ShipAction, ShipPosition } from "../../types/template";
import { TwodsixShipPositionSheetData } from "src/types/twodsix";

export class TwodsixShipPositionSheet extends AbstractTwodsixItemSheet {

  getData(): TwodsixShipPositionSheetData {
    const context = <TwodsixShipPositionSheetData>super.getData();
    context.components = this.item.actor?.items.filter(component => component.type === "component") ?? [];
    context.availableActions = TwodsixShipActions.availableMethods;
    context.sortedActions = Object.entries((<ShipPosition>this.item.data.data).actions).map(([id, ret]) => {
      ret.id = id;
      ret.placeholder = TwodsixShipActions.availableMethods[ret.type].placeholder;
      return ret;
    });
    context.sortedActions.sort((a: ShipAction, b: ShipAction) => (a.order > b.order) ? 1 : -1);
    return context;
  }

  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "item"],
      template: "systems/twodsix/templates/items/ship_position-sheet.html",
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
  }


  async _onDrop(event: DragEvent): Promise<boolean | any> {
    const data = getDataFromDropEvent(event);
    if (data.type === "Item" && (data.data?.type === "skills" || game.items?.get(data.id)?.type === "skills")) {
      const skillData = data.data ?? game.items?.get(data.id)?.data;
      const actions = (this.item.data.data as ShipPosition).actions;
      const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
      actions[randomID()] = {
        "order": Object.keys(actions).length,
        "name": "New action",
        "icon": skillData.img,
        "type": TWODSIX.SHIP_ACTION_TYPE.skillRoll,
        "command": `${skillData.name}/${skillData.data.characteristic} ${difficulties[skillData.data.difficulty].target}+`
      };
      this.item.update({ "data.actions": actions });
    } else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Ship.InvalidDocumentForCrewPosition"));
    }
  }

  private _onDeleteAction(event: Event) {
    if (event.currentTarget !== null) {
      const deleteId = $(event.currentTarget).data("id");
      this.item.update({ [`data.actions.-=${deleteId}`]: null });
    }
  }

  private _onCreateAction() {
    const actions = (this.item.data.data as ShipPosition).actions;
    actions[randomID()] = {
      "order": Object.keys(actions).length,
      "name": game.i18n.localize("TWODSIX.Ship.NewAction"),
      "icon": "icons/svg/dice-target.svg",
      "command": "",
      "type": TWODSIX.SHIP_ACTION_TYPE.chatMessage
    } as ShipAction;
    this.item.update({ "data.actions": actions });
  }
}
