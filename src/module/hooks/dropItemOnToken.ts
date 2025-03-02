// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

//Liberally adapted from "hey-catch" by Mana#4176
//import { Skills } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { getDocFromDropData } from "../utils/sheetUtils";
Hooks.on('dropCanvasData', (canvasObject, dropData) => {
  if ((['damageItem', 'ActiveEffect', 'Folder', 'ItemList'].includes(dropData.type) || (dropData.type === "Item" && !game.modules.get("item-piles")?.active)) && game.settings.get("twodsix", "allowDropOnIcon")) {
    catchDrop(canvasObject, dropData).then();
    return false;
  }
});

async function catchDrop(canvasObject: Canvas, dropData): Promise<any> {
  // Reference used: PlaceablesLayer.selectObjects
  // Find token(s) at drop location
  const foundTokens = getTokensAtLocation(canvasObject, dropData.x, dropData.y);

  if (foundTokens?.length === 0 || !foundTokens) {
    ui.notifications?.info("TWODSIX.Warnings.NoTargetFound", {localize: true});
    return false;
  } else if (foundTokens.length === 1) {
    const targetActor = <TwodsixActor>foundTokens[0]?.actor;
    if (targetActor?.isOwner) {
      switch (dropData.type) {
        case 'damageItem':
          return targetActor.handleDamageData(dropData.payload, <boolean>!game.settings.get('twodsix', 'autoDamageTarget'));
        case 'Item': {
          const droppedItem = await getDocFromDropData(dropData);
          return await targetActor.handleDroppedItem(droppedItem);
        }
        case 'ActiveEffect': {
          const droppedEffect = await fromUuid(dropData.uuid);
          return await targetActor.handleDroppedActiveEffect(droppedEffect);
        }
        case 'Folder': {
          const folder = await fromUuid(dropData.uuid);
          return targetActor.handleDroppedFolder(folder);
        }
        case 'ItemList': {
          return targetActor.handleDroppedList(dropData.parseString);
        }
        default: {
          ui.notifications.warn("TWODSIX.Warnings.CantDropOnToken", {localize: true});
          return false;
        }
      }
    } else {
      ui.notifications?.warn("TWODSIX.Warnings.LackPermissionToDamage", {localize: true});
      return false;
    }
  } else if (foundTokens.length > 1) {
    // Make sure only one token is there to avoid mistakes
    ui.notifications?.warn("TWODSIX.Warnings.MultipleActorsFound", {localize: true});
    return false;
  }
}

function getTokensAtLocation(canvasObject: Canvas, x: number, y: number) {
  const controllable = canvasObject.tokens?.placeables.filter(obj => obj.visible && obj.actor && obj.control instanceof Function);
  const foundTokens = controllable?.filter(obj => {
    //const w = obj.width, h = obj.height;
    return Number.between(x, obj.x, obj.x + obj.w) && Number.between(y, obj.y, obj.y + obj.h);
  });
  return foundTokens;
}
