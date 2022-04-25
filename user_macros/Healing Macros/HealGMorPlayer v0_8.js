/* eslint-disable no-undef */
/* eslint-disable semi */
const MULTIPLIER = 1.0;
const patients = game.user.targets;
let doctor = null;

// For player, select doctor from their primary owned character
// eslint-disable-next-line no-undef
if (game.user.isGM !== true) {
  const character = game.actors.filter(a => a.data.permission[game.userId] === CONST.ENTITY_PERMISSIONS.OWNER && !!a.getActiveTokens()[0])[0].data;

  if (character != null) {
    const charID = character._id;
    doctor = game.actors.get(charID);
  }
} else {
  // For GM, select doctor as the selected token
    if (token !== undefined) {
      // eslint-disable-next-line no-undef
      doctor = token.actor;
      //console.log(doctor);
      //console.log(canvas.tokens._controlled);
    }
}

// Heal if doctor and patients are defined
if (doctor !== null && patients !== null) {
  for (const patient of patients) {
    await healCharacter(doctor, game.actors.get(patient.data.actorId));
  }
}

async function healCharacter (healer, patient) {
  console.log('Healer: ', healer);
  console.log('Patient: ', patient);

  // Check that doctor has Medicine skill
  const medSkill = healer.items.find(item => item.name === 'Medicine');

  // Check that doctor has Medkit or Medical Kit
  let medKit = healer.items.find(item => item.name === 'Medkit');
  if (medKit == null) {
    medKit = healer.items.find(item => item.name === 'Medical Kit');
  }

  if (medSkill !== null && medKit != null) {
    // Have player roll medicine check
    const healRoll = await medSkill.skillRoll(true);

    if (healRoll === undefined) { return; }

    let pointsToHeal = healRoll.effect * MULTIPLIER;

    patient.healActor(pointsToHeal);
  }
}
