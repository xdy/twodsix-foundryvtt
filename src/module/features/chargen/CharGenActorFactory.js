// CharGenActorFactory.js — Creates Foundry actors from completed character generation state.
// Shared by all rulesets; ruleset-specific fields (e.g. CU contacts) are read from state if present.
import { calcModFor } from '../../utils/sheetUtils.js';
import { toHex } from '../../utils/utils.js';
import { isJoatSkillName } from './BaseCharGenLogic.js';
import { renderCharGenBio, renderCharGenContacts, renderCharGenNotes } from './CharGenOutputRenderer.js';
import {
  getCharGenActorSpeciesLabel,
  getCharGenRegistryEntry,
  getChargenRulesetDisplayName
} from './CharGenRegistry.js';
import { formatChargenEventReportsPlaintext } from './EventReport.js';

export async function createCharacterActor(state, charName) {
  const registryEntry = getCharGenRegistryEntry(state.ruleset);
  if (!registryEntry) {
    throw new Error(
      game.i18n.format('TWODSIX.CharGen.Errors.ActorCreateUnsupportedRuleset', { ruleset: String(state.ruleset) }),
    );
  }

  const itemIndexes = await _loadAllItemIndexes(registryEntry.packs, state.ruleset);

  const actor = await _createBaseActor(state, charName);
  await _attachSkills(actor, state, itemIndexes.skillByName, state.ruleset);
  await _attachWeapons(actor, state, itemIndexes.byId, state.ruleset);
  await _attachTraits(actor, state, itemIndexes.traitByName, state.ruleset);
  await _attachSpecies(actor, state, state.ruleset);
  await _setJoatLevel(actor, state);
  await _renderBioAndFields(actor, state, charName);
  await _applyDeadStatus(actor, state);
  actor.sheet.render({ force: true });
  return actor;
}

async function _loadAllItemIndexes(packs, ruleset) {
  const safePacks = packs || {};
  let itemDocs = [];
  try {
    const pack = game.packs.get(safePacks.itemPackId) || game.packs.get(safePacks.itemPackFallbackId);
    if (pack) {
      itemDocs = await pack.getDocuments();
    }
  } catch (e) {
    console.warn(`twodsix | Failed to load items from ${safePacks.itemPackId} pack.`, e);
  }

  let traitDocs = [];
  const traitPackName = safePacks.traitPackId ?? safePacks.itemPackId ?? `twodsix.${String(ruleset).toLowerCase()}-srd-items`;
  const traitFallback = safePacks.traitPackFallbackId ?? 'twodsix.cepheus-deluxe-items';
  try {
    const traitPack = game.packs.get(traitPackName) || game.packs.get(traitFallback);
    if (traitPack) {
      traitDocs = await traitPack.getDocuments();
    }
  } catch (e) {
    console.warn(`twodsix | Failed to load traits from ${traitPackName} pack.`, e);
  }

  return _buildAllItemIndexes(itemDocs, traitDocs);
}

function _buildAllItemIndexes(itemDocs, traitDocs) {
  const byId = new Map();
  const skillByName = new Map();
  const traitByName = new Map();
  for (const doc of itemDocs) {
    if (!doc) {
      continue;
    }
    byId.set(String(doc.id), doc);
    if (doc.type === 'skills') {
      skillByName.set(doc.name, doc);
    }
  }
  for (const doc of traitDocs) {
    if (doc?.type === 'trait') {
      traitByName.set(doc.name, doc);
    }
  }
  return { byId, skillByName, traitByName };
}

async function _createBaseActor(state, charName) {
  return Actor.create({
    name: charName,
    type: 'traveller',
    system: {
      characteristics: {
        strength: { value: state.chars.str },
        dexterity: { value: state.chars.dex },
        endurance: { value: state.chars.end },
        intelligence: { value: state.chars.int },
        education: { value: state.chars.edu },
        socialStanding: { value: state.chars.soc },
      },
      age: { value: state.age },
      gender: state.gender,
      homeWorld: state.homeworldDescriptors.length > 0 ? `(${state.homeworldDescriptors.join(', ')})` : '',
      finances: {
        cash: String(state.cashBenefits),
        pension: String(state.pension),
        debt: String(state.medicalDebt),
      },
    },
  });
}

async function _attachSkills(actor, state, skillByName, ruleset) {
  const { itemsToAdd, missingSkills } = _buildSkillItems(state, skillByName);
  if (itemsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', itemsToAdd);
  }
  if (missingSkills.length) {
    console.warn(
      `twodsix | CharGenActorFactory: ${missingSkills.length} skill(s) missing from pack for ruleset "${ruleset}".`,
      missingSkills,
    );
  }
}

async function _attachWeapons(actor, state, itemById, ruleset) {
  const { weaponsToAdd, missingWeaponIds } = _buildWeaponItems(state, itemById);
  if (weaponsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', weaponsToAdd);
  }
  if (missingWeaponIds.length) {
    console.warn(
      `twodsix | CharGenActorFactory: ${missingWeaponIds.length} selected weapon id(s) missing from pack for ruleset "${ruleset}".`,
      missingWeaponIds,
    );
  }
}

async function _attachTraits(actor, state, traitByName, ruleset) {
  const { traitsToAdd, missingTraitNames } = _buildTraitItemsFromIndex(state, traitByName);
  if (traitsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', traitsToAdd);
  }
  if (missingTraitNames.length) {
    console.warn(
      `twodsix | CharGenActorFactory: ${missingTraitNames.length} trait(s) missing from trait pack for ruleset "${ruleset}".`,
      missingTraitNames,
    );
  }
}

async function _attachSpecies(actor, state, ruleset) {
  const { speciesToAdd, missingSpecies } = await _buildSpeciesItem(state);
  if (speciesToAdd.length) {
    await actor.createEmbeddedDocuments('Item', speciesToAdd);
  }
  if (missingSpecies.length) {
    console.warn(
      `twodsix | CharGenActorFactory: species missing from pack for ruleset "${ruleset}".`,
      missingSpecies,
    );
  }
}

async function _setJoatLevel(actor, state) {
  if (state.joat <= 0) {
    return;
  }
  const untrainedSkill = actor.getUntrainedSkill();
  if (!untrainedSkill) {
    return;
  }
  const initial = CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
  const isCt = game.settings.get('twodsix', 'ruleset') === 'CT';
  const skillValue = isCt ? 0 : state.joat + initial;
  await untrainedSkill.update({ 'system.value': skillValue });
}

async function _renderBioAndFields(actor, state, charName) {
  const upp = ['str', 'dex', 'end', 'int', 'edu', 'soc'].map(k => toHex(state.chars[k] ?? 0)).join('');
  const careerLine = state.careers.map(_formatCareerLine).join(', ');
  const skillLine = [...state.skills.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, l]) => _formatSkillLine(n, l))
    .join(', ');
  const traitLine = state.traits?.length
    ? game.i18n.format('TWODSIX.CharGen.Summary.TraitsPrefix', { list: state.traits.join(', ') })
    : null;
  const debtSuffix = state.medicalDebt
    ? game.i18n.format('TWODSIX.CharGen.Summary.DebtInline', { amount: state.medicalDebt.toLocaleString() })
    : '';
  const summary = [
    game.i18n.format('TWODSIX.CharGen.Summary.ActorLine', {
      name: charName,
      upp,
      ageLabel: game.i18n.localize('TWODSIX.CharGen.App.Age'),
      age: state.age,
    }),
    game.i18n.format('TWODSIX.CharGen.Summary.CareerMoneyLine', {
      careers: careerLine,
      cash: state.cashBenefits.toLocaleString(),
      debt: debtSuffix,
    }),
    skillLine || game.i18n.localize('TWODSIX.CharGen.Summary.NoSkills'),
    traitLine,
    state.materialBenefits.length
      ? game.i18n.format('TWODSIX.CharGen.Summary.BenefitsPrefix', { list: state.materialBenefits.join(', ') })
      : null,
    state.pension
      ? game.i18n.format('TWODSIX.CharGen.Summary.PensionPrefix', { amount: state.pension.toLocaleString() })
      : null,
  ].filter(Boolean).join('\n');

  const detailedSummary = generateDetailedSummary(state);
  const rulesetName = getChargenRulesetDisplayName(state.ruleset);
  const structuredEventLog = formatChargenEventReportsPlaintext(state);
  const header = state.died
    ? game.i18n.localize('TWODSIX.CharGen.Summary.BioHeaderEpitaph')
    : game.i18n.format('TWODSIX.CharGen.Summary.BioHeaderResults', { ruleset: rulesetName });
  const bioHtml = await renderCharGenBio(header, detailedSummary, summary, state.log, structuredEventLog);
  const notesHtml = await renderCharGenNotes(state);
  const contactsHtml = await renderCharGenContacts(state);
  const speciesLabel = getCharGenActorSpeciesLabel(state);

  await actor.update({
    'system.bio': bioHtml,
    'system.notes': notesHtml,
    'system.contacts': contactsHtml,
    ...(speciesLabel ? { 'system.species': speciesLabel } : {}),
  });
}

async function _applyDeadStatus(actor, state) {
  if (!state.died) {
    return;
  }
  const deadEffect = _findDeadStatusEffect();
  if (deadEffect?.id) {
    await actor.createEmbeddedDocuments('ActiveEffect', [
      {
        name: game.i18n.localize(deadEffect.name),
        img: deadEffect.img,
        statuses: [deadEffect.id],
        disabled: false,
        'flags.core.statusId': deadEffect.id,
      },
    ]);
  }
}

export function generateDetailedSummary(state) {
  const chars = ['str', 'dex', 'end', 'int', 'edu', 'soc'];
  const charLabels = chars.map(k => game.i18n.localize(`TWODSIX.CharGen.Chars.${k.toUpperCase()}`));
  const header1 = game.i18n.format('TWODSIX.CharGen.Summary.DetailedHeaderRow', {
    age: game.i18n.localize('TWODSIX.CharGen.App.Age'),
    gender: game.i18n.localize('TWODSIX.CharGen.Summary.ColumnGender'),
    str: charLabels[0],
    dex: charLabels[1],
    end: charLabels[2],
    int: charLabels[3],
    edu: charLabels[4],
    soc: charLabels[5],
  });
  const vals = chars.map(k => {
    const v = state.chars[k] ?? 0;
    const mod = calcModFor(v);
    return `${v} (${mod >= 0 ? '+' : ''}${mod})`;
  });
  const row1 = `${state.age}\t${state.gender}\t${vals.join('\t')}`;

  const activeRules = Object.entries(state.optionalRules || {})
    .filter(([_, enabled]) => enabled === true)
    .map(([key, _]) => game.i18n.localize(`TWODSIX.CharGen.OptionalRules.${key.charAt(0).toUpperCase() + key.slice(1)}`))
    .join(', ');

  const skillList = [...state.skills.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, l]) => _formatSkillLine(n, l, ' '))
    .join('\n');
  const traitList = (state.traits || []).join('\n');
  const careerHeader = game.i18n.localize('TWODSIX.CharGen.Summary.CareerTableHeader');
  const careerRows = state.careers
    .map(c => `${c.name}\t${c.assignment || ''}\t${c.rankTitle || ''}\t${c.rank}\t${c.terms}`)
    .join('\n');
  const historyHeader = game.i18n.localize('TWODSIX.CharGen.Summary.HistoryTableHeader');
  const historyRows = state.termHistory.map(h => h.events.map(e => `${h.term}\t${e}`).join('\n')).join('\n');

  const lines = [
    header1,
    row1,
    '',
  ];

  if (activeRules) {
    lines.push(`${game.i18n.localize('TWODSIX.CharGen.OptionalRules.SummaryActiveRules')} ${activeRules}`);
    if (state.careerChanges > 0) {
      lines.push(`${game.i18n.localize('TWODSIX.CharGen.OptionalRules.SummaryCareerChanges')} ${state.careerChanges}`);
      lines.push(game.i18n.localize('TWODSIX.CharGen.OptionalRules.SummaryBenefitReduction'));
    }
    lines.push('');
  }

  const none = game.i18n.localize('TWODSIX.CharGen.Summary.None');
  lines.push(
    game.i18n.localize('TWODSIX.CharGen.Summary.SectionSkills'),
    skillList || none,
    '',
    game.i18n.localize('TWODSIX.CharGen.Summary.SectionTraits'),
    traitList || none,
    '',
    careerHeader,
    careerRows || none,
    '',
    historyHeader,
    historyRows || none,
  );

  return lines.join('\n');
}

/** ─── HELPERS ─────────────────────────────────────────────────────────── */

function _buildSkillItems(state, skillByName) {
  const itemsToAdd = [];
  const missingSkills = [];
  for (const [skillName, level] of state.skills) {
    if (isJoatSkillName(skillName)) {
      state.joat = Math.max(state.joat ?? 0, level);
      continue;
    }
    const pack = skillByName.get(skillName);
    if (pack) {
      const obj = _sanitizeEmbeddedItemData(pack.toObject());
      obj.system.value = level;
      obj.system.characteristic = 'NONE';
      itemsToAdd.push(obj);
    } else {
      missingSkills.push(skillName);
      itemsToAdd.push({ name: skillName, type: 'skills', system: { value: level, characteristic: 'NONE' } });
    }
  }
  return { itemsToAdd, missingSkills };
}

function _buildWeaponItems(state, itemById) {
  const weaponsToAdd = [];
  const missingWeaponIds = [];
  const seenIds = new Set();
  for (const w of (state.chosenWeapons || [])) {
    const weaponId = String(w.id);
    if (seenIds.has(weaponId)) {
      continue;
    }
    seenIds.add(weaponId);
    const doc = itemById.get(weaponId);
    if (doc) {
      weaponsToAdd.push(_sanitizeEmbeddedItemData(doc.toObject()));
    } else {
      missingWeaponIds.push(weaponId);
    }
  }
  return { weaponsToAdd, missingWeaponIds };
}

function _buildTraitItemsFromIndex(state, traitByName) {
  const traitsToAdd = [];
  const missingTraitNames = [];
  if (!state.traits?.length) {
    return { traitsToAdd, missingTraitNames };
  }
  for (const traitName of state.traits) {
    const trait = traitByName.get(traitName);
    if (trait) {
      traitsToAdd.push(_sanitizeEmbeddedItemData(trait.toObject()));
    } else {
      missingTraitNames.push(traitName);
      traitsToAdd.push({ name: traitName, type: 'trait', system: { description: '' } });
    }
  }
  return { traitsToAdd, missingTraitNames };
}

function _formatCareerLine(c) {
  const termWordKey = c.terms === 1 ? 'one' : 'many';
  const termWord = game.i18n.localize(`TWODSIX.CharGen.TermWord.${termWordKey}`);
  return `${c.name}${c.rankTitle ? ` (${c.rankTitle})` : ''} ${c.terms} ${termWord}`;
}

function _formatSkillLine(name, level, separator = '-') {
  return `${name}${separator}${level}`;
}

function _findDeadStatusEffect() {
  const statusEffects = CONFIG.statusEffects;
  if (Array.isArray(statusEffects)) {
    return statusEffects.find(effect => effect?.id === 'dead') ?? null;
  }
  if (statusEffects && typeof statusEffects === 'object') {
    if (statusEffects.dead) {
      return statusEffects.dead;
    }
    return Object.values(statusEffects).find(effect => effect?.id === 'dead') ?? null;
  }
  return null;
}

function _sanitizeEmbeddedItemData(itemData) {
  if (!itemData || typeof itemData !== 'object') {
    return itemData;
  }
  const copy = foundry.utils.deepClone(itemData);
  delete copy._id;
  return copy;
}

/**
 * Build the species item to embed on the new actor.
 * Species selection is stored on `state.chargenOverlay.<rulesetLower>.species` by
 * {@link import('./BaseCharGenLogic.js').BaseCharGenLogic#stepSpecies}; this loads the matching
 * compendium document so transfer-mode Active Effects on the species (or its embedded items)
 * propagate to the actor automatically.
 * @param {object} state - Completed chargen state
 * @returns {Promise<{ speciesToAdd: object[], missingSpecies: string[] }>}
 */
async function _buildSpeciesItem(state) {
  const speciesToAdd = [];
  const missingSpecies = [];
  const overlayKey = String(state?.ruleset ?? '').toLowerCase();
  const speciesRef = state?.chargenOverlay?.[overlayKey]?.species;
  if (!speciesRef?.id || !speciesRef?.packId) {
    return { speciesToAdd, missingSpecies };
  }
  const pack = game.packs?.get(speciesRef.packId);
  if (!pack) {
    missingSpecies.push(`${speciesRef.name ?? speciesRef.id} (pack "${speciesRef.packId}" not found)`);
    return { speciesToAdd, missingSpecies };
  }
  try {
    const doc = await pack.getDocument(speciesRef.id);
    if (doc && doc.type === 'species') {
      speciesToAdd.push(_sanitizeEmbeddedItemData(doc.toObject()));
    } else {
      missingSpecies.push(speciesRef.name ?? speciesRef.id);
    }
  } catch (err) {
    console.warn('twodsix | Failed to load species document for actor build.', err);
    missingSpecies.push(speciesRef.name ?? speciesRef.id);
  }
  return { speciesToAdd, missingSpecies };
}
