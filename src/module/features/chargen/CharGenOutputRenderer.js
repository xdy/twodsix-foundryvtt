/**
 * Rendering helpers for chargen actor output fields.
 */

export async function renderCharGenBio(header, detailedSummary, summary, log) {
  return foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-bio.hbs',
    { header, detailedSummary, summary, log },
  );
}

export async function renderCharGenNotes(state) {
  return foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-notes.hbs',
    {
      hasMaterialBenefits: (state.materialBenefits?.length ?? 0) > 0,
      materialBenefitsText: (state.materialBenefits ?? []).join(', '),
      hasMedicalDebt: (state.medicalDebt ?? 0) > 0,
      medicalDebtFormatted: (state.medicalDebt ?? 0).toLocaleString(),
    },
  );
}

export async function renderCharGenContacts(state) {
  return foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/chargen/char-gen-contacts.hbs',
    {
      enemies: state.enemies ?? [],
      friends: state.friends ?? [],
      contacts: state.contacts ?? [],
      hasContacts: (state.enemies?.length ?? 0) > 0
        || (state.friends?.length ?? 0) > 0
        || (state.contacts?.length ?? 0) > 0,
    },
  );
}
