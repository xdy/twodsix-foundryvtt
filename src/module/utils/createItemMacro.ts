/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createItemMacro(item, slot):Promise<void> {
  const command = `game.twodsix.rollItemMacro("${item.id ? item.id : item.data.id}");`;
  let macro = game.macros.entities.find((m) => (m.name === item.name) /*&& (m.data.command === command)*/);
  if (!macro) {
    const itemName = item.name ? item.name : item.data.name;
    const img = item.img ? item.img : item.data.img;
    macro = await Macro.create({
      command: command,
      name: itemName,
      type: 'script',
      img: img,
      flags: {'twodsix.itemMacro': true},
    }, {displaySheet: false}) as Macro;

    await game.user.assignHotbarMacro(macro, slot);
  }
}
