// plinks-prices.js — Plinks with per-1k pricing
// Turns `username:1533` (or full credential lines) into
//   x.com/username [1.53k] $18.40
// where the $ amount = followers / 1000 * (rate per 1k).
(function () {
  var U = App.Utils;
  var R = App.Renderers;
  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var panelBuilt = false;

  // Rate ($ per 1,000 followers). Restored from localStorage; defaults to 12
  // (the value used in the feature's example).
  (function initRate() {
    var stored = parseFloat(localStorage.getItem('plinksPricePerK'));
    state.plinksPricePerK = isNaN(stored) ? 12 : stored;
  })();

  function saveRate() {
    localStorage.setItem('plinksPricePerK', String(state.plinksPricePerK));
  }

  /* ======== Panel (rate input) ======== */
  function buildPanel() {
    var panel = $('#plinksPricesPanel');
    if (!panel || panelBuilt) return;
    panelBuilt = true;

    var h = '';
    h += '<div class="pp-info">';
    h += '<div class="pp-title">💲 Plinks with prices</div>';
    h += '<div class="pp-sub">Set your rate — prices auto-calculate from each follower count.</div>';
    h += '</div>';
    h += '<div class="pp-row">';
    h += '<label class="pp-label" for="ppRate">Price per 1,000 followers</label>';
    h += '<div class="pp-input-wrap">';
    h += '<span class="pp-currency">$</span>';
    h += '<input type="number" id="ppRate" class="pp-input" min="0" step="0.5" inputmode="decimal" value="' + state.plinksPricePerK + '">';
    h += '<span class="pp-per">/ 1k</span>';
    h += '</div>';
    h += '</div>';
    panel.innerHTML = h;

    var input = $('#ppRate');
    if (input) {
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        state.plinksPricePerK = (isNaN(v) || v < 0) ? 0 : v;
        saveRate();
        App.App.rerun();
      });
    }
  }

  /* ======== Line builder ======== */
  function priceLine(user, followersRaw) {
    var rate = Math.max(0, Number(state.plinksPricePerK) || 0);
    if (followersRaw === '' || followersRaw == null) {
      // No follower count -> nothing to price on; show the plink alone.
      return 'x.com/' + user;
    }
    var n = Number(followersRaw);
    var pretty = n >= 1000 ? U.formatK(n) : String(n);
    var price = (n * rate / 1000).toFixed(2);
    return 'x.com/' + user + ' [' + pretty + '] $' + price;
  }

  /* ======== Register mode ======== */
  App.App.registerMode({
    id: 'plinksPrices',
    label: 'Plinks with prices',
    run: function (text) {
      if (!panelBuilt) buildPanel();

      var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var parts = U.splitFlexible(rows[i]);
        var user = R.pickUsernameForPlinks(parts);
        if (!user) continue;
        var rest = U.credentialParts(parts).rest;
        var followersRaw = R.pickFollowersFrom(rest);
        out.push(priceLine(user, followersRaw));
      }
      // Highest follower count first (same ordering as Plinks with counts).
      out = U.sortLinesByCount(out);
      return out.join('\n');
    }
  });
})();
