//Liberally adapted from "hey-catch"
import TwodsixActor from "../entities/TwodsixActor";
Hooks.on('dropCanvasData', catchDrop);

async function catchDrop(canvasObject: Canvas, dropData) {

  if (dropData.type === 'damageItem') {
    const { x, y } = dropData;

    // Reference used: PlaceablesLayer.selectObjects
    // Find token(s) at drop location
    const controllable = canvasObject.tokens?.placeables.filter(obj => obj.visible && obj.actor && obj.control instanceof Function);
    const found = controllable?.filter(obj => {
      const w = obj.width, h = obj.height;
      return Number.between(x, obj.x, obj.x + w) && Number.between(y, obj.y, obj.y + h);
    });

    if (found?.length === 0 || !found) {
      return ui.notifications?.info(game.i18n.localize("TWODSIX.Warnings.NoTargetFound"));
    } else if (found.length === 1) {
      //console.log('Dropped On:', found[0]);
      const target = found[0];

      const actor = target?.actor;
      console.log(actor);

      // TODO: Could add support for asking GM to validate drop onto unowned actor?
      if (!actor?.isOwner) {
        return ui.notifications?.warn(game.i18n.localize("TWODSIX.Warnings.LackPermissionToDamage"));
      }
      if (actor.data.type === 'traveller') {
        await (<TwodsixActor>actor).damageActor(dropData.payload.damage, dropData.payload.armorPiercingValue, true);
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamageShip"));
      }
      return false;
    } else if (found.length > 1) {
      // Make sure only one token is there to avoid mistakes
      return ui.notifications?.warn(game.i18n.localize("TWODSIX.Warnings.MultipleActorsFound"));
    }
  }
}
