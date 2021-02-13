const MULTIPLIER = 1.0;
let patients = game.user.targets;
let doctor = null;

// For player, select doctor from their primary owned character
// eslint-disable-next-line no-undef
if (character != null) {
  // eslint-disable-next-line no-undef
  let charID = character.getActiveTokens()[0].data.actorId;
  doctor = game.actors.get(charID);
}

// For GM, selsect doctor as the selected token
if (doctor == null) {
  // eslint-disable-next-line no-undef
  if (token !== undefined) {
    // eslint-disable-next-line no-undef
    doctor = token.actor;
  }
}

// Heal if doctor and patients are defined
if (doctor !== null && patients !== null) {
  for (let patient of patients) {
    healCharacter(doctor, game.actors.get(patient.data.actorId));
  }
}

async function healCharacter(healer, patient) {

  // console.log("Healer: ", healer);
  // console.log("Patient: ", patient);

  // Check that doctor has Medicine skill
  const medSkill = healer.items.find(item => item.name === 'Medicine');

  // Check that doctor has Medkit or Medical Kit
  let medKit = healer.items.find(item => item.name === 'Medkit');
  if (medKit == null) {
    medKit = healer.items.find(item => item.name === "Medical Kit");
  }

  if (medSkill !== null && medKit != null) {
    // Have player roll medicine check
    let healRoll = await medSkill.skillRoll(true);

    let pointsToHeal = healRoll.effect * MULTIPLIER;

    // define characteristic healing order
    let heal_order = [ 'endurance', 'strength', 'dexterity' ];

    let char_id = '';

    // Remove damage in the healing order
    for (let i = 0; i < heal_order.length; ++i) {

      let cur_damage = patient.data.data.characteristics[heal_order[i]].damage;

      if (cur_damage > 0) {
        let new_damage = Math.max(0, cur_damage - pointsToHeal);
        char_id = 'data.characteristics.' + heal_order[i] + '.damage';

        await patient.update({[char_id] : new_damage});

        pointsToHeal -= cur_damage - new_damage;
      }

      if (pointsToHeal < 1) {
        break;
      }
    }
  }
}
