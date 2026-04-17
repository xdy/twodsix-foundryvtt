// EventReport.js — Structured output from applyEventTags(), consumed by the summary builder.
//
// An EventReport captures what happened during a single event application:
//   headline  — single display line: humanized description with check results inlined
//   subRows   — indented detail lines (user choices, nested rolls, crisis outcomes)
//   leaveCareer — whether the event forces leaving the career
//   allAutoHandled — true when every mechanical effect was purely automatic
//
// Serialized reports accumulate on `state.chargenEventReports` (see CharGenState); actor bio
// merges {@link eventReportToPlaintextLines} alongside the legacy `state.log` stream.

/**
 * Create a fresh EventReport for one event invocation.
 * @param {string} [rawDescription=''] - Humanized description of the event (used as initial headline).
 * @returns {EventReport}
 */
export function createEventReport(rawDescription = '') {
  return {
    headline: rawDescription,
    subRows: [],
    leaveCareer: false,
    allAutoHandled: true,
    _autoHandledItems: [],   // internal list; used to build the annotation in Phase 4
  };
}

/**
 * Record an automatically-applied effect (no sub-row, just an annotation).
 * Does NOT flip allAutoHandled — the effect was automatic.
 * @param {EventReport|null} report
 * @param {string} label - Short human-readable label, e.g. "Admin-1" or "STR +1"
 */
export function reportAutoHandled(report, label) {
  if (!report) {
    return;
  }
  report._autoHandledItems.push(label);
}

/**
 * Build the standard auto-handled suffix, including details when available.
 * @param {EventReport|Array<string>|null} reportOrItems
 * @returns {string}
 */
export function formatAutoHandledSuffix(reportOrItems) {
  const items = Array.isArray(reportOrItems)
    ? reportOrItems
    : Array.isArray(reportOrItems?._autoHandledItems)
      ? reportOrItems._autoHandledItems
      : [];
  const uniqueItems = [...new Set(items.filter(Boolean))];
  return uniqueItems.length
    ? game.i18n.format('TWODSIX.CharGen.EventReport.AutoHandledSuffixWithItems', {
      items: uniqueItems.join('; '),
    })
    : '';
}

/**
 * Record a sub-row (a line that must appear below the headline because it
 * requires user context: which characteristic was reduced, which skill was
 * chosen from a list, nested roll result, etc.).
 * Also marks the event as NOT fully-auto-handled.
 * @param {EventReport|null} report
 * @param {string} text - The sub-row text (will be indented with two spaces in the summary)
 */
export function reportSubRow(report, text) {
  if (!report) {
    return;
  }
  report.allAutoHandled = false;
  report.subRows.push(text);
}

/**
 * Append check resolution text to the headline (e.g. "Check DEX 8+: Fail").
 * @param {EventReport|null} report
 * @param {string} text
 */
export function reportAppendHeadline(report, text) {
  if (!report) {
    return;
  }
  if (report.headline && !report.headline.endsWith(' ')) {
    report.headline += ' ';
  }
  report.headline += text;
}

/**
 * Mark the report as forcing a career exit.
 * @param {EventReport|null} report
 */
export function reportLeaveCareer(report) {
  if (!report) {
    return;
  }
  report.leaveCareer = true;
}

/**
 * Flatten an EventReport to human-readable lines for journals, bios, or tests (Phase 4 pipeline).
 * Uses `headline` as callers left it (often already includes {@link formatAutoHandledSuffix}).
 * @param {ReturnType<typeof createEventReport>|null|undefined} report
 * @returns {string[]}
 */
export function eventReportToPlaintextLines(report) {
  if (!report?.headline) {
    return [];
  }
  const lines = [report.headline];
  for (const row of report.subRows ?? []) {
    lines.push(`  ${row}`);
  }
  return lines;
}

/**
 * Persist-safe shape for {@link createEventReport} (no functions; `_autoHandledItems` as plain list).
 * @param {ReturnType<typeof createEventReport>|null|undefined} report
 * @returns {object|null}
 */
export function serializeEventReport(report) {
  if (!report?.headline) {
    return null;
  }
  return {
    headline: report.headline,
    subRows: [...(report.subRows ?? [])],
    leaveCareer: !!report.leaveCareer,
    allAutoHandled: report.allAutoHandled !== false,
    autoHandledItems: [...(report._autoHandledItems ?? [])],
  };
}

/**
 * @param {object|null|undefined} data
 * @returns {ReturnType<typeof createEventReport>|null}
 */
export function eventReportFromSerialized(data) {
  if (!data?.headline) {
    return null;
  }
  const r = createEventReport(data.headline);
  r.subRows = Array.isArray(data.subRows) ? [...data.subRows] : [];
  r.leaveCareer = !!data.leaveCareer;
  r.allAutoHandled = data.allAutoHandled !== false;
  r._autoHandledItems = Array.isArray(data.autoHandledItems) ? [...data.autoHandledItems] : [];
  return r;
}

/**
 * Flatten all serialized career event reports on state into one plaintext block.
 * @param {object} state - charState
 * @returns {string}
 */
export function formatChargenEventReportsPlaintext(state) {
  const raw = state?.chargenEventReports;
  if (!Array.isArray(raw) || !raw.length) {
    return '';
  }
  const blocks = [];
  for (const item of raw) {
    const r = eventReportFromSerialized(item);
    if (!r) {
      continue;
    }
    const lines = eventReportToPlaintextLines(r);
    if (lines.length) {
      blocks.push(lines.join('\n'));
    }
  }
  return blocks.join('\n\n');
}
