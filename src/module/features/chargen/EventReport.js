// EventReport.js — Structured output from applyEventTags(), consumed by the summary builder.
//
// An EventReport captures what happened during a single event application:
//   headline  — single display line: humanized description with check results inlined
//   subRows   — indented detail lines (user choices, nested rolls, crisis outcomes)
//   leaveCareer — whether the event forces leaving the career
//   allAutoHandled — true when every mechanical effect was purely automatic
//
// Phase 1: shape introduced alongside legacy pipeline (CharGenActorFactory still uses
// the log-delta approach). Phase 4 switches CharGenActorFactory to consume EventReports.

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
