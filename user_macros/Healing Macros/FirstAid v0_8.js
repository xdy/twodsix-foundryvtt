/* eslint-disable no-undef */
/* eslint-disable semi */
// Heal a target(s) based on last Medicine skill check
// for FVTT v0.8

const MULTIPLIER = 1.0;
firstAid();

async function firstAid () {
  const patients = await game.user.targets;
  const pointsToHeal = await getHealAmount();

  if (patients !== null && pointsToHeal > 0) {
    for (const patient of patients) {
      healCharacter(pointsToHeal * MULTIPLIER, game.actors.get(patient.data.actorId));
    }
  }
}

async function healCharacter (pointsToHeal, patient) {
  // console.log("Patient: ", patient);

  // define characteristic healing order
  const healOrder = ['endurance', 'strength', 'dexterity'];

  let charId = '';

  // Remove damage in the healing order
  for (let i = 0; i < healOrder.length; ++i) {
    if (pointsToHeal < 1) { break; }
    const curDamage = patient.data.data.characteristics[healOrder[i]].damage;

    if (curDamage > 0) {
      const newDamage = Math.max(0, curDamage - pointsToHeal);
      charId = 'data.characteristics.' + healOrder[i] + '.damage';

      await patient.update({
        [charId]: newDamage
      });

      pointsToHeal -= curDamage - newDamage;
    }
  }
}

async function getHealAmount () {
  const skillRolls = await game.messages._source.filter(m => m.flavor !== undefined);
  const healing = await skillRolls.filter(m => m.flavor.includes('Medicine'));
  let retVal = 0;

  if (healing.length > 0) {
    retVal = healing[healing.length - 1].flags.twodsix.effect;
    // console.log("Calc Heal", retVal);
  }
  return (retVal);
}
