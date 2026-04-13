// CharGenActorFactory.js — Creates Foundry actors from completed character generation state.
// Shared by all rulesets; ruleset-specific fields (e.g. CU contacts) are read from state if present.
import { calcModFor } from '../../utils/sheetUtils.js';
import { toHex } from '../../utils/utils.js';

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

  const itemsToAdd = _buildSkillItems(state, packDocs);
  if (itemsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', itemsToAdd);
  }

  const weaponsToAdd = _buildWeaponItems(state, packDocs);
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
  const traitLine = state.traits?.length ? `Traits: ${state.traits.join(', ')}` : null;
  const summary = [
    `${charName}   ${upp}   Age ${state.age}`,
    `${careerLine}   Cr${state.cashBenefits.toLocaleString()}${state.medicalDebt ? ` (Debt: Cr${state.medicalDebt.toLocaleString()})` : ''}`,
    skillLine || '(no skills)',
    traitLine,
    state.materialBenefits.length ? `Benefits: ${state.materialBenefits.join(', ')}` : null,
    state.pension ? `Pension: Cr${state.pension.toLocaleString()}/year` : null,
  ].filter(Boolean).join('\n');

  const detailedSummary = generateDetailedSummary(state);
  const rulesetName = CONFIG.TWODSIX.RULESETS[state.ruleset]?.name || 'Cepheus Engine';
  const header = state.died ? 'Epitaph:' : `${rulesetName} generation results:`;
  const bioHtml = await foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-bio.hbs',
    { header, detailedSummary, summary, log: state.log }
  );

  const notesHtml = _buildNotesHtml(state);
  const contactsHtml = _buildContactsHtml(state);

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
  const charLabels = ['Str', 'Dex', 'End', 'Int', 'Edu', 'Soc'];
  const header1 = `Age\tGender\t${charLabels.join('\t')}`;
  const vals = chars.map(k => {
    const v = state.chars[k] ?? 0;
    const mod = calcModFor(v);
    return `${v} (${mod >= 0 ? '+' : ''}${mod})`;
  });
  const row1 = `${state.age}\t${state.gender}\t${vals.join('\t')}`;

  const activeRules = Object.entries(state.optionalRules || {})
    .filter(([_, enabled]) => String(enabled) === 'true')
    .map(([key, _]) => game.i18n.localize(`TWODSIX.CharGen.OptionalRules.${key.charAt(0).toUpperCase() + key.slice(1)}`))
    .join(', ');

  const skillList = [...state.skills.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, l]) => _formatSkillLine(n, l, ' '))
    .join('\n');
  const traitList = (state.traits || []).join('\n');
  const careerHeader = `Career\tAssignment\tTitle\tRank\tTerms`;
  const careerRows = state.careers
    .map(c => `${c.name}\t${c.assignment || ''}\t${c.rankTitle || ''}\t${c.rank}\t${c.terms}`)
    .join('\n');
  const historyHeader = `Term\tHistory`;
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

  lines.push(
    'Skills',
    skillList || '(none)',
    '',
    'Traits',
    traitList || '(none)',
    '',
    'CareerHeader',
    careerHeader,
    careerRows || '(none)',
    '',
    historyHeader,
    historyRows || '(none)',
  );

  return lines.join('\n');
}

/** ─── HELPERS ─────────────────────────────────────────────────────────── */

function _buildSkillItems(state, packDocs) {
  const itemsToAdd = [];
  for (const [skillName, level] of state.skills) {
    const pack = packDocs.find(i => i.name === skillName && i.type === 'skills');
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

function _buildWeaponItems(state, packDocs) {
  const weaponsToAdd = [];
  for (const w of (state.chosenWeapons || [])) {
    const doc = packDocs.find(d => d.id === w.id);
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
    for (const traitName of state.traits) {
      const trait = traitDocs.find(d => d.name === traitName && d.type === 'trait');
      if (trait) {
        traitsToAdd.push(trait.toObject());
      } else {
        traitsToAdd.push({ name: traitName, type: 'trait', system: { description: '' } });
      }
    }
  }
  return traitsToAdd;
}

function _buildNotesHtml(state) {
  let notesHtml = state.materialBenefits.length
    ? `<p><strong>Material Benefits:</strong> ${state.materialBenefits.join(', ')}</p>`
    : '';
  if (state.medicalDebt > 0) {
    notesHtml += `<p><strong>Medical Debt:</strong> Cr${state.medicalDebt.toLocaleString()}</p>`;
  }
  return notesHtml;
}

function _buildContactsHtml(state) {
  if (!state.enemies?.length && !state.friends?.length && !state.contacts?.length) {
    return '';
  }
  let html = '<p>';
  if (state.enemies?.length) {
    html += state.enemies.map(e => `<strong>ENEMY:</strong> ${e}<br>`).join('');
  }
  if (state.friends?.length) {
    html += state.friends.map(f => `<strong>FRIEND:</strong> ${f}<br>`).join('');
  }
  if (state.contacts?.length) {
    html += state.contacts.map(c => `<strong>CONTACT:</strong> ${c}<br>`).join('');
  }
  html += '</p>';
  return html;
}

function _formatCareerLine(c) {
  return `${c.name}${c.rankTitle ? ` (${c.rankTitle})` : ''} ${c.terms} term${c.terms !== 1 ? 's' : ''}`;
}

function _formatSkillLine(name, level, separator = '-') {
  return `${name}${separator}${level}`;
}
