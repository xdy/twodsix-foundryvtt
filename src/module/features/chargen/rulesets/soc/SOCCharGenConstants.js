import { SHARED_AGING_TABLE } from '../../SharedCharGenConstants.js';

export const SOC_STANDARD_CHARACTERISTIC_ARRAY = [10, 9, 8, 7, 6, 5];
export const SOC_POINTBUY_MAX_POINTS = 42;
export const SOC_POINT_BUY_MINIMUM_VALUE = 1;
export const SOC_POINT_BUY_MAXIMUM_VALUE = 15;
export const SOC_STARTING_AGE = 14;
export const SOC_TERM_YEARS = 4;
export const SOC_AGING_TABLE = SHARED_AGING_TABLE;

export const SOC_BACKGROUNDS = [
  { name: 'Metropolis', skills: ['Streetwise', 'Liaison', 'Sneak'] },
  { name: 'Port Town', skills: ['Watercraft', 'Craft', 'Athletics'] },
  { name: 'Aristocracy', skills: ['Carousing', 'Riding', 'Govern'] },
  { name: 'Priestly Acolyte', skills: ['Religion', 'Liaison', 'Leadership'] },
  { name: 'Peasantry', skills: ['Animals', 'Riding', 'Athletics'] },
  { name: 'Barbaric Wastes', skills: ['Animals', 'Scout', 'Survival'] },
];

export const SOC_SKILL_PACKAGES = [
  { name: 'Exploration', skills: ['Scout', 'Craft', 'Riding', 'Natural Philosophy', 'Survival'] },
  { name: 'Military', skills: ['Leadership', 'Artillery', 'Melee Combat', 'Archery', 'Battle'] },
  { name: 'Seafaring', skills: ['Watercraft', 'Artillery', 'Craft', 'Scout', 'Healing'] },
  { name: 'Trading', skills: ['Govern', 'Liaison', 'Carousing', 'Streetwise', 'Steward'] },
  { name: 'Criminal', skills: ['Streetwise', 'Sneak', 'Govern', 'Scout', 'Deception'] },
];

export const SOC_SKILL_NAME_MAP = {
  'Jack o’Trades': 'Jack of All Trades',
  "Jack o'Trades": 'Jack of All Trades',
  'Jack o’ Trades': 'Jack of All Trades',
  'Jack o Trades': 'Jack of All Trades',
  Melee: 'Melee Combat',
  'Natural Phil.': 'Natural Philosophy',
  'Natural Phil': 'Natural Philosophy',
};

export const SOC_CASCADE_SKILLS = {};

export const SOC_PREREQUISITES = {
  Noble: { char: 'soc', target: 10 },
  Scholar: { char: 'edu', target: 8 },
  Shaman: { char: 'end', target: 8 },
  Sorcerer: { char: 'int', target: 8 },
};

/** Injury table martial −1 DM (combat-oriented species careers). */
export const SOC_MARTIAL_CAREERS = new Set([
  'Barbarian',
  'Noble',
  'Pirate',
  'Rogue',
  'Sailor',
  'Shaman',
  'Soldier',
  'The Draconid',
  'The Dwarf',
  'The Troll',
  'The Centaur',
  'The Goblin',
]);

export const SOC_LIFE_EVENT_TABLES = [
  {
    name: 'Hinterlands',
    events: [
      {
        roll: 2,
        description: 'Attacked during a hunt.',
        checks: [{ skill: 'Archery', target: 8 }, { skill: 'Melee Combat', target: 8 }],
        always: ['[SKILL:Survival:1]'],
        onFail: ['[INJURY]'],
      },
      { roll: 3, description: 'Disaster or war changes your fortunes. [LOSE_BENEFIT_ROLL]' },
      { roll: 4, description: 'A close friend betrays you. [ALLY_TO_ENEMY]' },
      {
        roll: 5,
        description: 'The local noble takes an interest in you.',
        effects: [{ connector: 'or', tags: ['ALLY_AND_LOSE_BENEFIT', 'ENEMY_AND_BENEFIT'] }],
      },
      { roll: 6, description: 'You spend time in the big city. [LIFE_EVENT:City]' },
      { roll: 7, description: 'You form a close relationship. [ALLY]' },
      { roll: 8, description: 'You travel to far off locations. [SKILL:Language:1]' },
      { roll: 9, description: 'Traders teach you more of the outside world. [EDU_PLUS1]' },
      { roll: 10, description: 'You come into an unexpected inheritance. [CASH_ROLL:1d6*10]' },
      { roll: 11, description: 'You have a very good year. [BENEFIT_ROLL]' },
      { roll: 12, description: 'Strange things happen. [UNUSUAL_EVENT]' },
    ],
  },
  {
    name: 'Village',
    events: [
      { roll: 2, description: 'You are injured or become sick. [INJURY]' },
      {
        roll: 3,
        description: 'Your village is attacked by raiders or barbarians. [LOSE_BENEFIT_ROLL] Gain Melee Combat or Archery.',
        effects: ['LOSE_BENEFIT_ROLL', { connector: 'or', tags: ['SKILL:Melee Combat:1', 'SKILL:Archery:1'] }],
      },
      { roll: 4, description: 'A romantic relationship ends badly. [ENEMY]' },
      { roll: 5, description: 'You work hard to help your village prosper. [ALLY] [ENEMY]' },
      {
        roll: 6,
        description: 'You travel to the big city or other exotic locations. Gain Language or Streetwise.',
        effects: [{ connector: 'or', tags: ['SKILL:Language:1', 'SKILL:Streetwise:1'] }],
      },
      { roll: 7, description: 'You are married or form a close bond. [ALLY]' },
      { roll: 8, description: 'You do something heroic that everyone sees. [SOC_PLUS1]' },
      { roll: 9, description: 'Traders discover something valuable. [BENEFIT_ROLL]' },
      { roll: 10, description: 'Something good happens to you. [CASH_ROLL:1d6*10]' },
      {
        roll: 11,
        description: 'A noble wants what you have. Lose a Benefit roll or an Ally.',
        effects: [{ connector: 'or', tags: ['LOSE_BENEFIT_ROLL', 'LOSE_ALLY'] }],
      },
      { roll: 12, description: 'Weird things are happening. [UNUSUAL_EVENT]' },
    ],
  },
  {
    name: 'City',
    events: [
      { roll: 2, description: 'You are mugged on your way home from the tavern. [INJURY]' },
      { roll: 3, description: 'A relationship ends badly. [ALLY_TO_ENEMY]' },
      {
        roll: 4,
        description: 'A plague sweeps through the city.',
        checks: [{ skill: 'Healing', target: 8 }],
        onFail: [{ connector: 'or', tags: ['STR_MINUS1_AND_END_MINUS1', 'INJURY'] }],
      },
      {
        roll: 5,
        description: 'Fire sweeps through your neighborhood.',
        checks: [{ skill: 'DEX', target: 8 }],
        onSuccess: ['[LOSE_BENEFIT_ROLL]'],
        onFail: ['[INJURY]'],
      },
      { roll: 6, description: 'You must flee for your life and begin adventuring. [END_CAREER]' },
      { roll: 7, description: 'You gain an important friend or lover. [ALLY]' },
      { roll: 8, description: 'You travel to far off lands. [SKILL:Language:1]' },
      { roll: 9, description: 'Unexpected wealth comes your way. [CASH_ROLL:1d6*10]' },
      { roll: 10, description: 'Something good happens to you. [BENEFIT_ROLL]' },
      {
        roll: 11,
        description: 'You briefly come in contact with royalty or a high noble.',
        checks: [{ skill: 'SOC', target: 8 }],
        onSuccess: ['[ALLY:Royal]'],
      },
      { roll: 12, description: 'Something strange happens to you. [UNUSUAL_EVENT]' },
    ],
  },
];

export const SOC_UNUSUAL_EVENTS = [
  {
    roll: 2,
    description: 'You have a talent for magic. Gain Alchemy, Artifice, or Sorcery.',
    effects: [{ connector: 'or', tags: ['SKILL:Alchemy:1', 'SKILL:Artifice:1', 'SKILL:Sorcery:1'] }],
  },
  { roll: 3, description: 'You are acknowledged as an illegitimate noble. [MATERIAL:Freehold] [ENEMY:Noble]' },
  { roll: 4, description: 'Disaster strikes. [LOSE_ALL_BENEFITS]' },
  { roll: 5, description: 'You are attacked and left for dead.', checks: [{ skill: 'END', target: 8 }], onFail: ['[INJURY]', '[INJURY]'] },
  { roll: 6, description: 'Someone hates you. [ENEMY]' },
  { roll: 7, description: 'You gain close friends. [ALLY_ROLL:1d3+1]' },
  { roll: 8, description: 'A magical creature enters your life. [MATERIAL:Familiar]' },
  { roll: 9, description: 'You discover a strange wonder. [MATERIAL:Magic Item]' },
  { roll: 10, description: 'You become wealthy. [CASH_ROLL:1d6*100]' },
  { roll: 11, description: 'You lose about a year and remember none of it.' },
  { roll: 12, description: 'You meet a deity or supernatural power. [SKILL:Religion:1] [SOC_PLUS1]' },
];

export const SOC_INJURY_TABLE = [
  { min: -Infinity, max: -6, description: 'Severe lasting injury: lost hand, eye, or foot.', effects: ['MATERIAL:Severe lasting injury'] },
  { min: -5, max: -2, description: 'Healed badly: all physical characteristics -1.', effects: ['STR_MINUS1', 'DEX_MINUS1', 'END_MINUS1'] },
  { min: -1, max: -1, description: 'Incomplete healing: one physical characteristic -2.', effects: ['PHYS_MINUS2'] },
  { min: 0, max: 0, description: 'Mild lasting injury: scarred, finger lost, or teeth lost.', effects: ['MATERIAL:Mild lasting injury'] },
  { min: 1, max: 5, description: 'Obviously scarred, though not severely.', effects: ['MATERIAL:Scarred'] },
  { min: 6, max: Infinity, description: 'Lightly injured. No permanent effects.', effects: [] },
];

/** 2d6 chargen table for failed High Sorcery / mishaps (SRD summary; Referee may substitute). */
export const SOC_SORCERY_MISHAP_TABLE = [
  { roll: 2, description: 'Magical backlash. [INJURY]' },
  { roll: 3, description: 'You lose magical focus. [LOSE_BENEFIT_ROLL]' },
  { roll: 4, description: 'A dark power marks you. [ENEMY:Supernatural foe]' },
  { roll: 5, description: 'Your reputation suffers. [SOC_MINUS1]' },
  { roll: 6, description: 'Strain leaves you drained. [END_MINUS1]' },
  { roll: 7, description: 'Strange omens follow you. [LIFE_EVENT]' },
  { roll: 8, description: 'Weird energies surround you. [UNUSUAL_EVENT]' },
  { roll: 9, description: 'You scrape through unscathed but shaken. (No extra mechanical effect.)' },
  { roll: 10, description: 'Minor mishap — lose a Benefit roll. [LOSE_BENEFIT_ROLL]' },
  { roll: 11, description: 'A patron turns away. [LOSE_ALLY]' },
  { roll: 12, description: 'The magic recoils violently. [INJURY]' },
];
