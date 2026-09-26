'use strict';
fetch('../widget/i18n/ru.json').then(response => response.json()).then(messages => {
  let widget;
  function mount() {
    if (widget) widget.callbacks.destroy();
    widget = new window.DemoWidget();
    widget.i18n = key => messages[key];
    widget.get_settings = () => ({ path: '../widget/', version: '1.0.0', widget_code: 'cardcheck_tehprof' });
    widget.render_template = template => { document.getElementById('widget-slot').innerHTML = template.render; };
    APP.data.current_card.id = document.getElementById('scenario').value === 'new' ? 0 : 42;
    widget.callbacks.render();
    widget.callbacks.init();
    widget.callbacks.bind_actions();
  }
  document.getElementById('scenario').addEventListener('change', mount);
  document.getElementById('destroy').addEventListener('click', () => widget.callbacks.destroy());
  document.getElementById('mount').addEventListener('click', mount);
  mount();
});
