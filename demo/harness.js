'use strict';
// Адаптер только для демонстрации. В amoCRM зависимости предоставляет платформа.
(function () {
  function Query(elements) { this.elements = elements; this.length = elements.length; }
  function $(selector) {
    if (selector instanceof Query) return selector;
    if (typeof selector === 'string' && /^<[a-z]+>$/.test(selector)) return new Query([document.createElement(selector.slice(1, -1))]);
    return new Query(typeof selector === 'string' ? Array.from(document.querySelectorAll(selector)) : [selector]);
  }
  Query.prototype.find = function (selector) { return new Query(this.elements.flatMap(el => Array.from(el.querySelectorAll(selector)))); };
  Query.prototype.last = function () { return new Query(this.elements.slice(-1)); };
  Query.prototype.text = function (value) { this.elements.forEach(el => { el.textContent = value; }); return this; };
  Query.prototype.attr = function (key, value) { this.elements.forEach(el => el.setAttribute(key, value)); return this; };
  Query.prototype.prop = function (key, value) { this.elements.forEach(el => { el[key] = value; }); return this; };
  Query.prototype.addClass = function (name) { this.elements.forEach(el => el.classList.add(name)); return this; };
  Query.prototype.empty = function () { this.elements.forEach(el => el.replaceChildren()); return this; };
  Query.prototype.remove = function () { this.elements.forEach(el => el.remove()); return this; };
  Query.prototype.appendTo = function (target) { const parent = $(target).elements[0]; this.elements.forEach(el => parent.appendChild(el)); return this; };
  Query.prototype.on = function (event, selector, callback) {
    this.elements.forEach(el => {
      const handler = e => { if (e.target.closest(selector)) callback(e); };
      el.addEventListener(event.split('.')[0], handler);
      el.demoHandler = handler;
    });
    return this;
  };
  Query.prototype.off = function () { this.elements.forEach(el => el.removeEventListener('click', el.demoHandler)); return this; };
  $.ajax = function (options) {
    window.demoRequests.push({ method: options.method, url: options.url });
    document.getElementById('requests').textContent = 'Запросов карточки: ' + window.demoRequests.length;
    const done = [], fail = [], always = [];
    let timer;
    const request = {
      done(fn) { done.push(fn); return request; },
      fail(fn) { fail.push(fn); return request; },
      always(fn) { always.push(fn); return request; },
      abort() { clearTimeout(timer); fail.forEach(fn => fn({ status: 0 }, 'abort')); always.forEach(fn => fn()); }
    };
    const scenario = document.getElementById('scenario').value;
    timer = setTimeout(() => {
      const status = { unauthorized: 401, forbidden: 403, deleted: 204, failure: 0 }[scenario];
      if (status === 204) done.forEach(fn => fn(undefined, 'nocontent', { status: 204 }));
      else if (status !== undefined) fail.forEach(fn => fn({ status }, 'error'));
      else done.forEach(fn => fn(window.demoFixture(scenario), 'success', { status: 200 }));
      always.forEach(fn => fn());
    }, 400);
    return request;
  };
  window.demoRequests = [];
  window.define = function (dependencies, factory) {
    if (dependencies.length === 0) window.demoChecks = factory();
    else window.DemoWidget = factory($, window.demoChecks);
  };
  window.APP = { data: { current_card: { id: 42 } }, getBaseEntity: () => document.getElementById('scenario').value === 'company' ? 'companies' : 'contacts' };
  window.demoFixture = function (scenario) {
    if (scenario === 'malformed') return { id: 42, custom_fields_values: 'wrong' };
    if (scenario === 'different') return { id: 43, custom_fields_values: [] };
    const samples = {
      attention: { PHONE: ['+7 (701) 123-45-67', '+77011234567', ''], EMAIL: [' person@example.org ', 'per\u200bson@example.org', 'person@exаmple.org'] },
      clean: { PHONE: ['+44 20 7946 0958'], EMAIL: ['person@example.org'] },
      company: { PHONE: ['+44 20 7946 0958'], EMAIL: ['team@example.org'] },
      international: { PHONE: ['+81 3 1234 5678'], EMAIL: ['почта@пример.рф', '用户@例子.广告', 'user@xn--e1afmkfd.xn--p1ai'] },
      empty: {},
      xss: { EMAIL: ['<img src=x onerror=alert(1)>@example.org'] }
    };
    const values = samples[scenario] || samples.clean;
    return { id: 42, custom_fields_values: Object.keys(values).map(code => ({ field_code: code, values: values[code].map(value => ({ value })) })) };
  };
}());
