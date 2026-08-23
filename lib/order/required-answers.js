'use strict';

function answerValues(raw) {
  if (raw == null) return [];
  var v = raw;
  if (typeof raw === 'object' && !Array.isArray(raw) && raw.value !== undefined) v = raw.value;
  if (Array.isArray(v)) {
    return v
      .map(function (x) {
        return String(x == null ? '' : x).trim();
      })
      .filter(Boolean);
  }
  var s = String(v).trim();
  if (!s) return [];
  if (s.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed
          .map(function (x) {
            return String(x == null ? '' : x).trim();
          })
          .filter(Boolean);
      }
    } catch (_e) {}
  }
  if (s.indexOf(',') >= 0) {
    return s
      .split(',')
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }
  return [s];
}

function isQuestionAnswered(question, answers) {
  if (!question || !question.required) return true;
  var key = question.key || question.id;
  if (!key) return true;
  var raw = answers && (answers[key] != null ? answers[key] : answers[question.id]);
  return answerValues(raw).length > 0;
}

function missingRequiredQuestions(questions, answers, opts) {
  opts = opts || {};
  var includeStaff = opts.includeStaff === true;
  var missing = [];
  (questions || []).forEach(function (q) {
    if (!q || !q.required) return;
    if (!includeStaff && q.staff_only) return;
    if (!isQuestionAnswered(q, answers)) {
      missing.push({ key: q.key, label: q.label || q.key });
    }
  });
  return missing;
}

function fastAddButtonLabel(questions, answers, opts) {
  opts = opts || {};
  if (opts.added) return 'Added';
  var qs = (questions || []).filter(function (q) {
    return opts.includeStaff || !q.staff_only;
  });
  if (missingRequiredQuestions(qs, answers, opts).length) return 'Choose Options';
  return 'Add';
}

function assertRequiredAnswers(questions, answers, opts) {
  var missing = missingRequiredQuestions(questions, answers, opts);
  if (!missing.length) return;
  var err = Object.assign(new Error('required_options_missing'), { code: 400 });
  err.missing = missing;
  throw err;
}

module.exports = {
  answerValues,
  isQuestionAnswered,
  missingRequiredQuestions,
  fastAddButtonLabel,
  assertRequiredAnswers
};
