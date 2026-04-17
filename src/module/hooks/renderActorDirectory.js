import { startCharacterGeneration } from '../features/chargen/CharacterGeneration.js';

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
    cgButton.addEventListener('click', () => {
      startCharacterGeneration();
    });

    newDiv.appendChild(cgButton);
    headerActions.parentNode.insertBefore(newDiv, headerActions.nextSibling);
  }
});
