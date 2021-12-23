import { TWODSIX } from "../config";
import { getDataFromDropEvent } from "../utils/sheetUtils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";

export class TwodsixShipCrewPositionSheet extends AbstractTwodsixItemSheet {

  // @ts-ignore
  getData(): ItemSheetData {
    // @ts-ignore
    const data = super.getData();
    data.data.components = this.item?.parent?.items.filter(component => component.type === "component") ?? [];
    data.data.availableActions = TwodsixShipActions.availableMethods;
    data.data.sortedActions = Object.entries(data.data.actions).map((act) => {
      let ret = act[1]
      ret["id"] = act[0]
      ret["placeholder"] = TwodsixShipActions.availableMethods[ret["type"]]["placeholder"];
      return ret;
    });
    data.data.sortedActions.sort((a, b) => (a.order > b.order) ? 1 : -1);
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
  }


  async _onDrop(event: DragEvent): Promise<boolean | any> {
    const data = getDataFromDropEvent(event);
    if (data.type === "Item" && (data.data?.type === "skills" || game.items.get(data.id).type === "skills")) { 
        const skillData = data.data ?? game.items.get(data.id).data
        const actions = this.item.data.data.actions;
        const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
        actions[randomID()] = {
          "order": Object.keys(actions).length,
          "name": "New action",
          "icon": skillData.img,
          "type": "skillRoll",
          "command": `${skillData.name}/${skillData.data.characteristic} ${difficulties[skillData.data.difficulty].target}+`
        };
        this.item.update({ "data.actions": actions })
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.InvalidDocumentForCrewPosition"));
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
      "command": "",
      "type": "chatMessage"
    };
    this.item.update({ "data.actions": actions })
  }
}