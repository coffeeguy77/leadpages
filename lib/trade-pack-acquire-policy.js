'use strict';

/**
 * When pack_location_usage should be written for acquire-trade-pack outcomes.
 *
 * mode:'create' is a community library add only — never records location usage.
 * Binding modes (pick / first pack / regenerate) record usage when content is
 * applied to a site for a target location.
 */

const BIND_SOURCES = new Set([
  'existing',
  'first_pack',
  'generated',
  'already_bound',
]);

/**
 * @param {'create'|'pick'|string} mode
 * @param {string} [source] response source after a successful acquire
 * @returns {boolean}
 */
function shouldRecordPackLocationUsage(mode, source) {
  if (mode === 'create') return false;
  if (!source) return mode === 'pick';
  return BIND_SOURCES.has(String(source));
}

/**
 * Create-mode success payloads must not claim a location bind.
 * @param {object} response
 * @returns {boolean}
 */
function isLibraryOnlyCreateResponse(response) {
  return !!(
    response &&
    response.ok === true &&
    response.source === 'new_trade' &&
    response.libraryOnly === true
  );
}

module.exports = {
  BIND_SOURCES,
  shouldRecordPackLocationUsage,
  isLibraryOnlyCreateResponse,
};
