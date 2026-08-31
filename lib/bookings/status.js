'use strict';

/**
 * Central booking status definitions and transition matrix.
 */

const STATUSES = [
  'draft',
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'awaiting_payment',
  'refunded'
];

const LABELS = {
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  awaiting_payment: 'Awaiting payment',
  refunded: 'Refunded'
};

/** from → allowed next statuses */
const TRANSITIONS = {
  draft: ['pending', 'awaiting_payment', 'confirmed', 'cancelled'],
  pending: ['confirmed', 'awaiting_payment', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled', 'refunded'],
  confirmed: ['checked_in', 'in_progress', 'completed', 'cancelled', 'no_show', 'awaiting_payment'],
  checked_in: ['in_progress', 'completed', 'no_show', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['refunded'],
  cancelled: [],
  no_show: ['refunded'],
  refunded: []
};

function isValidStatus(s) {
  return STATUSES.indexOf(String(s || '')) >= 0;
}

function canTransition(from, to) {
  if (!isValidStatus(to)) return false;
  if (!from) return to === 'draft' || to === 'pending' || to === 'awaiting_payment' || to === 'confirmed';
  if (!isValidStatus(from)) return false;
  if (from === to) return true;
  const allowed = TRANSITIONS[from] || [];
  return allowed.indexOf(to) >= 0;
}

function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error('invalid_status_transition');
    err.code = 'invalid_status_transition';
    err.from = from;
    err.to = to;
    throw err;
  }
}

/** Statuses that occupy calendar capacity */
const BLOCKING = new Set([
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'awaiting_payment'
]);

function isBlockingStatus(s) {
  return BLOCKING.has(String(s || ''));
}

module.exports = {
  STATUSES,
  LABELS,
  TRANSITIONS,
  isValidStatus,
  canTransition,
  assertTransition,
  isBlockingStatus
};
