import { applyToAllActors, applyToAllItems } from '../module/utils/migration-utils';

const SOC_CAREER_PACK = 'twodsix.sword-of-cepheus-items';
const EVENT_MECHANIC_FIELDS = ['checks', 'always', 'onSuccess', 'onFail', 'effects'];

function toPlainObject(value) {
  return foundry.utils.deepClone(value?.toObject?.() ?? value);
}

function hasValues(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasEventMechanics(event) {
  return EVENT_MECHANIC_FIELDS.some(field => hasValues(event?.[field]));
}

function getRuleset(item) {
  return item.system?.ruleset ?? item._source?.system?.ruleset;
}

function isSocCareer(item) {
  return item.type === 'career' && getRuleset(item) === 'SOC';
}

async function getCanonicalSocCareers() {
  const pack = game.packs.get(SOC_CAREER_PACK);
  if (!pack) {
    console.warn(`[TWODSIX] SOC career migration skipped: could not find ${SOC_CAREER_PACK}`);
    return new Map();
  }

  const careers = new Map();
  for (const item of await pack.getDocuments()) {
    if (!isSocCareer(item)) {
      continue;
    }

    const eventTable = toPlainObject(item.system.eventTable ?? []);
    if (eventTable.some(hasEventMechanics)) {
      careers.set(item.name, eventTable);
    }
  }

  return careers;
}

function mergeEventTable(targetEvents, sourceEvents) {
  const target = toPlainObject(targetEvents ?? []);
  const source = toPlainObject(sourceEvents ?? []);
  const sourceByRoll = new Map(source.map(event => [event.roll, event]));
  const migrated = [];
  const seenRolls = new Set();
  let changed = false;

  for (const targetEvent of target) {
    const sourceEvent = sourceByRoll.get(targetEvent.roll);
    const event = {...targetEvent};
    seenRolls.add(targetEvent.roll);

    if (!sourceEvent) {
      migrated.push(event);
      continue;
    }

    if (!event.description && sourceEvent.description) {
      event.description = sourceEvent.description;
      changed = true;
    }

    for (const field of EVENT_MECHANIC_FIELDS) {
      if (!hasValues(event[field]) && hasValues(sourceEvent[field])) {
        event[field] = toPlainObject(sourceEvent[field]);
        changed = true;
      }
    }

    migrated.push(event);
  }

  for (const sourceEvent of source) {
    if (!seenRolls.has(sourceEvent.roll)) {
      migrated.push(toPlainObject(sourceEvent));
      changed = true;
    }
  }

  return changed ? migrated.sort((a, b) => a.roll - b.roll) : null;
}

function getSocCareerEventTableUpdate(item, canonicalCareers) {
  if (!isSocCareer(item)) {
    return null;
  }

  const sourceEvents = canonicalCareers.get(item.name);
  if (!sourceEvents) {
    return null;
  }

  const eventTable = mergeEventTable(item.system.eventTable, sourceEvents);
  return eventTable ? {'system.eventTable': eventTable} : null;
}

export async function migrate() {
  console.log('[TWODSIX] Starting SOC career event mechanics migration...');

  const canonicalCareers = await getCanonicalSocCareers();
  if (!canonicalCareers.size) {
    console.warn('[TWODSIX] SOC career event mechanics migration skipped: no canonical event tables found');
    return Promise.resolve();
  }

  await applyToAllItems(item => getSocCareerEventTableUpdate(item, canonicalCareers), {batch: true});

  await applyToAllActors(async actor => {
    for (const item of actor.items.contents) {
      const update = getSocCareerEventTableUpdate(item, canonicalCareers);
      if (update) {
        await item.update(update);
      }
    }
  });

  console.log('[TWODSIX] SOC career event mechanics migration complete');
  return Promise.resolve();
}
