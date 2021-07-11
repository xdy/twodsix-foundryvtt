import TwodsixItem from '../entities/TwodsixItem';
import {getGame} from '../utils/utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('renderItemSheet', async (app, html, data) => {
  const item = getGame().items?.get(data.id);

  // Check if item was just created
  if (item && item.getFlag('twodsix', 'newItem')) {
    // Mark item as no longer being new so that it won't show up when opening the item in the future
    await item.unsetFlag('twodsix', 'newItem');

    const closeAndCreateNew = getGame().i18n.localize('TWODSIX.CloseAndCreateNew');
    const copyText = getGame().i18n.localize('TWODSIX.Copy');

    const closeAndCreateBtn = $(`<a title="${closeAndCreateNew}"><i class="fas fa-save"></i> ${closeAndCreateNew}</a>`);

    closeAndCreateBtn.on('click', async () => {
      // close current item sheet
      item.sheet?.close();

      // create new item of same type and show its sheet
      const newItem = await TwodsixItem.create({name: `${item.name} (${copyText})`, type: item.type});
      newItem.sheet.render(true);
    });

    // insert the new button just before the close button
    const closeButton = html.closest('.app').find('.header-button.close');
    closeAndCreateBtn.insertBefore(closeButton);
  }
});
