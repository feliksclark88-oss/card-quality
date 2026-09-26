define(['jquery', './lib/checks.js'], function ($, checks) {
  'use strict';

  return function CardCheckWidget() {
    var self = this;
    var panel = null;
    var pending = null;
    var generation = 0;
    var namespace = '.cardcheck_tehprof';

    function text(key) {
      return self.i18n('interface')[key] || key;
    }

    function context() {
      var card = APP.data && APP.data.current_card;
      var entity = APP.getBaseEntity();
      var id = card && String(card.id);
      if ((entity !== 'contacts' && entity !== 'companies') || !id || !/^[1-9]\d*$/.test(id)) {
        return null;
      }
      return { entity: entity, id: id };
    }

    function clear() {
      generation += 1;
      if (pending) {
        pending.abort();
        pending = null;
      }
      if (panel) {
        panel.off(namespace).remove();
        panel = null;
      }
    }

    function status(message, error) {
      panel.find('.cardcheck-tehprof__status').text(message).attr('data-state', error ? 'error' : 'info');
    }

    function show(result) {
      var list = panel.find('.cardcheck-tehprof__results').empty();
      result.rows.forEach(function (row, index) {
        var item = $('<li>').addClass('cardcheck-tehprof__result');
        $('<p>').addClass('cardcheck-tehprof__label').text(text(row.type === 'PHONE' ? 'phone' : 'email') + ' · ' + (index + 1)).appendTo(item);
        $('<p>').addClass('cardcheck-tehprof__value').text(row.value || text('empty_value')).appendTo(item);
        var details = $('<ul>').addClass('cardcheck-tehprof__issues');
        if (!row.issues.length) {
          $('<li>').text(text('no_signals')).appendTo(details);
        }
        row.issues.forEach(function (code) {
          $('<li>').text(text(code)).appendTo(details);
        });
        details.appendTo(item);
        item.appendTo(list);
      });
      status(result.total ? text('checked') + ' ' + result.total + '. ' + text('attention') + ' ' + result.attention + '.' : text('no_values'), false);
    }

    function checkCard() {
      if (pending) {
        return;
      }
      var current = context();
      panel.find('.cardcheck-tehprof__results').empty();
      if (!current) {
        status(text('save_first'), true);
        return;
      }
      var run = generation;
      var button = panel.find('.cardcheck-tehprof__check');
      button.prop('disabled', true);
      status(text('loading'), false);
      pending = $.ajax({
        url: '/api/v4/' + current.entity + '/' + current.id,
        method: 'GET',
        dataType: 'json',
        timeout: 15000
      });
      pending.done(function (entity, responseState, xhr) {
        var latest = context();
        if (run !== generation || !latest || latest.id !== current.id || latest.entity !== current.entity) {
          return;
        }
        if (xhr && xhr.status === 204) {
          status(text('not_found'), true);
          return;
        }
        try {
          if (!entity || String(entity.id) !== current.id) {
            throw new Error('different_entity');
          }
          show(checks.analyze(entity));
        } catch (error) {
          status(text('unexpected'), true);
        }
      }).fail(function (xhr, state) {
        if (run !== generation || state === 'abort') {
          return;
        }
        var key = xhr.status === 401 ? 'unauthorized' : xhr.status === 403 ? 'forbidden' : xhr.status === 404 || xhr.status === 204 ? 'not_found' : 'request_failed';
        status(text(key), true);
      }).always(function () {
        if (run === generation && panel) {
          pending = null;
          button.prop('disabled', false);
        }
      });
    }

    this.callbacks = {
      render: function () {
        clear();
        var entity = APP.getBaseEntity();
        if (entity !== 'contacts' && entity !== 'companies') {
          return true;
        }
        self.render_template({
          caption: { class_name: 'cardcheck-tehprof-caption' },
          body: '',
          render: '<section class="cardcheck-tehprof"><p class="cardcheck-tehprof__intro"></p><button class="cardcheck-tehprof__check" type="button"></button><p class="cardcheck-tehprof__status" role="status" aria-live="polite"></p><ol class="cardcheck-tehprof__results"></ol><p class="cardcheck-tehprof__privacy"></p><p class="cardcheck-tehprof__help"><a href="mailto:support@tehprof.kz"></a></p></section>'
        });
        panel = $('.cardcheck-tehprof').last();
        panel.find('.cardcheck-tehprof__intro').text(text('intro'));
        panel.find('.cardcheck-tehprof__check').text(text('check'));
        panel.find('.cardcheck-tehprof__privacy').text(text('privacy'));
        panel.find('.cardcheck-tehprof__help a').text(text('support'));
        status(context() ? text('ready') : text('save_first'), false);
        panel.on('click' + namespace, '.cardcheck-tehprof__check', checkCard);
        return true;
      },
      init: function () {
        var settings = self.get_settings();
        if (!document.getElementById('cardcheck-tehprof-style')) {
          var link = document.createElement('link');
          link.id = 'cardcheck-tehprof-style';
          link.rel = 'stylesheet';
          link.href = settings.path.replace(/\/$/, '') + '/style.css?v=' + encodeURIComponent(settings.version);
          document.head.appendChild(link);
        }
        return true;
      },
      bind_actions: function () { return true; },
      settings: function () { return true; },
      onSave: function () { return true; },
      destroy: function () { clear(); return true; }
    };
    return this;
  };
});
