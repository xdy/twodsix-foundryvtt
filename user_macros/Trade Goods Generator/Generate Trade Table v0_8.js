/* eslint-disable no-undef */
/* eslint-disable semi */
// Macro to generated trade goods pricing and quantities for sale based on
// planet UPP and a trader modier for skill attributes
// Updated for FVTT 0.8

const DEBUG = false; // Display debuggin info to console
const RANDOM = true; // Whether trade goods for player to buy are seelcted at random (true).  Otherwise, goods available are determined by trade codes.
generateTable();

async function generateTable () {
  let uwp = 0;
  let traderDM = 0;
  let compendium = '';
  await new Promise((resolve) => {
    new Dialog({
      content: `
      <input placeholder = "World UWP" type="text" name="uwp"/>
      <input placeholder = "Trader DM" type="number" name="traderDM"/>`,
      title: 'Generate Trade Table',
      buttons: {
        CE: {
          label: 'Cepheus Engine',
          callback: btn => {
            resolve(uwp = btn.find("[name='uwp']").val(),
              traderDM = btn.find("[name='traderDM']").val(),
              compendium = 'CE');
          }
        },
        CL: {
          label: 'Cepheus Light',
          callback: btn => {
            resolve(uwp = btn.find("[name='uwp']").val(),
              traderDM = btn.find("[name='traderDM']").val(),
              compendium = 'CL');
          }
        }
      }

    }).render(true);
  });

  const tcodes = getTradeCode(uwp);
  const starBase = uwp[0];
  if (traderDM === '') { traderDM = 0; }

  if (DEBUG) {
    console.log('Trade codes:', tcodes);
  }
  if (DEBUG) {
    console.log('UWP: ', uwp, traderDM);
  }

  let tradeTable = '';
  tradeTable +=
      processTradeTable('Advanced Trade Goods - ' + compendium, tcodes,
        parseInt(traderDM), compendium, starBase);

  tradeTable += processTradeTable('Basic Goods - ' + compendium, tcodes,
    parseInt(traderDM), compendium, starBase);

  await new Promise((resolve) => {
    new Dialog({
      modal: false,
      title: `Trade Table for: ${uwp}`,
      content: `<table><tbody><tr>
      <th style="text-align:left">Good</th>
      <th style="text-align:center">Available to Buy (tons)</th>
      <th style="text-align:center">Player Buys (Cr)</th>
      <th style="text-align:center">Player Sells (Cr)</th></tr>
      ${tradeTable}
      </tbody></table>`,

      buttons: {
        Ok: {
          label: 'Ok',
          callback: (html) => { resolve(html.find('input').val()); },
          height: '12px'
        }
      }
    },
    { width: 700, height: 600 })
      .render(true);
  });
}

function processTradeTable (tableName, trcodes, offset, compendium, starBase) {
  let returnText = '';
  let isAvailable = [];
  const table = game.tables.contents.find(t => t.name === tableName);

  // If random selection, determine trade goods available
  if (tableName.indexOf('Basic') === -1 && RANDOM) {
    isAvailable = determineGoods(table, compendium, starBase);
  }
  if (DEBUG) {
    console.log(isAvailable);
  }

  // Process each item (good) in table
  for (let row = 0; row < table.data.results.size; ++row) {
    // Parse row of table that is tab delimited
    const details = table.data.results._source[row].text.split('\t');

    let tons = 0;
    let pSellPr = 0;
    let pBuyPr = 0;
    let pBuyMod = 0;
    let pSellMod = 0;

    // Determine planet trade code price DM's
    switch (compendium) {
      case 'CL':
        pSellMod = getMod(trcodes, details[4]);
        pBuyMod = getMod(trcodes, details[3]);
        break;
      case 'CE':
        pSellMod = getMod(trcodes, details[4]) - getMod(trcodes, details[3]);
        pBuyMod = getMod(trcodes, details[3]) - getMod(trcodes, details[4]);
        break;
    }

    if (DEBUG) {
      console.log('Name: ', details[0]);
    }
    if (DEBUG) {
      console.log('pSellMod:', pSellMod);
    }
    if (DEBUG) {
      console.log('pBuyMod:', pBuyMod);
    }

    // Determine tons available for player to buy
    if (RANDOM) {
      tons = new Roll('@dice', { dice: details[2] }).evaluate().total;
      if (tableName.indexOf('Basic') === -1) {
        tons *= isAvailable[row];
      }
    } else {
      if ((tableName.indexOf('Basic') !== -1) ||
          (availableGood(trcodes, details[3]))) {
        tons = new Roll('@dice', { dice: details[2] }).evaluate().total;
      }
    }

    // Determine Player Buys price
    if (tons === 0) {
      tons = '---';
      pBuyPr = '---';
    } else {
      pBuyPr = Math.round(details[1] * rollPriceAdjust(pBuyMod + offset, 'buy', compendium));
    }

    // Determine Player Sells price
    pSellPr = Math.round(
      details[1] * rollPriceAdjust(pSellMod + offset, 'sell', compendium));

    // generate buy-sell table row in html
    if (row === table.data.results.size - 1) {
      returnText +=
          `<tr style="border-bottom:1px solid red"><td style="padding-right:5px">${details[0]}</td>`;
    } else {
      returnText += `<tr><td style="padding-right:5px">${details[0]}</td>`;
    }

    returnText += `<td style="padding-right:5px; text-align:center">${tons}</td>
    <td style="padding-right:5px; text-align:center">${pBuyPr}</td><td style="padding-right:5px; text-align:center">${pSellPr}</td></tr>`;
  }

  return (returnText);
}

function determineGoods (table, compendium, starBase) {
  const numItems = table.data.results.size;
  // fill with zeros
  const availList = new Uint8Array(numItems);

  let baseAdj = 0;

  // Calculate starport roll bonus if Cepheus Light
  if (compendium === 'CL') {
    switch (starBase.toUpperCase()) {
      case 'A':
        baseAdj = 4;
        break;
      case 'B':
        baseAdj = 2;
        break;
      case 'C':
        baseAdj = 1;
        break;
      case 'D':
        baseAdj = 0;
        break;
      case 'E':
        baseAdj = -2;
        break;
    }
  }

  let numDraws = new Roll('1D6+@adj', { adj: baseAdj }).evaluate({ async: false }).total;
  if (DEBUG) {
    console.log('Number of Draws: ', numDraws);
  }

  if (numDraws < 1) {
    numDraws = 1;
  }

  for (let i = 0; i < numDraws; ++i) {
    const item = new Roll('1D@num', { num: numItems }).evaluate({ async: false }).total;
    ++availList[item - 1];
  }
  return (availList);
}

function getMod (planetTrCodes, goodCodes) {
  let modifier = 0;
  for (const code of planetTrCodes) {
    const codePos = goodCodes.indexOf(code);
    if (codePos !== -1) {
      const codeValue = goodCodes[codePos + 3];
      if (codeValue > modifier) {
        modifier = codeValue;
      }
    }
  }
  return (parseInt(modifier));
}

function rollPriceAdjust (offset, type, compendium) {
  let tableName = '';
  if (type === 'sell') {
    tableName += 'Sales Price Table';
  } else {
    tableName += 'Purchase Price Table';
  }
  tableName += ` - ${compendium}`;

  if (DEBUG) {
    console.log('Price Adjustment Table: ', tableName);
  }

  const table = game.tables.contents.find(t => t.name === tableName);

  const r = new Roll('2D6+@mod', { mod: offset }).evaluate({ async: false }).total;
  const details =
      table.data.results._source[Math.min(Math.max(r - 2, 0), table.data.results.size - 1)].text;

  if (DEBUG) {
    console.log('Roll on Adj Table: ', r);
  }
  if (DEBUG) {
    console.log('Relative Price: ', details);
  }
  return (parseInt(details) / 100);
}

function availableGood (trcodes, goodCodes) {
  for (const code of trcodes) {
    if (goodCodes.indexOf(code) !== -1) {
      return true;
    }
  }
  return false;
}

// Generate Trade Codes per Cepheus Light Rules
function getTradeCode (UWPprofile) {
  const returnText = [];

  // Strip out dash if used in profile
  UWPprofile = UWPprofile.replace('-', '');

  if (UWPprofile.length > 7) {
    const size = hexToBase10(UWPprofile[1]);
    const atmo = hexToBase10(UWPprofile[2]);
    const hydro = hexToBase10(UWPprofile[3]);
    const pop = hexToBase10(UWPprofile[4]);
    const techL = hexToBase10(UWPprofile[7]);

    if (atmo > 3 && atmo < 10 && hydro > 3 && hydro < 9 && pop > 4 && pop < 8) {
      returnText.push('Ag');
    }

    if (size === 0 && atmo === 0 && hydro === 0) {
      returnText.push('As');
    }

    // Different for CE
    if (pop === 0) {
      returnText.push('Ba');
    }

    if (atmo > 1 && hydro === 0) {
      returnText.push('De');
    }

    if (atmo > 9 && hydro > 0) {
      returnText.push('Fl');
    }

    if ((atmo === 5 || atmo === 6 || atmo === 8) && hydro > 3 && hydro < 10 &&
        pop > 3 && pop < 9) {
      returnText.push('Ga');
    }

    if (pop > 8) {
      returnText.push('Hi');
    }

    if (techL > 11) {
      returnText.push('Ht');
    }

    if (atmo < 2 && hydro > 0) {
      returnText.push('Ic');
    }

    if ((atmo < 3 || atmo === 4 || atmo === 7 || atmo === 9) && pop > 8) {
      returnText.push('In');
    }

    if (pop > 0 && pop < 4) {
      returnText.push('Lo');
    }

    if (techL < 6) {
      returnText.push('Lt');
    }

    if (atmo < 4 && hydro < 4 && pop > 5) {
      returnText.push('Na');
    }

    if (pop > 3 && pop < 7) {
      returnText.push('Ni');
    }

    if (atmo > 1 && atmo < 6 && hydro < 4) {
      returnText.push('Po');
    }

    if ((atmo === 6 || atmo === 8) && pop > 5 && pop < 9) {
      returnText.push('Ri');
    }

    if (hydro === 10) {
      returnText.push('Wa');
    }

    if (atmo === 0) {
      returnText.push('Va');
    }
  }
  return (returnText);
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
      return (Number(value));
  }
}
