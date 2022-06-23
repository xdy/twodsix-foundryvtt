//import { MacroData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs";

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function createItemMacro(item, slot): Promise<void> {
  if (item.type === "Macro") {
    await game.user?.assignHotbarMacro(game.macros?.get(item.id) || null, slot);
  } else {
    let itemName = "";
    let img = "";
    let command = "";
    if (item.type === "Item") {
      command = `game.twodsix.rollItemMacro("${item.id ? item.id : item.data._id}");`;
      itemName = item.name ? item.name : item.data?.name;
      img = item.img ? item.img : item.data?.img;

      //handle case for unattached item
      if (!itemName) {
        const origItem = <Item>game.items?.get(item.id);
        itemName = origItem?.name || "???";
        //img = origItem?.img || MacroData.DEFAULT_ICON;
        img = origItem?.img || CONST.DEFAULT_MACRO_ICON;
      }

    } else if (item.type === "RollTable") {
      const newTable = game.tables?.get(item.id);
      if (newTable) {
        itemName = newTable.name || "???";
        //img = newTable.data.img || MacroData.DEFAULT_ICON;
        img = newTable.data.img || CONST.DEFAULT_MACRO_ICON;
        command = `game.tables.get("${item.id}").draw();`;
      }
    } else {
      return;
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
