// cuDesignSteps.js — CU “design” creation path (characteristic strings, age, career skills, rank, cash, bonus skill).
// Extracted from CUCharGenLogic to keep the main class smaller; methods delegate back to the logic instance where needed.
import { CU_DESIGN_CAREERS } from '../CUCharGenConstants.js';
import {
  assignCharacteristicPoolFromChoices,
  improveSkillCappedInState,
  localizedAllCharOptsForAssignment,
} from '../CharGenUtils.js';

export async function cuStepDesignCharacteristicsString(_logic, app) {
  const state = app.charState;

  const selection = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUChooseCharacteristicString'), [
    { value: 'A', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCharStringOptionA') },
    { value: 'B', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCharStringOptionB') },
    { value: 'C', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCharStringOptionC') },
    { value: 'D', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUCharStringOptionD') },
  ]);

  const valuesByString = {
    A: [7, 8, 7, 5, 8, 7],
    B: [10, 7, 4, 6, 6, 9],
    C: [3, 8, 9, 8, 5, 9],
    D: [2, 12, 9, 7, 5, 7],
  };
  const values = [...(valuesByString[selection] ?? valuesByString.A)];

  await assignCharacteristicPoolFromChoices(app, localizedAllCharOptsForAssignment(), values, opt =>
    game.i18n.format('TWODSIX.CharGen.Steps.AssignValueToCharacteristic', { label: opt.label }),
  );
}

export async function cuStepDesignAge(_logic, app) {
  const state = app.charState;
  const choice = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeDesignDecideOrRoll'), [
    { value: 'decide', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeDesignDecide') },
    { value: 'roll', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeDesignRoll') },
  ]);

  let roll = null;
  let bracket = null;
  if (choice === 'roll') {
    roll = await app._roll('1d6');
    bracket = roll === 1 ? 'early20s' : roll <= 3 ? 'late20s_early30s' : roll <= 5 ? 'late30s_early40s' : 'late40s_early50s';
  } else {
    bracket = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeDesignPickBracket'), [
      { value: 'early20s', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeBracketEarly20sOpt') },
      { value: 'late20s_early30s', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeBracketLate20sOpt') },
      { value: 'late30s_early40s', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeBracketLate30sOpt') },
      { value: 'late40s_early50s', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUAgeBracketLate40sOpt') },
    ]);
  }

  const bracketToAge = {
    early20s: 22,
    late20s_early30s: 30,
    late30s_early40s: 40,
    late40s_early50s: 50,
  };
  const bracketLabel = {
    early20s: 'Early Twenties',
    late20s_early30s: 'Late Twenties–Early Thirties',
    late30s_early40s: 'Late Thirties–Early Forties',
    late40s_early50s: 'Late Forties–Early Fifties',
  };
  const bracketSkillTotal = {
    early20s: 4,
    late20s_early30s: 5,
    late30s_early40s: 6,
    late40s_early50s: 6,
  };

  state.age = bracketToAge[bracket] ?? state.age;
  app._log('Age', `${bracketLabel[bracket] ?? state.age}${roll ? ` (1D6=${roll})` : ''} → Age ${state.age}`);
  state.log.push(
    `Age: ${bracketLabel[bracket] ?? state.age}${roll ? ` (1D6=${roll})` : ''} → Age ${state.age} (optional skill level total ${bracketSkillTotal[bracket] ?? '?' }).`,
  );
}

export async function cuStepDesignRank(_logic, app, careerType) {
  const state = app.charState;
  const soc = state.chars.soc ?? 0;

  const rank = soc >= 10 ? 6 : soc === 9 ? 5 : soc === 8 ? 4 : soc === 7 ? 3 : soc >= 5 ? 2 : 1;

  const titlesByCareer = {
    Agent: ['Detective', 'Senior Detective', 'Lieutenant', 'Captain', 'Commander', 'Chief'],
    Belter: ['‘Worker’', 'Senior ‘Worker’', 'Supervisor', 'Asst. Chief', 'Chief ‘Worker’', 'Manager'],
    Citizen: ['‘Worker’', 'Senior ‘Worker’', 'Supervisor', 'Asst. Chief', 'Chief ‘Worker’', 'Manager'],
    Explorer: ['Scout', 'Senior Scout', 'Lieutenant', 'Lieutenant Commander', 'Commander', 'Commodore'],
    Fixer: ['Hustler', 'Sales Rep', 'Senior Sales Rep', 'Manager', 'Executive', 'Senior Exec'],
    Marine: ['Private', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel'],
    Mercenary: ['Private', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel'],
    Merchant: ['Crewman', 'Bosun', '3rd Officer', '2nd Officer', 'Chief Officer', 'Captain'],
    Rogue: ['Soldier', 'Enforcer', 'Lieutenant', 'Captain', 'Deputy', 'Boss'],
    Scientist: ['Researcher', 'Team Lead', 'Scientist', 'Senior Scientist', 'Chief Scientist', 'Project Manager'],
    Spacer: ['Crewman', 'Petty Officer', 'Lieutenant', 'Lieutenant Commander', 'Commander', 'Captain'],
    Technician: ['Junior Technician', 'Senior Technician', 'Supervisor', 'Asst. Chief', 'Chief', 'Manager'],
  };

  const title = titlesByCareer[careerType]?.[rank - 1] ?? `Rank ${rank}`;
  app._log('Rank', `SOC ${soc} → Rank ${rank} (${careerType}: ${title})`);
  state.log.push(`Rank: SOC ${soc} → Rank ${rank} (${careerType}: ${title}).`);

  state.careers.push({
    name: careerType,
    terms: 0,
    rank,
    rankTitle: title,
    commissioned: false,
    mishap: false,
    assignment: careerType,
    benefitsLost: false,
    extraBenefitRolls: 0,
  });
  if (!state.previousCareers.includes(careerType)) {
    state.previousCareers.push(careerType);
  }
}

export async function cuResolveVehicleSpecialization(_logic, app, skillName) {
  if (skillName !== 'Vehicle') {
    return skillName;
  }
  return await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUVehicleSpecialization'), [
    { value: 'Ground Vehicle', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUVehicleGround') },
    { value: 'Watercraft', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUVehicleWater') },
    { value: 'Aircraft', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUVehicleAir') },
  ]);
}

export async function cuStepDesignCareerSkills(logic, app) {
  const state = app.charState;
  const careerKeys = Object.keys(CU_DESIGN_CAREERS).sort();
  const career = await app._choose(
    game.i18n.localize('TWODSIX.CharGen.Steps.CUDesignCareerSkillsTitle'),
    careerKeys.map(k => ({
      value: k,
      label: game.i18n.format('TWODSIX.CharGen.Steps.CUDesignCareerOption', {
        career: k,
        description: CU_DESIGN_CAREERS[k].description,
      }),
    })),
  );
  const def = CU_DESIGN_CAREERS[career];
  const autoSkill = def?.autoSkill;
  const otherSkills = def?.otherSkills ?? [];
  const allowed = [autoSkill, ...otherSkills].filter(Boolean);

  const baseAutoSkill = await cuResolveVehicleSpecialization(logic, app, autoSkill);
  improveSkillCappedInState(state, baseAutoSkill, { max: 3 });
  app._log('Automatic Skill', `${baseAutoSkill} +1`);
  state.log.push(`Design: automatic skill ${baseAutoSkill} +1.`);

  for (let i = 0; i < 5; i++) {
    const options = [];
    for (const sk of allowed) {
      const resolved = sk === 'Vehicle' ? 'Vehicle' : sk;
      const level = state.skills.has(resolved) ? state.skills.get(resolved) : -1;
      if (level >= 3) {
        continue;
      }
      options.push({ value: sk, label: `${sk}${level >= 0 ? ` (currently ${level})` : ''}` });
    }
    if (!options.length) {
      state.log.push('Design: no remaining eligible skills (all at level 3).');
      break;
    }

    const picked = await app._choose(
      game.i18n.format('TWODSIX.CharGen.Steps.CUDesignCareerSkillLevel', { current: i + 2 }),
      options,
    );
    const resolved = await cuResolveVehicleSpecialization(logic, app, picked);
    improveSkillCappedInState(state, resolved, { max: 3 });
    const cur = state.skills.has(resolved) ? state.skills.get(resolved) : 0;
    app._log('Skill', `${resolved} → ${cur}`);
    state.log.push(`Design: improved ${resolved} to ${cur}.`);
  }

  return career;
}

export async function cuApplyDesignCash(_logic, app) {
  const state = app.charState;
  const soc = state.chars.soc ?? 0;
  const roll = await app._roll('1d6');
  const cash = soc * roll * 500;
  state.cashBenefits += cash;
  app._log('Starting Cash', `SOC(${soc})×1D6(${roll})×500 = Cr${cash.toLocaleString()}`);
  state.log.push(`Starting cash: SOC(${soc})×1D6(${roll})×500 = Cr${cash.toLocaleString()}.`);
}

export async function cuApplyDesignBonusSkill(logic, app) {
  const state = app.charState;
  const tableChoice = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUBonusSkillDesignTable'), [
    { value: 'A', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUBonusSkillDesignTableA') },
    { value: 'B', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUBonusSkillDesignTableB') },
  ]);

  const tableA = ['Carousing', 'Leader', 'Melee Combat', 'Gun Combat', 'Vehicle', 'Streetwise'];
  const tableB = ['Medical', 'Electronics', 'Admin', 'Vacc Suit', 'Steward', 'Computer'];
  const entries = tableChoice === 'A' ? tableA : tableB;

  const mode = await app._choose(
    game.i18n.format('TWODSIX.CharGen.Steps.CUBonusSkillDesignPickOrRoll', { table: tableChoice }),
    [
      { value: 'pick', label: game.i18n.localize('TWODSIX.CharGen.Steps.CUPickFromTable') },
      { value: 'roll', label: game.i18n.localize('TWODSIX.CharGen.Steps.CURollOnTable') },
    ],
  );

  for (let attempt = 1; attempt <= 25; attempt++) {
    let chosen = null;
    let dr = null;
    if (mode === 'roll') {
      dr = await app._roll('1d6');
      chosen = entries[dr - 1];
    } else {
      const opts = entries.map(sk => {
        const lvl = state.skills.has(sk) ? state.skills.get(sk) : -1;
        return { value: sk, label: `${sk}${lvl >= 0 ? ` (currently ${lvl})` : ''}` };
      });
      chosen = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.CUPickBonusSkillPlusOne'), opts);
    }

    const resolved = await cuResolveVehicleSpecialization(logic, app, chosen);
    if (!improveSkillCappedInState(state, resolved, { max: 3 })) {
      app._log('Bonus Skill', `${resolved} would exceed level 3 — rerolling`);
      continue;
    }
    const next = state.skills.get(resolved);
    app._log('Bonus Skill', `${resolved} → ${next}${dr ? ` (1D6=${dr})` : ''}`);
    state.log.push(`Bonus skill: ${resolved} → ${next}${dr ? ` (1D6=${dr})` : ''}.`);
    return;
  }

  app._log('Bonus Skill', 'Unable to grant bonus skill after many rerolls.');
  state.log.push('Bonus skill: no valid result after rerolls.');
}
