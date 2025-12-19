// Twodsix Ship Statblock Import Macro
// Paste a statblock in the prompt and this macro will create a TwodsixActor ship with components.

// Prompt for statblock input using DialogV2.input
const statblockResult = await foundry.applications.api.DialogV2.input({
  window: { title: "Import Ship Statblock", icon: "fa-solid fa-ship" },
  content: `<p>Paste the ship statblock below:</p><textarea name="statblock" style="width:100%;height:200px;"></textarea>`,
  ok: { label: "Import" },
  cancel: { label: "Cancel" }
});
const statblock = statblockResult?.statblock;
if (!statblock) {
  return ui.notifications.warn("Import cancelled.");
}


// === CONSTANTS & HELPERS ===
// Helper: Preprocess the raw statblock text so all field labels start on their own line, and normalize whitespace
function preprocessStatblock(rawText) {
  let text = rawText;
  // Normalize CRLF/CR to LF to stabilize parsing across sources
  text = text.replace(/\r\n?/g, '\n');
  // Insert a newline before any field label (from FIELD_LABELS) that is not already at the start of a line
  const labelPattern = new RegExp(`([^\n])\\s*(${FIELD_LABELS.map(escapeRegex).join('|')})`, 'g');
  text = text.replace(labelPattern, '$1\n$2');
  // Remove accidental double newlines and trim lines
  text = text.replace(/\n{2,}/g, '\n');
  text = text.split('\n').map(line => line.trimEnd()).join('\n');
  return text;
}
// Helper: Extract a field from statblock text using a regex and optional transform
function extractField(text, regex, transform) {
  const match = text.match(regex);
  if (!match) {
    return undefined;
  }
  return transform ? transform(match) : match[1];
}
// Helper: Create and push a component to the items array if value is present
function addComponent(itemsToAdd, valueOrObj, compName, subtype, extra = {}) {
  // If called with an object (for backward compatibility)
  if (typeof valueOrObj === 'object' && valueOrObj !== null && !Array.isArray(valueOrObj)) {
    const { name: componentName, type = "component", system = {} } = valueOrObj;
    if (!componentName || typeof componentName !== "string" || !componentName.trim()) {
      return;
    }
    itemsToAdd.push({ name: componentName.trim(), type, system });
    return;
  }
  // If called with value, name, subtype, extra
  // Only add quantity for countable subtypes
  const countable = [
    'accomodations', 'mount', 'armament', 'ammo', 'cargo', 'fuel', 'vehicle', 'drone', 'storage', 'otherInternal', 'stateroom', 'cryoberth', 'low berth', 'escape pod'
  ];
  const qty = Number.isInteger(valueOrObj) ? valueOrObj : parseInt(valueOrObj, 10);
  if (countable.includes(subtype)) {
    if (Number.isInteger(qty) && qty > 0) {
      itemsToAdd.push({
        name: compName,
        type: "component",
        system: { subtype, ...extra, availableQuantity: qty, quantity: qty }
      });
    } else {
      // Log skipped item for debugging
      console.warn("Skipped item due to invalid quantity:", {
        name: compName,
        value: valueOrObj,
        parsedQty: qty,
        subtype,
        extra
      });
      ui.notifications?.warn(`Skipped item: ${compName} (value: ${valueOrObj}, parsedQty: ${qty})`);
    }
  } else {
    // For non-countable items, add with no quantity fields, or default to 1 if schema requires
    itemsToAdd.push({
      name: compName,
      type: "component",
      system: { subtype, ...extra }
    });
  }
}
// Field labels used throughout macro
const FIELD_LABELS = [
  'Tonnage:', 'Armor:', 'Maneuver:', 'Jump:', 'P-Plant:', 'Fuel:', 'Computer:', 'Cost:', 'Armament:', 'Fittings:', 'Crew:'
];

// Non-weapon terms for filtering
const NON_WEAPON_TERMS_LIST = [
  'fittings', 'gunners', 'crew', 'troops', 'marines', 'stateroom', 'berth', 'pod', 'processor', 'armory', 'cargo',
  'engineer', 'medic', 'operator', 'co', 'captain', 'escape', 'magazine', 'space'
];

// Weapon keywords for filtering
const WEAPON_KEYWORDS = /laser|missile|cannon|gun|railgun|plasma|particle|sand|fusion|gauss|autocannon|beam|pulse|torpedo|barbette|spinal/i;

// Helper: escape regex special chars
function escapeRegex(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Helper: Parse an entry like "3x Name" or "3 Name" or just "Name" into { name, quantity }
function parseQtyName(input) {
  if (!input || typeof input !== 'string') {
    return { name: '', quantity: 0 };
  }
  // Match quantity at start or after whitespace, but not decimals
  const m = input.match(/^(?:\s*)?(\d+)(?!\.)x?\s*(.+)/i);
  if (m) {
    return { name: m[2].trim(), quantity: Number(m[1]) || 1 };
  }
  // Also match "Name" only
  const parsedName = input.trim();
  return { name: parsedName, quantity: parsedName ? 1 : 0 };
}
// Inline assertions (comments):
// console.assert(JSON.stringify(parseQtyName('3x Laser')) === JSON.stringify({ name: 'Laser', quantity: 3 }));
// console.assert(JSON.stringify(parseQtyName('2 Laser')) === JSON.stringify({ name: 'Laser', quantity: 2 }));
// console.assert(JSON.stringify(parseQtyName('Laser')) === JSON.stringify({ name: 'Laser', quantity: 1 }));
// console.assert(JSON.stringify(parseQtyName('2x Fuel Processor (20 tons/day)')) === JSON.stringify({ name: 'Fuel Processor (20 tons/day)', quantity: 2 }));
// console.assert(JSON.stringify(parseQtyName('64.5 tons of cargo space')) === JSON.stringify({ name: '64.5 tons of cargo space', quantity: 1 }));

// Regexes built from constants
const statblockFieldRegex = new RegExp(`^(${FIELD_LABELS.map(escapeRegex).join('|')})`, 'i');
const nonWeaponTerms = new RegExp(NON_WEAPON_TERMS_LIST.join('|'), 'i');
// Do not consume content inside parentheses when stripping trailing non-weapon descriptors
const trailingNonWeaponWords = new RegExp(`\\b(?:${NON_WEAPON_TERMS_LIST.join('|')})s?\\b[^()]*$`, 'i');

// Helper: Parse weapons and hardpoints from armament string (extracted from parser for clarity)
function parseWeaponsAndHardpoints(armament) {
  const weapons = [];
  const hardpoints = [];
  if (!armament) {
    return { weapons, hardpoints };
  }
  function cleanWeaponNamePreserveParens(rawName) {
    if (!rawName) {
      return rawName;
    }
    const parenMatch = rawName.match(/\s*(\([^)]*\))\s*$/);
    const parenSuffix = parenMatch ? ` ${parenMatch[1]}` : '';
    const base = rawName.replace(/\s*\([^)]*\)\s*$/, '');
    const cleanedBase = base.replace(trailingNonWeaponWords, '').trim();
    return `${cleanedBase}${parenSuffix}`.trim();
  }
  let armamentRemainder = armament;
  const turretRegex = /(\d+)x?\s*([\w\s]+turrets?):\s*([^;]+)/gi;
  let turretMatch;
  while ((turretMatch = turretRegex.exec(armamentRemainder)) !== null) {
    const turretCount = Number(turretMatch[1]) || 1;
    const turretType = turretMatch[2].trim();
    const turretContents = turretMatch[3];
    for (let i = 0; i < turretCount; i++) {
      hardpoints.push({ name: turretType, quantity: 1 });
    }
    turretContents.split(/[,;]/).forEach(w => {
      const { name: wName, quantity } = parseQtyName(w);
      if (!wName) {
        return;
      }
      for (let i = 0; i < turretCount; i++) {
        weapons.push({ name: wName, quantity: quantity || 1 });
      }
    });
    armamentRemainder = armamentRemainder.replace(turretMatch[0], "");
  }
  armamentRemainder.split(/[;,]/).forEach(w => {
    const { name: wName, quantity } = parseQtyName(w);
    if (!wName) {
      return;
    }
    weapons.push({ name: wName, quantity: quantity || 1 });
  });
  for (let i = weapons.length - 1; i >= 0; i--) {
    weapons[i].name = cleanWeaponNamePreserveParens(weapons[i].name);
    if (!WEAPON_KEYWORDS.test(weapons[i].name) || nonWeaponTerms.test(weapons[i].name) || weapons[i].name.length < 2) {
      weapons.splice(i, 1);
    }
  }
  return { weapons, hardpoints };
}

// Helper: Parse fittings from fittings string (extracted for clarity)
function parseFittings(fittings, escapePods) {
  const fittingsArr = [];
  if (!fittings) {
    return fittingsArr;
  }
  fittings.split(/,/).forEach(f => {
    let qn = parseQtyName(f);
    let componentName = qn.name;
    // Special handling for armory for N marines
    let armoryMatch = f.match(/armory for (\d+) marines?/i);
    if (armoryMatch) {
      fittingsArr.push({ name: 'Armory', quantity: parseInt(armoryMatch[1], 10), subtype: mapComponentType('armory') });
      return;
    }
    // Special handling for escape pods
    let escapePodsMatch = f.match(/(\d+)\s*escape pods?/i);
    if (escapePodsMatch) {
      fittingsArr.push({ name: 'Escape Pods', quantity: parseInt(escapePodsMatch[1], 10), subtype: mapComponentType('escape pod') });
      return;
    }
    // Special handling for staterooms
    let stateroomsMatch = f.match(/(\d+)\s*staterooms?/i);
    if (stateroomsMatch) {
      fittingsArr.push({ name: 'Staterooms', quantity: parseInt(stateroomsMatch[1], 10), subtype: mapComponentType('stateroom') });
      return;
    }
    // Special handling for cryoberths
    let cryoberthsMatch = f.match(/(\d+)\s*cryoberths?/i);
    if (cryoberthsMatch) {
      fittingsArr.push({ name: 'Cryoberths', quantity: parseInt(cryoberthsMatch[1], 10), subtype: mapComponentType('cryoberth') });
      return;
    }
    // Special handling for emergency low berths
    let lowBerthsMatch = f.match(/(\d+)\s*emergency low berths?/i);
    if (lowBerthsMatch) {
      fittingsArr.push({ name: 'Emergency Low Berths', quantity: parseInt(lowBerthsMatch[1], 10), subtype: mapComponentType('low berth') });
      return;
    }

    // Special handling for fuel processor: "fuel processor (N t/day)" or similar
    let fuelProcMatch = f.match(/fuel processor/i);
    if (fuelProcMatch) {
      let fuelProcQty = parseQtyName(f);
      if (fuelProcQty.quantity && fuelProcQty.quantity > 0) {
        fittingsArr.push({ name: 'Fuel Processor', quantity: fuelProcQty.quantity, subtype: mapComponentType('fuel processor') });
        return;
      }
      // If no valid quantity, skip adding Fuel Processor
      return;
    }

    // Combine all skip conditions for clarity
    if (
      /cargo\b|cargo space/i.test(componentName) ||
      /missile magazine/i.test(componentName) ||
      /^(crew|scientist|pilot|engineer|medic|operator|total|sensor operator|cost|construction time)/i.test(componentName) ||
      !componentName || componentName.toLowerCase() === 'x' ||
      /^\d+(?:\.\d+)?$/.test(componentName) ||
      /([\d.]+)\s*tons?(?:\s+of)?\s+(?:cargo|cargo space)/i.test(f)
    ) {
      return;
    }
    let subtype = mapComponentType(componentName);
    if (componentName && qn.quantity && qn.quantity > 0) {
      fittingsArr.push({ name: componentName, quantity: qn.quantity, subtype });
    }
  });
  return fittingsArr;
}

// Helper: Parse title line to extract TL, ton string, and cleaned name
// Expects format: TL# #-TON Name (ton string preserved in returned name)
function parseTitleLine(title) {
  const result = { name: title, techLevel: undefined, titleTonnage: undefined, titleTonnageStr: undefined };
  if (!title || typeof title !== 'string') {
    return result;
  }
  // Strict pattern: TL# <ton-string> <rest-of-name>
  // ton-string examples: "200-TON", "200 TON", "200-ton"
  const m = title.match(/^\s*TL\s*#?(\d+)\s+(\d+(?:\s*[-]?\s*ton(?:s)?)?)\s+(.*)$/i);
  if (!m) {
    return result;
  }
  result.techLevel = Number(m[1]);
  result.titleTonnageStr = m[2].trim();
  const tn = result.titleTonnageStr.match(/(\d+)/);
  if (tn) {
    result.titleTonnage = Number(tn[1]);
  }
  // Preserve ton-string in name: e.g., '200-TON TRADER'
  result.name = `${result.titleTonnageStr} ${m[3].trim()}`.trim();
  return result;
}

// Simple assertions (comments):
// parseTitleLine('TL11 200-TON TRADER') => { name: '200-TON TRADER', techLevel:11, titleTonnage:200 }
// parseTitleLine('TL6 STAR RUNNER') => no match (returns original name)
// console.assert(parseTitleLine('TL11 200-TON TRADER').techLevel === 11);
// console.assert(parseTitleLine('TL11 200-TON TRADER').titleTonnage === 200);
// console.assert(parseTitleLine('TL11 200-TON TRADER').name === '200-TON TRADER');


// Helper: extract number after 'MCr' (or any number)
function extractMCrNumber(str) {
  if (!str) {
    return undefined;
  }
  const costMatch = str.match(/MCr\s*([\d.]+)/i);
  if (costMatch) {
    return costMatch[1];
  }
  const numMatch = str.match(/([\d.]+)/);
  if (numMatch) {
    return numMatch[1];
  }
  return undefined;
}

// --- Parsing utility ---
function parseShipStatblock(text) {
  // Extract ship name as all lines up to the first recognized field (e.g., Tonnage, Armor, etc.)
  // This supports multi-line names

  // Improved extraction for ALL-CAPS multi-line name and description
  let shipName = "Unnamed Ship";
  let shipDescription = "";
  let statblockStartIdx = 0;
  // 1. Extract all-caps name block (allowing for multi-line)
  const lines = text.split(/\r?\n/);
  let nameLines = [];
  let idx = 0;
  // Collect consecutive ALL-CAPS lines (allowing numbers, dashes, spaces)
  while (idx < lines.length && /^[A-Z0-9\- ]+$/.test(lines[idx].trim()) && lines[idx].trim().length > 0) {
    nameLines.push(lines[idx].trim());
    idx++;
  }
  if (nameLines.length > 0) {
    shipName = nameLines.join(' ').replace(/\s+/g, ' ').trim();
  }
  // Parse TL / title tonnage from the name and clean the returned name
  let techLevel;
  let titleTonnage;
  const titleParsed = parseTitleLine(shipName);
  if (titleParsed) {
    techLevel = titleParsed.techLevel;
    titleTonnage = titleParsed.titleTonnage;
    shipName = titleParsed.name;
  }
  // 2. Skip blank lines after name
  while (idx < lines.length && lines[idx].trim() === "") {
    idx++;
  }
  // 3. Collect description lines until a statblock field is found
  let descLines = [];
  while (idx < lines.length && !statblockFieldRegex.test(lines[idx].trim())) {
    descLines.push(lines[idx]);
    idx++;
  }
  if (descLines.length > 0) {
    shipDescription = descLines.join(' ').replace(/\s+/g, ' ').trim();
  }
  // 4. The rest is the statblock
  statblockStartIdx = idx;
  const statblockText = lines.slice(statblockStartIdx).join('\n');
  // Now parse fields from statblockText only
  let tonnage = Number(extractField(statblockText, /Tonnage:\s*(\d+)/i));
  // If no explicit Tonnage field but title contained one, use it
  if ((!tonnage || isNaN(tonnage)) && titleTonnage) {
    tonnage = Number(titleTonnage);
  }
  // Build a regex to match any field label from FIELD_LABELS (escaped, without trailing colon)
  const fieldLabelPattern = FIELD_LABELS.map(l => escapeRegex(l.replace(/:$/, '')) + ":").join("|");
  let armor = extractField(
    statblockText,
    new RegExp(`Armor:\\s*([\\s\\S]*?)(?=;|\\n|${fieldLabelPattern}|$)`, 'i'),
    m => m[1]?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  );
  if (armor && /^(none|no|n\/a)$/i.test(armor)) {
    armor = undefined;
  }
  const maneuver = Number(extractField(statblockText, /Maneuver:\s*(\d+)[- ]*G/i));
  const jump = Number(extractField(statblockText, /Jump:\s*(\d+)/i));
  const powerPlant = extractField(statblockText, /P-Plant:\s*Rating\s*(\d+)/i);
  const fuel = Number(extractField(statblockText, /Fuel:\s*(\d+)/i));
  const computer = extractField(statblockText, /Computer:\s*([^;]+)/i, m => m[1]?.replace(/\n/g, ' ').trim());
  let cost = extractField(statblockText, /Cost:\s*([^;]+)/i, m => m[1]?.replace(/\n/g, ' ').trim());
  cost = extractMCrNumber(cost);
  // Armament: capture up to Fittings or Crew or end of line
  let armament = extractField(statblockText, /Armament:\s*([\s\S]*?)(?:Fittings:|Crew:|$)/i, m => m[1].replace(/\n/g, ' ').trim());
  // Ignore placeholders like 'reserved for weapon systems'
  if (armament && /reserved for weapon systems|reserved for weapons|reserved for armament/i.test(armament)) {
    armament = undefined;
  }
  // Capture multiline fittings up to the next label (Crew/Cost/Construction Time) or end
  const fittings = extractField(
    statblockText,
    /Fittings:\s*([\s\S]*?)(?:Crew:|Cost:|Construction Time:|$)/i,
    m => m[1]?.replace(/\n/g, ' ').trim()
  );
  const crew = extractField(statblockText, /Crew:\s*([^\n]+)/i, m => m[1]?.trim());
  const staterooms = Number(extractField(statblockText, /(\d+)x?staterooms?/i));
  const cryoberths = Number(extractField(statblockText, /(\d+)x?cryoberths?/i));
  const lowBerths = Number(extractField(statblockText, /(\d+)x?emergency low berths?/i));
  // Match both 'missile magazine (N missiles)' and 'magazine (N missiles)'
  let magazineQty = 1; // Default to 1 if not found
  let magazineMatch = statblockText.match(/(?:missile\s+magazine|magazine)\s*\((\d+)\s*missiles?\)/i);
  if (magazineMatch && magazineMatch[1]) {
    magazineQty = parseInt(magazineMatch[1], 10);
    if (isNaN(magazineQty) || magazineQty < 1) {
      magazineQty = 1;
    }
  } else {
    // Try to extract any number before 'missiles' in parentheses
    let fallbackMatch = statblockText.match(/\((\d+)\s*missiles?\)/i);
    if (fallbackMatch && fallbackMatch[1]) {
      magazineQty = parseInt(fallbackMatch[1], 10);
      if (isNaN(magazineQty) || magazineQty < 1) {
        magazineQty = 1;
      }
    }
  }
  const escapePods = Number(extractField(statblockText, /(\d+)x?escape pods?/i));
  const armory = extractField(statblockText, /armory for (\d+) marines?/i);
  const fuelProcessor = extractField(statblockText, /fuel processor \(([^)]+)\)/i);
  const cargo = Number(extractField(statblockText, /([\d.]+)\s*tons? of cargo/i));

  // Weapons and hardpoints parsing (delegated to helper)
  const { weapons, hardpoints } = parseWeaponsAndHardpoints(armament);
  // Fittings parsing (delegated to helper)
  const fittingsArr = parseFittings(fittings, escapePods);
  return {
    name: shipName,
    description: shipDescription,
    tonnage, armor, maneuver, jump, powerPlant, fuel, computer, cost, weapons, hardpoints, fittings: fittingsArr, crew,
    staterooms, cryoberths, lowBerths, magazineQty, escapePods, armory, fuelProcessor, cargo,
    techLevel
  };
}

// --- Helper: Map component type from name (table-driven, ordered) ---
const COMPONENT_MAP = [
  { pattern: /\b(escape pods?|escape pod)\b/i, subtype: 'otherInternal' },
  { pattern: /\b(cryoberths?|cryoberth|staterooms?|stateroom)\b/i, subtype: 'accomodations' },
  { pattern: /\b(emergency low berths?|low berth|low berths?)\b/i, subtype: 'accomodations' },
  { pattern: /\b(m[- ]?drive|maneuver)\b/i, subtype: 'drive' },
  { pattern: /\b(j[- ]?drive|jump)\b/i, subtype: 'drive' },
  { pattern: /\b(power ?plant|p-plant)\b/i, subtype: 'power' },
  { pattern: /\b(computer)\b/i, subtype: 'computer' },
  { pattern: /\b(armor)\b/i, subtype: 'armor' },
  { pattern: /\b(hull)\b/i, subtype: 'hull' },
  { pattern: /\b(missile|laser|cannon|gun|railgun|plasma|fusion|beam|pulse|torpedo|autocannon|meson|particle|sandcaster)\b/i, subtype: 'armament' },
  { pattern: /\b(turret|hardpoint|mount)\b/i, subtype: 'mount' },
  { pattern: /\b(magazine)\b/i, subtype: 'magazine' },
  { pattern: /\b(armory)\b/i, subtype: 'otherInternal' },
  { pattern: /\b(fuel processor|fuel purification|fuel system)\b/i, subtype: 'fuel' },
  { pattern: /\b(cargo|cargo space)\b/i, subtype: 'cargo' },
  { pattern: /\b(sensor|sensors?)\b/i, subtype: 'sensor' },
  { pattern: /\b(shield|shields?)\b/i, subtype: 'shield' },
  { pattern: /\b(drone|drones?)\b/i, subtype: 'drone' },
  { pattern: /\b(vehicle|gig|dropship)\b/i, subtype: 'vehicle' },
  { pattern: /\b(software)\b/i, subtype: 'software' },
  { pattern: /\b(electronics?)\b/i, subtype: 'electronics' },
  { pattern: /\b(bridge)\b/i, subtype: 'bridge' },
  { pattern: /\b(dock)\b/i, subtype: 'dock' },
  { pattern: /\b(storage|storage space)\b/i, subtype: 'storage' }
];

function mapComponentType(componentName) {
  if (!componentName || typeof componentName !== 'string') {
    return 'otherInternal';
  }
  for (const { pattern, subtype } of COMPONENT_MAP) {
    if (pattern.test(componentName)) {
      return subtype;
    }
  }
  return 'otherInternal';
}

// Quick assertions (examples; left as comments for maintainers)
// console.assert(mapComponentType('Cryoberth') === 'accomodations');
// console.assert(mapComponentType('Escape Pods') === 'otherInternal');
// console.assert(mapComponentType('M-Drive 3G') === 'drive');


// --- Main import logic ---
// --- Preprocessing ---
const parsed = parseShipStatblock(preprocessStatblock(statblock));
if (!parsed.name || !parsed.tonnage) {
  return ui.notifications.error("Failed to parse ship name or tonnage. Please check the statblock format.");
}

// Create the ship actor
const actorData = {
  name: parsed.name,
  type: "ship",
  system: {
    deckPlan: "",
    crew: {},
    crewLabel: {},
    cargo: "",
    financeNotes: "",
    maintenanceCost: "0",
    mortgageCost: "0",
    shipValue: parsed.cost ? String(parsed.cost) : "0",
    techLevel: parsed.techLevel ? Number(parsed.techLevel) : 0,
    isMassProduced: false,
    commonFunds: 0,
    financeValues: { cash: 0 },
    reqPower: {
      systems: 0, "m-drive": 0, "j-drive": 0, sensors: 0, weapons: 0
    },
    weightStats: {
      systems: 0, cargo: parsed.cargo ? Number(parsed.cargo) : 0, fuel: parsed.fuel ? Number(parsed.fuel) : 0, vehicles: 0, available: 0
    },
    shipPositionActorIds: {},
    shipStats: {
      hull: { value: Number(parsed.tonnage), max: Number(parsed.tonnage), min: 0 },
      fuel: { value: parsed.fuel ? Number(parsed.fuel) : 0, max: parsed.fuel ? Number(parsed.fuel) : 0, min: 0, isRefined: true },
      power: { value: 0, max: 0, min: 0 },
      armor: {
        name: parsed.armor || "",
        weight: "",
        cost: "",
        value: 0,
        max: 0,
        min: 0
      },
      mass: { value: 0, max: 0, min: 0 },
      fuel_tanks: { name: "", weight: "", cost: "" },
      drives: {
        overdrive: false,
        jDrive: { rating: parsed.jump ? Number(parsed.jump) : 0 },
        mDrive: { rating: parsed.maneuver ? Number(parsed.maneuver) : 0 }
      },
      bandwidth: { value: 0, max: 0, min: 0 }
    },
    combatPosition: 0,
    characteristics: { morale: { value: 7, max: 0, min: 0 } },
    notes: parsed.description || ""
  }
};
const shipActor = await Actor.create(actorData);

// Prepare items/components
const items = [];

addComponent(items, parsed.tonnage, `Hull (${parsed.tonnage} tons)`, mapComponentType("hull"), { weight: String(parsed.tonnage), isBaseHull: true });
// Drives
addComponent(items, parsed.maneuver, `m-Drive ${parsed.maneuver}G`, mapComponentType("m-drive"), { rating: String(parsed.maneuver), driveType: "mdrive" });
addComponent(items, parsed.jump, `j-Drive ${parsed.jump}`, mapComponentType("j-drive"), { rating: String(parsed.jump), driveType: "jdrive" });
addComponent(items, parsed.powerPlant, `Power Plant ${parsed.powerPlant}`, mapComponentType("power plant"), { rating: String(parsed.powerPlant), generatesPower: true });
addComponent(items, parsed.computer, `Computer ${parsed.computer}`, mapComponentType("computer"), { rating: String(parsed.computer) });
if (parsed.armor && !/^(none|no|n\/a)$/i.test(parsed.armor)) {
  addComponent(items, parsed.armor, parsed.armor, mapComponentType("armor"), { features: parsed.armor });
}
if (parsed.fuelProcessor && typeof parsed.fuelProcessor === 'string' && parsed.fuelProcessor.trim() !== '') {
  addComponent(items, 1, `Fuel Processor`, mapComponentType("fuel processor"), { features: parsed.fuelProcessor });
}
if (parsed.magazineQty) {
  addComponent(items, parsed.magazineQty, "Missile Magazine", "ammo");
}
// Hardpoints
if (parsed.hardpoints && parsed.hardpoints.length > 0) {
  for (const hardpoint of parsed.hardpoints) {
    addComponent(items, hardpoint.quantity, hardpoint.name, "mount");
  }
}
// Weapons
for (const weapon of parsed.weapons) {
  addComponent(items, weapon.quantity, weapon.name, "armament");
}
// Fittings
for (const fitting of parsed.fittings) {
  if (/^fuel$/i.test(fitting.name.trim()) && parsed.fuel) {
    continue;
  }
  let subtype = fitting.subtype || "otherInternal";
  if (!fitting.subtype && /fuel processor|fuel purification|fuel system/i.test(fitting.name)) {
    subtype = "fuel";
  }
  addComponent(items, fitting.quantity, fitting.name, subtype);
}

if (items.length > 0) {
  await shipActor.createEmbeddedDocuments("Item", items);
}

ui.notifications.info(`Imported ship: ${parsed.name}`);
