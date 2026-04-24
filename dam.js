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

  // Lazy-init DAM state. Custom proxy URL persists across reloads because
  // setting it up is a one-time cost the user shouldn't have to redo.
  if (!state.dam) {
    state.dam = {
      categories: [],     // raw API list (first 4 like the python script)
      selected:   {},     // { slug: true } — which categories to scrape
      priceMode:  'keep', // 'keep' | 'remove' | 'custom' | 'markup' | 'perk'
      priceValue: '',     // numeric input used by custom/markup/perk
      lastOutput: '',
      lastCount:  0,
      scraping:   false,
      customProxy: (function () {
        try { return localStorage.getItem('damCustomProxy') || ''; }
        catch (e) { return ''; }
      })()
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
        '<div class="dp-title">DAM</div>',
        '<div class="dp-sub">Pick categories, choose a price strategy, hit Scrape \u2192 download the list.</div>',
      '</div>',

      '<div class="dam-row">',
        '<button type="button" id="damFetch"    class="dp-btn">Fetch categories</button>',
        '<button type="button" id="damScrape"   class="dp-btn dp-btn--alt">Scrape selected \u2192</button>',
        '<button type="button" id="damDownload" class="dp-btn">\u2193 Download .txt</button>',
        '<span class="dam-status" id="damStatus">idle</span>',
      '</div>',

      // Optional custom proxy URL: lets the user point at their own worker/edge
      // function when public CORS proxies get rate-limited or challenged by
      // Cloudflare. Format: "https://your-worker.example.com/?url=" — the
      // target URL will be appended (URL-encoded).
      '<div class="dam-proxy-row">',
        '<label class="dam-label" for="damProxy">Custom proxy URL <span class="dp-optional">(optional \u2014 appends target as ?url=\u2026)</span></label>',
        '<input type="text" id="damProxy" class="dam-proxy-input" spellcheck="false" placeholder="https://your-worker.example.com/?url="/>',
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

      '<div class="dam-count">Scraped: <b id="damCount">' + (s.lastCount || 0) + '</b> accounts</div>',

      // Results card — appears under the panel once a scrape lands. Copy
      // pushes the text to the clipboard; Clear wipes state + hides the card.
      '<div class="dam-results" id="damResults" style="display:none">',
        '<div class="dam-results-head">',
          '<span class="dam-results-title">Results <span class="dam-results-n" id="damResultsN">0</span></span>',
          '<div class="dam-results-actions">',
            '<button type="button" id="damCopyResults"  class="dp-btn dp-btn--alt">Copy</button>',
            '<button type="button" id="damClearResults" class="dp-btn dp-btn--alt">Clear</button>',
          '</div>',
        '</div>',
        '<pre class="dam-results-out" id="damResultsOut"></pre>',
      '</div>'
    ].join('');

    // Rehydrate the numeric input for whatever price mode is active
    var curField = priceFieldFor(pm);
    if (curField && s.priceValue) curField.value = s.priceValue;

    // Rehydrate custom proxy input
    var proxyEl = $('#damProxy');
    if (proxyEl && s.customProxy) proxyEl.value = s.customProxy;

    // Rehydrate results card if a previous scrape exists (mode-switch survival)
    if (s.lastOutput) renderResults();

    bindEvents();
    if (s.categories && s.categories.length) renderCats();
  }

  function renderResults() {
    var s = state.dam;
    var card = $('#damResults');
    var out  = $('#damResultsOut');
    var nEl  = $('#damResultsN');
    if (!card || !out) return;
    if (s.lastOutput) {
      card.style.display = 'block';
      out.textContent = s.lastOutput;
      if (nEl) nEl.textContent = s.lastCount || 0;
    } else {
      card.style.display = 'none';
      out.textContent = '';
      if (nEl) nEl.textContent = '0';
    }
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
    // Numeric inputs → update priceValue whenever edited AND auto-select the
    // corresponding radio, so typing a number doesn't silently fall under the
    // wrong price mode.
    var NUM_TO_MODE = { damVCustom: 'custom', damVMarkup: 'markup', damVPerK: 'perk' };
    Object.keys(NUM_TO_MODE).forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        state.dam.priceValue = this.value;
        var mode = NUM_TO_MODE[id];
        if (state.dam.priceMode !== mode) {
          state.dam.priceMode = mode;
          var radio = document.querySelector('input[name="damPrice"][value="' + mode + '"]');
          if (radio) radio.checked = true;
        }
      });
      // Focusing the field alone is also a strong signal of intent.
      el.addEventListener('focus', function () {
        var mode = NUM_TO_MODE[id];
        if (state.dam.priceMode !== mode) {
          state.dam.priceMode = mode;
          var radio = document.querySelector('input[name="damPrice"][value="' + mode + '"]');
          if (radio) radio.checked = true;
        }
      });
    });

    // Custom proxy URL input — persisted in localStorage so the user only
    // enters it once.
    var proxyEl = $('#damProxy');
    if (proxyEl) {
      proxyEl.addEventListener('input', function () {
        state.dam.customProxy = this.value.trim();
        try { localStorage.setItem('damCustomProxy', state.dam.customProxy); } catch (e) {}
      });
    }

    // Results card actions
    var copyBtn = $('#damCopyResults');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var text = state.dam.lastOutput || '';
      if (!text) return;
      var self = this;
      navigator.clipboard.writeText(text).then(function () {
        var orig = self.textContent;
        self.textContent = 'Copied';
        setTimeout(function () { self.textContent = orig; }, 900);
      }).catch(function () { alert('Copy failed.'); });
    });

    var clearBtn = $('#damClearResults');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      state.dam.lastOutput = '';
      state.dam.lastCount  = 0;
      var cnt = $('#damCount'); if (cnt) cnt.textContent = '0';
      renderResults();
      setStatus('Results cleared.', 'ok');
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

  // The target site sits behind Cloudflare and does not send CORS headers
  // to browser origins. The Python script uses cloudscraper server-side;
  // we have to route through a proxy. Strategy:
  //   1) Custom proxy (user-supplied) — most reliable if they run their own.
  //   2) Parallel race across a bank of public CORS proxies. First one that
  //      returns a valid JSON wins; the rest are abandoned. This is faster
  //      and way more resilient than serial — if 3/7 proxies are dead or
  //      rate-limited, we don't sit through their timeouts.
  //
  //   Each entry is { name, build, parse }.
  //     build(url) -> wrapped URL to fetch
  //     parse(text) -> parsed JSON (some proxies JSON-wrap the response, so
  //                    they need a two-step parse like .contents then JSON).
  var PUBLIC_PROXIES = [
    { name: 'corsproxy.io',
      build: function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); },
      parse: function (t) { return JSON.parse(t); } },
    { name: 'allorigins/raw',
      build: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
      parse: function (t) { return JSON.parse(t); } },
    // allorigins /get wraps the body in { contents: "…" } — survives CF HTML
    // sometimes because the wrapper is always JSON.
    { name: 'allorigins/get',
      build: function (u) { return 'https://api.allorigins.win/get?url=' + encodeURIComponent(u); },
      parse: function (t) {
        var env = JSON.parse(t);
        if (!env || typeof env.contents !== 'string') throw new Error('no contents');
        return JSON.parse(env.contents);
      } },
    { name: 'codetabs',
      build: function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + u; },
      parse: function (t) { return JSON.parse(t); } },
    { name: 'corsproxy.org',
      build: function (u) { return 'https://corsproxy.org/?' + encodeURIComponent(u); },
      parse: function (t) { return JSON.parse(t); } },
    { name: 'thingproxy',
      build: function (u) { return 'https://thingproxy.freeboard.io/fetch/' + u; },
      parse: function (t) { return JSON.parse(t); } },
    { name: 'cors.eu.org',
      build: function (u) { return 'https://cors.eu.org/' + u; },
      parse: function (t) { return JSON.parse(t); } },
    { name: 'yacdn',
      build: function (u) { return 'https://yacdn.org/serve/' + u; },
      parse: function (t) { return JSON.parse(t); } }
  ];

  // fetch + timeout + parse. Parse errors are opaque on purpose — if a proxy
  // gave back Cloudflare challenge HTML, we don't want partial JSON fragments
  // leaking through.
  function fetchWithTimeout(url, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function attemptProxy(proxy, url, timeoutMs) {
    return fetchWithTimeout(proxy.build(url), timeoutMs).then(function (text) {
      try { return proxy.parse(text); }
      catch (e) { throw new Error(proxy.name + ': non-JSON'); }
    }).catch(function (e) {
      throw new Error(proxy.name + ' \u2192 ' + (e && e.message ? e.message : 'failed'));
    });
  }

  // Promise.any polyfill for older runtimes. Resolves with the first
  // fulfilled value, rejects with an aggregate error if every promise fails.
  function firstOf(promises) {
    if (typeof Promise.any === 'function') {
      return Promise.any(promises).catch(function (agg) {
        // AggregateError has .errors; flatten their messages for the user.
        var msgs = (agg && agg.errors) ? agg.errors.map(function (e) { return e && e.message; }) : [agg && agg.message];
        var err = new Error(msgs.filter(Boolean).join(' | ') || 'all proxies failed');
        err.errors = (agg && agg.errors) || [];
        throw err;
      });
    }
    return new Promise(function (resolve, reject) {
      var errors = [];
      var remaining = promises.length;
      if (!remaining) { reject(new Error('no proxies')); return; }
      promises.forEach(function (p) {
        Promise.resolve(p).then(resolve, function (e) {
          errors.push(e);
          if (--remaining === 0) {
            var msgs = errors.map(function (x) { return x && x.message; }).filter(Boolean);
            var err = new Error(msgs.join(' | ') || 'all proxies failed');
            err.errors = errors;
            reject(err);
          }
        });
      });
    });
  }

  function fetchJson(url) {
    var s = state.dam;
    var custom = (s && s.customProxy ? String(s.customProxy).trim() : '');
    var TIMEOUT = 12000; // per attempt

    // 1) Custom proxy first — if it works, we never hit the public chain.
    //    Build: if prefix ends with ?url= / ?q= / ?quest=, URL-encode; else
    //    append raw (prefix-style proxies).
    if (custom) {
      var needsEncode = /[?&](url|q|quest)=$/.test(custom);
      var wrapped = custom + (needsEncode ? encodeURIComponent(url) : url);
      return fetchWithTimeout(wrapped, TIMEOUT)
        .then(function (text) {
          try { return JSON.parse(text); }
          catch (e) { throw new Error('custom proxy returned non-JSON'); }
        })
        .catch(function (customErr) {
          // Fall back to the public race if the custom one hiccups.
          return raceProxies(url, TIMEOUT).catch(function (raceErr) {
            throw new Error(
              'custom proxy: ' + (customErr && customErr.message || 'failed') +
              ' \u2014 public proxies also failed'
            );
          });
        });
    }

    // 2) No custom proxy → try direct (rare success on CF) + public race.
    //    Direct attempt is cheap and uncontested; if it fires CORS the race
    //    takes over.
    var direct = fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'cors'
    }).then(function (r) {
      if (!r.ok) throw new Error('direct HTTP ' + r.status);
      return r.json();
    });

    return firstOf([direct].concat(
      PUBLIC_PROXIES.map(function (p) { return attemptProxy(p, url, TIMEOUT); })
    )).catch(function (aggErr) {
      // Surface the first few individual proxy errors so the user knows
      // it's not a code bug.
      var detail = (aggErr && aggErr.errors)
        ? aggErr.errors.slice(0, 3).map(function (e) { return e && e.message; }).filter(Boolean).join(' | ')
        : (aggErr && aggErr.message) || '';
      var suffix = detail ? (' \u2014 ' + detail) : '';
      throw new Error('all proxies blocked \u2014 set a Custom proxy URL (Cloudflare Worker / your server)' + suffix);
    });
  }

  // Helper: run the public proxy race only (used when the custom proxy
  // fails and we want to fall back).
  function raceProxies(url, timeoutMs) {
    return firstOf(PUBLIC_PROXIES.map(function (p) {
      return attemptProxy(p, url, timeoutMs);
    }));
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

  // The /items endpoint paginates at 100 rows per call. Walk pages until the
  // API returns fewer than 100 rows, or we've collected availableCount, or we
  // hit the safety cap. If the API ignores ?page=N (unlikely but possible),
  // the dedup guard below catches "same first item repeated" and stops the
  // loop so we don't spin forever.
  var PAGE_SIZE = 100;
  var MAX_PAGES = 100; // 100 * 100 = 10k rows per category — way above real sizes

  function fetchAllItems(cat) {
    var slug = cat.slug;
    var available = cat.availableCount || 0;
    var collected = [];
    var firstIdPerPage = {}; // page -> first item key, for loop-detection

    function keyOf(it) {
      return (it && (it.id || it.uuid || it.display)) || JSON.stringify(it || {});
    }

    function fetchPage(page) {
      if (page > MAX_PAGES) return Promise.resolve();
      var url = BASE + '/api/categories/' + slug + '/items?page=' + page + '&limit=' + PAGE_SIZE;
      return fetchJson(url).then(function (j) {
        var items = (j && j.items) || [];
        if (!items.length) return;
        var firstKey = keyOf(items[0]);
        // If page N>1 starts with the same key we've already seen, the server
        // is ignoring ?page — stop to avoid infinite duplication.
        for (var p in firstIdPerPage) {
          if (firstIdPerPage[p] === firstKey) return;
        }
        firstIdPerPage[page] = firstKey;

        collected.push.apply(collected, items);
        if (items.length < PAGE_SIZE) return;                 // last page
        if (available && collected.length >= available) return; // all caught
        return fetchPage(page + 1);
      });
    }

    return fetchPage(1).then(function () { return { cat: cat, items: collected }; });
  }

  function scrapeSelected() {
    var s = state.dam;
    if (s.scraping) return;
    var picks = s.categories.filter(function (c) { return s.selected[c.slug]; });
    if (!picks.length) { setStatus('Pick at least one category first.', 'err'); return; }

    s.scraping = true;
    setStatus('Scraping ' + picks.length + ' categor' + (picks.length===1?'y':'ies') + '\u2026', 'busy');

    var jobs = picks.map(function (cat) {
      return fetchAllItems(cat).catch(function () { return { cat: cat, items: [] }; });
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

      var cnt = $('#damCount'); if (cnt) cnt.textContent = lines.length;
      renderResults();

      if (lines.length) setStatus('Scraped ' + lines.length + ' accounts \u2014 results ready below.', 'ok');
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
