import { startCharacterGeneration } from '../features/chargen/CharacterGeneration.js';

Hooks.on('renderActorDirectory', (app, html, data) => {
  if (!game.user.isGM) {
    return;
  }

  const element = html[0] ?? html;
  const headerActions = element.querySelector('header.directory-header .header-actions');
  if (headerActions && headerActions.parentNode) {
    const cgButton = document.createElement('button');
    cgButton.type = 'button';
    cgButton.className = 'character-generation';
    cgButton.innerHTML = `<i class="fas fa-user-plus"></i> ${game.i18n.localize('TWODSIX.ActorDirectory.CharacterGeneration')}`;
    cgButton.style.flex = "0";
    cgButton.style.whiteSpace = "nowrap";
    cgButton.addEventListener('click', () => {
      startCharacterGeneration();
    });

    headerActions.parentNode.insertBefore(cgButton, headerActions.nextSibling);
  }
});
