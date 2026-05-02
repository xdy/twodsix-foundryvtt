import { getCharGenRegistryEntry } from './CharGenRegistry.js';
import { getChargenNotesForActor } from './CharGenState.js';

/**
 * Rendering helpers for chargen actor output fields.
 */

export async function renderCharGenBio(header, detailedSummary, summary, log, structuredEventLog = '') {
  return foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-bio.hbs',
    {
      header,
      detailedSummary,
      summary,
      log,
      structuredEventLog,
      hasStructuredEventLog: Boolean(structuredEventLog?.trim()),
    },
  );
}

export async function renderCharGenNotes(state) {
  const entry = getCharGenRegistryEntry(state.ruleset);
  const rawChargenNotes = entry?.getActorNotesLines?.(state) ?? getChargenNotesForActor(state);
  const chargenNotes = Array.isArray(rawChargenNotes) ? rawChargenNotes : [];
  if (!Array.isArray(rawChargenNotes)) {
    console.warn(
      `twodsix | renderCharGenNotes: getActorNotesLines for ruleset "${state.ruleset}" must return string[]. Falling back to [].`,
    );
  }
  return foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-notes.hbs',
    {
      hasMaterialBenefits: (state.materialBenefits?.length ?? 0) > 0,
      materialBenefitsText: (state.materialBenefits ?? []).join(', '),
      hasMedicalDebt: (state.medicalDebt ?? 0) > 0,
      medicalDebtFormatted: (state.medicalDebt ?? 0).toLocaleString(),
      hasChargenNotes: chargenNotes.length > 0,
      chargenNotes,
    },
  );
}

export async function renderCharGenContacts(state) {
  const allies = state.allies ?? [];
  const friends = state.friends ?? [];
  const contacts = state.contacts ?? [];
  const enemies = state.enemies ?? [];
  return foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-contacts.hbs',
    {
      enemies,
      allies,
      friends,
      contacts,
      hasContacts:
        enemies.length > 0 || allies.length > 0 || friends.length > 0 || contacts.length > 0,
    },
  );
}
