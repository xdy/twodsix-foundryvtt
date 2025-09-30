// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";
type DamageResult = { location: string; hits: number };

/**
 * Generates a ship damage report based on the damage payload and ship stats.
 * Calculates net damage, applies damage effects, and determines radiation report.
 *
 * @param {TwodsixActor} ship - The ship actor being damaged.
 * @param {any} damagePayload - The damage payload containing damage values and weapon type.
 * @returns {void}
 */
export function generateShipDamageReport(ship: TwodsixActor, damagePayload: any): void {
  if (!ship || !damagePayload) {
    console.log("No ship and/or damage payload");
    return;
  }
  if (!damagePayload.isArmament) {
    ui.notifications.warn("TWODSIX.Ship.NotShipWeapon", { localize: true });
    return;
  }

  const damageList: DamageResult[] = [];
  let radReport:string|DamageResult[] = game.i18n.localize("TWODSIX.Ship.None");
  const damage = damagePayload.damageValue ?? 0;
  const radDamage = damagePayload.radDamage ?? 0;
  const currentArmor = ship.system.shipStats.armor.value ?? 0;
  const currentHull = ship.system.shipStats.hull.value ?? 0;
  const weaponType = damagePayload.shipWeaponType;
  const effect = damagePayload.effect;

  const damageRules = game.settings.get('twodsix', 'shipDamageType');
  const netDamage = damage - ((weaponType === "mesonGun"|| damageRules === "CT") ? 0 : currentArmor);

  if ( netDamage <= 0 && radDamage <= 0) {
    ui.notifications.warn("TWODSIX.Ship.NoDamage", { localize: true });
    return;
  }

  // Damage calculation
  if (netDamage > 0) {
    switch (damageRules) {
      case 'component': {
        const hitArray: number[] = getCEDamageEffects(netDamage);
        damageList.push(...getCEDamageLocationObject(hitArray, currentHull, currentArmor, weaponType));
        break;
      }
      case 'hullOnly': {
        damageList.push({location: 'hull', hits: Math.clamp(netDamage, 0, currentHull)});
        break;
      }
      case 'hullWCrit': {
        const maxHull:number = ship.system.shipStats.hull.max ?? 0;
        const appliedHits = Math.clamp(netDamage, 0, currentHull);
        damageList.push({location: 'hull', hits: appliedHits});
        damageList.push(...get10PctCriticals(currentHull, currentHull - appliedHits, maxHull, effect));
        break;
      }
      case 'surfaceInternal':{
        damageList.push(...getCDDamageList(damage, weaponType, ship, effect));
        break;
      }
      case 'CT': {
        damageList.push(...getCTDamageList(damage));
        break;
      }
      case 'AC': {
        damageList.push(...getACDamageList(damage, weaponType, ship));
        break;
      }
      case 'CU': {
        const {hull, component} = getCUDamageEffects(netDamage);
        damageList.push({location: 'hull', hits: hull});
        damageList.push(...getCUDamageList(component));
        break;
      }
      default:
        break;
    }
  }

  // Radiation calculation
  if (radDamage > 0) {
    switch (damageRules) {
      case 'component': {
        radReport = getCERadDamage(weaponType, currentArmor);
        break;
      }
      case 'hullOnly':
      case 'hullWCrit': {
        radReport = game.i18n.format("TWODSIX.Ship.DamageMessages.AllCrew", {dose: "[[/r 2D6*20]]"});
        break;
      }
      case 'surfaceInternal': {
        radReport = getCDRadDamage(radDamage, ship);
        break;
      }
      case "AC": {
        radReport = getACRadDamage(radDamage);
        break;
      }
      default:
        break;
    }
  }
  //console.log(damageList, radReport);
  sendReportToMessage(damageList, radReport, ship);
};

/**
 * Sends the ship damage report to chat, including system damage and radiation exposure.
 *
 * @param {DamageResult[]} damageList - Array of damage objects with location and hits.
 * @param {string | DamageResult[]} radReport - Radiation damage report (can include inline rolls).
 * @param {TwodsixActor} ship - The ship actor being damaged.
 * @returns {Promise<void>}
 */
async function sendReportToMessage(damageList: DamageResult[], radReport: string | DamageResult[], ship: TwodsixActor): Promise<void> {
  // Build system damage table
  const systemDamageHtml = generateDamageTable(damageList);

  // Enrich radiation report for inline rolls and secrets
  let enrichedRadReport = "";
  if (Array.isArray(radReport)) {
    enrichedRadReport = generateDamageTable(radReport);
  } else {
    enrichedRadReport = await foundry.applications.ux.TextEditor.implementation.enrichHTML(radReport, { secrets: ship.isOwner });
  }

  // Compose the full flavor message
  const flavorText = `
    <section class="flavor-message">
      <section class="flavor-line">${game.i18n.localize("TWODSIX.Chat.DamageReport")}</section>
      <section>
        <fieldset>
          <legend>${game.i18n.localize("TWODSIX.Chat.Roll.ComponentDamage")}</legend>
          ${systemDamageHtml}
        </fieldset>
      </section>
      <section>
        <fieldset>
          <legend>${game.i18n.localize("TWODSIX.Actor.RadiationExposure")}</legend>
          ${enrichedRadReport}
        </fieldset>
      </section>
    </section>
  `;

  // Send to chat
  await ChatMessage.create({
    flavor: flavorText,
    speaker: ChatMessage.getSpeaker({ actor: ship })
  });
}

/**
 * Generates an HTML table from an array of DamageResults. The columns are location and hits.
 *
 * @param {DamageResult[]} damageList - The damage (location and number of hits) inflicted during space combat.
 * @returns {string} A string for HTML table .
 */
function generateDamageTable(damageList: DamageResult[]): string {
  if (damageList.length === 0) {
    return `<span>${game.i18n.localize("TWODSIX.Ship.None")}</span>`;
  }

  let systemDamageHtml = `<table class="flavor-table"><tr><th>${game.i18n.localize("TWODSIX.Ship.Systems")}</th><th class="centre">${game.i18n.localize("TWODSIX.Items.Component.hits")}</th></tr>`;
  for (const row of damageList) {
    if (row.location === "destroyed") {
      return `<span>${game.i18n.localize("TWODSIX.Ship.DamageMessages.ShipDestroyed")}</span>`;
    }
    //Allow for custom j-drive label and localize
    let componentName = game.i18n.localize(row.location === "j-drive" ? game.settings.get('twodsix', 'jDriveLabel') : `TWODSIX.Items.Component.${row.location}`);
    if (componentName.includes("TWODSIX")) {
      componentName = row.location;
    }

    //Check for explicitly destroyed components
    let numberOfHits:string = row.hits.toString();
    if(["CT", "surfaceInternal", "AC"].includes(game.settings.get('twodsix', 'shipDamageType'))) {
      if(row.hits >= game.settings.get('twodsix', 'maxComponentHits') && !["hull", "armor"].includes(row.location)) {
        numberOfHits = game.i18n.localize("TWODSIX.Items.Component.destroyed");
      }
    }
    systemDamageHtml += `<tr><td>${componentName}</td><td class="centre">${numberOfHits}</td></tr>`;
  }
  systemDamageHtml += `</table>`;
  return systemDamageHtml;
}

/**
 * Represents a range of damage and the corresponding effects.
 */
interface DamageRange {
  min: number;
  max: number;
  hits: number[];
}

/**
 * Calculates the space combat damage effects based on the input damage value.
 *
 * @param {number} damage - The numeric damage value inflicted during space combat.
 * @returns {number[]} An array of numbers representing the damage effects (e.g., 1, 2).
 */
function getCEDamageEffects(damage: number): number[] {
  const effects: number[] = [];

  // Define base damage effects according to the damage table
  const baseTable: DamageRange[] = [
    { min: -Infinity, max: 0, hits: [] },
    { min: 1, max: 4, hits: [1] },
    { min: 5, max: 8, hits: [1, 1] },
    { min: 9, max: 12, hits: [2] },
    { min: 13, max: 16, hits: [1, 1, 1] },
    { min: 17, max: 20, hits: [1, 1, 2] },
    { min: 21, max: 24, hits: [2, 2] },
    { min: 25, max: 28, hits: [3] },
    { min: 29, max: 32, hits: [3, 1] },
    { min: 33, max: 36, hits: [3, 2] },
    { min: 37, max: 40, hits: [3, 2, 1] },
    { min: 41, max: 44, hits: [3, 3] },
  ];

  if (damage <= 44) {
    // Match damage within predefined ranges
    for (const row of baseTable) {
      if (damage >= row.min && damage <= row.max) {
        effects.push(...row.hits);
        break;
      }
    }
  } else if (damage > 44) {
    // Base effect at 44 is "Two Triple Hits"
    effects.push(3, 3);

    const extra = damage - 44;
    if (extra > 0) {
      // Add one Single Hit for every additional 3 points
      const singleHits = Math.floor(extra / 3);

      for (let i = 0; i < singleHits; i++) {
        effects.push(1);
      }

      // Add one Double Hit for every additional 6 points
      const doubleHits = Math.floor(extra / 6);

      for (let i = 0; i < doubleHits; i++) {
        effects.push(2);
      }
    }
  }

  return effects.length > 0 ? effects : [];
}

/**
 * Determines the hit locations and hit values for ship damage.
 *
 * @param {number[]} hitArray - Array of hit values.
 * @param {number} currentHull - Current hull value of the ship.
 * @param {number} currentArmor - Current armor value of the ship.
 * @param {string} weaponType - Type of weapon used.
 * @returns {DamageResult[]} Array of objects with location and hits.
 */
function getCEDamageLocationObject(hitArray: number[], currentHull: number, currentArmor: number, weaponType: string): DamageResult[] {
  const returnValue = [];

  // Define hit location lookup arrays
  const externalHitCE = ["hull", "sensor", "m-drive", "turret", "hull", "armor", "hull", "fuel", "m-drive", "sensor", "hull"];
  const internalHitCE = ["structure", "power", "j-drive", "bay", "structure", "crew", "structure", "hold", "j-drive", "power", "structure"];

  for (const value of hitArray) {
    const internalHit = (currentHull <= 0) || (weaponType === "mesonGun");
    const newLocation = rollHitTable(internalHit ? internalHitCE : externalHitCE, value);
    if (newLocation.location === "armor" && currentArmor <= 0) {
      newLocation.location = "hull";
    }
    returnValue.push({ location: newLocation.location, hits: newLocation.hits });
  }
  return returnValue;
}

/**
 * Crew Damage Table for CE Ship Combat.
 * Each entry defines a roll range and the corresponding radiation effect.
 */
const crewDamageTableCE = [
  {
    min: -Infinity,
    max: 4,
    radiation: "TWODSIX.Ship.DamageMessages.NoRad",
    dose: "0"
  },
  {
    min: 5,
    max: 8,
    radiation: "TWODSIX.Ship.DamageMessages.SingleCrew",
    dose: "[[/r 2D6*10]]"
  },
  {
    min: 9,
    max: 10,
    radiation: "TWODSIX.Ship.DamageMessages.SingleCrew",
    dose: "[[/r 4D6*10]]"
  },
  {
    min: 11,
    max: 11,
    radiation: "TWODSIX.Ship.DamageMessages.AllCrew",
    dose: "[[/r 2D6*10]]"
  },
  {
    min: 12,
    max: Infinity,
    radiation: "TWODSIX.Ship.DamageMessages.AllCrew",
    dose: "[[/r 4D6*10]]"
  }
];

/**
 * Determines the crew radiation damage effect based on weapon type and armor for Cepheus Engine rules.
 *
 * @param {string} weaponType - The type of weapon used.
 * @param {number} currentArmor - The current armor value of the ship.
 * @returns {string} The radiation damage effect description.
 */
function getCERadDamage(weaponType: string, currentArmor: number): string {
  const rollDM = (weaponType === "mesonGun" || currentArmor < 0) ? 0 : -currentArmor;
  const damageRoll = getMultipleRolls(1, 6, 2) + rollDM;
  for (const row of crewDamageTableCE) {
    if (damageRoll >= row.min && damageRoll <= row.max) {
      return game.i18n.format(row.radiation, {dose: row.dose});
    }
  }
  return "Unknown";
}

/**
 * Determines the hit locations and hit values for ship damage (Cepheus Deluxe rules).
 *
 * @param {number} damage - The amount of damage dealt.
 * @param {string} weaponType - The type of weapon used.
 * @param {TwodsixActor} ship - The ship actor being damaged.
 * @param {number} effect - The effect value from the attack roll.
 * @returns {DamageResult[]} Array of hit objects.
 */
function getCDDamageList(damage:number, weaponType:string, ship:TwodsixActor, effect:number):DamageResult[] {
  const returnValue: DamageResult[] = [];
  if (["sandcaster", "special", "other"].includes(weaponType)) {
    console.log("Calculation of damage not possible for this weapon");
    return returnValue;
  }

  let adjWeaponType = weaponType;

  let armorType = getCDArmorType(ship.system.shipStats.armor.name);
  //shift armor type one class weaker for critical
  const criticalArmorList = {unarmored: "unarmored", light: "unarmored", heavy: "light", massive: "heavy"};
  if (effect >= 6 && Object.hasOwn(criticalArmorList, armorType)){
    armorType = criticalArmorList[armorType];
  }
  //Does Not yet shift armor type one class weaker for meson weapon


  //Penetration Matrix - note missile and torpedo are: missile = light and others are intermediate
  const penetrationMatrix = {
    light: {unarmored: "internal", light: "surface", heavy: "none", massive: "none"},
    intermediate: {unarmored: "critical", light: "internal", heavy: "surface", massive: "none"},
    heavy: {unarmored: "destroyed", light: "critical", heavy: "internal", massive: "surface"},
    main: {unarmored: "destroyed", light: "destroyed", heavy: "critical", massive: "internal"}
  };

  //adjust for missiles type as not on table
  switch (weaponType) {
    case "missile":
      adjWeaponType = "light";
      break;
    case "torpedoes":
    case "nuclearMissile":
      adjWeaponType = "intermediate";
      break;
    default:
      break;
  }

  //NOTE: do not understand how to "avoid armor" for meson gun or gravitic disruptor - RAW it would be instant kill

  // Defensive: check for valid weaponType and armorType
  if (!penetrationMatrix[adjWeaponType] || !penetrationMatrix[adjWeaponType][armorType]) {
    console.warn(`Unknown weaponType (${weaponType}) or armorType (${armorType}) in getCDDamageList`);
    return [];
  }

  const hitType = penetrationMatrix[adjWeaponType][armorType];

  //handle bounding cases
  if (hitType === "destroyed") {
    return [{location: "destroyed", hits: Infinity}];
  } else if (hitType === "none") {
    return [];
  }

  // Use generateDamageList for all hit types
  const hitTypeMap: Record<string, () => DamageResult> = {
    internal: getInternalHitCD,
    surface: getSurfaceHitCD,
    critical: getCriticalHitCD
  };

  if (hitTypeMap[hitType]) {
    return generateDamageList(damage, hitTypeMap[hitType]);
  }
  return [];
}

/**
 * Rolls for an internal hit location in Cepheus Deluxe ship combat.
 * If a critical is rolled, delegates to getCriticalHitCD().
 * @returns {DamageResult} The hit location and number of hits.
 */
function getInternalHitCD(): DamageResult {
  const hitTable =  ["breach", "power", "j-drive", "armament", "m-drive", "breach", "cargo", "crew", "sensor", "bridge", "special"];
  return rollHitTable(hitTable, 1, getCriticalHitCD);
}

/**
 * Rolls for a surface hit location in Cepheus Deluxe ship combat.
 * If "internal" is rolled, delegates to getInternalHitCD().
 * @returns {{location: string, hits: number}} The hit location and number of hits.
 */
function getSurfaceHitCD(): DamageResult {
  const hitTable =  ["none", "none", "none", "none", "none", "breach", "breach", "armament", "armament", "electronics", "special"];
  return rollHitTable(hitTable, 1, getInternalHitCD);
}

/**
 * Rolls for a critical hit location in Cepheus Deluxe ship combat.
 * @returns {DamageResult} The critical hit location and number of hits.
 */
function getCriticalHitCD(): DamageResult {
  const hitTable = ["power", "m-drive", "j-drive", "crew", "electronics", "destroyed"];
  return rollHitTable(hitTable, game.settings.get('twodsix', 'maxComponentHits'));
}

/**
 * Rolls for a radiation hit location in Cepheus Deluxe ship combat.
 * @param {number} rads The number of radiation hits.
 * @param {TwodsixActor} ship The ship actor hit.
 * @returns {DamageResult} The critical hit location and number of hits.
 */
function getCDRadDamage(rads: number, ship: TwodsixActor): DamageResult[] {
  const returnValue:DamageResult[] = [];

  // Define rad hit location lookup array
  const radsCD = ["none", "none", "none", "none", "sensor", "sensor", "electronics", "electronics", "crew", "crew", "critical"];
  const armorType = getCDArmorType(ship.system.shipStats.armor.name);
  const currentArmor = ship.system.shipStats.armor.value ?? 0;
  const armorDM = getCDArmorDM(armorType);
  const radDM = Math.max(rads-1, 0) + armorDM;
  for (let i=0; i < rads; i++) {
    const locationRoll = Math.clamp(getMultipleRolls(1, 6, 2) + radDM - 2, 0, 10);
    let newLocation = radsCD[locationRoll];
    if (newLocation === "critical") {
      returnValue.push(getCriticalHitCD());
    } else if (newLocation !== "none") {
      if (newLocation === "armor" && currentArmor <= 0) {
        newLocation = "hull";
      }
      returnValue.push({ location: newLocation, hits: 1 });
    }
  }
  return returnValue;
}

function getCDArmorDM(armorKey: string): number {
  if (!armorKey) {
    return 0;
  }
  const armorTypesDM = {unarmored: 0, light: -1, heavy: -2, massive: -4};
  return Object.hasOwn(armorTypesDM, armorKey) ? armorTypesDM[armorKey] : 0;
}

function getCDArmorType(armorDescription: string): string {
  const armorLower = armorDescription.toLowerCase();
  // Use localized armor names for matching
  for (const key of Object.keys(TWODSIX.ShipArmorTypesCD)) {
    const localized = game.i18n.localize(TWODSIX.ShipArmorTypesCD[key]).toLowerCase();
    if (armorLower.includes(localized)) {
      return key;
    }
  }
  return "";
}

/**
 * Calculates critical hits based on hull percentage drop and effect for ship combat.
 * This implementation is for MgT2e rules.
 *
 * @param {number} currentHull - The ship's current hull value before damage.
 * @param {number} futureHull - The ship's hull value after damage is applied.
 * @param {number} maxHull - The ship's maximum hull value.
 * @param {number} effect - The effect value from the attack roll.
 * @returns {Array<{location: string, hits: number}>} Array of critical hit objects.
 */
function get10PctCriticals(currentHull: number, futureHull: number, maxHull: number, effect: number): DamageResult[] {
  const results: DamageResult[] = [];
  const critTable = [
    "sensor", "power", "fuel", "armament", "armor",
    "hull", "m-drive", "cargo", "j-drive", "crew", "bridge"
  ];
  // Add a severe critical if effect is high (effect >= 6)
  if (effect >= 6) {
    results.push(rollHitTable(critTable, effect));
  }

  // Calculate hull percentage in tenths, clamp to 0-9
  const pctCurrent: number = Math.clamp(Math.floor(currentHull / maxHull * 10), 0, 9);
  const pctFuture: number = Math.clamp(Math.floor(futureHull / maxHull * 10), 0, 9);
  const numCrits = Math.max(0, pctCurrent - pctFuture);

  // Add one critical per 10% hull lost
  for (let i = 0; i < numCrits; i++) {
    results.push(rollHitTable(critTable, 1));
  }

  return results;
}

function getCTDamageList(damage:number): DamageResult[] {
  return generateDamageList(damage, getHitCT);
}

/**
 * Rolls for a surface hit location in Classic Traveller ship combat.
 * If "critical" is rolled, delegates to getCriticalHitCT().
 * @returns {DmageResult} The hit location and number of hits.
 */
function getHitCT(): DamageResult {
  const hitTable =  ["power", "m-drive", "j-drive", "fuel", "hull", "hull", "cargo", "computer", "armament", "armament", "special"];
  return rollHitTable(hitTable, 1, getCriticalHitCT);
}

/**
 * Rolls for a critical hit location in Classic Traveller ship combat.
 * @returns {DamageResult} The critical hit location and number of hits.
 */
function getCriticalHitCT():DamageResult {
  const hitTable = ["power", "m-drive", "j-drive", "crew", "computer", "destroyed"];
  return rollHitTable(hitTable, game.settings.get('twodsix', 'maxComponentHits'));
}

function getACDamageList(damage:number, weaponType: string, ship:TwodsixActor): DamageResult[] {
  //Alpha Cephei uses armor as a gate and not damage reduction
  if (damage > (ship.system.shipStats.armor.value ?? 0) || weaponType === "mesonGun") {
    return generateDamageList(damage, getHitAC);
  } else {
    return [];
  }
}

/**
 * Rolls for a surface hit location in Alpha Cephei ship combat.
 * If "critical" is rolled, delegates to getCriticalHitAC().
 * @returns {DmageResult} The hit location and number of hits.
 */
function getHitAC(): DamageResult {
  const hitTable =  ["breach", "power", "j-drive", "armament", "m-drive", "armor", "cargo", "crew", "computer", "bridge", "special"];
  const result:DamageResult = rollHitTable(hitTable, 1, getCriticalHitAC);
  if (result.location === "crew") {
    result.hits = getMultipleRolls(1, 6, 2);
  }
  return result;
}

/**
 * Rolls for a critical hit location in Alpha Cephi ship combat.
 * @returns {DamageResult} The critical hit location and number of hits.
 */
function getCriticalHitAC():DamageResult {
  const hitTable = ["power", "m-drive", "j-drive", "crew", "computer", "destroyed"];
  let result:DamageResult = rollHitTable(hitTable, game.settings.get('twodsix', 'maxComponentHits'));
  if (result.location === "crew") {
    result = {location: "crew - critical", hits: getMultipleRolls(1, 6, 4)};
  }
  return result;
}

/**
 * Rolls for a critical hit location in Alpha Cephi ship combat.
 * @returns {DamageResult} The critical hit location and number of hits.
 */
function getRadHitAC():DamageResult {
  const hitTable = ["none", "crew", "crew", "computer", "computer", "critical"];
  let result:DamageResult = rollHitTable(hitTable, 1);
  if (result.location === "critical") {
    result = {location: "crew - critical", hits: getMultipleRolls(1, 6, 4)};
  } else if (result.location === "crew") {
    result.hits = getMultipleRolls(1, 6, 2);
  }
  return result;
}

function getACRadDamage(radDamage: number): DamageResult[] {
  return generateDamageList(radDamage, getRadHitAC);
}

/**
 * Calculates the space combat damage effects based on the input damage value.
 *
 * @param {number} damage - The numeric damage value inflicted during space combat.
 * @returns {{hull:number, component:number}} An object of hit damage.
 */
function getCUDamageEffects(damage: number): {hull:number, component:number} {
  // Define base damage effects according to the damage table
  const baseTable: any[] = [
    { min: -Infinity, max: 0, hull: 0, component: 0},
    { min: 1, max: 4, hull: 1, component: 0},
    { min: 5, max: 6, hull: 2, component: 1},
    { min: 7, max: 8, hull: 3, component: 2},
    { min: 9, max: 16, hull: 6, component: 2},
    { min: 17, max: 24, hull: 16, component: 3},
    { min: 25, max: 32, hull: 18, component: 3},
    { min: 33, max: 40, hull: 30, component: 4},
    { min: 41, max: 60, hull: 42, component: 4},
    { min: 61, max: 80, hull: 80, component: 5},
    { min: 81, max: 100, hull: 160, component: 5},
    { min: 101, max: Infinity, hull: 360, component: 6},
  ];
  // Match damage within predefined ranges
  for (const row of baseTable) {
    if (damage >= row.min && damage <= row.max) {
      return {hull: row.hull, component: row.component};
    }
  }
  console.log ("Unknown lookup for CU damage table.");
  return {hull: 0, component: 0};
}

function getCUDamageList(hits:number):DamageResult[] {
  return generateDamageList(hits, getHitCU);
}

/**
 * Rolls for a surface hit location in Cepheus Universal ship combat.
 * If "critical" is rolled, delegates to getCriticalHitCT().
 * @returns {DmageResult} The hit location and number of hits.
 */
function getHitCU(): DamageResult {
  const hitTable =  ["sensor", "sensor", "power", "ftl-drive", "armor", "armament", "screen", "m-drive", "crew", "special", "special"];
  return rollHitTable(hitTable, 1, getIncidentalHitCU);
}

/**
 * Rolls for a incidental hit location in Cepheus Universal ship combat.
 * @returns {DamageResult} The critical hit location and number of hits.
 */
function getIncidentalHitCU():DamageResult {
  const hitTable = ["fire", "fire", "fire", "cargo", "cargo", "fuel", "accomodations", "hanger", "tractor-beam", "life-support", "life-support"];
  return rollHitTable(hitTable, 1);
}

/**
 * Rolls on a hit table and handles delegation for special results.
 * @param {string[]} table The hit location table.
 * @param {number} defaultHits The number of hits sustained
 * @param {() => DamageResult} cascadeRoll - Delegate function for special results.
 * @returns {DamageResult} Returns the damage result as a {location, hits} object
 */
function rollHitTable(table: string[], defaultHits:number = 1, cascadeRoll?: () => DamageResult): DamageResult {
  // Standard 2d6-2 for 11-entry tables, fallback to flat distribution for others
  let tableRoll: number;
  if (table.length === 11) {
    tableRoll = Math.clamp(getMultipleRolls(1, 6, 2) - 2, 0, 10);
  } else {
    tableRoll = Math.clamp(getRandomInteger(0, table.length - 1), 0, table.length - 1);
  }
  let hitLocation = table[tableRoll];
  let hits = defaultHits;
  if (cascadeRoll && hitLocation === "special") {
    const special = cascadeRoll();
    hitLocation = special.location;
    hits = special.hits;
  }
  return { location: hitLocation, hits: hits };
}

function generateDamageList(damage:number, hitGenerator: () => DamageResult): DamageResult[] {
  const returnValue: DamageResult[] = [];
  for (let i = 0; i < damage; i++) {
    const newDamage = hitGenerator();
    //Again, need to check for destroyed ship
    if (newDamage.location === "destroyed") {
      return [{location: "destroyed", hits: Infinity}];
    } else if (newDamage.location !== "none") {
      returnValue.push({location: newDamage.location, hits: newDamage.hits});
    }
    // If "none", skip adding
  }
  return returnValue;
}

/**
 * Generates a random integer between min and max (inclusive).
 *
 * @param {number} min - The minimum integer value.
 * @param {number} max - The maximum integer value.
 * @returns {number} A random integer between min and max.
 */
function getRandomInteger(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates multiple integer rolls.
 *
 * @param {number} min - The minimum integer value.
 * @param {number} max - The maximum integer value.
 * @param {number} repeats - The number of times to roll
 * @returns {number} The sum of multiple random integers between min and max.
 */
function getMultipleRolls(min: number, max: number, repeats:number): number {
  let returnValue = 0;
  for (let i = 0; i<repeats; i++ ) {
    returnValue += getRandomInteger(min, max);
  }
  return returnValue;
}
