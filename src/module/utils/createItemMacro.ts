// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} dropData     Document type and uuid
 * @param {number} slot     The hotbar slot to use
 */
export function createItemMacro(dropData: object, slot: number) {
  //console.log(dropData.uuid.split("."));
  if (dropData.type === "Item") {
    addItemMacro(dropData, slot).then();
    return false;
  }
}

async function addItemMacro(dropData:object, slot:number): Promise<void> {
  const item = await fromUuid(dropData.uuid);
  if (item?.id) {
    if (dropData.type === "Macro") {
      await game.user?.assignHotbarMacro(game.macros?.get(item.id) || null, slot);
    } else {
      let itemName = "";
      let img = "";
      let command = "";
      if (dropData.type === "Item") {
        itemName = item.name || "";
        command = `game.twodsix.rollItemMacro("${item.id ? item.id : item._id}", "${itemName}");`;
        img = item.img || foundry.documents.BaseMacro.DEFAULT_ICON;

        //handle case for unattached item
        if (itemName === "") {
          const origItem = <Item>game.items?.get(item.id);
          itemName = origItem?.name || "???";
          //img = origItem?.img || MacroData.DEFAULT_ICON;
          img = origItem?.img || foundry.documents.BaseMacro.DEFAULT_ICON;
        }

      } else if (dropData.type === "RollTable") {
        const newTable = game.tables?.get(item.id);
        if (newTable) {
          itemName = newTable.name || "???";
          //img = newTable.img || MacroData.DEFAULT_ICON;
          img = newTable.img || foundry.documents.BaseMacro.DEFAULT_ICON;;
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
      } else {
        if (macro.command !== command) {
          await Dialog.confirm({
            title: game.i18n.localize("TWODSIX.Dialogs.ReplaceMacroCommand"),
            content: game.i18n.localize("TWODSIX.Warnings.MacroNameExists"),
            yes: async () => {
              await macro.update({command: command});
            },
            no: () => {
              //Nothing
            },
          });
        }
        if (Object.values(game.user.hotbar).includes(macro.id) && game.settings.get('twodsix', 'NoDuplicatesOnHotbar')) {
          return;
        }
      }
      await game.user?.assignHotbarMacro(macro, slot);
    }
  }
}
