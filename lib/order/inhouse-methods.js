'use strict';

/** In-house payment methods that count as deposit received. */
const INHOUSE_METHODS = {
  cash_deposit: { label: 'Cash deposit', provider: 'cash_deposit' },
  eftpos: { label: 'EFTPOS', provider: 'eftpos' },
  direct_deposit: { label: 'Direct deposit', provider: 'direct_deposit' },
  contra: { label: 'Contra', provider: 'contra' }
};

function normaliseInhouseMethod(raw) {
  var k = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (k === 'cash') return 'cash_deposit';
  if (INHOUSE_METHODS[k]) return k;
  return null;
}

function inhouseMethodLabel(method) {
  var m = normaliseInhouseMethod(method);
  return m ? INHOUSE_METHODS[m].label : String(method || 'In-house');
}

module.exports = {
  INHOUSE_METHODS,
  normaliseInhouseMethod,
  inhouseMethodLabel
};
