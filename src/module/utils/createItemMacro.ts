
/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createItemMacro(item, slot): Promise<void> {
  if (item.type === "Macro") {
    await game.user?.assignHotbarMacro(game.macros.get(item.id), slot);
  } else {
    const command = `game.twodsix.rollItemMacro("${item.id ? item.id : item.data._id}");`;
    let itemName = item.name ? item.name : item.data?.name;
    let img = item.img ? item.img : item.data?.img;

    //handle case for unattached item
    if (!itemName) {
      const origItem = <Item>game.items?.get(item.id);
      itemName = origItem?.name || "???";
      img = origItem?.img || CONST.DEFAULT_MACRO_ICON;
    }
    let macro: Macro | undefined = game.macros?.getName(itemName);
    if (!macro) {
      macro = await Macro.create({
        command: command,
        name: itemName,
        type: 'script',
        img: img,
        flags: { 'twodsix.itemMacro': true },
      }, { renderSheet: false }) as Macro;
    }
    await game.user?.assignHotbarMacro(macro, slot);
  }
}
