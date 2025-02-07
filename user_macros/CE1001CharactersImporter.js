// Take text block from
// http://members.ozemail.com.au/~jonoreita/SupplementOne/Cepheus_Engine_1001_characters.html
// and translate into a character skills must be separated by commas
//Updated for v13+

let compendium = '';

getInputText();

// Get text block and process
async function getInputText () {
  // Get Input
  const rawText = await new Promise((resolve) => {
    new foundry.applications.api.DialogV2({
      modal: true,
      window: {
        title: 'Copy and paste text for a single character',
        icon: 'fa-solid fa-file-import'
      },
      content:
          `<label>Must select comma separated skills</label><textarea type="text" name="input" cols="40" rows="5"></textarea>`,
      buttons: [
        {
          action: 'CE',
          label: `Cepheus Engine`,
          callback: (_event, target) => {
            compendium = 'CE';
            resolve(target.form.elements.input.value);
          }
        },
        {
          action: 'CEL',
          label: `Cepheus Light`,
          callback: (_event, target) => {
            compendium = 'CL';
            resolve(target.form.elements.input.value);
          }
        }
      ]
    }).render(true);
  });

  // Abort if no text entered
  if (rawText.length === 0) {
    return;
  }

  // split input into lines of text
  const processedText = rawText.split('\n');
  let line = 0;

  // Process first line which is of the generic format "#. honorific name(s)
  // (gender, species) UPP Age #"

  // locate key positions on first line
  let startName = 0;

  if (processedText[line].indexOf('.') !== -1) {
    startName =
        processedText[line].indexOf('.') + 2; // Adjust for numbered character
  }
  const posOpenParen = processedText[line].indexOf('(');
  const posCloseParen = processedText[line].indexOf(')');
  const posAge = processedText[line].indexOf('Age');

  // break up first line
  const fullName = processedText[line].slice(startName, posOpenParen - 1);
  const genderSpecies =
      processedText[line].slice(posOpenParen + 1, posCloseParen).split(' ');
  let upp = processedText[line].slice(posCloseParen + 2, posAge - 1);
  upp = upp.replace('-', ''); // remove dash if psionic
  const age = processedText[line].slice(posAge + 4);

  // create new actor
  const actor = await Actor.create({ name: fullName, type: 'traveller' });

  ++line;

  // Process second line which is of the generic format "careers(terms)  Cr#"
  const posCr = processedText[line].indexOf('Cr');

  const credits = processedText[line].slice(posCr + 2);
  let cash = 0;
  let debt = 0;
  if (credits >= 0) {
    cash = credits;
  } else {
    debt = -credits;
  }

  let bio = '<p>Career(s): ' + processedText[line].slice(0, posCr - 3) + '</p>';

  // Enter basic character data
  await actor.update({
    'system.name': fullName,
    'name': fullName,
    'system.age.value': age,
    'system.gender': genderSpecies[0],
    'system.species': genderSpecies[1],
    'system.finances.cash': cash,
    'system.finances.debt': debt
  });

  ++line;

  // Check for traits for non-humans and add to bio
  if (genderSpecies[1] !== 'Human') {
    bio += '<p>' + processedText[line] + '</p>';
    ++line;
  }

  // define characteristic order for UPP
  const uppOrder = [
    'strength', 'dexterity', 'endurance', 'intelligence', 'education',
    'socialStanding', 'psionicStrength'
  ];

  let charId = '';
  // enter characteristic values
  for (let i = 0; i < Math.min(upp.length, uppOrder.length); ++i) {
    charId = 'system.characteristics.' + uppOrder[i] + '.value';
    await actor.update({ [charId]: hexToBase10(upp[i]) });
  }

  // generate array of skill-level pairs
  let cleanSkills = processedText[line].trim(); // get rid of extra whitespace

  // Get rid of end of string ',' if present
  if (cleanSkills[cleanSkills.length - 1] === ',') {
    cleanSkills = cleanSkills.slice(0, -1);
  }

  // make an array of individual skill-level entries
  const skillsList = cleanSkills.split(', ');

  // Open Compendium
  let packName = '';
  switch (compendium) {
    case 'CE':
      packName = 'twodsix.ce-srd-items';
      break;
    case 'CL':
      packName = 'twodsix.cepheus-light-items';
      break;
  }
  const pack = await game.packs.get(packName).getDocuments();

  // Process skills list
  for (let i = 0; i < skillsList.length; ++i) {
    const lastDash = skillsList[i].lastIndexOf('-'); // Some skills have dash in name, so last one is the marker
    const skillName = skillsList[i].slice(0, lastDash);
    let skillLevel = skillsList[i].slice(lastDash + 1);

    let adjName = translateSkillName(skillName);

    let skillItem = await pack.find(s => s.name === adjName && s.type === 'skills');

    // Try to correct a null skillItem
    if (skillItem === null || skillItem === undefined) {
      adjName = compendiumErrors(skillName);
      skillItem = await pack.find(s => s.name === adjName && s.type === 'skills');
    }

    // Add new skill if it doesn't exist, pick higher level to add if it does
    if (skillItem != null) {
      let newSkill = await actor.items.find(item => item.name === adjName);

      if (newSkill == null) {
        await actor.createEmbeddedDocuments('Item', [skillItem]);
        newSkill = await actor.items.find(item => item.name === adjName);
      } else {
        skillLevel = Math.max(skillLevel, newSkill.system.value);
      }

      await newSkill.update(
        { 'system.value': skillLevel, 'system.characteristic': 'NONE' });
    } else {
      bio += '<p>Unknown skill: ' + skillsList[i] + '</p>';
    }
  }

  ++line;

  // Process rest of bio

  // Check for muster out benefits, optional line
  if (processedText[line] !== 'Character Event Log:') {
    // Try to add items from benefits
    const itemList = processedText[line].split(', ');

    for (let i = 0; i < itemList.length; ++i) {
      const newItem = await pack.find(s => s.name === itemList[i]);
      if (newItem != null) {
        await actor.createEmbeddedDocuments('Item', [newItem]);
      }
    }

    bio += '<p>Muster Out Benefits: ' + processedText[line] + '</p>';
    ++line;
  }

  // Add character event log to bio
  for (let i = line; i < processedText.length; ++i) {
    bio += '<p>' + processedText[i] + '</p>';
  }
  await actor.update({ 'system.bio': bio });

  // Show new actor
  actor.sheet.render(true);
}

// Convert hex value to base10
function hexToBase10 (value) {
  switch (value.toUpperCase()) {
    case 'A':
      return ('10');
    case 'B':
      return ('11');
    case 'C':
      return ('12');
    case 'D':
      return ('13');
    case 'E':
      return ('14');
    case 'F':
      return ('15');
    case 'G':
      return ('16');
    default:
      return (value);
  }
}

// Convert Abbreviated Skill Name to Full Compendium Name
function translateSkillName (skillName) {
  switch (skillName) {
    case 'Grav Vehicle':
    case 'Rotor Aircraft':
    case 'Winged Aircraft':
      switch (compendium) {
        case 'CE':
          return ('Aircraft (' + skillName + ')');
        case 'CL':
          return ('Aircraft');
      }
      break;
    case 'Farming':
    case 'Riding':
    case 'Veterinary Medicine':
      switch (compendium) {
        case 'CE':
          return ('Animals (' + skillName + ')');
        case 'CL':
          return ('Animals');
      }
      break;
      // case 'Survival':
    case 'Archery':
    case 'Energy Pistol':
    case 'Energy Rifle':
    case 'Shotguns':
    case 'Shotgun':
    case 'Slug Pistol':
    case 'Slug Rifle':
      switch (compendium) {
        case 'CE':
          return ('Gun Combat (' + skillName + ')');
        case 'CL':
          return ('Gun Combat');
      }
      break;
    case 'Bay Weapons':
    case 'Heavy Weapons':
    case 'Screens':
    case 'Spinal Mounts':
    case 'Turret Weapons':
      switch (compendium) {
        case 'CE':
          return ('Gunnery (' + skillName + ')');
        case 'CL':
          if (skillName === 'Heavy Weapons') {
            return (skillName);
          } else {
            return ('Gunnery');
          }
      }
      break;
    case 'Bludgeoning Weapons':
    case 'Natural Weapons':
    case 'Slashing Weapons':
    case 'Piercing Weapons':
      switch (compendium) {
        case 'CE':
          return ('Melee Combat (' + skillName + ')');
        case 'CL':
          return ('Melee');
      }
      break;
    case 'Life Sciences':
    case 'Physical Sciences':
    case 'Social Sciences':
    case 'Space Sciences':
      switch (compendium) {
        case 'CE':
          return ('Science (' + skillName + ')');
        case 'CL':
          return ('Science');
      }
      break;
    case 'Mole':
    case 'Tracked Vehicle':
    case 'Wheeled Vehicle':
      switch (compendium) {
        case 'CE':
          return ('Vehicle (' + skillName + ')');
        case 'CL':
          return ('Driving');
      }
      break;
    case 'Motorboats':
    case 'Ocean Ships':
    case 'Sailing Ships':
    case 'Submarine':
      switch (compendium) {
        case 'CE':
          return ('Watercraft (' + skillName + ')');
        case 'CL':
          return ('Watercraft');
      }
      break;
    case 'Battle Dress':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Zero-G');
      }
      break;
    case 'Gambling':
    case 'Carousing':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Carouse');
      }
      break;
    case 'Computer':
    case 'Comms':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Computers');
      }
      break;
    case 'Electronics':
    case 'Mechanics':
    case 'Gravitics':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Repair');
      }
      break;
    case 'Navigation':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Piloting');
      }
      break;
    case 'Broker':
    case 'Bribery':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Liaison');
      }
      break;
    case 'Advocate':
      switch (compendium) {
        case 'CE':
          return (skillName);
        case 'CL':
          return ('Admin');
      }
      break;
    default:
      return (skillName);
  }
}

function compendiumErrors (skillName) {
  switch (skillName) {
    case 'Leader':
      return ('Leadership');
    case 'Survival':
      return ('Survival ');
    case 'Piercing Weapons':
      return ('Melee Weapons (Piercing Weapons)');
    case 'Jack o\' Trades':
      switch (compendium) {
        case 'CE':
          return ('Jack of All Trades');
        case 'CL':
          return ('Jack-of-All-Trades');
      }
      break;
    case 'Melee Combat':
      return ('Melee');
    case 'Demolitions':
      return ('Demolition / Explosives');
    case 'Shotgun':
      return ('Gun Combat (Shotguns)');
    case 'Autopistol':
      return ('Auto Pistol');
    case 'Carousing':
      return ('Carouse');
    case 'Computer':
      return ('Computers');
    case 'Administration':
      return ('Admin');
    case 'Investigation':
      return ('Investigate');
    case 'Grav Vehicle':
      return ('Grav Vehicles');
  }
}
