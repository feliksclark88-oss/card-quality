define([], function () {
  'use strict';

  var invisible = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
  var cyrillic = /[\u0400-\u052f]/;

  function visible(value) {
    return value.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, function (character) {
      return '[U+' + character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + ']';
    }).replace(/^\s+|\s+$/g, function (space) {
      return space.replace(/\s/g, '␠');
    });
  }

  function emailIssues(value) {
    var issues = [];
    var at = value.lastIndexOf('@');
    var local = at < 0 ? '' : value.slice(0, at);
    var domain = at < 0 ? '' : value.slice(at + 1);
    var quoted = local.length >= 2 && local[0] === '"' && local[local.length - 1] === '"';
    if (at <= 0 || !domain || domain.indexOf('@') !== -1 || (!quoted && (local.indexOf('@') !== -1 || /\s/.test(local)))) {
      issues.push('email_format');
    } else if (/\s/.test(domain) || (!quoted && (/^\.|\.$|\.\./.test(local))) || /^\.|\.$|\.\./.test(domain)) {
      issues.push('email_format');
    }
    var literal = /^\[[^\]]+\]$/.test(domain);
    if (domain && !literal && (/[\/\\<>(),;:"\[\]]/.test(domain) || domain.split('.').some(function (label) {
      return /^[\x00-\x7f]*$/.test(label) && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label);
    }))) {
      if (issues.indexOf('email_format') === -1) issues.push('email_format');
    }
    if (cyrillic.test(value)) {
      issues.push('email_cyrillic');
    } else if (/[^\x00-\x7f]/.test(value)) {
      issues.push('email_international');
    }
    return issues;
  }

  function phoneIssues(value) {
    var issues = [];
    var digits = value.replace(/\D/g, '');
    // Номера с добавочным, буквами и национальными правилами требуют ручной проверки.
    if (/[^\d\s+().\-–—]/.test(value)) {
      issues.push('phone_special');
    }
    if (!digits || digits.length < 5 || digits.length > 15) {
      issues.push('phone_length');
    }
    if ((value.match(/\+/g) || []).length > 1 || value.indexOf('+') > 0) {
      issues.push('phone_plus');
    }
    return issues;
  }

  function comparisonKey(type, value) {
    if (type === 'EMAIL') {
      var at = value.lastIndexOf('@');
      return at < 0 ? value : value.slice(0, at) + '@' + value.slice(at + 1).toLowerCase();
    }
    // Не приравниваем международный префикс к национальному и не отбрасываем добавочный.
    return value.replace(/[\s().\-–—]/g, '');
  }

  function analyze(entity) {
    if (!entity || !Array.isArray(entity.custom_fields_values) && entity.custom_fields_values !== null) {
      throw new Error('unsupported_entity');
    }
    var rows = [];
    var seen = { PHONE: Object.create(null), EMAIL: Object.create(null) };
    (entity.custom_fields_values || []).forEach(function (field) {
      var type = field.field_code;
      if (type !== 'PHONE' && type !== 'EMAIL') {
        return;
      }
      var values = Array.isArray(field.values) && field.values.length ? field.values : [{ value: '' }];
      values.forEach(function (entry) {
        var raw = entry && entry.value;
        var value = raw === null || raw === undefined ? '' : String(raw);
        var trimmed = value.trim();
        var issues = [];
        if (invisible.test(value)) {
          issues.push('invisible');
        }
        if (!trimmed) {
          issues.push('empty');
        } else {
          if (value !== trimmed) {
            issues.push('edge_space');
          }
          issues = issues.concat(type === 'EMAIL' ? emailIssues(trimmed) : phoneIssues(trimmed));
          var key = comparisonKey(type, trimmed);
          if (seen[type][key]) {
            issues.push('duplicate');
          } else {
            seen[type][key] = true;
          }
        }
        rows.push({ type: type, value: visible(value), issues: issues });
      });
    });
    return { rows: rows, total: rows.length, attention: rows.filter(function (row) { return row.issues.length > 0; }).length };
  }

  return { analyze: analyze };
});
