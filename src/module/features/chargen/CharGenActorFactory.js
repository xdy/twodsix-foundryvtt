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
  if (itemsToAdd.length) {
    await actor.createEmbeddedDocuments('Item', itemsToAdd);
  }

  const upp = ['str', 'dex', 'end', 'int', 'edu', 'soc'].map(k => toHex(state.chars[k] ?? 0)).join('');
  const careerLine = state.careers
    .map(c => `${c.name}${c.rankTitle ? ` (${c.rankTitle})` : ''} ${c.terms} term${c.terms !== 1 ? 's' : ''}`)
    .join(', ');
  const skillLine = [...state.skills.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, l]) => `${n}-${l}`)
    .join(', ');
  const summary = [
    `${charName}   ${upp}   Age ${state.age}`,
    `${careerLine}   Cr${state.cashBenefits.toLocaleString()}${state.medicalDebt ? ` (Debt: Cr${state.medicalDebt.toLocaleString()})` : ''}`,
    skillLine || '(no skills)',
    state.materialBenefits.length ? `Benefits: ${state.materialBenefits.join(', ')}` : null,
    state.pension ? `Pension: Cr${state.pension.toLocaleString()}/year` : null,
  ].filter(Boolean).join('\n');

  const detailedSummary = generateDetailedSummary(state, charName);
  const rulesetName = CONFIG.TWODSIX.RULESETS[state.ruleset]?.name || 'Cepheus Engine';
  const header = state.died ? 'Epitaph:' : `${rulesetName} generation results:`;
  const bioHtml = await foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-bio.hbs',
    { header, detailedSummary, summary, log: state.log }
  );
  let notesHtml = state.materialBenefits.length
    ? `<p><strong>Material Benefits:</strong> ${state.materialBenefits.join(', ')}</p>`
    : '';
  if (state.medicalDebt > 0) {
    notesHtml += `<p><strong>Medical Debt:</strong> Cr${state.medicalDebt.toLocaleString()}</p>`;
  }

  // Build contacts HTML from enemies, friends, and contacts arrays (CU and other rulesets)
  let contactsHtml = '';
  if (state.enemies?.length || state.friends?.length || state.contacts?.length) {
    contactsHtml = '<p>';
    if (state.enemies?.length) {
      contactsHtml += state.enemies.map(e => `<strong>ENEMY:</strong> ${e}<br>`).join('');
    }
    if (state.friends?.length) {
      contactsHtml += state.friends.map(f => `<strong>FRIEND:</strong> ${f}<br>`).join('');
    }
    if (state.contacts?.length) {
      contactsHtml += state.contacts.map(c => `<strong>CONTACT:</strong> ${c}<br>`).join('');
    }
    contactsHtml += '</p>';
  }

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

export function generateDetailedSummary(state, charName) {
  const chars = ['str', 'dex', 'end', 'int', 'edu', 'soc'];
  const charLabels = ['Str', 'Dex', 'End', 'Int', 'Edu', 'Soc'];
  const header1 = `Age\tGender\t${charLabels.join('\t')}`;
  const vals = chars.map(k => {
    const v = state.chars[k] ?? 0;
    const mod = calcModFor(v);
    return `${v} (${mod >= 0 ? '+' : ''}${mod})`;
  });
  const row1 = `${state.age}\t${state.gender}\t${vals.join('\t')}`;
  const skillList = [...state.skills.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, l]) => `${n} ${l}`)
    .join('\n');
  const careerHeader = `Career\tAssignment\tTitle\tRank\tTerms`;
  const careerRows = state.careers
    .map(c => `${c.name}\t${c.assignment || ''}\t${c.rankTitle || ''}\t${c.rank}\t${c.terms}`)
    .join('\n');
  const historyHeader = `Term\tHistory`;
  const historyRows = state.termHistory.map(h => h.events.map(e => `${h.term}\t${e}`).join('\n')).join('\n');
  return [
    header1,
    row1,
    '',
    'Skills',
    skillList || '(none)',
    '',
    careerHeader,
    careerRows || '(none)',
    '',
    historyHeader,
    historyRows || '(none)',
  ].join('\n');
}
