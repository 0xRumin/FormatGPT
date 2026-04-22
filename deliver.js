// deliver.js — "Deliver" mode.
// Paste a big list in the input; type how many accounts to extract and
// (optionally) a filename. "Extract" moves the first N non-empty lines into
// the output pane and removes them from the input — the rest stays in input.
// Line counts in both panes are updated live. The custom filename is used by
// the Save-as-txt handler (see index.html) whenever the current mode is
// "deliver" and a name was provided.
(function () {
  if (!window.App || !App.App || typeof App.App.registerMode !== 'function') return;

  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  state.deliverExtract  = state.deliverExtract  || '';
  state.deliverFilename = state.deliverFilename || '';
  state.deliverCount    = state.deliverCount    || 0;

  var panelBuilt = false;

  function buildPanel() {
    var panel = $('#deliverPanel');
    if (!panel || panelBuilt) return;
    panelBuilt = true;

    panel.innerHTML = [
      '<div class="dp-head">',
        '<div class="dp-title">Deliver</div>',
        '<div class="dp-sub">Extract the first N accounts from input → output. Remaining lines stay in input.</div>',
      '</div>',
      '<div class="dp-row">',
        '<label class="dp-field">',
          '<span class="dp-label">Accounts to extract</span>',
          '<input type="number" id="dpCount" min="1" inputmode="numeric" placeholder="e.g. 5000" />',
        '</label>',
        '<label class="dp-field">',
          '<span class="dp-label">Output filename <span class="dp-optional">(optional)</span></span>',
          '<input type="text" id="dpName" spellcheck="false" placeholder="GavinDe  →  GavinDe.txt" />',
        '</label>',
        '<button type="button" id="dpExtract" class="dp-btn">Extract →</button>',
      '</div>',
      '<div class="dp-stats">',
        '<span class="dp-stat">Input <b id="dpInCount">0</b> lines</span>',
        '<span class="dp-stat dp-stat--out">Output <b id="dpOutCount">0</b> lines</span>',
        '<span class="dp-stat dp-stat--hint" id="dpHint"></span>',
      '</div>'
    ].join('');

    if (state.deliverCount)    $('#dpCount').value = state.deliverCount;
    if (state.deliverFilename) $('#dpName').value  = state.deliverFilename;

    $('#dpCount').addEventListener('input', function () {
      state.deliverCount = parseInt(this.value, 10) || 0;
    });
    $('#dpName').addEventListener('input', function () {
      state.deliverFilename = this.value;
    });

    $('#dpExtract').addEventListener('click', function () {
      var inp = $('#inp');
      if (!inp) return;
      var n = parseInt($('#dpCount').value, 10);
      if (!n || n <= 0) {
        showHint('Enter how many accounts to extract.', true);
        return;
      }

      var raw = (inp.value || '').split(/\r?\n/);
      var nonEmpty = [];
      for (var i = 0; i < raw.length; i++) {
        if (raw[i].trim()) nonEmpty.push(raw[i]);
      }

      if (nonEmpty.length === 0) {
        showHint('Input is empty — nothing to extract.', true);
        return;
      }

      var take = Math.min(n, nonEmpty.length);
      var extracted = nonEmpty.slice(0, take);
      var remaining = nonEmpty.slice(take);

      state.deliverExtract = extracted.join('\n');
      inp.value = remaining.join('\n');

      App.App.rerun();
      updateStats();

      var leftover = remaining.length;
      showHint('Extracted ' + take.toLocaleString() + ' → output. ' +
               leftover.toLocaleString() + ' remain in input.');
    });
  }

  function showHint(msg, isError) {
    var el = $('#dpHint');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('dp-hint--err', !!isError);
  }

  function countLines(text) {
    if (!text) return 0;
    var parts = text.split(/\r?\n/);
    var n = 0;
    for (var i = 0; i < parts.length; i++) if (parts[i].trim()) n++;
    return n;
  }

  function updateStats() {
    var inp = $('#inp');
    var inLines  = countLines(inp ? inp.value : '');
    var outLines = countLines(state.deliverExtract || '');
    var ic = $('#dpInCount');  if (ic) ic.textContent = inLines.toLocaleString();
    var oc = $('#dpOutCount'); if (oc) oc.textContent = outLines.toLocaleString();
  }

  App.App.registerMode({
    id: 'deliver',
    label: 'Deliver',
    run: function (text) {
      if (!panelBuilt) buildPanel();
      updateStats();
      return state.deliverExtract || '';
    }
  });
})();
