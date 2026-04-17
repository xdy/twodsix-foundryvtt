import { SHARED_AGING_TABLE } from '../../SharedCharGenConstants.js';

export const CE_AGING_TABLE = SHARED_AGING_TABLE;

export const CE_MISHAP_DESC = [
  null,
  'Injured in action.',
  'Honorably discharged.',
  'Honorably discharged after legal battle. Cr10,000 debt added.',
  'Dishonorably discharged. Benefits lost.',
  'Dishonorably discharged; 4 extra years in prison. Benefits lost.',
  'Medically discharged. Roll on injury table.'
];

export const CE_INJURY_DESC = [
  null,
  'Nearly killed.',
  'Severely injured.',
  'Missing eye or limb. STR or DEX -2.',
  'Scarred. One physical characteristic -2.',
  'Injured. One physical characteristic -1.',
  'Lightly injured. No permanent effect.'
];

export const CE_DRAFT_TABLE = [
  null,
  'Aerospace Defense',
  'Marine',
  'Maritime Defense',
  'Navy',
  'Scout',
  'Surface Defense'
];

export const CE_CASCADE_SKILLS = {
  'Gun Combat': [
    'Gun Combat (Slug Rifle)',
    'Gun Combat (Slug Pistol)',
    'Gun Combat (Energy Rifle)',
    'Gun Combat (Energy Pistol)',
    'Gun Combat (Shotguns)',
    'Gun Combat (Archery)'
  ],
  'Melee Combat': [
    'Melee Combat (Blades)',
    'Melee Combat (Bludgeoning)',
    'Melee Combat (Natural Weapons)',
    'Melee Combat (Unarmed)'
  ],
  'Vehicle': [
    'Vehicle (Wheeled)',
    'Vehicle (Tracked)',
    'Vehicle (Grav)',
    'Vehicle (Mole)'
  ],
  'Sciences': [
    'Science (Life Sciences)',
    'Science (Physical Sciences)',
    'Science (Social Sciences)',
    'Science (Space Sciences)'
  ],
  'Animals': [
    'Animals (Farming)',
    'Animals (Riding)',
    'Animals (Veterinary)',
    'Animals (Survival)'
  ]
};

export const CE_HOMEWORLD_DESCRIPTORS = {
  'No Law': 'Gun Combat',
  'Low Law': 'Gun Combat',
  'Medium Law': 'Gun Combat',
  'High Law': 'Melee Combat',
  'Agricultural': 'Animals',
  'Asteroid': 'Zero-G',
  'Desert': 'Survival',
  'Fluid Oceans': 'Watercraft',
  'Garden': 'Animals',
  'High Technology': 'Computer',
  'High Population': 'Streetwise',
  'Ice-Capped': 'Zero-G',
  'Industrial': 'Broker',
  'Low Technology': 'Survival',
  'Poor': 'Animals',
  'Rich': 'Carousing',
  'Water World': 'Watercraft',
  'Vacuum': 'Zero-G'
};

export const CE_EDUCATION_SKILLS = [
  'Admin',
  'Advocate',
  'Animals',
  'Carousing',
  'Comms',
  'Computer',
  'Electronics',
  'Engineering',
  'Life Sciences',
  'Linguistics',
  'Mechanics',
  'Medicine',
  'Physical Sciences',
  'Social Sciences',
  'Space Sciences'
];

export const CE_SKILL_NAME_MAP = {
  "Jack o' Trades": 'Jack of All Trades',
  'Life Sciences': 'Science (Life Sciences)',
  'Physical Sciences': 'Science (Physical Sciences)',
  'Social Sciences': 'Science (Social Sciences)',
  'Space Sciences': 'Science (Space Sciences)'
};
