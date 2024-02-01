// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

//Liberally adapted from "hey-catch" by Mana#4176
//import { Skills } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { getItemDataFromDropData } from "../utils/sheetUtils";
Hooks.on('dropCanvasData', (canvasObject, dropData) => {
  if ((dropData.type === 'damageItem' || (dropData.type === "Item" && !game.modules.get("item-piles")?.active)) && game.settings.get("twodsix", "allowDropOnIcon")) {
    catchDrop(canvasObject, dropData).then();
    return false;
  }
});

async function catchDrop(canvasObject: Canvas, dropData) {
  // Reference used: PlaceablesLayer.selectObjects
  // Find token(s) at drop location
  const foundTokens = getTokensAtLocation(canvasObject, dropData.x, dropData.y);

  if (foundTokens?.length === 0 || !foundTokens) {
    return ui.notifications?.info(game.i18n.localize("TWODSIX.Warnings.NoTargetFound"));
  } else if (foundTokens.length === 1) {
    const targetActor = <TwodsixActor>foundTokens[0]?.actor;

    if (!targetActor?.isOwner) {
      return ui.notifications?.warn(game.i18n.localize("TWODSIX.Warnings.LackPermissionToDamage"));
    }
    if (dropData.type === 'damageItem') {
      return targetActor.handleDamageData(dropData.payload, <boolean>!game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    } else if (dropData.type === 'Item') {
      const itemData = await getItemDataFromDropData(dropData);
      return targetActor.handleDroppedItem(itemData);
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDropOnToken"));
    }
    return false;
  } else if (foundTokens.length > 1) {
    // Make sure only one token is there to avoid mistakes
    return ui.notifications?.warn(game.i18n.localize("TWODSIX.Warnings.MultipleActorsFound"));
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
