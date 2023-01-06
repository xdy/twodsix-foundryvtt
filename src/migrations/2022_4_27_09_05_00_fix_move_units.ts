// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Traveller } from "../types/template";
import { applyToAllActors } from "../module/utils/migration-utils";

async function adjustMovementUnits (actor: TwodsixActor): Promise<void> {
  const actorData = actor.system as Traveller;
  if (actorData.movement?.units) {
    //console.log("Starting units: ", actorData.movement.units);
    switch (actorData.movement?.units) {
      case 'TWODSIX.Actor.Movement.DistFt':
        await actor.update({ 'system.movement.units': 'ft' });
        break;
      case 'TWODSIX.Actor.Movement.DistMi':
        await actor.update({ 'system.movement.units': 'mi' });
        break;
      case 'TWODSIX.Actor.Movement.DistM':
        await actor.update({ 'system.movement.units': 'm' });
        break;
      case 'TWODSIX.Actor.Movement.DistKm':
        await actor.update({ 'system.movement.units': 'km' });
        break;
      case 'TWODSIX.Actor.Movement.DistPc':
        await actor.update({ 'system.movement.units': 'pc' });
        break;
      case 'TWODSIX.Actor.Movement.DistGU':
        await actor.update({ 'system.movement.units': 'gu' });
        break;
      default:
        console.log('nothing changed');
        break;
    }
    //console.log("Ending Units: ", (<Traveller>actor.system).movement?.units);
  }
  return Promise.resolve();
}

export async function migrate(): Promise<void> {
  await applyToAllActors(adjustMovementUnits);

  return Promise.resolve();
}
