'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let checker;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../widget/lib/checks.js'), 'utf8'), { define: (deps, factory) => { checker = factory(); } });
function result(type, values) {
  return JSON.parse(JSON.stringify(checker.analyze({ custom_fields_values: [{ field_code: type, values: values.map(value => ({ value })) }] })));
}
function codes(type, value) { return result(type, [value]).rows[0].issues; }

test('обычные международные номера сохраняют оформление', () => {
  assert.deepEqual(codes('PHONE', '+44 (20) 7946-0958'), []);
  assert.deepEqual(codes('PHONE', '+7 701 123 45 67'), []);
});
test('пробелы, BOM, zero-width, bidi и управляющие символы видимы', () => {
  for (const character of ['\u200b', '\u202e', '\u2066', '\u0000', '\u00ad']) {
    const row = result('EMAIL', ['user' + character + '@example.org']).rows[0];
    assert.ok(row.issues.includes('invisible'));
    assert.ok(row.value.includes('[U+'));
    assert.ok(!row.value.includes(character));
  }
  assert.ok(codes('EMAIL', '\ufeffuser@example.org').includes('edge_space'));
  assert.ok(codes('EMAIL', ' user@example.org ').includes('edge_space'));
  assert.equal(result('EMAIL', [' user@example.org ']).rows[0].value, '␠user@example.org␠');
});
test('кириллица и IDN не объявляются некорректным форматом', () => {
  for (const email of ['почта@пример.рф', 'user@пример.рф', 'δοκιμή@παράδειγμα.δοκιμή', '用户@例子.广告', 'user@xn--e1afmkfd.xn--p1ai']) {
    assert.ok(!codes('EMAIL', email).includes('email_format'), email);
  }
  assert.ok(codes('EMAIL', 'user@exаmple.org').includes('email_cyrillic'));
});
test('специальные допустимые email не отклоняются как очевидная ошибка', () => {
  for (const email of ['first+tag@example.org', "o'hara@example.org", 'name@localhost', '"name with spaces"@example.org', '"name@department"@example.org', 'user@[IPv6:2001:db8::1]']) {
    assert.ok(!codes('EMAIL', email).includes('email_format'), email);
  }
});
test('очевидно неполный email получает осторожную подсказку', () => {
  for (const email of ['wrong', '@example.org', 'user@', 'u@@example.org', 'a..b@example.org', 'a@example..org', 'a b@example.org', 'a@exam ple.org', 'a@foo/bar', 'a@-foo.com', 'a@foo-.com', 'a@foo_bar.com']) {
    assert.ok(codes('EMAIL', email).includes('email_format'), email);
  }
});
test('добавочные, короткие и буквенные номера отмечаются для ручной проверки', () => {
  assert.ok(codes('PHONE', '112').includes('phone_length'));
  assert.ok(codes('PHONE', '+1 800 FLOWERS').includes('phone_special'));
  assert.ok(codes('PHONE', '+7 701 1234567 доб. 20').includes('phone_special'));
  assert.ok(codes('PHONE', '1+234567').includes('phone_plus'));
});
test('повторы только внутри карточки и одного типа', () => {
  const phones = result('PHONE', ['+44 (20) 7946-0958', '+442079460958', '442079460958', '+442079460958#20']);
  assert.ok(phones.rows[1].issues.includes('duplicate'));
  assert.ok(!phones.rows[2].issues.includes('duplicate'));
  assert.ok(!phones.rows[3].issues.includes('duplicate'));
  const emails = result('EMAIL', ['User@example.org', 'User@EXAMPLE.ORG ', 'user@example.org']);
  assert.ok(emails.rows[1].issues.includes('duplicate'));
  assert.ok(!emails.rows[2].issues.includes('duplicate'));
});
test('пустые значения и отсутствие каналов различаются', () => {
  for (const value of ['', ' ', null, undefined]) assert.ok(codes('PHONE', value).includes('empty'));
  assert.equal(checker.analyze({ custom_fields_values: null }).total, 0);
  assert.equal(checker.analyze({ custom_fields_values: [] }).total, 0);
  assert.throws(() => checker.analyze({}));
});
test('поля вне PHONE/EMAIL не анализируются; вход не мутирует', () => {
  const dto = { id: 42, custom_fields_values: [{ field_code: 'TEXT', values: [{ value: 'secret' }] }, { field_code: 'PHONE', values: [{ value: '+123456789' }] }] };
  const before = JSON.stringify(dto);
  assert.equal(checker.analyze(dto).total, 1);
  assert.equal(JSON.stringify(dto), before);
});
test('специальные ключи не ломают хранилище повторов', () => {
  assert.ok(!codes('EMAIL', '__proto__').includes('duplicate'));
  assert.ok(result('EMAIL', ['constructor', 'constructor']).rows[1].issues.includes('duplicate'));
});
test('каждой подсказке соответствует русский текст', () => {
  const ru = JSON.parse(fs.readFileSync(path.join(__dirname, '../widget/i18n/ru.json'))).interface;
  for (const sample of [['EMAIL', 'а\u200b @example..org '], ['PHONE', '++x'], ['PHONE', ''], ['EMAIL', 'x@example.org']]) {
    for (const code of codes(...sample)) assert.equal(typeof ru[code], 'string');
  }
});
