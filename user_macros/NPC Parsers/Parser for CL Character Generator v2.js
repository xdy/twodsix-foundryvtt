// Take text block from https://cepheuslightgen.herokuapp.com/ and translate
// into a Cepheus Light character
getInputText();

// Get text block and process
async function getInputText() {
  // Get Input
  let raw_text = await new Promise((resolve) => {
    new Dialog({
      modal : true,
      title : `Copy and paste text for a single character`,
      content :
          `<label>Must select just the character block</label><textarea type="text" name="input" cols="40" rows="5"></textarea>`,
      buttons : {
        OK : {
          label : `Process`,
          callback :
              (html) => { resolve(html.find('[name="input"]')[0].value); }
        }
      }
    }).render(true);
  });

  // Abort if no text entered
  if (raw_text.length === 0) {
    return;
  }

  // split input into lines of text
  let processedText = raw_text.split(`\n`);
  let line = 0;

  // break up first line which is of the generic format "honorific name(s) UPP
  // Age #"
  let posAge = processedText[line].indexOf(`Age`);
  let age = parseInt(processedText[line].slice(posAge + 4));
  let upp = processedText[line].slice(posAge - 8, posAge - 2).trim();
  let fullName = processedText[line].slice(0, posAge - 9).trim();

  // console.log('Age: ', age, ', UPP: ', upp, 'Full Name: ', fullName);

  // create new actor
  let actor = await Actor.create({name : fullName, type : 'traveller'});

  ++line;

  // process second line which is the homeworld
  let homeworld =
      processedText[line].slice(processedText[line].indexOf(`:`) + 2);
  ++line;

  // Process third line which is of the generic format "careers(terms)  Cr#"
  let posCr = processedText[line].indexOf('Cr');

  let credits = parseInt(processedText[line].slice(posCr + 2));
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
    'data.name' : fullName,
    'name' : fullName,
    'data.age.value' : age,
    'data.finances.cash' : cash,
    'data.finances.debt' : debt,
    'data.bio' : bio,
    'data.homeWorld' : homeworld
  });

  // define characteristic order for UPP
  let upp_order = [
    'strength', 'dexterity', 'endurance', 'intelligence', 'education',
    'socialStanding'
  ];

  let char_id = '';
  // enter characteristic values
  for (let i = 0; i < Math.min(upp.length, upp_order.length); ++i) {
    char_id = 'data.characteristics.' + upp_order[i] + '.value';
    await actor.update({[char_id] : hexToBase10(upp[i])});
  }

  // Open Compendium
  const pack = await game.packs.get('twodsix.cepheus-light-items').getContent();

  // Jump to muster out benefits
  line += 2;
  if (processedText[line] !== '') {
    bio += '<p>Muster Out Benefits: ' + processedText[line] + '</p>';

    // Try to add items from benefits
    let itemList = processedText[line].split(', ');

    for (let i = 0; i < itemList.length; ++i) {
      let benefit = itemList[i].slice(0, itemList[i].indexOf('x') - 1).trim();
      benefit = compendiumErrors(benefit);
      let newItem = await pack.find(s => s.name === benefit);
      if (newItem != null) {
        await actor.createOwnedItem(newItem);
        let quant = parseInt(itemList[i].slice(itemList[i].indexOf('x') + 1));
        newItem = await actor.items.find(item => item.data.name === benefit);

        await newItem.update({'data.quantity' : quant});
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
  let skillsList = cleanSkills.split(
      ', '); // make an array of individual skill-level entries

  // Process skills list
  for (let i = 0; i < skillsList.length; ++i) {

    let skillPair = skillsList[i].trim();
    let skillName = skillPair.slice(0, skillPair.length - 2).trim();
    let skillLevel = parseInt(skillPair.slice(skillPair.length - 2));

    let skillItem = await pack.find(s => s.name === skillName);

    // Try to correct a null skillItem
    if (skillItem === null || skillItem === undefined) {
      skillName = compendiumErrors(skillName);
      skillItem = await pack.find(s => s.name === skillName);
    }

    // Add new skill
    if (skillItem != null) {

      await actor.createOwnedItem(skillItem);
      let newSkill =
          await actor.items.find(item => item.data.name === skillName);

      await newSkill.update(
          {'data.value' : skillLevel, 'data.characteristic' : 'NONE'});
    } else {
      bio += '<p>Unknown skill: ' + skillsList[i] + '</p>';
    }
  }

  await actor.update({'data.bio' : bio});

  // Show new actor
  actor.sheet.render(true);
}

// Convert hex value to base10
function hexToBase10(value) {
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

function compendiumErrors(skillName) {
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
  default:
    return (skillName);
  }
}
