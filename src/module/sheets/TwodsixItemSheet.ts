import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getItemDataFromDropData } from "../utils/sheetUtils";
import { Gear } from "../../types/template";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class TwodsixItemSheet extends AbstractTwodsixItemSheet {

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
    return `${path}/${this.item.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData(): ItemSheet {
    const data = super.getData();

    (<TwodsixItem>this.item).prepareConsumable();
    // Add relevant data from system settings
    data.data.settings = {
      ShowLawLevel: game.settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ShowWeaponType: game.settings.get('twodsix', 'ShowWeaponType'),
      ShowDamageType: game.settings.get('twodsix', 'ShowDamageType'),
      ShowRateOfFire: game.settings.get('twodsix', 'ShowRateOfFire'),
      ShowRecoil: game.settings.get('twodsix', 'ShowRecoil'),
      DIFFICULTIES: TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))]
    };
    data.data.config = TWODSIX;
    data.data.isOwned = this.item.isOwned;
    return data;
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

    html.find(".edit-active-effect").on("click", this._onEditEffect.bind(this));
    html.find(".create-active-effect").on("click", this._onCreateEffect.bind(this));
    html.find(".delete-active-effect").on("click", this._onDeleteEffect.bind(this));

    this.handleContentEditable(html);
  }

  private async _onCreateEffect(): Promise<void> {
    const effects = [new ActiveEffect({
      origin: this.item.uuid,
      icon: this.item.img,
      tint: "#ffffff",
      disabled: (<Gear>this.item.data.data).equipped !== undefined && (<Gear>this.item.data.data).equipped !== "equipped"
    }).toObject()];
    await this.item.update({effects: effects }, {recursive: true});
    const newEffect = this.item.effects.contents[0].toObject();
    newEffect.flags = {twodsix: {sourceId: newEffect._id}};
    await this.item.update({effects: [newEffect] }, {recursive: true});

    if (this.actor) {
      newEffect.transfer = false;
      const oldId = newEffect._id;
      newEffect._id = "";
      await this.actor.createEmbeddedDocuments("ActiveEffect", [newEffect]);
      this.actor.effects.find(effect => effect.getFlag("twodsix", "sourceId") === oldId)?.sheet?.render(true);
    } else {
      this.item.effects.contents[0].sheet?.render(true);
    }
  }

  private _onEditEffect(): void {
    if (this.actor) {
      this.actor.effects.find(effect => effect.getFlag("twodsix", "sourceId") === this.item.effects.contents[0].id)?.sheet?.render(true);
    } else {
      this.item.effects.contents[0].sheet?.render(true);
    }
  }

  private async _onDeleteEffect(): Promise<void> {
    if (this.actor) {
      const id = this.actor.effects.find(effect => effect.getFlag("twodsix", "sourceId") === this.item.effects.contents[0].id)?.id;
      if (id) {
        this.actor.deleteEmbeddedDocuments("ActiveEffect", [id]);
      }
    }
    await this.item.update({effects: [] }, {recursive: false});
  }


  private getConsumable(event:Event):TwodsixItem | undefined {
    if (event.currentTarget) {
      const li = $(event.currentTarget).parents(".consumable");
      return <TwodsixItem>(this.item).actor?.items.get(li.data("consumableId"));
    } else {
      return undefined;
    }
  }

  private _onEditConsumable(event:Event): void {
    this.getConsumable(event)?.sheet?.render(true);
  }

  private async _onDeleteConsumable(event:Event): Promise<void> {
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
            (<TwodsixItem>this.item).removeConsumable(consumable.id); //TODO Should have await?
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
            const data = {
              name: buttonHtml.find('.consumable-name').val(),
              type: "consumable",
              data: {
                subtype: buttonHtml.find('.consumable-subtype').val(),
                quantity: parseInt(buttonHtml.find('.consumable-quantity').val() as string, 10) || 0,
                currentCount: max,
                max: max,
              }
            };
            const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [data]) || {};
            await (<TwodsixItem>this.item).addConsumable(newConsumable[0].id);
          }
        },
        cancel: {
          label: game.i18n.localize("Cancel")
        }
      },
      default: 'ok',
    }).render(true);
  }

  private _onChangeUseConsumableForAttack(event): void {
    this.item.update({"data.useConsumableForAttack": $(event.currentTarget).val()});
  }

  private static check(cond: boolean, err: string) {
    if (cond) {
      throw new Error(game.i18n.localize(`TWODSIX.Errors.${err}`));
    }
  }

  protected async _onDrop(event: DragEvent): Promise<boolean | any> {
    event.preventDefault();
    try {
      TwodsixItemSheet.check(!this.item.isOwned, "OnlyOwnedItems");
      TwodsixItemSheet.check(this.item.type === "skills", "SkillsConsumables");

      const data = getDataFromDropEvent(event);

      TwodsixItemSheet.check(!data, "DraggingSomething");
      TwodsixItemSheet.check(data.type !== "Item", "OnlyDropItems");

      const itemData = await getItemDataFromDropData(data);

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
    } catch (err) {
      console.error(`Twodsix | ${err}`);
      ui.notifications.error(err);
    }
  }
}
