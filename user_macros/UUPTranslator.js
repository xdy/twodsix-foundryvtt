// Simple UWP translator based on information from Cepheus Light, Cepheus Engine
// SRD and https://travellermap.com/doc/secondsurvey#uwp
// Updated for FVTT v13

translateCode('text', 'Enter UWP Code');
let value = '';
async function translateCode (type, text) {
  await foundry.applications.api.DialogV2.wait ({
    modal: true,
    window: {
      title: 'Input UWP Code',
      icon: 'fa-solid fa-globe'
    },
    content: `<table style="width:100%"><tr><th><label>${text}</label></th><td><input type="${
      type}" name="input"/></td></tr></table>`,
    buttons: [
      {
        action: 'Ok',
        label: 'Ok',
        callback: (_event, target) => {
          value = target.form.elements.input.value;
        },
        default: true
      }
    ],
    render: (_ev, app) => {
      app.querySelector("[name='input']").focus();
    },
    close: () => {
      Promise.resolve();
    }
  });

  if (value !== '') {
    let parse = parseCode(value);

    await new Promise((resolve) => {
      new foundry.applications.api.DialogV2({
        modal: true,
        window: {
          title: `UWP Translation for: ${value}`,
          icon: 'fa-solid fa-globe'
        },
        content:
          `<table style="width:100%;"><tbody><tr><th>Characteristic</th><th>Description</th></tr>${parse}</tbody></table>`,
        buttons: [
          {
            action: 'Ok',
            label: 'Ok',
            default: true,
            callback: () => {
              resolve();
            }
          }
        ]
      }).render(true);
    });
  }
}

function parseCode (profile) {
  // Strip out dash if used in profile
  profile = profile.replace('-', '');

  let UWPtables = [
    'Starport Type', 'World Size - CL', 'Atmosphere', 'Hydrographics',
    'Population', 'Government', 'Law Level - CL', 'Tech Level - CL'
  ];

  // parse starport, this is non-numeric
  let message = `<tr><td style="padding-right:5px">${UWPtables[0]} (${profile[0]})</td><td>${getStarportDescr(profile[0])}</td></tr>`;

  // process rest of UWP
  for (let i = 1; i < Math.min(profile.length, UWPtables.length); i++) {
    message += `<tr>${getUWPparameter(profile[i], UWPtables[i])}</tr>`;
  }

  // generate trade codes
  message += getTradeCodes(profile);
  return (message);
}

// Lookup a hex digit from a roll table
function getUWPparameter (inValue, tableName) {
  let item = hexToBase10(inValue);
  const table = game.tables.contents.find(t => t.name === tableName);
  if (item < table.results.size) {
    let details = table.results._source[item].text;
    return (`<td style="padding-right:5px">${tableName} (${inValue})</td><td>${details}</td>`);
  } else {
    return (`<td style="padding-right:5px">${tableName} (${inValue})</td><td>UNKNOWN TABLE ITEM</td>`);
  }
}

// Convert hex value to base10
function hexToBase10 (inValue) {
  switch (inValue.toUpperCase()) {
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
      return (Number(inValue));
  }
}

// Lookup starport description (letter values that are not hex)
function getStarportDescr (inValue) {
  let rtext = '';
  switch (inValue.toUpperCase()) {
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

  if (profile.length < 8) {
    rtext += 'UWP Code too short</td></tr>';
  } else {
    const size = hexToBase10(profile[1]);
    const atmo = hexToBase10(profile[2]);
    const hydro = hexToBase10(profile[3]);
    const pop = hexToBase10(profile[4]);
    const techL = hexToBase10(profile[7]);

    if (atmo > 3 && atmo < 10 && hydro > 3 && hydro < 9 && pop > 4 && pop < 8) {
      rtext += 'Ag - Agricultural, ';
    }

    if (size === 0 && atmo === 0 && hydro === 0) {
      rtext += 'Asteroid, ';
    }

    if (pop === 0) {
      rtext += 'Ba - Barren, ';
    }

    if (atmo > 1 && hydro === 0) {
      rtext += 'De - Desert, ';
    }

    if (atmo > 9 && hydro > 0) {
      rtext += 'Fl - Non-water Fluid Oceans, ';
    }

    if ((atmo === 5 || atmo === 6 || atmo === 8) && hydro > 3 && hydro < 10 && pop > 3 && pop < 9) {
      rtext += 'Ga - Garden, ';
    }

    if (pop > 8) {
      rtext += 'Hi - High Population, ';
    }

    if (techL > 11) {
      rtext += 'Ht - High Technology, ';
    }

    if (atmo < 2 && hydro > 0) {
      rtext += 'Ic - Ice Capped, ';
    }

    if ((atmo < 3 || atmo === 4 || atmo === 7 || atmo === 9) && pop > 8) {
      rtext += 'In - Industrial, ';
    }

    if (pop > 0 && pop < 4) {
      rtext += 'Lo - Low Population, ';
    }

    if (techL < 6) {
      rtext += 'Lt - Low Technology, ';
    }

    if (atmo < 4 && hydro < 4 && pop > 5) {
      rtext += 'Na - Non Agricultural, ';
    }

    if (pop > 3 && pop < 7) {
      rtext += 'Ni - Non Industrial, ';
    }

    if (atmo > 1 && atmo < 6 && hydro < 4) {
      rtext += 'Po - Poor, ';
    }

    if ((atmo === 6 || atmo === 8) && pop > 5 && pop < 9) {
      rtext += 'Ri - Rich, ';
    }

    if (hydro === 10) {
      rtext += 'Wa - Water World, ';
    }

    if (atmo === 0) {
      rtext += 'Va - Vacuum, ';
    }
    // Get rid of extra comma and space
    if (rtext.length > 0) {
      rtext = rtext.slice(0, -2);
    }

    rtext += '</td></tr>';
  }

  return (`<tr><td "padding-right:5px">Trade Codes</td><td>${rtext}`);
}
