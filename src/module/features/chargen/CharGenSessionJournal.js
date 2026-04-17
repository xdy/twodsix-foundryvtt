// CharGenSessionJournal.js — CharGen backing journal, debounced flag saves, human-readable decision log
import { appendJournalPageHtml } from '../../utils/appendJournalPageHtml.js';
import { getOrCreateTwodsixJournalFolder, TWODSIX_JOURNAL_FOLDER_CHAR_GEN } from '../../utils/journalFolders.js';
import { LanguageType } from '../../utils/nameGenerator.js';
import { toHex } from '../../utils/utils.js';
import { createCoalescingTaskQueue, createSerializedAsyncQueue } from '../coalescingQueue.js';
import { getChargenRulesetDisplayName } from './CharGenRegistry.js';
import { CHARACTERISTIC_KEYS, CHARGEN_SESSION_VERSION, serializeCharGenState, } from './CharGenState.js';

/**
 * Owns journal entry binding, debounced saves to the journal flag, and HTML log lines.
 * @param {*} app - CharGenApp instance (avoid circular import)
 */
export class CharGenSessionJournal {
  constructor(app) {
    this._app = app;
    this.entryId = null;
    this.pageId = null;
    this._saveCoalescer = createCoalescingTaskQueue((err, requestId) => {
      this._lastSaveError = err;
      this._lastFailedSaveRequestId = requestId;
      console.error('Twodsix | CharGenSessionJournal.saveState failed:', err);
    });
    this._journalHtmlQueue = createSerializedAsyncQueue(err => {
      console.error('Twodsix | CharGenSessionJournal journal append failed:', err);
    });
    this._saveQueue = Promise.resolve();
    this._saveDebounceTimer = null;
    this._lastSaveError = null;
    this._lastFailedSaveRequestId = 0;
    /** How many `decisionStore` entries have been copied into the journal page text. */
    this.loggedDecisionCount = 0;
    /**
     * True only when this session created its backing journal (fresh CharGen).
     * Resumed sessions bind to an existing journal and never delete it on close.
     */
    this.boundDisposable = false;
    /** True after `destroy()` is called; prevents async work on a torn-down journal. */
    this._destroyed = false;
  }

  clearBinding() {
    this.entryId = null;
    this.pageId = null;
    this.loggedDecisionCount = 0;
    this.boundDisposable = false;
    this._lastSaveError = null;
    this._lastFailedSaveRequestId = 0;
  }

  /** Tear down async queues and debounce timer. Call from CharGenApp.close(). */
  destroy() {
    this._destroyed = true;
    clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = null;
  }

  /**
   * Append HTML to the backing journal page (human-readable log).
   * @param {string} html
   */
  async appendHtml(html) {
    if (this._destroyed) {
      return;
    }
    return this._journalHtmlQueue.runSerialized(async () => {
      if (this._destroyed || !this.entryId) {
        return;
      }
      const resolved = await appendJournalPageHtml(this.entryId, this.pageId, html, {
        logLabel: 'CharGenSessionJournal.appendHtml',
      });
      if (resolved) {
        this.pageId = resolved;
      }
    });
  }

  _journalQuestionLine(dec) {
    const q = dec?.question != null ? String(dec.question).trim() : '';
    if (!q) {
      return null;
    }
    const max = 220;
    return q.length > max ? `${q.slice(0, max - 1)}…` : q;
  }

  _formatDecisionJournalLine(dec) {
    const qShort = this._journalQuestionLine(dec);
    if (dec.type === 'roll') {
      if (qShort) {
        return game.i18n.format('TWODSIX.CharGen.Session.JournalRollWithQuestion', {
          question: qShort,
          value: dec.value,
        });
      }
      return game.i18n.format('TWODSIX.CharGen.Session.JournalRoll', { value: dec.value });
    }
    if (dec.type === 'choice' && dec.chars) {
      const upp = CHARACTERISTIC_KEYS.map(k => toHex(dec.chars[k] ?? 0)).join('');
      if (qShort) {
        return game.i18n.format('TWODSIX.CharGen.Session.JournalCharacteristicsWithQuestion', {
          question: qShort,
          upp,
        });
      }
      return game.i18n.format('TWODSIX.CharGen.Session.JournalCharacteristics', { upp });
    }
    const raw = String(dec.value ?? '');
    const short = raw.length > 140 ? `${raw.slice(0, 137)}…` : raw;
    if (qShort) {
      return game.i18n.format('TWODSIX.CharGen.Session.JournalChoiceWithQuestion', {
        question: qShort,
        value: short,
      });
    }
    return game.i18n.format('TWODSIX.CharGen.Session.JournalChoice', { value: short });
  }

  async appendUndoLine() {
    const text = game.i18n.localize('TWODSIX.CharGen.Session.JournalUndo');
    await this.appendHtml(`<p><em>${foundry.utils.escapeHTML(text)}</em></p>\n`);
  }

  async appendNewDecisionsToLog() {
    const store = this._app.decisionStore;
    const n = store.decisions.length;
    if (n < this.loggedDecisionCount) {
      this.loggedDecisionCount = n;
    }
    if (n <= this.loggedDecisionCount) {
      return;
    }
    let chunk = '';
    for (let i = this.loggedDecisionCount; i < n; i++) {
      const dec = store.decisions[i];
      const line = this._formatDecisionJournalLine(dec);
      chunk += `<p>${foundry.utils.escapeHTML(line)}</p>\n`;
    }
    if (chunk) {
      await this.appendHtml(chunk);
    }
    this.loggedDecisionCount = n;
  }

  async appendSessionStartedLine() {
    const ruleset = this._app.charState?.ruleset ?? 'CE';
    const rulesetName = getChargenRulesetDisplayName(ruleset);
    const dateStr = new Date().toLocaleString();
    const html = `<p><strong>${foundry.utils.escapeHTML(game.i18n.localize('TWODSIX.CharGen.Session.SessionStarted'))}</strong> ${foundry.utils.escapeHTML(
      game.i18n.format('TWODSIX.CharGen.Session.SessionStartedDetail', { date: dateStr, ruleset: rulesetName }),
    )}</p>\n`;
    await this.appendHtml(html);
  }

  async appendCompletionMilestone({ died, charName }) {
    const name = foundry.utils.escapeHTML(charName);
    if (died) {
      await this.appendHtml(
        `<hr><p><strong>${foundry.utils.escapeHTML(game.i18n.localize('TWODSIX.CharGen.Session.JournalDoneDied'))}</strong> — ${name}</p>\n`,
      );
    } else {
      await this.appendHtml(
        `<hr><p><strong>${foundry.utils.escapeHTML(game.i18n.localize('TWODSIX.CharGen.Session.JournalDone'))}</strong> — ${name}</p>\n`,
      );
    }
  }

  async renameEntryToCharacterName(charName) {
    if (!this.entryId) {
      return;
    }
    const journal = game.journal.get(this.entryId);
    if (!journal) {
      return;
    }
    const raw = String(charName ?? '').trim()
      || game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
    const safe = raw.replace(/["<>]/g, '').slice(0, 120).trim() || 'Traveller';
    const newName = game.i18n.format('TWODSIX.CharGen.Session.JournalNameComplete', { name: safe });
    if (journal.name === newName) {
      return;
    }
    try {
      await journal.update({ name: newName });
    } catch (err) {
      console.warn('Twodsix | CharGenSessionJournal.renameEntryToCharacterName failed:', err);
    }
  }

  buildSnapshot() {
    const app = this._app;
    return {
      _schemaVersion: CHARGEN_SESSION_VERSION,
      journalEntryId: this.entryId,
      journalPageId: this.pageId,
      ruleset: app.charState?.ruleset ?? 'CE',
      languageType: app.charState?.languageType ?? LanguageType.Humaniti,
      charName: app.charName,
      autoAll: app.autoAll,
      isDone: app.isDone,
      died: app.charState?.died ?? false,
      decisions: foundry.utils.deepClone(app.decisionStore.decisions),
      checkpointState:
        (app.isDone || app.charState?.died) && app.charState ? serializeCharGenState(app.charState) : null,
    };
  }

  scheduleSave() {
    if (this._destroyed) {
      return;
    }
    clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = setTimeout(() => {
      this._saveDebounceTimer = null;
      void this.saveState().catch(() => {});
    }, 450);
  }

  async flushSave() {
    clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = null;
    await this.saveState();
  }

  /**
   * Save current CharGen session to the backing journal entry flag.
   */
  async saveState() {
    if (!this.entryId) {
      return;
    }
    const snapshot = this.buildSnapshot();
    const requestId = this._saveCoalescer.bumpRequestId();
    this._lastSaveError = null;
    this._saveQueue = this._saveCoalescer.enqueue(requestId, async () => {
      const journal = game.journal.get(this.entryId);
      if (!journal) {
        console.warn('Twodsix | CharGenSessionJournal.saveState: JournalEntry not found:', this.entryId);
        return;
      }
      await journal.setFlag('twodsix', 'charGenSession', snapshot);
      await this.appendNewDecisionsToLog();
    });

    await this._saveQueue;
    if (this._lastFailedSaveRequestId === requestId && this._lastSaveError) {
      throw this._lastSaveError;
    }
  }

  /**
   * Delete a session journal created this CharGen run when no Foundry actor was created.
   * @param {string} journalId
   */
  async deleteAbandoned(journalId) {
    const journal = game.journal.get(journalId);
    if (journal?.getFlag('twodsix', 'charGenSession') == null || !journal.isOwner) {
      return;
    }
    try {
      await journal.delete();
    } catch (err) {
      console.warn('Twodsix | CharGenSessionJournal: could not delete abandoned session journal:', err);
    }
  }

  async ensureJournal() {
    if (this.entryId) {
      return;
    }
    if (!game.settings.get('twodsix', 'chargenSessionJournal')) {
      return;
    }
    this.loggedDecisionCount = 0;
    const name = game.i18n.format('TWODSIX.CharGen.Session.DefaultJournalName', {
      date: new Date().toLocaleDateString(),
    });
    try {
      const folderId = await getOrCreateTwodsixJournalFolder(TWODSIX_JOURNAL_FOLDER_CHAR_GEN);
      const journal = await JournalEntry.create({ name, folder: folderId });
      const pages = await journal.createEmbeddedDocuments('JournalEntryPage', [
        {
          name: game.i18n.localize('TWODSIX.CharGen.Session.LogPageName'),
          type: 'text',
          text: { content: `<p>${game.i18n.localize('TWODSIX.CharGen.Session.LogIntro')}</p>\n` },
        },
      ]);
      this.entryId = journal.id;
      this.pageId = pages[0]?.id ?? null;
      this.boundDisposable = true;
      await this.appendSessionStartedLine();
      await this.saveState();
    } catch (err) {
      console.error('Twodsix | CharGenSessionJournal.ensureJournal failed:', err);
      this.entryId = null;
      this.pageId = null;
      this.loggedDecisionCount = 0;
    }
  }
}
