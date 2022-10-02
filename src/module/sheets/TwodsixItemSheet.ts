// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getItemDataFromDropData, openPDFReference, deletePDFReference } from "../utils/sheetUtils";
import { Component } from "src/types/template";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class TwodsixItemSheet extends AbstractTwodsixItemSheet {
  returnData: any; ///Not certain on this one or is it just 'data' ************

  /** @override */
  static get defaultOptions(): ItemSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "item"],
      submitOnClose: true,
      submitOnChange: true,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      dragDrop: [{dropSelector: null}]
    });
  }

  /** @override */
  get template(): string {
    const path = "systems/twodsix/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData(): ItemSheet {
    const returnData = super.getData();
    //returnData.actor = returnData.data;

    (<TwodsixItem>this.item).prepareConsumable();
    // Add relevant data from system settings
    returnData.settings = {
      ShowLawLevel: game.settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ShowWeaponType: game.settings.get('twodsix', 'ShowWeaponType'),
      ShowDamageType: game.settings.get('twodsix', 'ShowDamageType'),
      ShowRateOfFire: game.settings.get('twodsix', 'ShowRateOfFire'),
      ShowRecoil: game.settings.get('twodsix', 'ShowRecoil'),
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showComponentRating: game.settings.get('twodsix', 'showComponentRating'),
      showComponentDM: game.settings.get('twodsix', 'showComponentDM'),
      DIFFICULTIES: TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))]
    };
    returnData.config = TWODSIX;
    //returnData.isOwned = this.item.isOwned;
    //returnData.data.settings = returnData.settings;  //DELETE WHEN CONVERSION COMPLETE
    //returnData.data.config = returnData.config;  //DELETE WHEN CONVERSION COMPLETE
    //returnData.data.isOwned = returnData.isOwned;  //DELETE WHEN CONVERSION COMPLETE
    return returnData;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options: Partial<Application.Position> = {}): (Application.Position & { height: number }) | void {
    const position: Application.Position = <Application.Position>super.setPosition(options);
    const sheetBody = (this.element as JQuery).find(".sheet-body");
    const bodyHeight = <number>position.height - 192;
    sheetBody.css("height", bodyHeight);
    return <(Application.Position & { height: number }) | void>position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }

    html.find('.consumable-create').on('click', this._onCreateConsumable.bind(this));
    html.find('.consumable-edit').on('click', this._onEditConsumable.bind(this));
    html.find('.consumable-delete').on('click', this._onDeleteConsumable.bind(this));
    html.find('.consumable-use-consumable-for-attack').on('change', this._onChangeUseConsumableForAttack.bind(this));
    this.handleContentEditable(html);
    html.find('.open-link').on('click', openPDFReference.bind(this, [this.item.system.docReference]));
    html.find('.delete-link').on('click', deletePDFReference.bind(this));
    html.find(`[name="system.subtype"]`).on('change', this._changeSubtype.bind(this));
    html.find(`[name="system.isBaseHull"]`).on('change', this._changeIsBaseHull.bind(this));
  }
  private async _changeSubtype(event) {
    await this.item.update({"system.subtype": event.currentTarget.selectedOptions[0].value});
    /*Update from default other image*/
    if (this.item.img === "systems/twodsix/assets/icons/components/otherInternal.svg" || this.item.img === "systems/twodsix/assets/icons/components/other.svg") {
      await this.item.update({"img": "systems/twodsix/assets/icons/components/" + event.currentTarget.selectedOptions[0].value + ".svg"});
    }
    /*Prevent cargo from using %hull weight*/
    const anComponent = <Component> this.item.system;
    if (anComponent.weightIsPct && event.currentTarget.value === "cargo") {
      await this.item.update({"system.weightIsPct": false});
    }
    /*Unset isBaseHull if not hull component*/
    if (event.currentTarget.value !== "hull" && anComponent.isBaseHull) {
      await this.item.update({"system.isBaseHull": false});
    }
    /*Unset hardened if fuel, cargo, storage, vehicle*/
    if (["fuel", "cargo", "storage", "vehicle"].includes(event.currentTarget.value)) {
      await this.item.update({"system.hardened": false});
    }
  }

  /* -------------------------------------------- */
  /** @override */
  // cludge to fix consumables dissapearing when updating item sheet
  async _onChangeInput(event) {
    //console.log(event);
    await super._onChangeInput(event);
    //await (<TwodsixItem>this.item).prepareConsumable();
    this.item?.sheet?.render();
  }
  /* -------------------------------------------- */

  private async _changeIsBaseHull() {
    const anComponent = <Component> this.item.system;
    const newValue = !anComponent.isBaseHull;

    await this.item.update({"system.isBaseHull": newValue});
    /*Unset isWeightPct if changing to base hull*/
    if (newValue && anComponent.weightIsPct) {
      await this.item.update({"system.weightIsPct": false});
    }
  }

  private getConsumable(event) {
    const li = $(event.currentTarget).parents(".consumable");
    return this.item.actor?.items.get(li.data("consumableId"));
  }

  private _onEditConsumable(event): void {
    this.getConsumable(event)?.sheet?.render(true);
  }

  private async _onDeleteConsumable(event): Promise<void> {
    const consumable = this.getConsumable(event);
    if (!consumable) {
      (<TwodsixItem>this.item).removeConsumable(""); //TODO Should have await?
    } else {
      const body = game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumableFrom").replace("_CONSUMABLE_NAME_", `"<strong>${consumable.name}</strong>"`).replace("_ITEM_NAME_", <string>this.item.name);

      await Dialog.confirm({
        title: game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumable"),
        content: `<div class="remove-consumable">${body}<br><br></div>`,
        yes: async () => {
          if (consumable && consumable.id) {
            await (<TwodsixItem>this.item).removeConsumable(consumable.id); //TODO Should have await?
            this.render();
          }
        },
        no: () => {
          //Nothing
        },
      });
    }
  }

  private async _onCreateConsumable(): Promise<void> {
    if (!this.item.isOwned) {
      console.error(`Twodsix | Consumables can only be created for owned items`);
      return;
    }
    const template = 'systems/twodsix/templates/items/dialogs/create-consumable.html';
    const html = await renderTemplate(template, {
      consumables: TWODSIX.CONSUMABLES
    });
    new Dialog({
      title: `${game.i18n.localize("TWODSIX.Items.Items.New")} ${game.i18n.localize("TWODSIX.itemTypes.consumable")}`,
      content: html,
      buttons: {
        ok: {
          label: game.i18n.localize("TWODSIX.Create"),
          callback: async (buttonHtml: JQuery) => {
            const max = parseInt(buttonHtml.find('.consumable-max').val() as string, 10) || 0;
            let equippedState = "";
            if (this.item.type !== "skills" && this.item.type !== "trait" && this.item.type !== "ship_position") {
              equippedState = this.item.system.equipped ?? "backpack";
            }
            const newConsumableData = {
              name: buttonHtml.find('.consumable-name').val(),
              type: "consumable",
              system: {
                subtype: buttonHtml.find('.consumable-subtype').val(),
                quantity: parseInt(buttonHtml.find('.consumable-quantity').val() as string, 10) || 0,
                currentCount: max,
                max: max,
                equipped: equippedState
              }
            };
            const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData]) || {};
            await (<TwodsixItem>this.item).addConsumable(newConsumable[0].id);
            this.render();
          }
        },
        cancel: {
          label: game.i18n.localize("Cancel")
        }
      },
      default: 'ok',
    }).render(true);
  }

  private async _onChangeUseConsumableForAttack(event): Promise<void> {
    await this.item.update({"system.useConsumableForAttack": $(event.currentTarget).val()});
    this.render();
  }

  private static check(cond: boolean, err: string) {
    if (cond) {
      throw new Error(game.i18n.localize(`TWODSIX.Errors.${err}`));
    }
  }

  protected async _onDrop(event: DragEvent): Promise<boolean | any> {
    event.preventDefault();
    try {
      const dropData = getDataFromDropEvent(event);
      TwodsixItemSheet.check(!dropData, "DraggingSomething");
      if (dropData.type === 'html' || dropData.type === 'pdf'){
        if (dropData.href) {
          await this.item.update({
            "system.pdfReference.type": dropData.type,
            "system.pdfReference.href": dropData.href,
            "system.pdfReference.label": dropData.label
          });
        }
      } else {
        //This part handles just comsumables
        TwodsixItemSheet.check(!this.item.isOwned, "OnlyOwnedItems");
        TwodsixItemSheet.check(this.item.type === "skills", "SkillsConsumables");

        TwodsixItemSheet.check(dropData.type !== "Item", "OnlyDropItems");

        const itemData = await getItemDataFromDropData(dropData);

        TwodsixItemSheet.check(itemData.type !== "consumable", "OnlyDropConsumables");

        // If the dropped item has the same actor as the current item let's just use the same id.
        let itemId: string;
        if (this.item.actor?.items.get(itemData.id)) {
          itemId = itemData.id;
        } else {
          const newItem = await this.item.actor?.createEmbeddedDocuments("Item", [itemData]);
          if (!newItem) {
            throw new Error(`Somehow could not create item ${itemData}`);
          }
          itemId = newItem[0].id;
        }
        await (<TwodsixItem>this.item).addConsumable(itemId);
      }
      this.render();
    } catch (err) {
      console.error(`Twodsix | ${err}`);
      ui.notifications.error(err);
    }
  }
}
