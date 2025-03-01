// Take text block from https://travellertools.azurewebsites.net and
// translate into a character
// updated for FVTT v13

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
        `<label>Don't include menu bar (include all text with white background)</label><textarea type="text" name="input" cols="40" rows="5"></textarea>`,
      buttons: [
        {
          action: "ok",
          label: `Process`,
          default: true,
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

  if (processedText[line] === '') {
    ++line;
  }

  // Process first line which is of the generic format "honortific name
  // permalink" locate name on first line
  const fullName = processedText[line].slice(0, processedText[line].indexOf('permalink') - 1);

  // create new actor
  const actor = await Actor.create({ name: fullName, type: 'traveller' });
  const usingTT2 = processedText[1].includes("Species") || processedText[1].includes("species");

  line += 2; // skip to species, age, gender, stat line

  // break up third line
  const ageGenStats = processedText[line].split('\t');

  const species = usingTT2 ? ageGenStats[0] : "";
  const age = usingTT2 ? parseInt(ageGenStats[1]): parseInt(ageGenStats[0]);
  const gender = usingTT2 ?  ageGenStats[2] : ageGenStats[1];

  // Enter basic character data
  await actor.update({
    'system.name': fullName,
    'name': fullName,
    'system.age.value': age,
    'system.gender': gender,
    'system.species': species
  });

  // define characteristic order for UPP
  const uppOrder = ['strength', 'dexterity', 'endurance', 'intelligence', 'education', 'socialStanding'];

  let charId = '';
  // enter characteristic values
  const offset = usingTT2 ? 3 : 2;
  for (let i = 0; i < Math.min(ageGenStats.length - 2, uppOrder.length); ++i) {
    charId = 'system.characteristics.' + uppOrder[i] + '.value';
    const statVal = ageGenStats[i + offset].slice(0, ageGenStats[i + offset].indexOf('(') - 1);
    await actor.update({ [charId]: parseInt(statVal) });
  }
  ++line;

  // add description
  await actor.update({ 'system.description': processedText[line] });

  // Skip to start of skills list
  do {
    ++line;
  } while (processedText[line].indexOf('Skills') < 0);
  ++line;

  // Process and add skills
  const skillsPack = await game.packs.get('twodsix.twoe-skills').getDocuments();

  while (processedText[line].indexOf('Career') < 0 && line < processedText.length) {
    const skillLevel =
		parseInt(processedText[line][processedText[line].length - 1]);
    const skillName =
		processedText[line].slice(0, processedText[line].length - 2);

    if (skillName !== '') {
	  // Convert skill name to 2e compendium format
	  let adjName = '';
	  if (skillName.indexOf('(') >= 0) {
        adjName = skillName.replace(' (', ': ');
        adjName = adjName.slice(0, -1);
	  } else {
        adjName = skillName;
	  }

	  // look for skill in compendium
	  const skillItem = await skillsPack.find(s => s.name === adjName && s.type === 'skills');

	  if (skillItem == null) {
        const skillData = { name: adjName, type: 'skills' };
        await actor.createEmbeddedDocuments('Item', [skillData]);
	  } else {
        await actor.createEmbeddedDocuments('Item', [skillItem]);
	  }

	  // find added skill item on actor
	  const newItem = await actor.items.find(item => item.name === adjName);

	  // update level
	  await newItem.update(
        { 'system.value': skillLevel, 'system.characteristic': 'NONE' });
    }
    ++line;
  }

  // process career table
  let bio = `<p>Careers:</p><table style="width:100%;">`;
  let contacts = ``;

  while (processedText[line].indexOf('History') < 0 &&
		 processedText[line].indexOf('Education') < 0 && processedText[line].indexOf('Enmity') < 0) {
    bio += genTableRowHTML(processedText[line], 'Career');
    ++line;
  }

  // process education if exists
  if (processedText[line].indexOf('Education') >= 0) {
    bio += `</table><br><p>Education:</p><table style="width:100%;">`;
    while (processedText[line].indexOf('History') < 0 && processedText[line].indexOf('Enmity') < 0) {
	  bio += genTableRowHTML(processedText[line], 'Education');
	  ++line;
    }
  }

  // process contacts if exists
  if (processedText[line].indexOf('Enmity') >= 0) {
    contacts += `<table style="width:100%;">`;
    while (processedText[line].indexOf('History') < 0) {
	  contacts += genTableRowHTML(processedText[line], 'Name');
	  ++line;
    }
    contacts += `</table>`;
  }


  // Add character event log to bio
  bio += `</table><br><p>Career History:</p><table style="width:100%">`;

  while (processedText[line].indexOf('\t') >= 0) {
    bio += genTableRowHTML(processedText[line], 'Term');
    ++line;
    if (processedText[line] === undefined) {
	  break;
    }
  }
  bio += `</table><br>`;

  await actor.update({ 'system.bio': bio, 'system.contacts': contacts });

  // Show new actor
  actor.sheet.render(true);
}

function genTableRowHTML (rowText, headerText) {
  if (rowText.indexOf('\t') < 0) {
    return ('');
  }

  const parsedLine = rowText.split('\t');
  let returnText = '<tr>';
  for (let i = 0; i < parsedLine.length; ++i) {
    if (parsedLine[0].indexOf(headerText) >= 0) {
	  returnText +=
			'<th style="text-align:center; min-column-width: 4ch;">' + parsedLine[i].trim() + '</th>';
    } else {
	  returnText +=
			'<td style="text-align:center">' + parsedLine[i].trim() + '</td>';
    }
  }
  returnText += '</tr>';
  return (returnText);
}
