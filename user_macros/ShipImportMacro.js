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
// Helper: Create and push a component to the items array
function createComponent(targetItems, { name: componentName, type = "component", system = {} }) {
  if (!componentName || typeof componentName !== "string" || !componentName.trim()) {
    return;
  }
  targetItems.push({ name: componentName.trim(), type, system });
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

// Regexes built from constants
const statblockFieldRegex = new RegExp(`^(${FIELD_LABELS.map(escapeRegex).join('|')})`, 'i');
const nonWeaponTerms = new RegExp(NON_WEAPON_TERMS_LIST.join('|'), 'i');
const trailingNonWeaponWords = new RegExp(`\\b(${NON_WEAPON_TERMS_LIST.join('|')})s?\\b.*$`, 'i');

// Helper: Parse weapons and hardpoints from armament string (extracted from parser for clarity)
function parseWeaponsAndHardpoints(armament) {
  const weapons = [];
  const hardpoints = [];
  if (!armament) {
    return { weapons, hardpoints };
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
      const m = w.match(/(\d+)x?\s*([\w\s\-']+)/i);
      if (m) {
        for (let i = 0; i < turretCount; i++) {
          weapons.push({ name: m[2].trim(), quantity: Number(m[1]) });
        }
      } else if (w.trim()) {
        for (let i = 0; i < turretCount; i++) {
          weapons.push({ name: w.trim(), quantity: 1 });
        }
      }
    });
    armamentRemainder = armamentRemainder.replace(turretMatch[0], "");
  }
  armamentRemainder.split(/[;,]/).forEach(w => {
    const m = w.match(/(\d+)x?\s*([\w\s\-']+)/i);
    if (m) {
      weapons.push({ name: m[2].trim(), quantity: Number(m[1]) || 1 });
    } else if (w.trim()) {
      weapons.push({ name: w.trim(), quantity: 1 });
    }
  });
  for (let i = weapons.length - 1; i >= 0; i--) {
    weapons[i].name = weapons[i].name.replace(trailingNonWeaponWords, '').trim();
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
    const m = f.match(/(\d+)x?\s*([\w\s\-']+)/i);
    let componentName = m ? m[2].trim() : f.trim();
    if (componentName && /escape pods?/i.test(componentName) && escapePods) {
      return;
    }
    if (/^(crew|cargo|scientist|pilot|engineer|medic|operator|total|sensor operator|cost|construction time)/i.test(componentName)) {
      return;
    }
    if (!componentName || componentName.toLowerCase() === 'x') {
      return;
    }
    let subtype = mapComponentType(componentName);
    if (m) {
      fittingsArr.push({ name: componentName, quantity: Number(m[1]) || 1, subtype });
    } else if (f.trim()) {
      fittingsArr.push({ name: componentName, quantity: 1, subtype });
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
  let armor = extractField(statblockText, /Armor:\s*([^;]+)/i, m => m[1]?.replace(/\n/g, ' ').trim());
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
  const fittings = extractField(statblockText, /Fittings:\s*([^\n]+)/i, m => m[1]?.trim());
  const crew = extractField(statblockText, /Crew:\s*([^\n]+)/i, m => m[1]?.trim());
  const staterooms = Number(extractField(statblockText, /(\d+)x?staterooms?/i));
  const cryoberths = Number(extractField(statblockText, /(\d+)x?cryoberths?/i));
  const lowBerths = Number(extractField(statblockText, /(\d+)x?emergency low berths?/i));
  const magazine = Number(extractField(statblockText, /magazine \((\d+) missiles?\)/i));
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
    staterooms, cryoberths, lowBerths, magazine, escapePods, armory, fuelProcessor, cargo,
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
  { pattern: /\b(missile|laser|cannon|gun|railgun|plasma|fusion|beam|pulse|torpedo|autocannon|meson|particle|sandcaster)\b/i, subtype: 'armament' },
  { pattern: /\b(turret|hardpoint|mount)\b/i, subtype: 'mount' },
  { pattern: /\b(magazine)\b/i, subtype: 'magazine' },
  { pattern: /\b(armory)\b/i, subtype: 'otherInternal' },
  { pattern: /\b(fuel processor|fuel purification|fuel system)\b/i, subtype: 'fuel' },
  { pattern: /\b(cargo|cargo space)\b/i, subtype: 'cargo' },
  { pattern: /\b(sensor|sensors?)\b/i, subtype: 'sensor' },
  { pattern: /\b(shield|shields?)\b/i, subtype: 'shield' },
  { pattern: /\b(drone|drones?)\b/i, subtype: 'drone' },
  { pattern: /\b(vehicle|gig)\b/i, subtype: 'vehicle' },
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
const preprocessedStatblock = preprocessStatblock(statblock);
const parsed = parseShipStatblock(preprocessedStatblock);
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

// Add hull component for displacement weight (primary hull)
createComponent(items, {
  name: `Hull (${parsed.tonnage} tons)`,
  system: { subtype: mapComponentType("hull"), weight: String(parsed.tonnage), isBaseHull: true }
});

// Drives
if (parsed.maneuver) {
  createComponent(items, {
    name: `m-Drive ${parsed.maneuver}G`,
    system: { subtype: mapComponentType("m-drive"), rating: String(parsed.maneuver), driveType: "mdrive" }
  });
}
if (parsed.jump) {
  createComponent(items, {
    name: `j-Drive ${parsed.jump}`,
    system: { subtype: mapComponentType("j-drive"), rating: String(parsed.jump), driveType: "jdrive" }
  });
}
if (parsed.powerPlant) {
  createComponent(items, {
    name: `Power Plant ${parsed.powerPlant}`,
    system: { subtype: mapComponentType("power plant"), rating: String(parsed.powerPlant), generatesPower: true }
  });
}
// Computer
if (parsed.computer) {
  createComponent(items, {
    name: `Computer ${parsed.computer}`,
    system: { subtype: mapComponentType("computer"), rating: String(parsed.computer) }
  });
}
// Armor
if (parsed.armor) {
  createComponent(items, {
    name: parsed.armor,
    system: { subtype: mapComponentType("armor"), features: parsed.armor }
  });
}

// Hardpoints (turrets)
if (parsed.hardpoints && parsed.hardpoints.length > 0) {
  for (const hardpoint of parsed.hardpoints) {
    createComponent(items, {
      name: hardpoint.name,
      system: { subtype: "mount", availableQuantity: String(hardpoint.quantity), quantity: String(hardpoint.quantity) }
    });
  }
}

// Weapons
for (const weapon of parsed.weapons) {
  // If weapon.turrets is set, create one component per turret, each with the specified quantity
  if (weapon.turrets) {
    for (let i = 0; i < weapon.turrets; i++) {
      createComponent(items, {
        name: weapon.name,
        system: { subtype: "armament", availableQuantity: String(weapon.quantity), quantity: String(weapon.quantity) }
      });
    }
  } else {
    createComponent(items, {
      name: weapon.name,
      system: { subtype: "armament", availableQuantity: String(weapon.quantity), quantity: String(weapon.quantity) }
    });
  }
}
// Fittings with improved mapping
for (const fitting of parsed.fittings) {
  // Skip only fittings that are just 'fuel' if parsed.fuel exists, but allow fuel processors and similar
  if (/^fuel$/i.test(fitting.name.trim()) && parsed.fuel) {
    continue;
  }
  let subtype = fitting.subtype || "otherInternal";
  if (!fitting.subtype && /fuel processor|fuel purification|fuel system/i.test(fitting.name)) {
    subtype = "fuel";
  }
  createComponent(items, {
    name: fitting.name,
    system: { subtype: subtype, availableQuantity: String(fitting.quantity), quantity: String(fitting.quantity) }
  });
}
// Staterooms
if (parsed.staterooms) {
  createComponent(items, {
    name: `Staterooms`,
    system: { subtype: mapComponentType("stateroom"), availableQuantity: String(parsed.staterooms), quantity: String(parsed.staterooms) }
  });
}
// Cryoberths
if (parsed.cryoberths) {
  createComponent(items, {
    name: `Cryoberths`,
    system: { subtype: mapComponentType("cryoberth"), availableQuantity: String(parsed.cryoberths), quantity: String(parsed.cryoberths) }
  });
}
// Emergency Low Berths
if (parsed.lowBerths) {
  createComponent(items, {
    name: `Emergency Low Berths`,
    system: { subtype: mapComponentType("low berth"), availableQuantity: String(parsed.lowBerths), quantity: String(parsed.lowBerths) }
  });
}
// Magazine
if (parsed.magazine) {
  createComponent(items, {
    name: `Missile Magazine`,
    system: { subtype: mapComponentType("magazine"), availableQuantity: String(parsed.magazine), quantity: String(parsed.magazine) }
  });
}
// Escape Pods
if (parsed.escapePods) {
  createComponent(items, {
    name: `Escape Pods`,
    system: { subtype: mapComponentType("escape pod"), availableQuantity: String(parsed.escapePods), quantity: String(parsed.escapePods) }
  });
}
// Armory
if (parsed.armory) {
  createComponent(items, {
    name: `Armory`,
    system: { subtype: mapComponentType("armory"), features: `For ${parsed.armory} marines` }
  });
}
// Fuel Processor
if (parsed.fuelProcessor) {
  createComponent(items, {
    name: `Fuel Processor`,
    system: { subtype: mapComponentType("fuel processor"), features: parsed.fuelProcessor }
  });
}
// Cargo
if (parsed.cargo) {
  createComponent(items, {
    name: `Cargo Space`,
    system: { subtype: mapComponentType("cargo"), tons: String(parsed.cargo) }
  });
}

if (items.length > 0) {
  await shipActor.createEmbeddedDocuments("Item", items);
}

ui.notifications.info(`Imported ship: ${parsed.name}`);
