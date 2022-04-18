/* eslint-disable no-undef */
/* eslint-disable semi */
const reactionTable = {
  Chaser: {
    attack: ' it outnumbers characters. ',
    flee: '5'
  },
  Killer: {
    attack: '6',
    flee: '3'
  },
  Pouncer: {
    attack: ' it has surprise. ',
    flee: ' surprised. '
  },
  Siren: {
    attack: ' it has surprise. ',
    flee: ' it is surprised. '
  },
  Trapper: {
    attack: ' it has surprise. ',
    flee: '5'
  },
  Filter: {
    attack: '10',
    flee: '5'
  },
  Grazer: {
    attack: '8',
    flee: '6'
  },
  Intermittent: {
    attack: '10',
    flee: '4'
  },
  Eater: {
    attack: '5',
    flee: '4'
  },
  Gatherer: {
    attack: '9',
    flee: '7'
  },
  Hunter: {
    attack: ' 6+ when larger, Otherwise 10+ ',
    flee: '5'
  },
  CarrionEater: {
    attack: '11',
    flee: '7'
  },
  Hijacker: {
    attack: '7',
    flee: '6'
  },
  Intimidator: {
    attack: '8',
    flee: '7'
  },
  Reducer: {
    attack: '10',
    flee: '7'
  }
};

const animalType = await getAnimalType();
const roll = await new Roll("2d6").roll({async: true});
chatReaction(animalType, roll);

async function getAnimalType () {
  let html = `<label>Animal Type</label>`;
  html += `<select name ="chosenType" value="Chaser">`;
  for (const animal in reactionTable) {
    html += `<option value = "${animal}">${animal}</option>`;
  }
  html += `</select>`;

  // Get Input
  const animalType = await new Promise((resolve) => {
    new Dialog({
      modal: true,
      title: 'Animal Reaction',
      content: html,
      buttons: {
        OK: {
          label: 'Roll',
          callback:
                    (html) => { resolve(html.find('[name="chosenType"]')[0].value) }
        }
      }
    }).render(true)
  });
  return animalType;
}

async function chatReaction (type, roll) {
  let animalFlees = false;
  let animalAttacks = false;
  let specialFlee = "";
  let specialAttack = "";
  let flavor = "";

  if (isNaN(reactionTable[type].flee)) {
    specialFlee = reactionTable[type].flee
  } else if (roll.total <= parseInt(reactionTable[type].flee)) {
    animalFlees = true;
  }

  if (isNaN(reactionTable[type].attack)) {
    specialAttack = reactionTable[type].attack
  } else if (roll.total >= parseInt(reactionTable[type].attack)) {
    animalAttacks = true;
  }

  if (animalAttacks) {
    flavor = "Animal attacks party!";
  } else if (animalFlees) {
    flavor = "Animal flees from party!";
  } else if (specialAttack || specialFlee) {
    if (specialAttack) { flavor += "Animal may attack if " + specialAttack; }
    if (specialFlee) { flavor += "Animal may flee if " + specialFlee; }
  } else {
    flavor = "Animal does not react";
  }

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ alias: type }),
    flavor: flavor
  });
}
