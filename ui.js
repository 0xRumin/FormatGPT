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

  function applyTheme(t) {
    var root = document.documentElement;
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

  function loadSavedTheme() {
    var saved = localStorage.getItem('fgptTheme');
    if (!saved) return;
    try {
      var t = JSON.parse(saved);
      if (t && t.accent) applyTheme(t);
    } catch(e) {}
  }

  function saveTheme(t) {
    localStorage.setItem('fgptTheme', JSON.stringify(t));
  }

  loadSavedTheme();

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

    // Build theme swatch HTML
    let swatchHtml = THEMES.map((t, i) =>
      `<button class="sp-swatch" data-idx="${i}" title="${t.name}">
        <span class="sp-swatch-color" style="background:${t.swatch}"></span>
        <span class="sp-swatch-name">${t.name}</span>
      </button>`
    ).join('');

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

        <!-- Mail Access URL -->
        <div>
          <label class="sp-settings-label">Mail Access URL</label>
          <input id="sp-mail" type="text" spellcheck="false" style="
            width:100%;padding:10px;border:1px solid var(--line,#2a3340);border-radius:10px;
            background:var(--input-bg,#0b0f14);color:#d9e7ff" />
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

  function showSettings() {
    const panel = createSettingsPanel();
    const input = $('#sp-mail');
    const resetBtn = $('#sp-reset');
    const applyBtn = $('#sp-apply');
    const closeBtn = $('#sp-close');
    const back = $('#sp-backdrop');
    const swatches = $('#sp-swatches');

    input.value = (State?.state?.mailAccess) || '';

    let pendingTheme = null;
    const savedRaw = localStorage.getItem('fgptTheme');
    let currentTheme = savedRaw ? JSON.parse(savedRaw) : THEMES[0];

    syncSwatchActive(currentTheme.accent);
    panel.style.display = 'block';

    function close() { panel.style.display = 'none'; }

    function syncSwatchActive(accent) {
      const all = swatches?.querySelectorAll('.sp-swatch') || [];
      for (const s of all) {
        const idx = +s.dataset.idx;
        s.classList.toggle('sp-swatch-on', THEMES[idx]?.accent === accent);
      }
    }

    function pickTheme(t) {
      pendingTheme = t;
      applyTheme(t);
      syncSwatchActive(t.accent);
    }

    swatches?.addEventListener('click', (e) => {
      const btn = e.target.closest('.sp-swatch');
      if (!btn) return;
      const t = THEMES[+btn.dataset.idx];
      if (t) pickTheme(t);
    });

    function normalize(url) {
      const v = (url || '').trim();
      if (!v) return State.normalizeMailAccess('');
      if (/^https?:\/\//i.test(v)) return v;
      if (/^\/\//.test(v)) return 'https:' + v;
      return 'https://' + v;
    }

    resetBtn.onclick = () => {
      const d = State.normalizeMailAccess('');
      input.value = d;
      pickTheme(THEMES[0]);
      localStorage.removeItem('fgptTheme');
    };
    applyBtn.onclick = () => {
      const next = normalize(input.value);
      if (Core?.setMailAccess) Core.setMailAccess(next);
      else if (State?.setMailAccess) State.setMailAccess(next);
      if (pendingTheme) saveTheme(pendingTheme);
      Core?.rerun && Core.rerun();
      close();
    };
    closeBtn.onclick = back.onclick = () => {
      if (pendingTheme) {
        const prev = savedRaw ? JSON.parse(savedRaw) : THEMES[0];
        applyTheme(prev);
      }
      pendingTheme = null;
      close();
    };
    panel.onkeydown = (e) => { if (e.key === 'Escape') closeBtn.onclick(); };
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

  function syncDamPanel(mode) {
    const panel = $('#damPanel');
    if (panel) panel.style.display = mode === 'dam' ? 'block' : 'none';
    // Hide the entire workbench (input + axis + output) via JS too, not just
    // CSS. Belt-and-suspenders: if the data-mode attribute gets out of sync
    // or a cached stylesheet loses the rule, this guarantees the panes are
    // gone while DAM is active.
    const work = document.querySelector('.work');
    if (work) work.style.display = mode === 'dam' ? 'none' : '';
  }

  // URL ↔ mode mapping
  var MODE_SLUGS = {
    standard:'standard', reorder:'reorder', filter:'filter', sorter:'sorter',
    plinksWith:'plinks-with', plinksPrices:'plinks-with-prices', plinksWithout:'plinks-without',
    convertUsers:'usernames-to-plinks', plinksToUsers:'plinks-to-usernames',
    mailChanger:'mail-changer', xfly:'xfly', reverse:'reverse',
    crosscheck:'crosscheck', deliver:'deliver', dam:'dam'
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
    syncDamPanel(value);
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
      setModeFromDd(val);
      closeDropdown(modeMenu, modeBtn);
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
        S.deliverFilename  = '';
        S.deliverCount     = 0;
        S.deliverDirection = 'bottom'; // back to default
      }
      const dpCount = document.getElementById('dpCount');
      const dpName  = document.getElementById('dpName');
      const dpHint  = document.getElementById('dpHint');
      const dpTotal = document.getElementById('dpTotalCount');
      if (dpCount) dpCount.value = '';
      if (dpName)  dpName.value  = '';
      if (dpHint)  { dpHint.textContent = ''; dpHint.classList.remove('dp-hint--err'); }
      if (dpTotal) dpTotal.textContent = '0';
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

    // Initial render — read mode from URL if present
    var initMode = readModeFromUrl();
    setModeFromDd(initMode);
  }

  window.App.UI = { boot };
})();