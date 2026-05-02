import { findSavedCharGenSessions, startCharacterGeneration } from '../features/chargen/CharacterGeneration.js';

Hooks.on('renderActorDirectory', (app, html, data) => {
  if (!game.user.isGM) {
    return;
  }

  const element = html[0] ?? html;
  if (element.querySelector('.header-actions.char-gen')) {
    return;
  }
  const headerActions = element.querySelector('header.directory-header .header-actions');
  if (headerActions && headerActions.parentNode) {
    const newDiv = document.createElement('div');
    newDiv.className = 'header-actions action-buttons char-gen flexrow';

    const cgButton = document.createElement('button');
    cgButton.type = 'button';
    cgButton.className = 'character-generation';
    cgButton.innerHTML = `<i class="fas fa-user-plus"></i> ${game.i18n.localize('TWODSIX.ActorDirectory.CharacterGeneration')}`;
    cgButton.style.flex = "0";
    cgButton.style.whiteSpace = "nowrap";
    cgButton.addEventListener('click', async () => {
      const saved = findSavedCharGenSessions();
      if (!saved.length) {
        startCharacterGeneration();
        return;
      }

      const options = saved
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: 'base' }))
        .map(j => `<option value="${j.id}">${foundry.utils.escapeHTML(j.name)}</option>`)
        .join('');
      const content = `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize('TWODSIX.CharGen.Resume.Label')}</label>
            <select name="journalId">
              <option value="new">${game.i18n.localize('TWODSIX.CharGen.Resume.NewSession')}</option>
              ${options}
            </select>
          </div>
        </form>`;

      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize('TWODSIX.ActorDirectory.CharacterGeneration') },
        content,
        ok: {
          label: game.i18n.localize('TWODSIX.CharGen.Resume.Go'),
          callback: (event, button) => {
            const form = button.closest('.dialog-content')?.querySelector('form') ?? button.form;
            return form.querySelector('[name=journalId]').value;
          },
        },
        rejectClose: false,
      });

      if (!result) {
        return;
      }
      if (result === 'new') {
        startCharacterGeneration();
      } else {
        const journal = game.journal.get(result);
        if (journal) {
          startCharacterGeneration(journal);
        }
      }
    });

    newDiv.appendChild(cgButton);
    headerActions.parentNode.insertBefore(newDiv, headerActions.nextSibling);
  }
});
