// Take text block from https://travellertools.azurewebsites.net/Home/ and
// translate into a character

getInputText();

// Get text block and process
async function getInputText() {
  // Get Input
  let raw_text = await new Promise((resolve) => {
    new Dialog({
      modal : true,
      title : `Copy and paste text for a single character`,
      content :
          `<label>Don't include menu bar (include all text with white background)</label><textarea type="text" name="input" cols="40" rows="5"></textarea>`,
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

  if (processedText[line] === '') {
    ++line;
  }

  // Process first line which is of the generic format "honortific name
  // permalink" locate name on first line
  let fullName = processedText[line].slice(
      0, processedText[line].indexOf(`permalink`) - 1);

  // create new actor
  let actor = await Actor.create({name : fullName, type : 'traveller'});

  line += 2; // skip to age, gender, stat line

  // break up third line
  let ageGenStats = processedText[line].split(`\t`);
  let age = parseInt(ageGenStats[0]);
  let gender = ageGenStats[1];

  // Enter basic character data
  await actor.update({
    'data.name' : fullName,
    'name' : fullName,
    'data.age.value' : age,
    'data.gender' : gender,
    'data.species' : `Human`,
  });

  // define characteristic order for UPP
  let upp_order = [
    'strength', 'dexterity', 'endurance', 'intelligence', 'education',
    'socialStanding'
  ];

  let char_id = '';
  // enter characteristic values
  for (let i = 0; i < Math.min(ageGenStats.length - 2, upp_order.length); ++i) {
    char_id = 'data.characteristics.' + upp_order[i] + '.value';
    let statVal =
        ageGenStats[i + 2].slice(0, ageGenStats[i + 2].indexOf(`(`) - 1);

    await actor.update({[char_id] : parseInt(statVal)});
  }
  ++line;

  // add description
  await actor.update({'data.description' : processedText[line]});

  // Skip to start of skills list
  do {
    ++line;
  } while (processedText[line].indexOf(`Skills`) < 0);
  ++line;

  // Process and add skills
  const com_pack = await game.packs.get('twodsix.twoe-skills').getContent();

  while (processedText[line].indexOf(`Career`) < 0 &&
         line < processedText.length) {
    let skillLevel =
        parseInt(processedText[line][processedText[line].length - 1]);
    let skillName =
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
      let skillItem = await com_pack.find(s => s.name === adjName && s.type==='skills');

      if (skillItem == null) {
        const skillData = {name : adjName, type : "skills"};
        await actor.createEmbeddedEntity("OwnedItem", skillData);
      } else {
        await actor.createOwnedItem(skillItem);
      }

      // find added skill item on actor
      let newItem = await actor.items.find(item => item.data.name === adjName);

      // update level
      await newItem.update(
          {'data.value' : skillLevel, 'data.characteristic' : 'NONE'});
    }
    ++line;
  }

  // process career table
  let bio = `<p>Careers:</p><table style="width:100%;">`;

  while (processedText[line].indexOf('History') < 0 &&
         processedText[line].indexOf('Education') < 0) {
    bio += genTableRowHTML(processedText[line], 'Career');
    ++line;
  }

  // process education if exists
  if (processedText[line].indexOf('Education') >= 0) {
    bio += `</table><br><p>Education:</p><table style="width:100%;">`;
    while (processedText[line].indexOf('History') < 0) {
      bio += genTableRowHTML(processedText[line], 'Education');
      ++line;
    }
  }

  // Add character event log to bio
  bio += `</table><br><p>Career History:</p><table style="width:100%;">`;

  while (processedText[line].indexOf('\t') >= 0) {
    bio += genTableRowHTML(processedText[line], 'Term');
    ++line;
    if (processedText[line] === undefined) {
      break;
    }
  }
  bio += `</table><br>`;

  await actor.update({'data.bio' : bio});

  // Show new actor
  // console.log(actor);
  actor.sheet.render(true);
}

function genTableRowHTML(rowText, headerText) {
  if (rowText.indexOf('\t') < 0) {
    return ('');
  }

  let parsedLine = rowText.split('\t');
  let returnText = '<tr>';
  for (let i = 0; i < parsedLine.length; ++i) {
    if (parsedLine[0].indexOf(headerText) >= 0) {
      returnText +=
          '<th style="text-align:center">' + parsedLine[i].trim() + '</th>';
    } else {
      returnText +=
          '<td style="text-align:center">' + parsedLine[i].trim() + '</td>';
    }
  }
  returnText += '</tr>';
  return (returnText);
}
