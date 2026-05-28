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

  // ---- Accent color system ----
  const ACCENT_PRESETS = [
    { name: 'Teal',    accent: '#2dd4bf', accent2: '#5eead4', accent3: '#06b6d4' },
    { name: 'Cyan',    accent: '#22d3ee', accent2: '#67e8f9', accent3: '#0ea5e9' },
    { name: 'Blue',    accent: '#3b82f6', accent2: '#60a5fa', accent3: '#2563eb' },
    { name: 'Violet',  accent: '#8b5cf6', accent2: '#a78bfa', accent3: '#7c3aed' },
    { name: 'Purple',  accent: '#a855f7', accent2: '#c084fc', accent3: '#9333ea' },
    { name: 'Pink',    accent: '#ec4899', accent2: '#f472b6', accent3: '#db2777' },
    { name: 'Rose',    accent: '#f43f5e', accent2: '#fb7185', accent3: '#e11d48' },
    { name: 'Orange',  accent: '#f97316', accent2: '#fb923c', accent3: '#ea580c' },
    { name: 'Amber',   accent: '#f59e0b', accent2: '#fbbf24', accent3: '#d97706' },
    { name: 'Green',   accent: '#22c55e', accent2: '#4ade80', accent3: '#16a34a' },
    { name: 'Emerald', accent: '#10b981', accent2: '#34d399', accent3: '#059669' },
    { name: 'Mint',    accent: '#6ee7b7', accent2: '#a7f3d0', accent3: '#34d399' },
  ];

  function applyAccentColor(accent, accent2, accent3) {
    var root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-2', accent2);
    root.style.setProperty('--accent-3', accent3);
  }

  function loadSavedAccent() {
    var saved = localStorage.getItem('accentColor');
    if (!saved) return;
    try {
      var c = JSON.parse(saved);
      if (c.accent) applyAccentColor(c.accent, c.accent2, c.accent3);
    } catch (e) {}
  }

  function saveAccent(accent, accent2, accent3) {
    localStorage.setItem('accentColor', JSON.stringify({ accent, accent2, accent3 }));
  }

  // Apply on load
  loadSavedAccent();

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

    // Build accent swatch HTML
    let swatchHtml = ACCENT_PRESETS.map((p, i) =>
      `<button class="sp-swatch" data-idx="${i}" title="${p.name}" style="background:${p.accent}"></button>`
    ).join('');

    panel.innerHTML = `
      <div id="sp-backdrop" style="position:absolute;inset:0;background:#0006;backdrop-filter:blur(4px)"></div>
      <div id="sp-card" style="
        position:absolute;left:50%;top:50%;
        transform:translate(-50%,-50%);
        width:min(560px,92vw);max-height:90vh;overflow-y:auto;
        background:rgba(15,19,24,.97);border:1px solid #2a3340;border-radius:14px;
        padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.5);color:#e6edf3;
        font:14px/1.45 var(--font-mono, ui-monospace, monospace);">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <strong style="font-weight:700;font-size:15px">Settings</strong>
          <button id="sp-close" title="Close" style="border:0;background:#111726;color:#b9c7dc;border-radius:8px;padding:6px 10px;cursor:pointer">✕</button>
        </div>

        <!-- Accent Color -->
        <div style="margin-bottom:16px">
          <label style="display:block;margin-bottom:8px;font-size:11px;letter-spacing:.5px;color:#9fb0c6;font-weight:600;text-transform:uppercase">Accent Color</label>
          <div id="sp-swatches" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            ${swatchHtml}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div id="sp-color-preview" style="width:32px;height:32px;border-radius:8px;border:2px solid #2a3340;flex-shrink:0"></div>
            <span style="color:#9fb0c6;font-size:12px">Custom</span>
            <input id="sp-color-hex" type="text" maxlength="7" spellcheck="false" placeholder="#2dd4bf" style="
              width:90px;padding:8px 10px;border:1px solid #2a3340;border-radius:8px;
              background:#0b0f14;color:#d9e7ff;font-size:13px;font-family:inherit" />
          </div>
        </div>

        <div style="border-top:1px solid #1b2330;margin:14px 0"></div>

        <!-- Mail Access URL -->
        <div>
          <label style="display:block;margin-bottom:6px;font-size:11px;letter-spacing:.5px;color:#9fb0c6;font-weight:600;text-transform:uppercase">Mail Access URL</label>
          <input id="sp-mail" type="text" spellcheck="false" style="
            width:100%;padding:10px;border:1px solid #2a3340;border-radius:10px;
            background:#0b0f14;color:#d9e7ff" />
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button id="sp-reset" type="button" style="border:1px solid #3b4656;background:#121925;color:#9fb3ca;border-radius:10px;padding:8px 14px;cursor:pointer">Reset All</button>
          <button id="sp-apply" type="button" style="border:0;background:var(--accent,#16a34a);color:#041014;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer">Save ✓</button>
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
    const hexInput = $('#sp-color-hex');
    const colorPreview = $('#sp-color-preview');

    input.value = (State?.state?.mailAccess) || '';

    // Init color state
    let pendingColor = null;
    const saved = localStorage.getItem('accentColor');
    let current = saved ? JSON.parse(saved) : ACCENT_PRESETS[0];
    if (colorPreview) colorPreview.style.background = current.accent;
    if (hexInput) hexInput.value = current.accent;
    syncSwatchActive(current.accent);

    panel.style.display = 'block';

    function close() { panel.style.display = 'none'; }

    function syncSwatchActive(hex) {
      const all = swatches?.querySelectorAll('.sp-swatch') || [];
      for (const s of all) {
        const idx = +s.dataset.idx;
        const match = ACCENT_PRESETS[idx]?.accent === hex;
        s.style.outline = match ? '2px solid #fff' : 'none';
        s.style.outlineOffset = match ? '2px' : '0';
      }
    }

    function lighten(hex, amt) {
      let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      r = Math.min(255, r + amt); g = Math.min(255, g + amt); b = Math.min(255, b + amt);
      return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
    }
    function darken(hex, amt) { return lighten(hex, -amt); }

    function pickColor(accent, accent2, accent3) {
      pendingColor = { accent, accent2, accent3 };
      applyAccentColor(accent, accent2, accent3);
      if (colorPreview) colorPreview.style.background = accent;
      if (hexInput) hexInput.value = accent;
      syncSwatchActive(accent);
    }

    // Swatch clicks
    swatches?.addEventListener('click', (e) => {
      const btn = e.target.closest('.sp-swatch');
      if (!btn) return;
      const p = ACCENT_PRESETS[+btn.dataset.idx];
      if (p) pickColor(p.accent, p.accent2, p.accent3);
    });

    // Custom hex
    hexInput?.addEventListener('input', () => {
      let v = hexInput.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        pickColor(v, lighten(v, 30), darken(v, 20));
      }
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
      // Reset accent to default
      const def = ACCENT_PRESETS[0];
      pickColor(def.accent, def.accent2, def.accent3);
      localStorage.removeItem('accentColor');
    };
    applyBtn.onclick = () => {
      const next = normalize(input.value);
      if (Core?.setMailAccess) Core.setMailAccess(next);
      else if (State?.setMailAccess) State.setMailAccess(next);
      if (pendingColor) saveAccent(pendingColor.accent, pendingColor.accent2, pendingColor.accent3);
      Core?.rerun && Core.rerun();
      close();
    };
    closeBtn.onclick = back.onclick = () => {
      // If not saved, revert to last saved
      if (!pendingColor) { close(); return; }
      const prev = saved ? JSON.parse(saved) : ACCENT_PRESETS[0];
      applyAccentColor(prev.accent, prev.accent2, prev.accent3);
      pendingColor = null;
      close();
    };
    panel.onkeydown = (e) => {
      if (e.key === 'Escape') { closeBtn.onclick(); }
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
    plinksWith:'plinks-with', plinksWithout:'plinks-without',
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