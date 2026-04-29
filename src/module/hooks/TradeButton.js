import { findSavedTradingJourneys, startTrading } from '../features/trader/TraderEntrypoint.js';

Hooks.on('renderJournalDirectory', (app, html, data) => {
  if (!game.user.isGM) {
    return;
  }

  const element = html[0] ?? html;
  if (element.querySelector('.header-actions.trade-journey')) {
    return;
  }
  const headerActions = element.querySelector('header.directory-header .header-actions');
  if (headerActions && headerActions.parentNode) {
    const newDiv = document.createElement('div');
    newDiv.className = 'header-actions action-buttons trade-journey flexrow';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trade-journey';
    btn.innerHTML = `<i class="fas fa-shuttle-space"></i> ${game.i18n.localize('TWODSIX.Trader.Button')}`;
    btn.style.flex = "0";
    btn.style.whiteSpace = "nowrap";
    btn.addEventListener('click', async () => {
      const saved = findSavedTradingJourneys();
      if (!saved.length) {
        startTrading();
        return;
      }

      // Offer to resume or start new
      const options = saved.map(j => `<option value="${j.id}">${j.name}</option>`).join('');
      const content = `
        <form>
          <div class="form-group">
            <label>${game.i18n.localize('TWODSIX.Trader.Resume.Label')}</label>
            <select name="journalId">
              <option value="new">${game.i18n.localize('TWODSIX.Trader.Resume.NewGame')}</option>
              ${options}
            </select>
          </div>
        </form>`;

      const result = await foundry.applications.api.DialogV2.prompt({
        window: { title: game.i18n.localize('TWODSIX.Trader.Button') },
        content,
        ok: {
          label: game.i18n.localize('TWODSIX.Trader.Resume.Go'),
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
        startTrading();
      } else {
        const journal = game.journal.get(result);
        if (journal) {
          startTrading(journal);
        }
      }
    });
    newDiv.appendChild(btn);
    headerActions.parentNode.insertBefore(newDiv, headerActions.nextSibling);
  }
});
