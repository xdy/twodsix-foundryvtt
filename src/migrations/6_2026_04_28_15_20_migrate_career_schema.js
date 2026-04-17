import { applyToAllActors, applyToAllItems } from '../module/utils/migration-utils';

const EFFECT_TAG_PATTERN = /\[[^\]]+\]/g;
const CHECK_TAG_PATTERN = /^\[CHECK:([^:\]]+):(\d+)\]$/i;

function parseEventDescription(description) {
  const text = String(description ?? '');
  const tags = text.match(EFFECT_TAG_PATTERN) ?? [];
  const checks = [];
  const always = [];
  const onSuccess = [];
  const onFail = [];
  let branchPrompt;
  let branchChoices;

  const branchCandidates = text.match(/\[[^\]]+\]\s+or\s+\[[^\]]+\]/gi) ?? [];
  if (branchCandidates.length === 1) {
    const branchTags = branchCandidates[0].match(EFFECT_TAG_PATTERN) ?? [];
    if (branchTags.length === 2) {
      const [leftTag, rightTag] = branchTags;
      branchPrompt = `${text} (choose one)`;
      branchChoices = [
        { value: 'optionA', label: leftTag, onSuccess: [leftTag] },
        { value: 'optionB', label: rightTag, onSuccess: [rightTag] },
      ];
    }
  }

  for (const tag of tags) {
    const checkMatch = tag.match(CHECK_TAG_PATTERN);
    if (checkMatch) {
      checks.push({ skill: checkMatch[1], target: Number(checkMatch[2]) });
      continue;
    }
    if (branchChoices?.some(choice => (choice.onSuccess ?? []).includes(tag))) {
      continue;
    }
    const lower = text.toLowerCase();
    if (lower.includes('on fail') && lower.includes(tag.toLowerCase())) {
      onFail.push(tag);
    } else if (lower.includes('on success') && lower.includes(tag.toLowerCase())) {
      onSuccess.push(tag);
    } else {
      always.push(tag);
    }
  }

  const parsed = {
    description: text,
    checks,
    always,
    onSuccess,
    onFail,
    effects: [],
  };
  if (branchPrompt && branchChoices?.length) {
    parsed.branchPrompt = branchPrompt;
    parsed.branchChoices = branchChoices;
  }
  return parsed;
}

function normalizeEventRow(row) {
  const base = parseEventDescription(row?.description ?? '');
  const normalized = {
    roll: Number(row?.roll) || 0,
    ...base,
  };
  for (const key of ['checks', 'always', 'onSuccess', 'onFail', 'effects']) {
    if (Array.isArray(row?.[key])) {
      normalized[key] = row[key];
    }
  }
  if (row?.branchPrompt != null) {
    normalized.branchPrompt = row.branchPrompt;
  }
  if (Array.isArray(row?.branchChoices)) {
    normalized.branchChoices = row.branchChoices;
  }
  return normalized;
}

function normalizeMishapTable(system) {
  if (Array.isArray(system?.mishapTable) && system.mishapTable.length) {
    return system.mishapTable.map(normalizeEventRow);
  }
  const raw = system?.chargenExtensions?.mishaps;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry, idx) => ({
    roll: idx + 1,
    ...parseEventDescription(entry),
  }));
}

function getCareerSchemaUpdate(item) {
  if (item.type !== 'career') {
    return null;
  }

  const system = item.system ?? item._source?.system ?? {};
  const eventTable = Array.isArray(system.eventTable) ? system.eventTable.map(normalizeEventRow) : [];
  const mishapTable = normalizeMishapTable(system);
  const assignmentTable = system.assignmentTable ?? system.chargenExtensions?.assignments ?? {};
  const officerRanks = Array.isArray(system.officerRanks) && system.officerRanks.length
    ? system.officerRanks
    : (Array.isArray(system.chargenExtensions?.officerRanks) ? system.chargenExtensions.officerRanks : []);

  return {
    'system.eventTable': eventTable,
    'system.mishapTable': mishapTable,
    'system.assignmentTable': assignmentTable,
    'system.officerRanks': officerRanks,
  };
}

export async function migrate() {
  console.log('[TWODSIX] Starting career schema migration...');
  await applyToAllItems(getCareerSchemaUpdate, { batch: true });

  await applyToAllActors(async actor => {
    for (const item of actor.items.contents) {
      const update = getCareerSchemaUpdate(item);
      if (update) {
        await item.update(update);
      }
    }
  });

  console.log('[TWODSIX] Career schema migration complete');
  return Promise.resolve();
}
