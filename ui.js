// ui.js (FULL)
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  window.App = window.App || {};
  const { App: Core } = window.App;
  const State = window.App.State;

  function openDropdown(menuEl, btnEl) {
    btnEl?.setAttribute('aria-expanded', 'true');
    menuEl?.classList.add('open');
  }
  function closeDropdown(menuEl, btnEl) {
    btnEl?.setAttribute('aria-expanded', 'false');
    menuEl?.classList.remove('open');
  }

  // ---- Full theme system ----
  const THEMES = window._FGPT_THEMES || [];

  const CSS_MAP = {
    accent:'--accent', accent2:'--accent-2', accent3:'--accent-3',
    accentRgb:'--accent-rgb', accent2Rgb:'--accent2-rgb', okRgb:'--ok-rgb',
    cardRgb:'--card-rgb', tintRgb:'--tint-rgb',
    bg:'--bg0', bg2:'--bg1', card:'--panel', input:'--input-bg',
    line:'--line', glow:'--glow', muted:'--muted', ok:'--ok', bad:'--bad'
  };

  // Accent vars a custom color writes inline; cleared before applying a preset
  // so a previous custom (which may be inline !important) never sticks.
  var CUSTOM_ACCENT_VARS = ['--accent','--accent-2','--accent-3','--accent-rgb',
    '--accent2-rgb','--mint','--violet','--glow','--nb-hard-lime','--nb-accent-hi','--ink'];

  function hexToRgbStr(hex) {
    hex = String(hex || '').trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    if (!isFinite(n)) return '45,212,191';
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }
  function relLum(hex) {
    var p = hexToRgbStr(hex).split(',').map(Number);
    return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255;
  }

  // Apply a single free-picked accent color across the UI, in whichever theme
  // is active. Under Neon the palette tokens are !important, so custom writes
  // inline with 'important' priority to win; under Aurora normal inline is enough.
  function applyCustomAccent(hex) {
    var root = document.documentElement;
    var rgb = hexToRgbStr(hex);
    var prio = root.getAttribute('data-theme') === 'neon' ? 'important' : '';
    var set = function (n, v) { root.style.setProperty(n, v, prio); };
    root.setAttribute('data-swatch', 'custom');
    set('--accent', hex); set('--accent-2', hex); set('--accent-3', hex);
    set('--accent-rgb', rgb); set('--accent2-rgb', rgb);
    set('--mint', hex); set('--violet', hex);
    set('--glow', 'rgba(' + rgb + ',.18)');
    set('--nb-hard-lime', hex);   /* neon accent-colored offset shadow */
    set('--nb-accent-hi', hex);   /* neon button :hover fill            */
    /* Readable text on accent-filled buttons: dark ink on a light pick, light on a dark one. */
    set('--ink', relLum(hex) > 0.55 ? '#0a0c10' : '#ffffff');
    root.style.setProperty('--fg', 'hsl(0,0%,100%)');
  }

  function applyTheme(t) {
    var root = document.documentElement;
    // Clear any custom inline accent (possibly !important) so a preset applies cleanly.
    CUSTOM_ACCENT_VARS.forEach(function (v) { root.style.removeProperty(v); });
    // Expose the chosen swatch as an attribute so the Neon theme can retint its
    // accent per swatch (theme-neon.css reads html[data-theme="neon"][data-swatch=…]).
    // Aurora ignores it — nothing there is scoped to [data-swatch].
    if (t && t.name) root.setAttribute('data-swatch', t.name.toLowerCase());
    for (var k in CSS_MAP) {
      if (t[k]) root.style.setProperty(CSS_MAP[k], t[k]);
    }
    root.style.setProperty('--line-strong', t.line.replace(/[\d.]+\)$/, function(m) {
      return (parseFloat(m)*2.5).toFixed(2)+')';
    }));
    root.style.setProperty('--fg', 'hsl(0,0%,100%)');
    document.body.style.background = t.bg;
    var aur = document.querySelector('.aur');
    if (aur) aur.style.background = 'radial-gradient(ellipse at 50% 0%,' + t.glow + ' 0%,transparent 70%)';
  }

  // Color choice is stored PER UI THEME so a color picked in Neon never leaks
  // into Aurora and vice-versa. Aurora keeps the legacy 'fgptTheme' key for
  // back-compat; Neon uses 'fgptTheme_neon'.
  function curUi() {
    return document.documentElement.getAttribute('data-theme') === 'neon' ? 'neon' : 'aurora';
  }
  function colorKeyFor(ui) { return ui === 'neon' ? 'fgptTheme_neon' : 'fgptTheme'; }
  function loadColorFor(ui) {
    try { var s = localStorage.getItem(colorKeyFor(ui)); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  }
  function saveColorFor(ui, t) {
    try { localStorage.setItem(colorKeyFor(ui), JSON.stringify(t)); } catch (e) {}
  }

  // The default when a UI theme has no saved color: Aurora → first swatch;
  // Neon → its built-in lime (no swatch, cleared inline accents).
  function applyDefaultColor() {
    if (curUi() === 'neon') {
      var root = document.documentElement;
      CUSTOM_ACCENT_VARS.forEach(function (v) { root.style.removeProperty(v); });
      root.removeAttribute('data-swatch');
    } else {
      applyTheme(THEMES[0]);
    }
  }
  // Apply a stored color choice (preset object, {custom,accent}, or null=default).
  function applyChoice(t) {
    if (t && t.custom && t.accent) applyCustomAccent(t.accent);
    else if (t && t.accent) applyTheme(t);
    else applyDefaultColor();
  }

  // On load, apply the color saved for whichever UI theme the boot script chose.
  applyChoice(loadColorFor(curUi()));

  function createSettingsPanel() {
    if ($('#settingsPanel')) return $('#settingsPanel');

    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.style.position = 'fixed';
    panel.style.inset = '0';
    panel.style.zIndex = '9999';
    panel.style.display = 'none';

    // Build theme swatch HTML. data-sw lets the Neon theme swap each chip's
    // preview to that swatch's neon accent (theme-neon.css §14) while Neon is
    // active; Aurora keeps the inline gradient below.
    let swatchHtml = THEMES.map((t, i) =>
      `<button class="sp-swatch" data-idx="${i}" data-sw="${t.name.toLowerCase()}" title="${t.name}">
        <span class="sp-swatch-color" data-sw="${t.name.toLowerCase()}" style="background:${t.swatch}"></span>
        <span class="sp-swatch-name">${t.name}</span>
      </button>`
    ).join('');
    // Custom color picker — pick any accent and apply it to the UI (both themes).
    swatchHtml += `
      <label class="sp-swatch sp-swatch-custom" id="sp-custom-swatch" title="Pick a custom accent color">
        <span class="sp-swatch-color" id="sp-custom-dot" style="background:conic-gradient(from 0deg,#ff5c78,#ffc23d,#2fe38f,#2df0d0,#4d9bff,#a06bff,#ff5cc0,#ff5c78)"></span>
        <span class="sp-swatch-name">Custom</span>
        <input type="color" id="sp-custom-input" value="#2dd4bf" aria-label="Pick a custom accent color">
      </label>`;

    panel.innerHTML = `
      <div id="sp-backdrop" style="position:absolute;inset:0;background:#0006;backdrop-filter:blur(4px)"></div>
      <div id="sp-card" style="
        position:absolute;left:50%;top:50%;
        transform:translate(-50%,-50%);
        width:min(580px,94vw);max-height:90vh;overflow-y:auto;
        background:rgba(15,19,24,.97);border:1px solid var(--line,#2a3340);border-radius:14px;
        padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);color:#e6edf3;
        font:14px/1.45 var(--font-mono, ui-monospace, monospace);">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <strong style="font-weight:700;font-size:15px">Settings</strong>
          <button id="sp-close" title="Close" style="border:0;background:rgba(255,255,255,.06);color:#b9c7dc;border-radius:8px;padding:6px 10px;cursor:pointer">✕</button>
        </div>

        <!-- Theme -->
        <div style="margin-bottom:18px">
          <label class="sp-settings-label">Color Theme</label>
          <div id="sp-swatches" class="sp-theme-grid">
            ${swatchHtml}
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,.06);margin:16px 0"></div>

        <!-- App theme (structural look): Aurora (default) vs Neon Terminal -->
        <div style="margin-bottom:18px">
          <label class="sp-settings-label">Theme</label>
          <div id="sp-appthemes" class="sp-appthemes">
            <button type="button" class="sp-apptheme" data-apptheme="">Aurora</button>
            <button type="button" class="sp-apptheme" data-apptheme="neon">Neon Terminal</button>
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,.06);margin:16px 0"></div>

        <!-- Mail Access URLs (collapsible dropdown) -->
        <div>
          <label class="sp-settings-label">Mail Access URL</label>
          <div id="sp-mail-dd" class="sp-mail-dd">
            <button id="sp-mail-dd-btn" type="button" class="sp-mail-dd-btn" aria-haspopup="listbox" aria-expanded="false">
              <span id="sp-mail-current" class="sp-mail-current"></span>
              <svg class="sp-mail-dd-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div id="sp-mail-panel" class="sp-mail-panel">
              <div id="sp-mail-list" class="sp-mail-list" role="listbox"></div>
              <div class="sp-mail-add">
                <input id="sp-mail-add" class="sp-mail-add-input" type="text" spellcheck="false"
                  placeholder="Add another mail URL…" autocomplete="off" />
                <button id="sp-mail-add-btn" type="button" class="sp-mail-add-btn">Add</button>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
          <button id="sp-reset" type="button" style="border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#9fb3ca;border-radius:10px;padding:8px 14px;cursor:pointer">Reset All</button>
          <button id="sp-apply" type="button" style="border:0;background:var(--accent,#2dd4bf);color:#041014;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer">Save ✓</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function showSettings() {
    const panel = createSettingsPanel();
    const card = $('#sp-card');
    const mailDd = $('#sp-mail-dd');
    const mailDdBtn = $('#sp-mail-dd-btn');
    const mailCurrent = $('#sp-mail-current');
    const mailListEl = $('#sp-mail-list');
    const mailAddInput = $('#sp-mail-add');
    const mailAddBtn = $('#sp-mail-add-btn');
    const resetBtn = $('#sp-reset');
    const applyBtn = $('#sp-apply');
    const closeBtn = $('#sp-close');
    const back = $('#sp-backdrop');
    const swatches = $('#sp-swatches');
    const customSwatch = $('#sp-custom-swatch');
    const customInput = $('#sp-custom-input');
    const customDot = $('#sp-custom-dot');

    // Working copies — persisted only on Save, discarded on close/cancel.
    let mailList = (State?.state?.mailAccessList || []).slice();
    let activeUrl = State?.state?.mailAccess || mailList[0] || '';

    // Color state is tracked PER UI THEME. savedColors is the on-disk baseline
    // captured at open (for cancel/revert); pending holds unsaved live edits.
    const savedColors = { aurora: loadColorFor('aurora'), neon: loadColorFor('neon') };
    const pending = { aurora: null, neon: null };
    const effChoice = (ui) => (pending[ui] !== null ? pending[ui] : savedColors[ui]);

    // Reflect the current UI theme's selection in the chips.
    function refreshChips(t) {
      if (t && t.custom && t.accent) setCustomActive(t.accent);
      else if (t && t.accent) syncSwatchActive(t.accent);
      else syncSwatchActive(null);           // default (Neon lime): nothing highlighted
    }
    refreshChips(effChoice(curUi()));
    panel.style.display = 'block';

    // App theme switch — Aurora (default) vs Neon Terminal. Applies immediately
    // (sets <html data-theme>), highlights the active choice, and persists to
    // the "fgpt_theme" key (read by the no-flash boot script in index.html).
    var appThemes = $('#sp-appthemes');
    function syncAppThemeBtns() {
      var cur = document.documentElement.getAttribute('data-theme') || '';
      var btns = appThemes ? appThemes.querySelectorAll('.sp-apptheme') : [];
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', (btns[i].dataset.apptheme || '') === cur);
      }
    }
    syncAppThemeBtns();
    if (appThemes) appThemes.onclick = function (e) {
      var btn = e.target.closest('.sp-apptheme');
      if (!btn) return;
      var val = btn.dataset.apptheme || '';
      if (val) document.documentElement.setAttribute('data-theme', val);
      else document.documentElement.removeAttribute('data-theme');
      try {
        if (val) localStorage.setItem('fgpt_theme', val);
        else localStorage.removeItem('fgpt_theme');
      } catch (e2) {}
      syncAppThemeBtns();
      syncTickerBuild();
      // Switch to the newly-active UI theme's OWN color choice, so Neon and
      // Aurora keep independent palettes.
      var t = effChoice(curUi());
      applyChoice(t);
      refreshChips(t);
    };

    function close() { panel.style.display = 'none'; }

    // Highlight a preset chip (and clear the Custom chip).
    function syncSwatchActive(accent) {
      const all = swatches?.querySelectorAll('.sp-swatch') || [];
      for (const s of all) {
        const idx = +s.dataset.idx;
        s.classList.toggle('sp-swatch-on', Number.isFinite(idx) && THEMES[idx]?.accent === accent);
      }
    }

    // Highlight the Custom chip and seed its swatch + picker with `hex`.
    function setCustomActive(hex) {
      syncSwatchActive(null);               // clear preset chips
      if (customInput) customInput.value = hex;
      if (customDot) customDot.style.background = hex;
      if (customSwatch) customSwatch.classList.add('sp-swatch-on');
    }

    function pickTheme(t) {
      pending[curUi()] = t;                  // pending for THIS UI theme only
      applyTheme(t);
      syncSwatchActive(t.accent);           // also clears the Custom chip
    }

    swatches?.addEventListener('click', (e) => {
      const btn = e.target.closest('.sp-swatch');
      if (!btn || !btn.dataset.idx) return; // ignore the Custom label
      const t = THEMES[+btn.dataset.idx];
      if (t) pickTheme(t);
    });

    // Custom color picker: apply live as the user drags, persist on Save.
    customInput?.addEventListener('input', () => {
      const hex = customInput.value;
      applyCustomAccent(hex);
      pending[curUi()] = { custom: true, accent: hex };
      setCustomActive(hex);
    });

    function normalize(url) {
      const v = (url || '').trim();
      if (!v) return '';
      if (/^https?:\/\//i.test(v)) return v;
      if (/^\/\//.test(v)) return 'https:' + v;
      return 'https://' + v;
    }

    // ----- Mail URL dropdown: pick the active one, add, remove -----
    function setMailOpen(open) {
      if (!mailDd) return;
      mailDd.classList.toggle('sp-mail-open', !!open);
      if (mailDdBtn) mailDdBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function updateMailCurrent() {
      if (!mailCurrent) return;
      mailCurrent.textContent = activeUrl || 'No URL selected';
      mailCurrent.classList.toggle('sp-mail-current-empty', !activeUrl);
    }

    function renderMailList() {
      updateMailCurrent();
      if (!mailListEl) return;
      if (!mailList.length) {
        mailListEl.innerHTML = '<div class="sp-mail-empty">No mail URLs yet — add one below.</div>';
        return;
      }
      mailListEl.innerHTML = mailList.map((url) => {
        const on = url === activeUrl;
        return '<div class="sp-mail-row' + (on ? ' sp-mail-on' : '') + '" role="option" aria-selected="' + (on ? 'true' : 'false') + '" data-url="' + escHtml(url) + '">' +
                 '<span class="sp-mail-radio" aria-hidden="true"></span>' +
                 '<span class="sp-mail-url" title="' + escHtml(url) + '">' + escHtml(url) + '</span>' +
                 '<button type="button" class="sp-mail-del" title="Remove this URL" aria-label="Remove">✕</button>' +
               '</div>';
      }).join('');
    }
    renderMailList();
    setMailOpen(false); // always start collapsed (panel is reused across opens)

    // Toggle the dropdown.
    mailDdBtn.onclick = (e) => {
      e.stopPropagation();
      setMailOpen(!mailDd.classList.contains('sp-mail-open'));
    };

    // Click a row → make it active & collapse; click its ✕ → remove (stay open).
    mailListEl.onclick = (e) => {
      const del = e.target.closest('.sp-mail-del');
      if (del) {
        e.stopPropagation();
        const row = del.closest('.sp-mail-row');
        const url = row && row.dataset.url;
        mailList = mailList.filter((u) => u !== url);
        if (activeUrl === url) activeUrl = mailList[0] || '';
        renderMailList();
        return;
      }
      const row = e.target.closest('.sp-mail-row');
      if (row) { activeUrl = row.dataset.url; renderMailList(); setMailOpen(false); }
    };

    function addMailUrl() {
      const v = normalize(mailAddInput.value);
      if (!v) {
        mailAddInput.focus();
        mailAddInput.classList.add('sp-mail-add-err');
        setTimeout(() => mailAddInput.classList.remove('sp-mail-add-err'), 800);
        return;
      }
      if (mailList.indexOf(v) < 0) mailList.push(v);
      activeUrl = v; // newly added becomes the selected one
      mailAddInput.value = '';
      renderMailList();
      mailAddInput.focus();
    }
    mailAddBtn.onclick = addMailUrl;
    mailAddInput.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addMailUrl(); }
    };

    // Click anywhere else in the modal (outside the dropdown) collapses it.
    if (card) card.onclick = (e) => {
      if (mailDd && mailDd.classList.contains('sp-mail-open') && !e.target.closest('#sp-mail-dd')) {
        setMailOpen(false);
      }
    };

    resetBtn.onclick = () => {
      mailList = ((App.Config && App.Config.DEFAULT_MAIL_LIST) || []).map(normalize).filter(Boolean);
      activeUrl = mailList[0] || '';
      renderMailList();
      // Forget both UI themes' colors and return the current one to its default.
      try { localStorage.removeItem('fgptTheme'); localStorage.removeItem('fgptTheme_neon'); } catch (e) {}
      savedColors.aurora = null; savedColors.neon = null;
      pending.aurora = null; pending.neon = null;
      applyDefaultColor();
      refreshChips(null);
    };
    applyBtn.onclick = () => {
      if (State?.setMailAccessList) State.setMailAccessList(mailList, activeUrl);
      else if (State?.setMailAccess) State.setMailAccess(activeUrl);
      // Persist each UI theme's color independently (only if it was changed).
      ['aurora', 'neon'].forEach((ui) => {
        if (pending[ui] !== null) saveColorFor(ui, pending[ui]);
      });
      Core?.rerun && Core.rerun();
      close();
    };
    closeBtn.onclick = back.onclick = () => {
      // Discard unsaved edits: restore the current UI theme's saved baseline.
      if (pending.aurora !== null || pending.neon !== null) {
        applyChoice(savedColors[curUi()]);
      }
      pending.aurora = null; pending.neon = null;
      close();
    };
    panel.onkeydown = (e) => {
      if (e.key !== 'Escape') return;
      // Escape collapses an open mail dropdown first, then closes the modal.
      if (mailDd && mailDd.classList.contains('sp-mail-open')) { setMailOpen(false); return; }
      closeBtn.onclick();
    };
  }

  function syncReorderPanel(mode) {
    const panel = $('#reorderPanel');
    if (panel) panel.style.display = mode === 'reorder' ? 'block' : 'none';
  }

  function syncFilterPanel(mode) {
    const panel = $('#filterPanel');
    if (panel) panel.style.display = mode === 'filter' ? 'block' : 'none';
    // Hide the standard output card when filter mode is active (filter has its own output)
    const outCard = $('#out')?.closest('.card');
    if (outCard) outCard.style.display = mode === 'filter' ? 'none' : '';
  }

  function syncSorterPanel(mode) {
    const panel = $('#sorterPanel');
    if (panel) panel.style.display = mode === 'sorter' ? 'block' : 'none';
  }

  function syncPlinksPricesPanel(mode) {
    const panel = $('#plinksPricesPanel');
    if (panel) panel.style.display = mode === 'plinksPrices' ? 'block' : 'none';
  }

  function syncCrosscheckPanel(mode) {
    const panel = $('#crosscheckPanel');
    if (panel) panel.style.display = mode === 'crosscheck' ? 'flex' : 'none';
  }

  function syncDeliverPanel(mode) {
    const panel = $('#deliverPanel');
    if (panel) panel.style.display = mode === 'deliver' ? 'block' : 'none';
  }

  // URL ↔ mode mapping
  var MODE_SLUGS = {
    standard:'standard', reorder:'reorder', filter:'filter', sorter:'sorter', separator:'separator',
    duplicate:'duplicate-finder',
    plinksWith:'plinks-with', plinksPrices:'plinks-with-prices', plinksWithout:'plinks-without',
    mailChanger:'mail-changer', reverse:'reverse',
    crosscheck:'crosscheck', deliver:'deliver'
  };
  var SLUG_TO_MODE = {};
  for (var k in MODE_SLUGS) SLUG_TO_MODE[MODE_SLUGS[k]] = k;

  // Detect base path once (/ for user pages, /RepoName for project pages)
  var APP_BASE = (function () {
    var path = location.pathname.replace(/\/$/, '');
    var last = path.split('/').pop() || '';
    // If last segment is a known mode slug, strip it to get the base
    if (SLUG_TO_MODE[last]) return path.replace(/\/[^/]*$/, '') || '';
    // If we got here via ?p= redirect, the path is the base
    if (location.search.indexOf('p=') > -1) return path || '';
    // Otherwise current path IS the base (e.g. / or /FormatGPT)
    return path || '';
  })();

  function pushModeUrl(mode) {
    var slug = MODE_SLUGS[mode] || mode;
    var url = slug === 'standard' ? (APP_BASE || '/') : APP_BASE + '/' + slug;
    try { history.replaceState(null, '', url); } catch (e) {}
  }

  function readModeFromUrl() {
    // Handle SPA redirect from 404.html (?p=sorter)
    var params = new URLSearchParams(location.search);
    var redirectSlug = params.get('p');
    if (redirectSlug) {
      var mode = SLUG_TO_MODE[redirectSlug] || redirectSlug;
      try { history.replaceState(null, '', APP_BASE || '/'); } catch (e) {}
      if (mode && mode !== 'FormatGPT' && mode !== 'index.html') return mode;
      return 'standard';
    }
    var path = location.pathname.replace(/\/$/, '');
    var slug = path.split('/').pop() || '';
    if (!slug || slug === 'FormatGPT' || slug === 'index.html') return 'standard';
    return SLUG_TO_MODE[slug] || slug;
  }

  function setModeFromDd(value) {
    Core?.setMode && Core.setMode(value);
    syncReorderPanel(value);
    syncFilterPanel(value);
    syncSorterPanel(value);
    syncPlinksPricesPanel(value);
    syncCrosscheckPanel(value);
    syncDeliverPanel(value);
    document.body.dataset.mode = value;
    pushModeUrl(value);
    Core?.rerun && Core.rerun();
  }

  function boot() {
    const inp = $('#inp');
    const out = $('#out');
    const clear = $('#clearBtn');
    const blue = $('#blueBtn');
    const addMail = $('#addMailChk');
    const copyMain = $('#copyMain');
    const copyCaret = $('#copyCaret');
    const menuDownload = $('#menuDownloadTxt');

    // Mode dropdown
    const modeDd = $('#modeDd');
    const modeMenu = $('#modeMenu');
    const modeBtn  = $('#modeBtn');

    // Open on button tap
    modeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = modeMenu?.classList.contains('open');
      if (isOpen) closeDropdown(modeMenu, modeBtn);
      else openDropdown(modeMenu, modeBtn);
    });

    // Select item
    modeMenu?.addEventListener('click', (e) => {
      const li = e.target.closest('.dd-item');
      if (!li) return;
      const val = li.dataset.value || 'standard';
      for (const x of modeMenu.querySelectorAll('.dd-item')) {
        const on = x === li;
        x.classList.toggle('active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      modeDd?.setAttribute('data-value', val);
      const modeLabel = $('#modeLabel'); if (modeLabel) modeLabel.textContent = li.textContent.trim();
      closeDropdown(modeMenu, modeBtn);
      // Let the closed menu and selected label paint before a large mode rerun.
      requestAnimationFrame(() => setModeFromDd(val));
    });

    // Close when tapping outside
    document.addEventListener('click', (e) => {
      if (!modeDd?.contains(e.target)) closeDropdown(modeMenu, modeBtn);
    });

    // Textarea live — debounced so big pastes and fast typing don't thrash the formatter
    let _inpRerunTimer = 0;
    inp?.addEventListener('input', () => {
      clearTimeout(_inpRerunTimer);
      _inpRerunTimer = setTimeout(() => { Core?.rerun && Core.rerun(); }, 140);
    });

    // Clear — wipes input, output, Crosscheck List 2 AND the Deliver panel fields
    clear?.addEventListener('click', () => {
      if (inp) inp.value = '';
      if (out) out.textContent = '';
      const cc = document.getElementById('ccList2');
      if (cc) cc.value = '';
      try { localStorage.removeItem('cc_list2'); } catch (e) {}
      if (window.App?.State?.state?.crosscheck) {
        window.App.State.state.crosscheck._persistedList2 = '';
      }

      // Wipe Filter mode state + textarea so nothing residual sticks around
      const fpUsers = document.getElementById('fpUsernames');
      if (fpUsers) fpUsers.value = '';
      try { localStorage.removeItem('filterUsernames'); } catch (e) {}
      if (window.App?.State?.state) window.App.State.state.filterUsernames = '';

      // Wipe Deliver mode state + panel fields so nothing residual sticks around
      const S = window.App?.State?.state;
      if (S) {
        S.deliverExtract   = '';
        S.deliverExtractDone = false;
        S.deliverFilename  = '';
        S.deliverCount     = 0;
        S.deliverDirection = 'bottom'; // back to default
      }
      const dpCount = document.getElementById('dpCount');
      const dpName  = document.getElementById('dpName');
      const dpHint  = document.getElementById('dpHint');
      const dpTotal = document.getElementById('dpTotalCount');
      const dpExtract = document.getElementById('dpExtract');
      if (dpCount) dpCount.value = '';
      if (dpName)  dpName.value  = '';
      if (dpHint)  { dpHint.textContent = ''; dpHint.classList.remove('dp-hint--err'); }
      if (dpTotal) dpTotal.textContent = '0';
      if (dpExtract) {
        dpExtract.classList.remove('is-spent');
        dpExtract.disabled = false;
        dpExtract.removeAttribute('title');
      }
      // Reset direction toggle visual state
      const dpDirBtns = document.querySelectorAll('#dpDir .dp-dir-btn');
      dpDirBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.dir === 'bottom'));

      Core?.rerun && Core.rerun();
    });

    // Blue toggle
    blue?.addEventListener('click', () => {
      const on = blue.getAttribute('aria-pressed') === 'true' ? false : true;
      blue.setAttribute('aria-pressed', on ? 'true' : 'false');
      blue.classList.toggle('is-on', on);
      if (State?.state) State.state.blue = on;
      Core?.rerun && Core.rerun();
    });

    // Add Mail checkbox
    addMail?.addEventListener('change', () => {
      if (State?.state) State.state.addMail = !!addMail.checked;
      Core?.rerun && Core.rerun();
    });

    // Chunk Mode checkbox — keeps the mail chunk intact in Standard output
    const chunkChk = $('#chunkChk');
    if (chunkChk) {
      chunkChk.checked = !!(State?.state && State.state.chunkMode);
      chunkChk.addEventListener('change', () => {
        if (State?.state) State.state.chunkMode = !!chunkChk.checked;
        try { localStorage.setItem('chunkMode', chunkChk.checked ? '1' : '0'); } catch (e) {}
        Core?.rerun && Core.rerun();
      });
    }

    // Paste
    $('#pasteMain')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (inp) inp.value = text;
        Core?.rerun && Core.rerun();
      } catch { alert('Paste failed. Long-press in the box and choose Paste.'); }
    });

    // Upload via caret menu
    const pasteCaret = $('#pasteCaret');
    const pasteMenu  = $('#pasteMenu');
    const uploadAny  = $('#uploadAny');

    pasteCaret?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pasteCaret.getAttribute('aria-expanded') === 'true';
      pasteCaret.setAttribute('aria-expanded', open ? 'false' : 'true');
      pasteMenu?.classList.toggle('open', !open);
    });
    $('#menuUploadAny')?.addEventListener('click', () => {
      uploadAny?.click();
      pasteMenu?.classList.remove('open');
      pasteCaret?.setAttribute('aria-expanded', 'false');
    });
    uploadAny?.addEventListener('change', async () => {
      const f = uploadAny.files && uploadAny.files[0];
      if (!f) return;
      const text = await f.text();
      if (inp) inp.value = text;
      Core?.rerun && Core.rerun();
    });

    // Copy / Download
    copyMain?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(out?.textContent || '');
        copyMain.textContent = 'Copied';
        setTimeout(() => { copyMain.textContent = 'Copy'; }, 900);
      } catch { alert('Copy failed.'); }
    });
    copyCaret?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = copyCaret.getAttribute('aria-expanded') === 'true';
      copyCaret.setAttribute('aria-expanded', open ? 'false' : 'true');
      $('#copyMenu')?.classList.toggle('open', !open);
    });
    menuDownload?.addEventListener('click', () => {
      Core?.saveTxt && Core.saveTxt();
      $('#copyMenu')?.classList.remove('open');
      copyCaret?.setAttribute('aria-expanded', 'false');
    });

    // Settings gear -> proper panel
    $('#settingsIcon')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showSettings();
    });

    syncTickerBuild();

    // Initial render — read mode from URL if present
    var initMode = readModeFromUrl();
    setModeFromDd(initMode);
  }

  // Ticker "build" label follows the active UI theme (AURORA / NEON).
  function syncTickerBuild() {
    var neon = document.documentElement.getAttribute('data-theme') === 'neon';
    var txt = neon ? 'neon build' : 'aurora build';
    document.querySelectorAll('.ticker .tk-build').forEach(function (el) { el.textContent = txt; });
  }

  window.App.UI = { boot };
})();
