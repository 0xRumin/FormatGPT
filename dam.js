// dam.js — DAM (digitalaccountmarket.com) scraper mode.
// Browser port of D:\SCRIPTS\1. Mosts\DAM\main.py. Flow:
//   1) Fetch category list via the public /api/categories endpoint
//   2) User ticks categories + picks a price strategy (5 options)
//   3) Scrape items from each chosen category in parallel
//   4) Format + sort: "x.com/username [followers] $price"  high → low
//   5) Write the result into the main output pane (+ optional .txt download)
//
// The Python script uses cloudscraper to sidestep Cloudflare. We don't have
// that in the browser — if Cloudflare challenges the request we surface a
// clean error in the status pill instead of silently failing.
(function () {
  if (!window.App || !App.App || typeof App.App.registerMode !== 'function') return;

  var BASE  = 'https://digitalaccountmarket.com';
  var state = App.State.state;
  var U     = App.Utils;
  var $     = function (sel, root) { return (root || document).querySelector(sel); };

  // Lazy-init DAM state (persisted only in memory — no localStorage).
  if (!state.dam) {
    state.dam = {
      categories: [],     // raw API list (first 4 like the python script)
      selected:   {},     // { slug: true } — which categories to scrape
      priceMode:  'keep', // 'keep' | 'remove' | 'custom' | 'markup' | 'perk'
      priceValue: '',     // numeric input used by custom/markup/perk
      lastOutput: '',
      lastCount:  0,
      scraping:   false
    };
  }

  var panelBuilt = false;

  function buildPanel() {
    var panel = $('#damPanel');
    if (!panel || panelBuilt) return;
    panelBuilt = true;

    var s  = state.dam;
    var pm = s.priceMode;

    panel.innerHTML = [
      '<div class="dp-head">',
        '<div class="dp-title">DAM \u2014 digitalaccountmarket.com</div>',
        '<div class="dp-sub">Pick categories, choose a price strategy, hit Scrape. Output lands in the right pane, sorted high\u2192low by followers.</div>',
      '</div>',

      '<div class="dam-row">',
        '<button type="button" id="damFetch"    class="dp-btn">Fetch categories</button>',
        '<button type="button" id="damScrape"   class="dp-btn dp-btn--alt">Scrape selected \u2192</button>',
        '<button type="button" id="damDownload" class="dp-btn">\u2193 Download .txt</button>',
        '<span class="dam-status" id="damStatus">idle</span>',
      '</div>',

      '<div class="dam-grid">',
        '<div class="dam-section">',
          '<div class="dam-label">Categories <span class="dp-optional">(Fetch to load)</span></div>',
          '<div class="dam-cats" id="damCats"><div class="dam-empty">No categories loaded yet.</div></div>',
          '<label class="dam-all"><input type="checkbox" id="damAll"/><span>Select all</span></label>',
        '</div>',

        '<div class="dam-section">',
          '<div class="dam-label">Price handling</div>',
          '<div class="dam-prices">',
            '<label class="dam-radio"><input type="radio" name="damPrice" value="keep"   ' + (pm==='keep'   ?'checked':'') + '/><span>Keep original prices</span></label>',
            '<label class="dam-radio"><input type="radio" name="damPrice" value="remove" ' + (pm==='remove' ?'checked':'') + '/><span>Remove prices</span></label>',
            '<label class="dam-radio"><input type="radio" name="damPrice" value="custom" ' + (pm==='custom' ?'checked':'') + '/><span>Custom price</span>',
              '<input type="number" step="0.01" min="0" class="dam-num" id="damVCustom" placeholder="9.99"/></label>',
            '<label class="dam-radio"><input type="radio" name="damPrice" value="markup" ' + (pm==='markup' ?'checked':'') + '/><span>Markup %</span>',
              '<input type="number" step="1"    min="0" class="dam-num" id="damVMarkup" placeholder="20"/></label>',
            '<label class="dam-radio"><input type="radio" name="damPrice" value="perk"   ' + (pm==='perk'   ?'checked':'') + '/><span>Per 1K followers</span>',
              '<input type="number" step="0.01" min="0" class="dam-num" id="damVPerK"   placeholder="6"/></label>',
          '</div>',
        '</div>',
      '</div>',

      '<div class="dam-count">Scraped: <b id="damCount">' + (s.lastCount || 0) + '</b> accounts</div>'
    ].join('');

    // Rehydrate the numeric input for whatever price mode is active
    var curField = priceFieldFor(pm);
    if (curField && s.priceValue) curField.value = s.priceValue;

    bindEvents();
    if (s.categories && s.categories.length) renderCats();
  }

  function priceFieldFor(mode) {
    if (mode === 'custom') return $('#damVCustom');
    if (mode === 'markup') return $('#damVMarkup');
    if (mode === 'perk')   return $('#damVPerK');
    return null;
  }

  function bindEvents() {
    $('#damFetch').addEventListener('click', fetchCats);
    $('#damScrape').addEventListener('click', scrapeSelected);
    $('#damDownload').addEventListener('click', downloadTxt);
    $('#damAll').addEventListener('change', function () {
      var on = this.checked, s = state.dam;
      s.selected = {};
      if (on) for (var i = 0; i < s.categories.length; i++) s.selected[s.categories[i].slug] = true;
      renderCats();
    });

    // Price-mode radios
    var radios = document.querySelectorAll('input[name="damPrice"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () {
        state.dam.priceMode = this.value;
        // When switching mode, seed the new field from stored priceValue
        var f = priceFieldFor(this.value);
        if (f && state.dam.priceValue) f.value = state.dam.priceValue;
        // Focus the active numeric field for quicker typing
        if (f) { try { f.focus(); f.select(); } catch (e) {} }
      });
    }
    // Numeric inputs → update priceValue whenever edited
    ['damVCustom','damVMarkup','damVPerK'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', function () { state.dam.priceValue = this.value; });
    });
  }

  function setStatus(msg, type) {
    var el = $('#damStatus'); if (!el) return;
    el.textContent = msg || 'idle';
    el.classList.remove('is-err','is-ok','is-busy');
    if (type) el.classList.add('is-' + type);
  }

  function escapeHtml(s) {
    return String(s||'').replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }

  function renderCats() {
    var box = $('#damCats'); if (!box) return;
    var s = state.dam;
    if (!s.categories || !s.categories.length) {
      box.innerHTML = '<div class="dam-empty">No categories loaded yet.</div>';
      syncAllCheckbox();
      return;
    }
    var h = '';
    for (var i = 0; i < s.categories.length; i++) {
      var c = s.categories[i];
      var checked = s.selected[c.slug] ? 'checked' : '';
      var priceStr = c.isStatCategory
        ? '$' + (c.salePricePerK || 0) + '/1K'
        : (c.price ? '$' + Number(c.price).toFixed(2) : 'no price');
      h += '<label class="dam-cat">';
      h +=   '<input type="checkbox" data-slug="' + escapeHtml(c.slug) + '" ' + checked + '/>';
      h +=   '<span class="dam-cat-name">' + escapeHtml(c.name || 'Unknown') + '</span>';
      h +=   '<span class="dam-cat-meta">' + (c.availableCount || 0) + ' accs \u00b7 ' + priceStr + '</span>';
      h += '</label>';
    }
    box.innerHTML = h;
    var cbs = box.querySelectorAll('input[type="checkbox"]');
    for (var j = 0; j < cbs.length; j++) {
      cbs[j].addEventListener('change', function () {
        state.dam.selected[this.dataset.slug] = this.checked;
        syncAllCheckbox();
      });
    }
    syncAllCheckbox();
  }

  function syncAllCheckbox() {
    var allBox = $('#damAll'); if (!allBox) return;
    var s = state.dam;
    var total = s.categories.length;
    var sel   = 0;
    for (var i = 0; i < total; i++) if (s.selected[s.categories[i].slug]) sel++;
    allBox.checked       = total > 0 && sel === total;
    allBox.indeterminate = sel > 0 && sel < total;
  }

  // digitalaccountmarket.com sits behind Cloudflare and does not send
  // Access-Control-Allow-Origin headers for browser clients, so a direct
  // fetch() from GitHub Pages (or any origin) is blocked. We route requests
  // through a chain of free CORS proxies — first one that answers with
  // parseable JSON wins. Python's cloudscraper handles this server-side;
  // these proxies are our browser-side equivalent.
  var PROXIES = [
    function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); }
  ];

  function fetchViaProxy(url, idx) {
    idx = idx || 0;
    if (idx >= PROXIES.length) return Promise.reject(new Error('all proxies failed (CORS / Cloudflare)'));
    var wrapped = PROXIES[idx](url);
    return fetch(wrapped, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (txt) {
      // Some proxies return plain JSON, others wrap it. We only accept JSON.
      try { return JSON.parse(txt); }
      catch (e) { throw new Error('bad JSON from proxy'); }
    }).catch(function () {
      return fetchViaProxy(url, idx + 1);
    });
  }

  function fetchJson(url) {
    // Try direct first (fast path — will work if CORS ever gets enabled);
    // fall back to the proxy chain on any network/CORS error.
    return fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function () {
      return fetchViaProxy(url);
    });
  }

  function fetchCats() {
    setStatus('Fetching categories\u2026', 'busy');
    fetchJson(BASE + '/api/categories').then(function (data) {
      // Python uses [:4] — keep the same slice for parity.
      var list = Array.isArray(data) ? data.slice(0, 4) : [];
      state.dam.categories = list;
      state.dam.selected   = {};
      renderCats();
      if (!list.length) { setStatus('No categories returned.', 'err'); return; }
      setStatus('Loaded ' + list.length + ' categor' + (list.length===1?'y':'ies') + '.', 'ok');
    }).catch(function (e) {
      setStatus('Fetch failed \u2014 ' + (e && e.message ? e.message : 'CORS or network error'), 'err');
    });
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  function scrapeSelected() {
    var s = state.dam;
    if (s.scraping) return;
    var picks = s.categories.filter(function (c) { return s.selected[c.slug]; });
    if (!picks.length) { setStatus('Pick at least one category first.', 'err'); return; }

    s.scraping = true;
    setStatus('Scraping ' + picks.length + ' categor' + (picks.length===1?'y':'ies') + '\u2026', 'busy');

    var jobs = picks.map(function (cat) {
      return fetchJson(BASE + '/api/categories/' + cat.slug + '/items')
        .then(function (j) { return { cat: cat, items: (j && j.items) || [] }; })
        .catch(function ()  { return { cat: cat, items: [] }; });
    });

    Promise.all(jobs).then(function (results) {
      var all = [];
      results.forEach(function (r) {
        var cat = r.cat;
        (r.items || []).forEach(function (it) {
          var username = (it.display || '').trim();
          if (!username) return;
          var followers, formatted, price;
          if (cat.isStatCategory) {
            followers = Number(it.followerCount) || 0;
            formatted = it.formattedFollowers || (followers ? String(followers) : '');
            price     = Number(it.price) || 0;
          } else {
            followers = 0;
            formatted = '';
            price     = Number(cat.price) || 0;
          }
          all.push({ username: username, followers: followers, formatted: formatted, price: price });
        });
      });

      // high → low by followers (non-stat categories all have 0 so they bunch at the end)
      all.sort(function (a, b) { return b.followers - a.followers; });

      var val   = parseFloat(s.priceValue);
      var mode  = s.priceMode;
      var lines = all.map(function (it) {
        var pricePart = '';
        switch (mode) {
          case 'remove': pricePart = ''; break;
          case 'custom': pricePart = isFinite(val) ? (' $' + round1(val)) : (it.price ? ' $' + round1(it.price) : ''); break;
          case 'markup': pricePart = (isFinite(val) && it.price) ? (' $' + round1(it.price * (1 + val/100))) : (it.price ? ' $' + round1(it.price) : ''); break;
          case 'perk':   pricePart = (isFinite(val) && it.followers) ? (' $' + round1((it.followers/1000) * val)) : (it.price ? ' $' + round1(it.price) : ''); break;
          case 'keep':
          default:       pricePart = it.price ? ' $' + round1(it.price) : ''; break;
        }
        var followPart = it.formatted ? ' [' + it.formatted + ']' : '';
        return 'x.com/' + it.username + followPart + pricePart;
      });

      s.lastOutput = lines.join('\n');
      s.lastCount  = lines.length;
      s.scraping   = false;

      // The standard output pane is hidden in DAM mode (body[data-mode="dam"]
      // .work { display:none }), so we only update DAM's own count pill.
      // The full result goes out via the Download .txt button.
      var cnt = $('#damCount'); if (cnt) cnt.textContent = lines.length;

      if (lines.length) setStatus('Scraped ' + lines.length + ' accounts \u2014 hit Download to save.', 'ok');
      else              setStatus('Scrape returned 0 rows.', 'err');
    }).catch(function (e) {
      s.scraping = false;
      setStatus('Scrape failed \u2014 ' + (e && e.message ? e.message : 'network error'), 'err');
    });
  }

  function downloadTxt() {
    var text = state.dam.lastOutput || '';
    if (!text) { setStatus('Nothing to download \u2014 hit Scrape first.', 'err'); return; }
    var name = (U && U.randFileName) ? U.randFileName('txt') : ('dam_' + Date.now() + '.txt');
    var blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
    setStatus('Downloaded ' + name, 'ok');
  }

  // Register — DAM doesn't read from the input textarea; its output is
  // produced only when the Scrape button is clicked. On rerun we just return
  // the last scrape so the output pane keeps showing it.
  App.App.registerMode({
    id:    'dam',
    label: 'DAM',
    run: function () {
      if (!panelBuilt) buildPanel();
      return state.dam.lastOutput || '';
    }
  });
})();
