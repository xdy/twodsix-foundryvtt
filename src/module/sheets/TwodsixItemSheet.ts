import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getItemDataFromDropData } from "../utils/sheetUtils";
import Trait = dataTwodsix.Trait;

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
    data.actor = this.item.actor;

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

    data.ACTIVE_EFFECT_MODES = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce((ret, entry) => {
      const [ key, value ] = entry;
      ret[ value ] = key;
      return ret;
    }, {});
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

    //change-row
    html.find('.change-row input, .change-row select').on('change', this._onEditChange.bind(this));
    html.find('.change-create').on('click', this._onCreateChange.bind(this));
    html.find('.change-delete').on('click', this._onDeleteChange.bind(this));

    html.find(".effect-edit").on("click", this._onEditEffect.bind(this));

    this.handleContentEditable(html);
  }

  private _onEditEffect(event:Event): void {
    if (event.currentTarget) {
      const effect = (<TwodsixActor>this.actor).effects.get($(event.currentTarget).data('effectId'));
      effect?.sheet.render(true);
    }
  }

  private _onDeleteChange(event:Event): void {
    if (event.currentTarget) {
      const idx = parseInt($(event.currentTarget).data("index"), 10);
      const changes = (<Trait>this.item.data.data).changes.filter((_, i) => i !== idx);
      this.item.update({"data.changes": changes});
    }
  }

  private _onEditChange(event:Event) : void{
    if (event.currentTarget) {
      const idx = parseInt($(event.currentTarget).parents(".change-row").data("change-index"), 10);
      const changes = (<Trait>this.item.data.data).changes;
      const type:string = $(event.currentTarget).data("type");
      if (!isNaN(idx) && type) {
        const val = $(event.currentTarget).val() as string;
        changes[idx][type] = type === "mode" ? parseInt(val, 10) : val;
        this.item.update({"data.changes": changes});
      }
    }
  }

  private _onCreateChange(): void {
    const changes = (<Trait>this.item.data.data).changes ?? [];
    this.item.update({"data.changes": changes.concat({key: "", value: "", mode: 0})});
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
