// Simple subsector generator based on information from Cepheus Deluxe & Cepheus Deluxe Galaxy
// using the generator https://www.drivethrurpg.com/product/377266/Cepheus-Deluxe-Galaxy
// Fields used
// 1: Name
// 2: HexNbr
// 3-10: UWP
// 13: Bases
// 12: Zone
// 14: Gas Giants?
//Updated for FVTT v13

const gridSize = 115.47;

translateCode();

async function translateCode () {
  let topLabel = '';
  const value = await new Promise((resolve) => {
    new foundry.applications.api.DialogV2({
      modal: true,
      window: {
        title: 'Enter Subsector Text Block',
        icon: 'fa-solid fa-globe'
      },
      content: `<label>Enter subsector block</label><textarea type="text" name="input" cols="40" rows="5"></textarea>`,
      buttons: [
        {
          action: 'uwp',
          label: 'UWP',
          callback: (_event, target) => {
            resolve(target.form.elements.input.value);
            topLabel = 'UWP';
          }
        },
        {
          action: 'tradeCodes',
          label: 'Trade Codes',
          callback: (_event, target) => {
            resolve(target.form.elements.input.value);
            topLabel = 'Trade';
          }
        }
      ]
    }).render(true);
  });

  if (value !== '') {
    // parse input text block into lines
    const processedText = value.split('\n');

    const newNotes = [];
    let newDrawings = [];
    let newTiles = [];
    const maxX = 700;
    const maxY = 1000;

    // new journal entry
    const newJournal = await JournalEntry.create({
	    name: "New Subsector"
    });

    // add new journal entries, notes, and drawing text for each planet
    for (let i = 0; i < processedText.length; ++i) {
      const parse = parseCode(processedText[i]);
      const planetData = await newPlanet(parse, newJournal, topLabel);
      newNotes.push(planetData.note);
      newTiles = newTiles.concat(planetData.returnTiles);
      newDrawings = newDrawings.concat(planetData.returnDrawing);
    }

    Scene.create({
      name: 'Temp Scene',
      active: false,
      navigation: true,
      backgroundColor: '#000000',
      grid: {
        size: gridSize* Math.sqrt(3.0) / 2.0,
        type: CONST.GRID_TYPES.HEXEVENQ,
        color: '#c4c4c4'
      },
      notes: newNotes,
      drawings: newDrawings,
      initial: {x: Math.round(maxX / 2), y: Math.round(maxY / 2), scale: 0.8},
      tiles: newTiles,
      padding: 0.05,
      width: maxX,
      height: maxY
    });
  }
}

async function newPlanet (parse, newJournal, topLabel) {
  const addedPlanet = await newJournal.createEmbeddedDocuments("JournalEntryPage", [{
    name: parse.planetName,
    text: {
      content: parse.text
    }
  }]
  );

  // Calculate pixel position of items to display
  const lrgFontSize = 14;
  const smFontSize = lrgFontSize - 2;
  const iconSize = 36;
  const iconPos = getPixelFromHex(parse.col, parse.row);
  const yOffset = 0.5 * iconSize + 0.7 * lrgFontSize;

  // Pick top label to use
  let topText = '';
  if (topLabel === 'UWP') {
    topText = parse.UWP;
  } else {
    topText = parse.tCodes;
  }

  // Pick planet icon
  let planetIcon = 'systems/twodsix/assets/icons/Starport' + parse.UWP[0] + '.svg';
  if (parse.UWP[1] === '0') {
    planetIcon = 'systems/twodsix/assets/icons/asteroid-' + parse.UWP[0] + '.svg';
  }

  // generate note and drawing objects
  // add note and icon
  const returnNote = {
    entryId: newJournal.id,
    pageId: addedPlanet[0].id,
    text: '-',
    fontSize: smFontSize,
    textAnchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
    x: iconPos.x,
    y: iconPos.y,
    texture: {
      src: planetIcon,
      tint: parse.color,
    },
    iconSize: iconSize,
    width: smFontSize + 2,
    height: smFontSize + 2,
    strokeWidth: 0
  };

  // add color for Zone
  let zoneColor = '#ffffff';
  switch (parse.zone) {
    case 'A':
      zoneColor = '#cc9a06';
      break;
    case 'R':
      zoneColor = '#ff0000';
      break;
  }

  // add planet name
  const returnDrawing = [
    {
      x: Math.round(iconPos.x - measureText(parse.planetName, lrgFontSize)/2 - 1),
      y: Math.round(iconPos.y + yOffset - lrgFontSize/2 - 1),
      z: 20,
      text: abbreviatedName(parse.planetName),
      textColor: zoneColor,
      fontSize: lrgFontSize,
      shape: {
        width: measureText(parse.planetName, lrgFontSize) + 2,
        height: lrgFontSize + 2
      },
      strokeWidth: 0,
      strokeColor: "#000000"
    },

    // add UWP or trade codes
    {
      text: topText,
      x: Math.round(iconPos.x - measureText(topText, smFontSize)/2 - 1),
      y: Math.round(iconPos.y - yOffset - smFontSize/2 - 1),
      z: 20,
      shape: {
        width: measureText(topText, smFontSize) + 2,
        height: smFontSize + 2,
      },
      textColor: '#ffffff',
      fontSize: smFontSize,
      strokeWidth: 0,
      strokeColor: "#000000"
    }
  ];

  // add gas giant or base markers if applicable
  const returnTiles = [];
  for (let i = 0; i < parse.markers.length; ++i) {
    returnTiles.push({
      x: Math.round(iconPos.x + iconSize / 2 + smFontSize / 4),
      y: Math.round(iconPos.y + smFontSize * (i - 0.5 * parse.markers.length)),
      z: 20,
      width: smFontSize,
      height: smFontSize,
      texture: {
        tint: '#d6d6d6',
        src: 'systems/twodsix/assets/icons/' + getMarkerIcon(parse.markers[i])
      }
    });
  }

  // add planet icon again incase notes are turned off
  returnTiles.push({
    x: Math.round(iconPos.x - iconSize / 2),
    y: Math.round(iconPos.y - iconSize / 2),
    z: 20,
    width: iconSize,
    height: iconSize,
    texture: {
      tint: parse.color,
      src: planetIcon
    }
  });

  return ({ note: returnNote, returnDrawing: returnDrawing, returnTiles: returnTiles });
}

function getMarkerIcon (textSymbol) {
  switch (textSymbol) {
    case 'N':
	  return ('star-formation.svg');
    case 'P':
	  return ('pirate-skull.svg');
    case 'S':
	  return ('scout-ship.svg');
    case 'G':
	  return ('jupiter.svg');
    default:
	  return ('perspective-dice-six-faces-random.svg');
  }
}

function getPixelFromHex (col, row) {
  const width = gridSize;
  const sqrt3 = Math.sqrt(3.0);
  //Add +1 offset due to needing non-zero Padding
  const xPixel = Math.round((0.75 * (col + 1) + 0.5) * width);
  const yPixel = Math.round(((row + 1) + 0.5 * ((col + 1) & 1) + 0.5) * sqrt3 / 2.0 * width);

  return ({
    x: xPixel,
    y: yPixel
  });
}

function parseCode (profile) {
  const parsedLine = profile.split('\t');

  // Remove first element of array if a tab
  if (parsedLine[0] === '' || parsedLine[0] === '>') {
    parsedLine.shift();
  }

  const planetName = parsedLine[0].trim();
  const column = Number(parsedLine[1].substring(0, 2));
  const row = Number(parsedLine[1].substring(2, 4));

  const UWP = parsedLine.slice(2, 10).join('');
  const bases = parsedLine[12];
  let retZone = parsedLine[11][0];

  const UWPtables = [
    'Starport Type', 'World Size - CL', 'Atmosphere', 'Hydrographics',
    'Population', 'Government', 'Law Level - CL', 'Tech Level - CL'
  ];
  let planetDescrip = `<table style="width:100%;"><tbody><tr><th style="width:20%;">Characteristic</th><th style="width:70%;">Description</th></tr>`;
  // parse starport, this is non-numeric
  planetDescrip += `<tr><td style="padding-right:5px">${UWPtables[0]} (${UWP[0]})</td><td>${getStarportDescr(UWP[0])}</td></tr>`;

  // process rest of UWP
  for (let i = 1; i < Math.min(profile.length, UWPtables.length); i++) {
    planetDescrip += `<tr>${getUWPparameter(UWP[i], UWPtables[i])}</tr>`;
  }

  // generate trade codes
  const trData = getTradeCodes(UWP);
  planetDescrip += trData.text;
  planetDescrip += `</tbody></table>`;

  // set zone color
  if (retZone === ' ') {
    retZone = trData.zone;
  }

  // add base and gas giant codes
  const markers = [];
  if (parsedLine[13] === 'Y') {
    console.log("Found GG");
    markers.push('G');
  }
  switch (bases) {
    case 'N':
      markers.push('N');
      break;
    case 'S':
      markers.push('S');
      break;
    case 'P':
      markers.push('P');
      break;
    case 'A':
      markers.push('N');
      markers.push('S');
      break;
    case 'G':
      markers.push('S');
      markers.push('P');
      break;
  }

  return ({ planetName: planetName, col: column, row: row, UWP: UWP, text: planetDescrip, color: trData.color, tCodes: trData.tCodes, markers: markers, zone: retZone });
}

// Lookup a hex digit from a roll table
function getUWPparameter (value, tableName) {
  const item = hexToBase10(value);
  const table = game.tables.contents.find(t => t.name === tableName);

  if (item < table.results.size) {
    const details = table.results._source[item].text;
    return (`<td style="padding-right:5px">${tableName} (${value})</td><td>${details}</td>`);
  } else {
    return (`<td style="padding-right:5px">${tableName} (${value})</td><td>UNKNOWN TABLE ITEM</td>`);
  }
}

// Convert hex value to base10
function hexToBase10 (value) {
  switch (value.toUpperCase()) {
    case 'A':
	    return (10);
    case 'B':
	    return (11);
    case 'C':
	    return (12);
    case 'D':
	    return (13);
    case 'E':
	    return (14);
    case 'F':
	    return (15);
    case 'G':
	    return (16);
    default:
	    return (parseInt(value));
  }
}

// Lookup starport description (letter values that are not hex)
function getStarportDescr (value) {
  let rtext = '';
  switch (value.toUpperCase()) {
    case 'A':
      rtext =
      'Excellent Quality. Refined fuel and annual maintenance overhaul available. Shipyard capable of constructing starships and non-starships present.';
      break;
    case 'B':
      rtext =
      'Good Quality. Refined fuel and annual maintenance overhaul available. Shipyard capable of constructing non-starships present.';
      break;
    case 'C':
      rtext =
      'Routine Quality. Only unrefined fuel available. Reasonable repair facilities present.';
      break;
    case 'D':
      rtext =
      'Poor Quality. Only unrefined fuel available. No repair facilities present.';
      break;
    case 'E':
      rtext =
      'Frontier Installation. Essentially a marked spot of bedrock with no fuel, facilities, or bases present.';
      break;
    case 'X':
      rtext = 'No Starport. No provision is made for any ship landings.';
      break;
    default:
	    rtext = 'Unknown';
  }
  return (rtext);
}

// Generate Trade Codes per Cepheus Light Rules
function getTradeCodes (profile) {
  let rtext = '';
  let rCode = '';
  let rColor = '#ffffff';
  let zText = '';

  if (profile.length < 8) {
    rtext += 'UWP Code too short</td></tr>';
  } else {
    const size = hexToBase10(profile[1]);
    const atmo = hexToBase10(profile[2]);
    const hydro = hexToBase10(profile[3]);
    const pop = hexToBase10(profile[4]);
    const gov = hexToBase10(profile[5]);
    const law = hexToBase10(profile[6]);
    const techL = hexToBase10(profile[7]);

    if (atmo > 3 && atmo < 10 && hydro > 3 && hydro < 9 && pop > 4 && pop < 8) {
      rtext += 'Ag - Agricultural, ';
      rCode += 'Ag\xa0';
    }

    if (size === 0 && atmo === 0 && hydro === 0) {
      rtext += 'As - Asteroid, ';
      rCode += 'As\xa0';
    }

    if (pop === 0) {
      rtext += 'Ba - Barren, ';
      rCode += 'Ba\xa0';
      rColor = '#999999';
    }

    if (atmo > 1 && hydro === 0) {
      rtext += 'De - Desert, ';
      rCode += 'De\xa0';
      rColor = '#cc8800';
    }

    if (atmo > 9 && hydro > 0) {
      rtext += 'Fl - Non-water Fluid Oceans, ';
      rCode += 'Fl\xa0';
      rColor = '#ff6600';
    }

    if ((atmo === 5 || atmo === 6 || atmo === 8) && hydro > 3 && hydro < 10 && pop > 3 && pop < 9) {
      rtext += 'Ga - Garden, ';
      rCode += 'Ga\xa0';
      rColor = '#009900';
    }

    if (pop > 8) {
      rtext += 'Hi - High Population, ';
      rCode += 'Hi\xa0';
    }

    if (techL > 11) {
      rtext += 'Ht - High Technology, ';
      rCode += 'Ht\xa0';
    }

    if (atmo < 2 && hydro > 0) {
      rtext += 'Ic - Ice Capped, ';
      rCode += 'Ic\xa0';
      rColor = '#ccccff';
    }

    if ((atmo < 3 || atmo === 4 || atmo === 7 || atmo === 9) && pop > 8) {
      rtext += 'In - Industrial, ';
      rCode += 'In\xa0';
    }

    if (pop > 0 && pop < 4) {
      rtext += 'Lo - Low Population, ';
      rCode += 'Lo\xa0';
    }

    if (techL < 6) {
      rtext += 'Lt - Low Technology, ';
      rCode += 'Lt\xa0';
    }

    if (atmo < 4 && hydro < 4 && pop > 5) {
      rtext += 'Na - Non Agricultural, ';
      rCode += 'Na\xa0';
    }

    if (pop > 3 && pop < 7) {
      rtext += 'Ni - Non Industrial, ';
      rCode += 'Ni\xa0';
    }

    if (atmo > 1 && atmo < 6 && hydro < 4) {
      rtext += 'Po - Poor, ';
      rCode += 'Po\xa0';
    }

    if ((atmo === 6 || atmo === 8) && pop > 5 && pop < 9) {
      rtext += 'Ri - Rich, ';
      rCode += 'Ri\xa0';
    }

    if (hydro === 10) {
      rtext += 'Wa - Water World, ';
      rCode += 'Wa\xa0';
      rColor = '#3366cc';
    }

    if (atmo === 0) {
      rtext += 'Va - Vacuum, ';
      rCode += 'Va\xa0';
    }
    // Get rid of extra coma and space
    if (rtext.length > 0) {
	    rtext = rtext.slice(0, -2);
    }
    rtext += '</td></tr>';
    // get rid of extra comma
    if (rCode.length > 0) {
	    rCode = rCode.slice(0, -1);
    }

    if (atmo > 9 || (gov === 0 || gov === 7 || gov === 10) || (law === 0 || law > 8)) {
	    zText = 'A';
    }
  }

  return ({ text: `<tr><td "padding-right:5px">Trade Codes</td><td>${rtext}`, color: rColor, tCodes: rCode, zone: zText });
}

function abbreviatedName (planetName) {
  const parsedName = planetName.split(" ");

  if (parsedName.length > 1) {
    return parsedName[0] + "...";
  } else {
    return parsedName[0];
  }
}

//from https://www.codegrepper.com/code-examples/javascript/calculate+width+of+text+javascript
function measureText(str, fontSize = 10) {
  if (str.length === 0) {
    return "";
  }
  const widths = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.2796875,0.2765625,0.3546875,0.5546875,0.5546875,0.8890625,0.665625,0.190625,0.3328125,0.3328125,0.3890625,0.5828125,0.2765625,0.3328125,0.2765625,0.3015625,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.2765625,0.2765625,0.584375,0.5828125,0.584375,0.5546875,1.0140625,0.665625,0.665625,0.721875,0.721875,0.665625,0.609375,0.7765625,0.721875,0.2765625,0.5,0.665625,0.5546875,0.8328125,0.721875,0.7765625,0.665625,0.7765625,0.721875,0.665625,0.609375,0.721875,0.665625,0.94375,0.665625,0.665625,0.609375,0.2765625,0.3546875,0.2765625,0.4765625,0.5546875,0.3328125,0.5546875,0.5546875,0.5,0.5546875,0.5546875,0.2765625,0.5546875,0.5546875,0.221875,0.240625,0.5,0.221875,0.8328125,0.5546875,0.5546875,0.5546875,0.5546875,0.3328125,0.5,0.2765625,0.5546875,0.5,0.721875,0.5,0.5,0.5,0.3546875,0.259375,0.353125,0.5890625];
  const avg = 0.5279276315789471;
  return str
    .split('')
    .map(c => c.charCodeAt(0) < widths.length ? widths[c.charCodeAt(0)] : avg)
    .reduce((cur, acc) => acc + cur) * fontSize;
}
