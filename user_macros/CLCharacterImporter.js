// Take text block from https://cepheuslightgen.herokuapp.com/ and translate
// into a Cepheus Light character
// For Foundry VTT version v13+
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
          `<label>Must select just the character block</label><textarea type="text" name="input" cols="40" rows="5"></textarea>`,
      buttons: [
        {
          action: 'OK',
          label: `Process`,
          callback:
          (_event, target) => {
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

  // break up first line which is of the generic format "honorific name(s) UPP
  // Age #"
  const posAge = processedText[line].indexOf('Age');
  const age = parseInt(processedText[line].slice(posAge + 4));
  const upp = processedText[line].slice(posAge - 8, posAge - 2).trim();
  const fullName = processedText[line].slice(0, posAge - 9).trim();

  // create new actor
  const actor = await Actor.create({ name: fullName, type: 'traveller' });

  ++line;

  // process second line which is the homeworld
  const homeworld =
      processedText[line].slice(processedText[line].indexOf(':') + 2);
  ++line;

  // Process third line which is of the generic format "careers(terms)  Cr#"
  const posCr = processedText[line].indexOf('Cr');

  const credits = parseInt(processedText[line].slice(posCr + 2));
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
    'system.finances.cash': cash,
    'system.finances.debt': debt,
    'system.bio': bio,
    'system.homeWorld': homeworld
  });

  // define characteristic order for UPP
  const uppOrder = [
    'strength', 'dexterity', 'endurance', 'intelligence', 'education',
    'socialStanding'
  ];

  let charId = '';
  // enter characteristic values
  for (let i = 0; i < Math.min(upp.length, uppOrder.length); ++i) {
    charId = 'system.characteristics.' + uppOrder[i] + '.value';
    await actor.update({ [charId]: hexToBase10(upp[i]) });
  }

  // Open Compendium
  const pack = await game.packs.get('twodsix.cepheus-light-items').getDocuments();
  const itemsToAdd = [];

  // Jump to muster out benefits
  line += 2;
  if (processedText[line] !== '') {
    bio += '<p>Muster Out Benefits: ' + processedText[line] + '</p>';

    // Try to add items from benefits
    const itemList = processedText[line].split(', ');

    for (let i = 0; i < itemList.length; ++i) {
      let benefit = itemList[i].slice(0, itemList[i].lastIndexOf('x') - 1).trim();
      benefit = compendiumErrors(benefit);

      let newItem = pack.find(s => s.name === benefit)?.toObject();

      if (newItem) {
        const quant = parseInt(itemList[i].slice(itemList[i].lastIndexOf('x') + 1));
        newItem.system.quantity = quant;
        itemsToAdd.push(Object.assign({}, newItem));
      }
    }
  }

  line += 2;

  // generate array of skill-level pairs
  let cleanSkills = processedText[line].trim(); // get rid of extra whitespace
  if (cleanSkills[cleanSkills.length - 1] ===
      ',') { // Get rid of end of string ',' if present
    cleanSkills = cleanSkills.slice(0, -1);
  }
  const skillsList = cleanSkills.split(
    ', '); // make an array of individual skill-level entries

  // Process skills list
  for (let i = 0; i < skillsList.length; ++i) {
    const skillPair = skillsList[i].trim();
    let skillName = skillPair.slice(0, skillPair.length - 2).trim();
    const skillLevel = parseInt(skillPair.slice(skillPair.length - 2));

    let skillItem = pack.find(s => s.name === skillName && s.type === 'skills')?.toObject();

    // Try to correct a null skillItem
    if (!skillItem) {
      skillName = compendiumErrors(skillName);
      skillItem = pack.find(s => s.name === skillName && s.type === 'skills')?.toObject();
    }

    // Add new skill
    if (skillItem) {
      skillItem.system.value = skillLevel;
      //skillItem.system.characteristic =  'NONE';
      //skillItem.system.name = skillItem.name;
      itemsToAdd.push(Object.assign({}, skillItem));
    } else {
      bio += '<p>Unknown skill: ' + skillsList[i] + '</p>';
    }
  }
  await actor.createEmbeddedDocuments('Item', itemsToAdd);
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

function compendiumErrors (skillName) {
  switch (skillName) {
    case 'Leader':
      return ('Leadership');
    case 'Survival':
      return ('Survival ');
    case 'Piercing Weapons':
      return ('Melee Weapons (Piercing Weapons)');
    case 'Jack-o-Trades':
      return ('Jack-of-All-Trades');
    case 'Jack o\' Trades':
      return ('Jack-of-All-Trades');
    case 'Melee Combat':
      return ('Melee');
    case 'Demolitions':
      return ('Demolition / Explosives');
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
    case 'Great Axe':
      return ('Axe');
    case 'Vibro-Blade':
      return ('Vibro-blade');
    default:
      return (skillName);
  }
}
