// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

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
  const damageList: any[] = [];
  let radReport:string = game.i18n.localize("TWODSIX.Ship.None");
  const damage = damagePayload.damageValue ?? 0;
  const currentArmor = ship.system.shipStats.armor.value ?? 0;
  const currentHull = ship.system.shipStats.hull.value ?? 0;
  const weaponType = damagePayload.shipWeaponType;
  const effect = damagePayload.effect;
  const netDamage = damage - (weaponType === "mesonGun" ? 0 : currentArmor);
  const damageRules = game.settings.get('twodsix', 'shipDamageType');

  // Damage calculation
  if (netDamage <= 0) {
    ui.notifications.warn("TWODSIX.Ship.NoDamage", { localize: true });
  } else {
    switch (damageRules) {
      case 'component': {
        const hitArray: any = getCEDamageEffects(netDamage);
        damageList.push(...getCEDamageLocationObject(hitArray, currentHull, currentArmor, weaponType));
        break;
      }
      case 'hullOnly': {
        damageList.push({location: 'hull', hits: Math.clamp( damage , 0, currentHull)});
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
        break;
      }
      default:
        break;
    }
  }

  // Radiation calculation
  if (damagePayload.radDamage > 0) {
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
      case 'surfaceInternal':{
        radReport = getCDRadDamage(damagePayload.radDamage, ship);
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
 * @param {any[]} damageList - Array of damage objects with location and hits.
 * @param {string | any[]} radReport - Radiation damage report (can include inline rolls).
 * @param {TwodsixActor} ship - The ship actor being damaged.
 * @returns {Promise<void>}
 */
async function sendReportToMessage(damageList: any[], radReport: string | any[], ship: TwodsixActor): Promise<void> {
  // Build system damage table
  let systemDamageHtml = "";
  if (damageList.length > 0) {
    systemDamageHtml = generateDamageTable(damageList);
  } else {
    systemDamageHtml = `<span>${game.i18n.localize("TWODSIX.Ship.None")}</span>`;
  }

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

function generateDamageTable(damageList: any[]): string {
  let systemDamageHtml = `<table class="flavor-table"><tr><th>${game.i18n.localize("TWODSIX.Ship.Systems")}</th><th class="centre">${game.i18n.localize("TWODSIX.Items.Component.hits")}</th></tr>`;
  for (const row of damageList) {
    let componentName = game.i18n.localize(`TWODSIX.Items.component.${row.location}`);
    if (componentName.includes("TWODSIX")) {
      componentName = row.location;
    }
    systemDamageHtml += `<tr><td>${componentName}</td><td class="centre">${row.hits}</td></tr>`;
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

  let matchedBase = false;

  // Match damage within predefined ranges
  for (const row of baseTable) {
    if (damage >= row.min && damage <= row.max) {
      effects.push(...row.hits);
      matchedBase = true;
      break;
    }
  }

  // Handle overflow damage beyond 44
  if (!matchedBase && damage > 44) {
    // Base effect at 44 is "Two Triple Hits"
    effects.push(3, 3);

    const extra = damage - 44;

    // Add one Single Hit for every additional 3 points
    const singleHits = Math.floor(extra / 3);

    // Add one Double Hit for every additional 6 points
    const doubleHits = Math.floor(extra / 6);

    for (let i = 0; i < singleHits; i++) {
      effects.push(1);
    }

    for (let i = 0; i < doubleHits; i++) {
      effects.push(2);
    }
  }

  return effects.length > 0 ? effects : [];
};

/**
 * Determines the hit locations and hit values for ship damage.
 *
 * @param {number[]} hitArray - Array of hit values.
 * @param {number} currentHull - Current hull value of the ship.
 * @param {number} currentArmor - Current armor value of the ship.
 * @param {string} weaponType - Type of weapon used.
 * @returns {any[]} Array of objects with location and hits.
 */
function getCEDamageLocationObject(hitArray: number[], currentHull: number, currentArmor: number, weaponType: string): any[] {
  const returnValue = [];

  // Define hit location lookup arrays
  const externalHitCE = ["hull", "sensor", "m-drive", "turret", "hull", "armor", "hull", "fuel", "m-drive", "sensor", "hull"];
  const internalHitCE = ["structure", "power", "j-drive", "bay", "structure", "crew", "structure", "hold", "j-drive", "power", "structure"];

  for (const value of hitArray) {
    const locationRoll = getRandomInteger(1, 6) + getRandomInteger(1, 6) - 2;
    const internalHit = (currentHull <= 0) || (weaponType === "mesonGun");
    let newLocation = internalHit ? internalHitCE[locationRoll] : externalHitCE[locationRoll];
    if (newLocation === "armor" && currentArmor <= 0) {
      newLocation = "hull";
    }
    returnValue.push({ location: newLocation, hits: value });
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
 * Determines the crew radiation damage effect based on weapon type and armor.
 *
 * @param {string} weaponType - The type of weapon used.
 * @param {number} currentArmor - The current armor value of the ship.
 * @returns {string} The radiation damage effect description.
 */
function getCERadDamage(weaponType: string, currentArmor: number): string {
  const rollDM = (weaponType === "mesonGun" || currentArmor < 0) ? 0 : -currentArmor;
  const damageRoll = getRandomInteger(1, 6) + getRandomInteger(1, 6) + rollDM;
  for (const row of crewDamageTableCE) {
    if (damageRoll >= row.min && damageRoll <= row.max) {
      return game.i18n.format(row.radiation, {dose: row.dose});
    }
  }
  return "Unknown";
}

function getCDRadDamage(rads: number, ship: TwodsixActor):any[] {
  const returnValue = [];

  // Define hit location lookup arrays
  const radsCD = ["none", "none", "none", "none", "sensor", "sensor", "electronics", "electronics", "crew", "crew", "critical"];
  const armorDM = getCDArmorDM(ship.system.shipStats.armor.name);
  const radDM = Math.max(rads-1, 0) - armorDM;
  for (let i=0; i < rads; i++) {
    const locationRoll = Math.clamp(getRandomInteger(1, 6) + getRandomInteger(1, 6) + radDM - 2, 0, 10);
    let newLocation = radsCD[locationRoll];
    if (newLocation === "armor" && currentArmor <= 0) {
      newLocation = "hull";
    }
    returnValue.push({ location: newLocation, hits: 1 });
  }
  return returnValue;
}

function getCDArmorDM(armor: string): number {
  if (!armor) {
    return 0;
  }
  // Use localized armor names for matching
  const armorTypes = [
    { key: "TWODSIX.ArmorCD.Light", dm: -1 },
    { key: "TWODSIX.ArmorCD.Heavy", dm: -2 },
    { key: "TWODSIX.ArmorCD.Massive", dm: -4 }
  ];

  const armorLower = armor.toLowerCase();
  for (const { key, dm } of armorTypes) {
    const localized = game.i18n.localize(key).toLowerCase();
    if (armorLower.includes(localized)) {
      return dm;
    }
  }
  return 0;
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
function get10PctCriticals(currentHull: number, futureHull: number, maxHull: number, effect: number): Array<{location: string, hits: number}> {
  const results: Array<{location: string, hits: number}> = [];

  // Add a severe critical if effect is high (effect >= 6)
  if (effect >= 6) {
    results.push({ location: getCritLocation(), hits: effect });
  }

  // Calculate hull percentage in tenths, clamp to 0-9
  const pctCurrent: number = Math.clamp(Math.floor(currentHull / maxHull * 10), 0, 9);
  const pctFuture: number = Math.clamp(Math.floor(futureHull / maxHull * 10), 0, 9);
  const numCrits = Math.max(0, pctCurrent - pctFuture);

  // Add one critical per 10% hull lost
  for (let i = 0; i < numCrits; i++) {
    results.push({ location: getCritLocation(), hits: 1 });
  }

  return results;
}

/**
 * Randomly selects a critical hit location for ship combat.
 * This implementation is for MgT2e rules.
 *
 * @returns {string} The component subtype name of the critical hit location.
 */
function getCritLocation(): string {
  // Define critical hit locations by component type
  const critTable = [
    "sensor", "power", "fuel", "armament", "armor",
    "hull", "m-drive", "cargo", "j-drive", "crew", "bridge"
  ];
  // Roll 2d6 and clamp to valid index
  const locationRoll = Math.clamp(getRandomInteger(1, 6) + getRandomInteger(1, 6) - 2, 0, critTable.length - 1);
  return critTable[locationRoll];
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
