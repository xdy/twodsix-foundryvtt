import {AbstractTwodsixItemSheet} from './AbstractTwodsixItemSheet';
import {TWODSIX} from '../config';
import TwodsixItem from '../entities/TwodsixItem';
import { getDataFromDropEvent, getItemDataFromDropData } from '../utils/sheetUtils';
import {getGame, getUi} from '../utils/utils';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class TwodsixItemSheet extends AbstractTwodsixItemSheet {

  /** @override */
  static get defaultOptions():DocumentSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ['twodsix', 'sheet', 'item'],
      submitOnClose: true,
      submitOnChange: true,
      tabs: [{navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description'}],
      dragDrop: [{dropSelector: null}]
    });
  }

  /** @override */
  get template():string {
    const path = 'systems/twodsix/templates/items';
    return `${path}/${this.item.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  // @ts-ignore
  getData():ItemSheetData {
    const data = super.getData();
    const actorData = data.data;
    data.actor = actorData;

    // @ts-ignore
    this.item.prepareConsumable();
    // Add relevant data from system settings
    data.data.settings = {
      ShowLawLevel: getGame().settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: getGame().settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ShowWeaponType: getGame().settings.get('twodsix', 'ShowWeaponType'),
      ShowDamageType: getGame().settings.get('twodsix', 'ShowDamageType'),
      ShowRateOfFire: getGame().settings.get('twodsix', 'ShowRateOfFire'),
      ShowRecoil: getGame().settings.get('twodsix', 'ShowRecoil'),
      DIFFICULTIES: TWODSIX.DIFFICULTIES[(<number>getGame().settings.get('twodsix', 'difficultyListUsed'))]
    };
    data.data.config = TWODSIX;
    data.data.isOwned = this.item.isOwned;
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  // @ts-ignore
  setPosition(options:ApplicationPosition = {}):any {
    const position = super.setPosition(options);
    const sheetBody = (this.element as JQuery).find('.sheet-body');
    const bodyHeight = position.height - 192;
    sheetBody.css('height', bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html:JQuery):void {
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
  }

  private getConsumable(event:Event):TwodsixItem {
    const li = $(event.currentTarget).parents('.consumable');
    // @ts-ignore
    return this.item.actor.items.get(li.data('consumableId'));
  }

  private _onEditConsumable(event:Event):void {
    this.getConsumable(event).sheet?.render(true);
  }

  private async _onDeleteConsumable(event:Event):Promise<void> {
    const consumable = this.getConsumable(event);
    if(!consumable) {
      this.item.removeConsumable('');
    } else {
      const bodyTextTemplate = getGame().i18n.localize('TWODSIX.Items.Consumable.RemoveConsumableFrom');
      const consumableNameString = `"<strong>${consumable.name}</strong>"`;
      const body = bodyTextTemplate.replace('_CONSUMABLE_NAME_', consumableNameString).replace('_ITEM_NAME_', this.item.name);

      await Dialog.confirm({
        title: getGame().i18n.localize('TWODSIX.Items.Consumable.RemoveConsumable'),
        content: `<div class="remove-consumable">${body}<br><br></div>`,
        // @ts-ignore
        yes: async () => this.item.removeConsumable(consumable.id),
        no: () => {
          //Nothing
        },
      });
    }
  }

  private async _onCreateConsumable():Promise<void> {
    if (!this.item.isOwned) {
      console.error('Twodsix | Consumables can only be created for owned items');
      return;
    }
    const template = 'systems/twodsix/templates/items/dialogs/create-consumable.html';
    const html = await renderTemplate(template, {
      consumables: TWODSIX.CONSUMABLES
    });
    new Dialog({
      title: `${getGame().i18n.localize('TWODSIX.Items.Items.New')} ${getGame().i18n.localize('TWODSIX.itemTypes.consumable')}`,
      content: html,
      buttons: {
        ok: {
          label: getGame().i18n.localize('TWODSIX.Create'),
          callback: async (buttonHtml:JQuery) => {
            const max = parseInt(buttonHtml.find('.consumable-max').val() as string, 10) || 0;
            const data = {
              name: buttonHtml.find('.consumable-name').val(),
              type: 'consumable',
              data: {
                subtype: buttonHtml.find('.consumable-subtype').val(),
                quantity: parseInt(buttonHtml.find('.consumable-quantity').val() as string, 10) || 0,
                currentCount: max,
                max: max,
              }
            };
            // @ts-ignore
            const newConsumable = await this.item.actor.createEmbeddedDocuments('Item', [data]);
            // @ts-ignore
            await this.item.addConsumable(newConsumable[0].id);
          }
        },
        cancel: {
          label: getGame().i18n.localize('Cancel')
        }
      },
      default: 'ok',
    }).render(true);
  }

  private _onChangeUseConsumableForAttack(event:Event):void {
    this.item.update({'data.useConsumableForAttack': $(event.currentTarget).val()});
  }

  private static check(cond:boolean, err:string) {
    if(cond) {
      throw new Error(getGame().i18n.localize(`TWODSIX.Errors.${err}`));
    }
  }

  protected async _onDrop(event:DragEvent):Promise<boolean | any> {
    event.preventDefault();
    try {
      TwodsixItemSheet.check(!this.item.isOwned, 'OnlyOwnedItems');
      TwodsixItemSheet.check(this.item.type === 'skills', 'SkillsConsumables');

      const data = getDataFromDropEvent(event);

      TwodsixItemSheet.check(!data, 'DraggingSomething');
      TwodsixItemSheet.check(data.type !== 'Item', 'OnlyDropItems');

      const itemData = await getItemDataFromDropData(data);

      TwodsixItemSheet.check(itemData.type !== 'consumable', 'OnlyDropConsumables');

      // If the dropped item has the same actor as the current item let's just use the same id.
      let itemId: string;
      if (this.item.actor.items.get(itemData.id)) {
        itemId = itemData.id;
      } else {
        const newItem = await this.item.actor.createEmbeddedDocuments('Item', [itemData]);
        itemId = newItem[0].id;
      }
      // @ts-ignore
      await this.item.addConsumable(itemId);
    } catch (err) {
      console.error(`Twodsix | ${err}`);
      getUi().notifications?.error(err);
    }
  }
}
