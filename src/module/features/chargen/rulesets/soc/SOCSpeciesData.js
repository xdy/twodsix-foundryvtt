// SOCSpeciesData.js — Sword of Cepheus chargen: human vs species careers (SRD)

/** @typedef {{ str?: number, dex?: number, end?: number, int?: number, edu?: number, soc?: number }} SocCharDeltas */

/** Human SOC careers (compendium names); species careers are separate items. */
export const SOC_HUMAN_CAREER_NAMES = new Set([
  'Barbarian',
  'Commoner',
  'Noble',
  'Pirate',
  'Priest',
  'Rogue',
  'Sailor',
  'Scholar',
  'Shaman',
  'Sorcerer',
  'Soldier',
  'Vagabond',
]);

/** Non-human career document names in `soc-srd-careers` pack. */
export const SOC_SPECIES_CAREER_NAMES = new Set([
  'The Antediluvian',
  'The Draconid',
  'The Dwarf',
  'The Elf',
  'The Geckofolk',
  'The Gnome',
  'The Goblin',
  'The Halfling',
  'The Centaur',
  'The Insectoid',
  'The Troll',
]);
