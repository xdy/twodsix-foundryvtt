// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

//Liberally adapted from "hey-catch" by Mana#4176
//import { Skills } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { handleDroppedItem, handleDroppedSkills } from "../sheets/AbstractTwodsixActorSheet";
import { getItemDataFromDropData } from "../utils/sheetUtils";
Hooks.on('dropCanvasData', (canvasObject, dropData) => {
  if ((dropData.type === 'damageItem' || dropData.type === "Item") && game.settings.get("twodsix", "allowDropOnIcon")) {
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
    //console.log('Dropped On:', found[0]);

    const targetActor = <TwodsixActor>foundTokens[0]?.actor;
    //console.log(actor);

    if (!targetActor?.isOwner) {
      return ui.notifications?.warn(game.i18n.localize("TWODSIX.Warnings.LackPermissionToDamage"));
    }

    if (targetActor.type === 'traveller' || targetActor.type === 'animal') {
      if (dropData.type === 'damageItem') {
        await (<TwodsixActor>targetActor).damageActor(dropData.payload.damage, dropData.payload.armorPiercingValue, true);
      } else if (dropData.type === 'Item') {
        const itemData = await getItemDataFromDropData(dropData);  //Note: this might need to change to  itemData = fromUuidSync(dropData.uuid)

        //Block unallowed types on animals
        if (!["weapon", "trait", "skills"].includes(itemData.type) && targetActor.type === "animal") {
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDragOntoActor"));
          return false;
        }

        if (isSameActor(targetActor, itemData)) {
          console.log(`Twodsix | Moved Skill ${itemData.name} to another position in the skill list`);
          return;
        }

        if (itemData.type === "skills") {
          handleDroppedSkills(targetActor, itemData);
          return;
        } else if (!["component"].includes(itemData.type)) {
          handleDroppedItem(targetActor, itemData);
          return;
        }
      }
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

function isSameActor(actor: Actor, itemData: any): boolean {
  return (itemData.actor?.id === actor.id) || (actor.isToken && (itemData.actor?.id === actor.token?.id));
}
