export default function registerHandlebarsHelpers():void {

  // If you need to add Handlebars helpers, here are a few useful examples:
  Handlebars.registerHelper('concat', function () {
    let outStr = '';
    for (const arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function (str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper('checkPsi', function (characteristic) {
    if (!game.user.isGM && characteristic.shortLabel === 'PSI' && characteristic.value === 0) {
      return false;
    }
    return true;
  });

  Handlebars.registerHelper('checkTrainedSkill', function (skill) {
    return skill.trained
  });

  Handlebars.registerHelper('shouldShowSkill', function (skill, hideUntrainedSkills) {
    return skill.trained || hideUntrainedSkills
  });

  Handlebars.registerHelper('getSkillValueWithJoat', getSkillValueWithJoat);

  function getSkillValueWithJoat(skill, joat) {
    if (skill.trained) return skill.value
    return skill.value + joat.value
  }

  Handlebars.registerHelper('getTotalSkillValue', function (skill, joat, mod) {
    return getSkillValueWithJoat(skill, joat) + mod
  });


  Handlebars.registerHelper({
    add: (v1, v2) => v1 + v2,
    sub: (v1, v2) => v1 - v2,
    mul: (v1, v2) => v1 * v2,
    div: (v1, v2) => v1 / v2,
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and() {
      return Array.prototype.every.call(arguments, Boolean);
    },
    or() {
      return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    }
  });
}
