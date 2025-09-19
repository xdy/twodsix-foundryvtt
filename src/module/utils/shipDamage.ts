// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Generates a ship damage report based on the damage payload and ship stats.
 * Calculates net damage, applies damage effects, and determines radiation report.
 *
 * @param {TwodsixActor} ship - The ship actor being damaged.
 * @param {any} damagePayload - The damage payload containing damage values and weapon type.
 * @returns {Promise<void>}
 */
export function generateShipDamageReport(ship: TwodsixActor, damagePayload: any): Promise<void> {
  const damageList = [];
  const damage = damagePayload.damageValue ?? 0;
  const currentArmor = ship?.system.shipStats.armor.value ?? 0;
  const currentHull = ship.system.shipStats.hull.value ?? 0;
  const weaponType = damagePayload.shipWeaponType;
  const netDamage = damage - (weaponType === "mesonGun" ? 0 : currentArmor);
  if (netDamage <= 0) {
    ui.notifications.warn("No regular ship damage to assess", { localize: true });
    //return;
  } else {
    const hitArray: any = getCEDamageEffects(netDamage);
    damageList.push(...getCEDamageLocationObject(hitArray, currentHull, currentArmor, weaponType));
  }

  let radReport = "None";
  if (damagePayload.radDamage > 0) {
    radReport = getCERadDamage(weaponType, currentArmor);
  }
  console.log(damageList, radReport);
};

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
    radiation: "Lucky escape - no radiation"
  },
  {
    min: 5,
    max: 8,
    radiation: `One random crew member suffers [[/r 2D6*10]] rads`
  },
  {
    min: 9,
    max: 10,
    radiation: "One random crew member suffers [[/r 4D6*10]] rads"
  },
  {
    min: 11,
    max: 11,
    radiation: "All crew suffer [[/r 2D6*10]] rads"
  },
  {
    min: 12,
    max: 12,
    radiation: "All crew suffer [[/r 4D6*10]] rads"
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
      return row.radiation;
    }
  }
  return "Unknown";
}

/**
 * Generates a random integer between min and max (inclusive).
 *
 * @param {number} min - The minimum integer value.
 * @param {number} max - The maximum integer value.
 * @returns {number} A random integer between min and max.
 */
function getRandomInteger(min:number, max:number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
