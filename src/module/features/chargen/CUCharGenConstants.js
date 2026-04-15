export const CU_SKILL_CATEGORY_TABLES = {
  'Combat': ['Tactics', 'Gun Combat', 'Gun Combat', 'Melee Combat', 'Heavy Weapons', 'Demolitions'],
  'People': ['Bribery', 'Leader', 'Carousing', 'Admin', 'Streetwise', 'Forgery'],
  'Space Ops': ['Gunnery', 'Pilot', 'Navigation', 'Vacc Suit', 'Computer', 'Medical'],
  'Technical': ['Comms', 'Mechanical', 'Electronics', 'Computer', 'Security', 'Engineering'],
  'Civil': ['Vehicle', 'Computer', 'Mining', 'Medical', 'Investigate', 'Loader'],
  'Wilderness': ['Survival', 'Navigation', 'Leader', 'Recon', 'Medical', 'Vehicle'],
  'Crime': ['Streetwise', 'Forgery', 'Melee Combat', 'Gun Combat', 'Bribery', 'Security'],
  'Business': ['Admin', 'Broker', 'Carousing', 'Forgery', 'Broker', 'Negotiate'],
  'Low Tech': ['Riding', 'Archery', 'Melee Combat', 'Recon', 'Tactics', 'Survival'],
  'Science': ['Navigation', 'Vehicle', 'Vacc Suit', 'Computer', 'Investigate', 'Medicine']
};

export const CU_DESIGN_CAREERS = {
  Agent: {
    description: 'A law enforcer, secret agent, spy or police officer.',
    autoSkill: 'Investigate',
    otherSkills: ['Gun Combat', 'Melee Combat', 'Computer', 'Streetwise', 'Medical', 'Security', 'Ground Vehicle'],
  },
  Belter: {
    description: 'An asteroid miner, pioneer, prospector or colonial roughneck.',
    autoSkill: 'Vacc Suit',
    otherSkills: ['Mining', 'Mechanical', 'Comms', 'Ground Vehicle', 'Loader', 'Navigation', 'Melee Combat'],
  },
  Citizen: {
    description: 'A colonist or civilian, representing one of many occupations.',
    autoSkill: 'Vehicle',
    otherSkills: ['Mechanical', 'Agriculture', 'Carousing', 'Leader', 'Medical', 'Computer', 'Loader'],
  },
  Explorer: {
    description: 'A survey scout, deep space explorer, first-in mission specialist.',
    autoSkill: 'Survival',
    otherSkills: ['Pilot', 'Navigation', 'Vehicle', 'Comms', 'Investigate', 'Leader', 'Gun Combat'],
  },
  Fixer: {
    description: 'A deal-maker, middle-man, executive, sleazy lawyer, street fixer.',
    autoSkill: 'Broker',
    otherSkills: ['Admin', 'Computer', 'Carousing', 'Forgery', 'Bribery', 'Leader', 'Vehicle'],
  },
  Marine: {
    description: 'Mobile infantry, space marines, ship’s troops or star commandos.',
    autoSkill: 'Gun Combat',
    otherSkills: ['Melee Combat', 'Vacc Suit', 'Ground Vehicle', 'Recon', 'Heavy Weapons', 'Demolitions', 'Tactics'],
  },
  Mercenary: {
    description: 'Ground-based infantry, either regular army or mercenaries.',
    autoSkill: 'Gun Combat',
    otherSkills: ['Melee Combat', 'Bribery', 'Ground Vehicle', 'Recon', 'Heavy Weapons', 'Demolitions', 'Tactics'],
  },
  Merchant: {
    description: 'Interstellar truckers, haulage crews, making money between the stars.',
    autoSkill: 'Vacc Suit',
    otherSkills: ['Pilot', 'Navigation', 'Engineering', 'Computer', 'Comms', 'Loader', 'Broker'],
  },
  Rogue: {
    description: 'A criminal, thief, gang-member or saboteur.',
    autoSkill: 'Streetwise',
    otherSkills: ['Security', 'Gun Combat', 'Melee Combat', 'Bribery', 'Forgery', 'Ground Vehicle', 'Demolitions'],
  },
  Primitive: {
    description: 'Inhabitant of a low tech, primitive world, barbarian, savage.',
    autoSkill: 'Survival',
    otherSkills: ['Riding', 'Leader', 'Archery', 'Melee Combat', 'Recon', 'Tactics', 'Carousing'],
  },
  Spacer: {
    description: 'Military crewman or officer, member of the interstellar navy or space force.',
    autoSkill: 'Vacc Suit',
    otherSkills: ['Pilot', 'Gunnery', 'Navigation', 'Engineering', 'Computer', 'Comms', 'Medical'],
  },
  Scavenger: {
    description: 'A post-apocalyptic road warrior, survivor or resistance fighter.',
    autoSkill: 'Ground Vehicle',
    otherSkills: ['Navigation', 'Leader', 'Gun Combat', 'Melee Combat', 'Survival', 'Broker', 'Mechanical'],
  },
  Scientist: {
    description: 'Anything from a doctor to a geologist, physicist to bioweapon expert.',
    autoSkill: 'Investigate',
    otherSkills: ['Computer', 'Vehicle', 'Admin', 'Comms', 'Survival', 'Navigation', 'Medical'],
  },
  Technician: {
    description: 'A gearhead, engineer, hacker, mechanic, cyborg technician, etc.',
    autoSkill: 'Computer',
    otherSkills: ['Mechanical', 'Electronics', 'Engineering', 'Comms', 'Vehicle', 'Vacc Suit', 'Security'],
  },
};

export const CU_RISK_FAIL_EVENTS = [
  { threshold: 14, description: 'Died in service. [DIED]' },
  { threshold: 12, description: 'Badly injured. Lower Str, Dex or End by 1. How did it happen? Leave the Career. [INJURED_LEAVE]' },
  { threshold: 11, description: 'You get the blame for a disaster that killed or injured several people.' },
  { threshold: 10, description: 'Great achievements stolen by a rival group or organisation, taking all the credit.' },
  { threshold: 9, description: 'Stressful situations cause a mental collapse. Roll 2D6, on 7 or less, lower Int by 1. [INT_CRISIS]' },
  { threshold: 8, description: 'Get into debt of 4x Career Cash, by turning to criminal world. Why did this happen? [DEBT_4X]' },
  { threshold: 7, description: 'Your achievements were sabotaged by a colleague. Gain an Enemy. [ENEMY]' },
  { threshold: 6, description: 'People in power have been meddling with you, your team and your organisation.' },
  { threshold: 5, description: 'Revolution, war or disaster turns your world and relationships upside down.' },
  { threshold: 4, description: 'You saved lives, but it had to be covered up. You cannot talk about it. Ever.' },
  { threshold: 3, description: 'You broke the rules to help out an innocent person. Gain a Contact. What did you do? [CONTACT]' }
];

export const CU_RISK_SUCCESS_EVENTS = [
  { threshold: 18, description: 'Chance to make it big! Roll 2D6: on 4+ gain automatic promotion and one extra skill roll; on 2-3 you spend this term in prison (lower Soc by 1, gain a criminal Contact). [AUTO_PROMO_OR_PRISON]' },
  { threshold: 17, description: 'Caused someone to be humiliated or demoted. Gain an Enemy. [ENEMY]' },
  { threshold: 16, description: 'You are thrown into a crisis and take charge. Gain Leader-1. [SKILL:Leader:1]' },
  { threshold: 15, description: 'You scored big this term. Gain Cr20,000. How did you get this money? [CASH_20000]' },
  { threshold: 14, description: 'A romance expanded your horizons. Gain +1 Edu. Are you still in love, or is it over? [EDU_PLUS1]' },
  { threshold: 13, description: 'Gain a powerful Contact in the organisation. What did you do to gain this contact? [CONTACT]' },
  { threshold: 12, description: 'After an incident you are pushed into a backroom job. Gain Computer-1. [SKILL:Computer:1]' },
  { threshold: 11, description: 'Tragic love affair. Roll 1D6: 1-2 They died; 3-4 They Vanished; 5-6 They are still around.' },
  { threshold: 10, description: 'Make a good Friend in your own career or organization. [FRIEND]' },
  { threshold: 9, description: 'Conflict became a part of your life. Gain +1 Str. What was going on? [STR_PLUS1]' },
  { threshold: 8, description: 'Fast dates and partying. Gain Carousing-1. [SKILL:Carousing:1]' },
  { threshold: 7, description: 'An intense situation was survived with a colleague. Make a Friend. [FRIEND]' },
  { threshold: 6, description: 'Gain fame and recognition in your career for deserved actions. Gain +1 Soc. [SOC_PLUS1]' },
  { threshold: 5, description: 'Uncover a dangerous secret about a person or organisation. Gain Bribery-1. [SKILL:Bribery:1]' },
  { threshold: 4, description: 'Romance that continues today, or ended on a good note. Gain a Friend. [FRIEND]' },
  { threshold: 3, description: 'Gain a useful friend-of-a-friend Contact. [CONTACT]' },
  { threshold: 2, description: 'Betrayed by a close friend, now an Enemy. Gain a useful friend-of-a-friend Contact. [ENEMY][CONTACT]' }
];

export const CU_PROMO_FAIL_EVENTS = [
  { threshold: 12, description: 'You presided over a disaster and the stigma will stay with you for years. Gain -1 on next term\'s promotion attempt. [PROMO_PENALTY_1]' },
  { threshold: 11, description: 'You broke a lot of rules to get the job done. Too many rules. What was the job?' },
  { threshold: 10, description: 'People around you messed up and made you look bad. What did they do?' },
  { threshold: 9, description: 'You\'re too involved with romance. Gain a romantic Friend. [FRIEND]' },
  { threshold: 8, description: 'Too many small screw ups this term. What were they?' },
  { threshold: 7, description: 'You tried for promotion but failed. C\'est la vie.' },
  { threshold: 6, description: 'A rival got the position you were after, now making your life hell. Gain an Enemy. [ENEMY]' },
  { threshold: 5, description: 'Your superior sabotaged your chances, he needs you where you are.' },
  { threshold: 4, description: 'Something about your personality means you got overlooked. What is it?' },
  { threshold: 3, description: 'You were second choice, they like you! Gain a Contact and +2 on next term\'s attempt. [CONTACT][PROMO_BONUS_2]' }
];

export const CU_PROMO_SUCCESS_EVENTS = [
  { threshold: 12, description: 'Gain an extra Benefit roll when you leave the Career. [EXTRA_BENEFIT]' },
  { threshold: 11, description: 'You broke the rules to win big. They had to promote you when they wanted to fire you.' },
  { threshold: 10, description: 'A senior officer acts as a patron, ally and Contact. [CONTACT]' },
  { threshold: 9, description: 'You won promotion and an award, accolade or fame. What great thing did you do?' },
  { threshold: 8, description: 'You did great work, and you\'ve been recognized with promotion! Gain +1 Edu. [EDU_PLUS1]' },
  { threshold: 7, description: 'You scraped past, it doesn\'t look good. You spend this term proving yourself.' },
  { threshold: 6, description: 'You now owe a favour to a senior officer. Make a note of this.' },
  { threshold: 5, description: 'You beat a friend to the promotion, they are bitter. Make an Enemy. [ENEMY]' },
  { threshold: 4, description: 'Promotion means a transfer. Lose one Friend or Contact.' },
  { threshold: 3, description: 'Your promotion was built on lies and false achievements. Only you know this secret.' },
  { threshold: 2, description: 'A colleague colluded to make you look good. Now this Enemy has a hold over you. [ENEMY]' }
];

export const CU_BENEFITS_TABLE = [
  { threshold: 12, description: 'Augment 5 points or +1 End [AUGMENT_OR_END]' },
  { threshold: 11, description: 'Augment 5 points or CASH [AUGMENT_OR_CASH]' },
  { threshold: 10, description: 'CASH [CASH]' },
  { threshold: 9, description: 'Weapon or rare/custom piece of equipment (up to Cr5,000) [WEAPON]' },
  { threshold: 8, description: '+1 Edu [EDU_PLUS1]' },
  { threshold: 7, description: 'CASH [CASH]' },
  { threshold: 6, description: 'CASH [CASH]' },
  { threshold: 5, description: '+1 Soc [SOC_PLUS1]' },
  { threshold: 4, description: '+1 Int [INT_PLUS1]' },
  { threshold: 3, description: '+1 Str [STR_PLUS1]' },
  { threshold: 2, description: '+1 Dex [DEX_PLUS1]' }
];
