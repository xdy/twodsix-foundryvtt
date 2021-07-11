// https://stackoverflow.com/a/34749873
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: unknown): boolean {
  return <boolean>(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param sources
 */
export function mergeDeep(target: Record<string, any>, ...sources: Record<string, any>[]): Record<string, any> {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, {[key]: {}});
        }
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, {[key]: source[key]});
      }
    }
  }

  return mergeDeep(target, ...sources);
}

export function getGame(): Game {
  if (!(game instanceof Game)) throw new Error('Game not initialized yet!');
  return game;
}

export function getUi(): typeof ui {
  if ((ui === null || ui === undefined)) throw new Error('UI not initialized yet!');
  return ui;
}
