// CharGenActorFactory.js — Creates Foundry actors from completed character generation state.
// Shared by all rulesets; ruleset-specific fields (e.g. CU contacts) are read from state if present.
import { calcModFor } from '../../utils/sheetUtils.js';
import { toHex } from '../../utils/utils.js';
import { renderCharGenBio, renderCharGenContacts, renderCharGenNotes } from './CharGenOutputRenderer.js';

export async function createCharacterActor(state, charName) {
  let packDocs = [];
  const packName = `twodsix.${state.ruleset.toLowerCase()}-srd-items`;
  try {
    const pack = game.packs.get(packName) || game.packs.get('twodsix.ce-srd-items');
    if (pack) {
      packDocs = await pack.getDocuments();
    }
  } catch (e) {
    console.warn(`twodsix | Failed to load items from ${packName} pack.`, e);
  }
  const itemIndexes = _buildItemIndexes(packDocs);

  const actor = await Actor.create({
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

  const itemsToAdd = _buildSkillItems(state, itemIndexes.skillByName);
  if (itemsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', itemsToAdd);
  }

  const weaponsToAdd = _buildWeaponItems(state, itemIndexes.byId);
  if (weaponsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', weaponsToAdd);
  }

  const traitsToAdd = await _buildTraitItems(state);
  if (traitsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', traitsToAdd);
  }

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
  const rulesetName = CONFIG.TWODSIX.RULESETS[state.ruleset]?.name
    || game.i18n.localize('TWODSIX.CharGen.DefaultRulesetName');
  const header = state.died
    ? game.i18n.localize('TWODSIX.CharGen.Summary.BioHeaderEpitaph')
    : game.i18n.format('TWODSIX.CharGen.Summary.BioHeaderResults', { ruleset: rulesetName });
  const bioHtml = await renderCharGenBio(header, detailedSummary, summary, state.log);
  const notesHtml = await renderCharGenNotes(state);
  const contactsHtml = await renderCharGenContacts(state);

  await actor.update({ 'system.bio': bioHtml, 'system.notes': notesHtml, 'system.contacts': contactsHtml });

  if (state.died) {
    const deadEffect = CONFIG.statusEffects.dead;
    if (deadEffect) {
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

  actor.sheet.render({ force: true });
  return actor;
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

function _buildItemIndexes(packDocs) {
  const byId = new Map();
  const skillByName = new Map();
  for (const doc of packDocs) {
    if (!doc) {
      continue;
    }
    byId.set(String(doc.id), doc);
    if (doc.type === 'skills') {
      skillByName.set(doc.name, doc);
    }
  }
  return { byId, skillByName };
}

function _buildSkillItems(state, skillByName) {
  const itemsToAdd = [];
  for (const [skillName, level] of state.skills) {
    const pack = skillByName.get(skillName);
    if (pack) {
      const obj = pack.toObject();
      obj.system.value = level;
      obj.system.characteristic = 'NONE';
      itemsToAdd.push(obj);
    } else {
      itemsToAdd.push({ name: skillName, type: 'skills', system: { value: level, characteristic: 'NONE' } });
    }
  }
  return itemsToAdd;
}

function _buildWeaponItems(state, itemById) {
  const weaponsToAdd = [];
  for (const w of (state.chosenWeapons || [])) {
    const doc = itemById.get(String(w.id));
    if (doc) {
      weaponsToAdd.push(doc.toObject());
    }
  }
  return weaponsToAdd;
}

async function _buildTraitItems(state) {
  const traitsToAdd = [];
  const traitPackName = `twodsix.${state.ruleset.toLowerCase()}-traits`;
  const traitPack = game.packs.get(traitPackName) || game.packs.get('twodsix.cepheus-deluxe-items');
  if (traitPack && state.traits?.length) {
    const traitDocs = await traitPack.getDocuments();
    const traitByName = new Map(
      traitDocs.filter(d => d.type === 'trait').map(d => [d.name, d]),
    );
    for (const traitName of state.traits) {
      const trait = traitByName.get(traitName);
      if (trait) {
        traitsToAdd.push(trait.toObject());
      } else {
        traitsToAdd.push({ name: traitName, type: 'trait', system: { description: '' } });
      }
    }
  }
  return traitsToAdd;
}

function _formatCareerLine(c) {
  return `${c.name}${c.rankTitle ? ` (${c.rankTitle})` : ''} ${c.terms} term${c.terms !== 1 ? 's' : ''}`;
}

function _formatSkillLine(name, level, separator = '-') {
  return `${name}${separator}${level}`;
}
