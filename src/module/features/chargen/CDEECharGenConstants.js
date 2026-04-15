import { SHARED_AGING_TABLE } from './SharedCharGenConstants.js';

export const CDEE_AGING_TABLE = SHARED_AGING_TABLE;

export const CDEE_HOMEWORLD_TYPES = [
  { name: 'High-tech core world', skills: ['Computer', 'Grav Vehicles', 'Streetwise'] },
  { name: 'Water World', skills: ['Watercraft', 'Repair', 'Athletics'] },
  { name: 'Capital World', skills: ['Carousing', 'Grav Vehicles', 'Liaison'] },
  { name: 'Frontier colony', skills: ['Driving', 'Watercraft', 'Survival'] },
  { name: 'Inhospitable outpost', skills: ['Repair', 'Science', 'Zero-G'] },
  { name: 'Primitive backwater', skills: ['Animals', 'Recon', 'Survival'] }
];

export const CDEE_LIFE_EVENTS = [
  { roll: 2, description: 'Sickness or Injury. Roll on the [INJURY] table.' },
  { roll: 3, description: 'Birth or Death. Someone close to the character dies or is born.' },
  { roll: 4, description: 'Good Fortune. Something good happens to you. Gain [BENEFIT_DM:1] on one Cash Benefit roll.' },
  { roll: 5, description: 'Ending of Relationship. Change a [CONTACT] into an [ENEMY].' },
  { roll: 6, description: 'Improved Relationship. Change an [ENEMY] into a [CONTACT].' },
  { roll: 7, description: 'New Relationship. You become involved in a romantic relationship. Gain a [CONTACT].' },
  { roll: 8, description: 'Travel. You spend a lot of time travelling between worlds. Gain either [CHOOSE_SKILL:Steward,Carousing].' },
  { roll: 9, description: 'Study. You work to improve yourself. Gain [EDU_PLUS1].' },
  { roll: 10, description: 'Crime. You commit, or are accused of committing, a crime. Lose one Benefit roll. Throw Admin 8+. If you fail, you must spend the next Term in [PRISON].' },
  { roll: 11, description: 'Cybersurgery. You undergo surgery to install commonplace cybernetics. Gain any implants with a total cost of Cr5000.' },
  { roll: 12, description: 'Unusual Event. Something strange or unusual happens to you. [UNUSUAL_EVENT]' }
];

export const CDEE_UNUSUAL_EVENTS = [
  'Missing Time. For an unknown reason, there is a period of 3D days you cannot remember.',
  'Psionics. Gain basic Psionic training.',
  'Trait. Gain a free [TRAIT].',
  'Underworld Contacts. Gain a senior criminal [CONTACT].',
  'Alien Artifact. You find a strange alien artifact.',
  'Amnesia. You wake up with no memory of your past.'
];

export const CDEE_PRISON_EVENTS = [
  { roll: 2, description: 'Sickness or Injury. Roll on the [INJURY] table.' },
  { roll: 3, description: 'Escape Attempt: you attempt a daring, foolhardy escape! [CHECK:Deception:10] or [CHECK:Stealth:10] or [CHECK:Admin:10]. Succeed: escape to Rogue. Fail: [INJURY] and another term in [PRISON].' },
  { roll: 4, description: 'Gang Recruitment: Agree: [CONTACT:Criminal]. Refuse: [CHECK:Melee Combat:8]. Succeed: [CONTACT:Law Enforcement]. Fail: [INJURY] and [CONTACT:Law Enforcement].' },
  { roll: 5, description: 'Smuggling: [CHECK:Streetwise:8]. Succeed: [BENEFIT_ROLL]. Fail: [LOSE_BENEFIT_ROLL].' },
  { roll: 6, description: 'Forced Labor: Gain [SKILL:Athletics:1].' },
  { roll: 7, description: 'Cell Mates: Gain a [CONTACT].' },
  { roll: 8, description: 'Prison Riot! [CHECK:Melee Combat:8] or [CHECK:Stealth:8] or [CHECK:Liaison:8] to avoid [INJURY]. Either way, gain a level in the skill you rolled.' },
  { roll: 9, description: 'Study. Gain [EDU_PLUS1].' },
  { roll: 10, description: 'Assault a Guard: [CHECK:Melee Combat:8]. Succeed: [SKILL:Streetwise:1] and [CONTACT:Criminal]. Fail: [INJURY].' },
  { roll: 11, description: 'Experimentation. [CHECK:END:8]. Succeed: gain [TRAIT:Hard to Kill]. Fail: [END_MINUS1].' },
  { roll: 12, description: 'Paroled for good behavior! Gain one career skill and resume career.' }
];

export const CDEE_PRISON_SKILLS = ['Athletics', 'Deception', 'Melee Combat', 'Repair', 'Steward', 'Streetwise'];

export const CDEE_INJURY_TABLE = [
  { effect: -6, description: 'Nearly killed. [STR_PLUS-6] and other physicals -2 (or one -4). Lost limb/eye.' },
  { effect: -2, description: 'Severely injured. [STR_PLUS-3]. Possible lost limb.' },
  { effect: 0, description: 'Injured. Possible lost hand/eye or [PHYS_MINUS2].' },
  { effect: 5, description: 'Injured and suffers mild lasting injuries. Scarred or [PHYS_MINUS1].' },
  { effect: 6, description: 'Lightly injured. No permanent effects.' }
];

export const CDEE_SKILL_PACKAGES = [
  { name: 'Exploration', skills: ['Piloting', 'Engineering', 'Survival', 'Science', 'Repair'] },
  { name: 'Military', skills: ['Leadership', 'Gunnery', 'Melee Combat', 'Heavy Weapons', 'Tactics'] },
  { name: 'Naval', skills: ['Piloting', 'Computer', 'Repair', 'Gunnery', 'Engineering'] },
  { name: 'Trading', skills: ['Piloting', 'Engineering', 'Liaison', 'Medicine', 'Steward'] },
  { name: 'Criminal', skills: ['Streetwise', 'Stealth', 'Admin', 'Recon', 'Deception'] }
];

export const CDEE_ZERO_LEVEL_MILITARY = ['Athletics', 'Driving', 'Gun Combat', 'Melee Combat', 'Zero-G'];
export const CDEE_ZERO_LEVEL_CIVILIAN = ['Athletics', 'Driving', 'Zero-G'];

export const CDEE_CASCADE_SKILLS = {};

export const CDEE_SKILL_NAME_MAP = {
  'Computers': 'Computer',
  'Grav Vehicle': 'Grav Vehicles'
};

export const CDEE_POINTBUY_MAX_POINTS = 42;
//Not actually stated anywhere, but I think it's RAI
export const CDEE_POINT_BUY_MINIMUM_VALUE = 2;
//Not actually stated anywhere, but I think it's RAI
export const CDEE_POINT_BUY_MAXIMUM_VALUE = 15;

