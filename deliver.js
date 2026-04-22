// deliver.js — "Deliver" mode.
// Paste a big list in the input; choose direction (Bottom→Top default, or
// Top→Bottom), type how many accounts to extract and (optionally) a filename.
// "Extract" pulls N non-empty lines from the chosen end into the output pane
// and removes them from the input — the rest stays in input.
// Direction matters because auto-orders consume from the top of the file:
// extracting from the bottom keeps the in-flight queue untouched.
// "Download" saves the current extracted output as a .txt (custom filename
// when set, otherwise a unique 6-char random name).
(function () {
  if (!window.App || !App.App || typeof App.App.registerMode !== 'function') return;

  var state = App.State.state;
  var U     = App.Utils;
  var $     = function (sel, root) { return (root || document).querySelector(sel); };

  state.deliverExtract   = state.deliverExtract   || '';
  state.deliverFilename  = state.deliverFilename  || '';
  state.deliverCount     = state.deliverCount     || 0;
  state.deliverDirection = state.deliverDirection || 'bottom'; // 'bottom' | 'top'

  var panelBuilt = false;

  function buildPanel() {
    var panel = $('#deliverPanel');
    if (!panel || panelBuilt) return;
    panelBuilt = true;

    var dir = state.deliverDirection || 'bottom';

    panel.innerHTML = [
      '<div class="dp-head">',
        '<div class="dp-title">Deliver</div>',
        '<div class="dp-sub">Extract N accounts from input \u2192 output. Choose direction so live orders aren\u2019t disturbed.</div>',
      '</div>',
      '<div class="dp-row">',
        '<div class="dp-field dp-field--dir">',
          '<span class="dp-label">Direction</span>',
          '<div class="dp-dir" id="dpDir" role="tablist">',
            '<button type="button" class="dp-dir-btn' + (dir === 'bottom' ? ' is-active' : '') + '" data-dir="bottom">Bottom \u2192 Top</button>',
            '<button type="button" class="dp-dir-btn' + (dir === 'top'    ? ' is-active' : '') + '" data-dir="top">Top \u2192 Bottom</button>',
          '</div>',
        '</div>',
        '<label class="dp-field">',
          '<span class="dp-label">Accounts to extract</span>',
          '<input type="number" id="dpCount" min="1" inputmode="numeric" placeholder="e.g. 5000" />',
        '</label>',
        '<label class="dp-field">',
          '<span class="dp-label">Output filename <span class="dp-optional">(optional)</span></span>',
          '<input type="text" id="dpName" spellcheck="false" placeholder="GavinDe  \u2192  GavinDe.txt" />',
        '</label>',
        '<div class="dp-actions">',
          '<button type="button" id="dpExtract"  class="dp-btn">Extract \u2192</button>',
          '<button type="button" id="dpDownload" class="dp-btn dp-btn--alt">\u2193 Download</button>',
        '</div>',
      '</div>',
      '<div class="dp-stats">',
        '<span class="dp-stat">Input <b id="dpInCount">0</b> lines</span>',
        '<span class="dp-stat dp-stat--out">Output <b id="dpOutCount">0</b> lines</span>',
        '<span class="dp-stat dp-stat--total">Total Counts: <b id="dpTotalCount">0</b></span>',
        '<span class="dp-stat dp-stat--hint" id="dpHint"></span>',
      '</div>'
    ].join('');

    if (state.deliverCount)    $('#dpCount').value = state.deliverCount;
    if (state.deliverFilename) $('#dpName').value  = state.deliverFilename;

    // Input typing should refresh the stat totals live (not only on Extract).
    var _inpEl = $('#inp');
    if (_inpEl && !_inpEl.dataset.dpStatsBound){
      _inpEl.dataset.dpStatsBound = '1';
      _inpEl.addEventListener('input', function () { updateStats(); });
    }

    $('#dpCount').addEventListener('input', function () {
      state.deliverCount = parseInt(this.value, 10) || 0;
    });
    $('#dpName').addEventListener('input', function () {
      state.deliverFilename = this.value;
    });

    // Direction toggle
    $('#dpDir').addEventListener('click', function (e) {
      var btn = e.target.closest('.dp-dir-btn');
      if (!btn) return;
      state.deliverDirection = btn.dataset.dir === 'top' ? 'top' : 'bottom';
      var btns = this.querySelectorAll('.dp-dir-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('is-active', btns[i].dataset.dir === state.deliverDirection);
      }
      showHint('Direction set to ' + (state.deliverDirection === 'bottom' ? 'Bottom \u2192 Top' : 'Top \u2192 Bottom') + '.');
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
        showHint('Input is empty \u2014 nothing to extract.', true);
        return;
      }

      var take = Math.min(n, nonEmpty.length);
      var extracted, remaining;

      if ((state.deliverDirection || 'bottom') === 'bottom') {
        // Pull from the END of the list — leaves top-of-file lines untouched
        // for any auto-orders draining the input from the top.
        extracted = nonEmpty.slice(nonEmpty.length - take);
        remaining = nonEmpty.slice(0, nonEmpty.length - take);
      } else {
        extracted = nonEmpty.slice(0, take);
        remaining = nonEmpty.slice(take);
      }

      state.deliverExtract = extracted.join('\n');
      inp.value = remaining.join('\n');

      App.App.rerun();
      updateStats();

      var dirLabel = (state.deliverDirection === 'bottom') ? 'bottom' : 'top';
      showHint('Extracted ' + take.toLocaleString() + ' from ' + dirLabel + ' \u2192 output. ' +
               remaining.length.toLocaleString() + ' remain in input.');
    });

    $('#dpDownload').addEventListener('click', function () {
      var text = state.deliverExtract || '';
      if (!text) {
        showHint('Nothing to download \u2014 hit Extract first.', true);
        return;
      }
      var custom = (state.deliverFilename || '').trim();
      var name;
      if (custom) {
        var clean = custom.replace(/\.txt$/i, '')
                          .replace(/[^A-Za-z0-9_\-. ]/g, '')
                          .replace(/\s+/g, '_');
        name = (clean || 'deliver') + '.txt';
      } else {
        name = (U && U.randFileName) ? U.randFileName('txt') : ('deliver_' + Date.now() + '.txt');
      }
      var blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
      showHint('Downloaded ' + name + '.');
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
    var ic = $('#dpInCount');    if (ic) ic.textContent = inLines.toLocaleString();
    var oc = $('#dpOutCount');   if (oc) oc.textContent = outLines.toLocaleString();
    var tc = $('#dpTotalCount'); if (tc) tc.textContent = (inLines + outLines).toLocaleString();
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
