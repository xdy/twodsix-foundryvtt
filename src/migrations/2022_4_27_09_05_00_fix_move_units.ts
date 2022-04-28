import { Traveller } from "../types/template";
import { applyToAllActors } from "../migration-utils";

async function adjustMovementUnits (actor: TwodsixActor): Promise<void> {
  const actorData = actor.data.data as Traveller;
  if (actorData.movement?.units) {
    //console.log("Starting units: ", actorData.movement.units);
    switch (actorData.movement?.units) {
      case 'TWODSIX.Actor.Movement.DistFt':
        await actor.update({ 'data.movement.units': 'ft' });
        break;
      case 'TWODSIX.Actor.Movement.DistMi':
        await actor.update({ 'data.movement.units': 'mi' });
        break;
      case 'TWODSIX.Actor.Movement.DistM':
        await actor.update({ 'data.movement.units': 'm' });
        break;
      case 'TWODSIX.Actor.Movement.DistKm':
        await actor.update({ 'data.movement.units': 'km' });
        break;
      case 'TWODSIX.Actor.Movement.DistPc':
        await actor.update({ 'data.movement.units': 'pc' });
        break;
      case 'TWODSIX.Actor.Movement.DistGU':
        await actor.update({ 'data.movement.units': 'gu' });
        break;
      default:
        console.log('nothing changed');
        break;
    }
    //console.log("Ending Units: ", (<Traveller>actor.data.data).movement?.units);
  }
  return Promise.resolve();
}

export async function migrate(): Promise<void> {
  await applyToAllActors(adjustMovementUnits);

  return Promise.resolve();
}
