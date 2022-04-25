/* eslint-disable semi */
// Heal a target(s) based on last Medicine skill check
// for FVTT v0.8

const MULTIPLIER = 1.0;
firstAid();

async function firstAid() {
  const patients = await game.user.targets;
  const pointsToHeal = await getHealAmount();

  if (patients !== null && pointsToHeal > 0) {
    for (const patient of patients) {
       patient.actor.healActor(pointsToHeal*MULTIPLIER);
    }
  }
}

async function getHealAmount() {
  const skillRolls = await game.messages._source.filter(m => m.flavor !== undefined);
  const healing = await skillRolls.filter(m => m.flavor.includes('Medicine'));
  let retVal = 0;

  if (healing.length > 0) {
    retVal = healing[healing.length - 1].flags.twodsix.effect;
    // console.log("Calc Heal", retVal);
  }
  return (retVal);
}
