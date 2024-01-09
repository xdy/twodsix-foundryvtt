// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import TwodsixItem from "../entities/TwodsixItem";

Hooks.on('renderItemSheet', async (app, html) => {
  const item = app.item;

  // Check if item was just created
  if (item && item.getFlag('twodsix', 'newItem') && !item.uuid.includes('Compendium')) {
    // Mark item as no longer being new so that it won't show up when opening the item in the future
    await item.unsetFlag('twodsix', 'newItem');

    const closeAndCreateNew = game.i18n.localize("TWODSIX.CloseAndCreateNew");
    const copyText = game.i18n.localize("TWODSIX.Copy");

    const closeAndCreateBtn = $(`<a data-tooltip="${closeAndCreateNew}"><i class="fa-solid fa-floppy-disk"></i> ${closeAndCreateNew}</a>`);

    closeAndCreateBtn.on("click", async () => {
      // close current item sheet
      item.sheet?.close();

      // create new item of same type and show its sheet
      const newItem:TwodsixItem = await TwodsixItem.create({name: `${item.name} (${copyText})`, type: item.type});

      newItem.sheet?.render(true);
    });

    // insert the new button just before the close button
    const closeButton = html.closest('.app').find('.header-button.close');
    closeAndCreateBtn.insertBefore(closeButton);
  }
});
