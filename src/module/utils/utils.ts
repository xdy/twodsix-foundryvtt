// https://stackoverflow.com/a/34749873
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item):boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param sources
 */
export function mergeDeep(target:Record<string, any>, ...sources:Record<string, any>[]):Record<string, any> {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

export function getCharShortName(char: string): string {
  switch (char) {
    case "ALT1":
      return game.settings.get('twodsix', 'alternativeShort1');
    case "ALT2":
      return game.settings.get('twodsix', 'alternativeShort2');
    default:
      return game.i18n.localize("TWODSIX.Items.Skills." + char);
  }
}

export function simplifySkillName(skillName:string): string {
  return skillName.replace(/\W/g, "");
}

export function ObjectbyString(o, s) {
  //https://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-and-arrays-by-string-path
  s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  s = s.replace(/^\./, '');           // strip a leading dot
  const a = s.split('.');
  for (let i = 0, n = a.length; i < n; ++i) {
    const k = a[i];
    if (k in o) {
      o = o[k];
    } else {
      return;
    }
  }
  return o;
}
