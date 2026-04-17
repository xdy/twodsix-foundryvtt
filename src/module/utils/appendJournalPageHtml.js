/**
 * Append HTML to a Foundry journal text page (shared by CharGen, Trader, etc.).
 * @param {string} journalEntryId
 * @param {string|null} journalPageId
 * @param {string} html
 * @param {object} [options]
 * @param {string} [options.logLabel='appendJournalPageHtml'] - Prefix for console warnings
 * @returns {Promise<string|null>} Resolved page id when one was inferred or used; otherwise `journalPageId`.
 */
export async function appendJournalPageHtml(journalEntryId, journalPageId, html, options = {}) {
  const logLabel = options.logLabel ?? 'appendJournalPageHtml';
  const warn = msg => console.warn(`Twodsix | ${logLabel}: ${msg}`);

  if (!journalEntryId) {
    return journalPageId;
  }
  const journal = game.journal.get(journalEntryId);
  if (!journal) {
    warn(`JournalEntry not found: ${journalEntryId}`);
    return journalPageId;
  }

  let pageId = journalPageId || _firstJournalPageId(journal);
  if (!pageId) {
    warn('No journal page id.');
    return journalPageId;
  }

  let page = journal.pages.get(pageId);
  if (!page) {
    warn(`JournalPage not found: ${pageId}; trying fallback page.`);
    pageId = _firstJournalPageId(journal);
    if (!pageId) {
      warn('No fallback journal page id.');
      return journalPageId;
    }
    page = journal.pages.get(pageId);
    if (!page) {
      warn(`Fallback JournalPage not found: ${pageId}`);
      return journalPageId;
    }
  }

  const existing = page.text?.content || '';
  await page.update({ 'text.content': existing + html });
  return pageId;
}

/**
 * Return the id of the first page in a journal, or null.
 * @param {JournalEntry} journal
 * @returns {string|null}
 */
function _firstJournalPageId(journal) {
  if (!journal.pages?.size) {
    return null;
  }
  return journal.pages.contents?.[0]?.id ?? null;
}
