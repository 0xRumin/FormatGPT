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

    panel.innerHTML = `
      <div id="sp-backdrop" style="position:absolute;inset:0;background:#0006;"></div>
      <div id="sp-card" style="
        position:absolute;left:50%;top:20%;
        transform:translateX(-50%);
        width:min(560px,92vw);
        background:#0f1318;border:1px solid #2a3340;border-radius:12px;
        padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);color:#e6edf3;
        font:14px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-weight:700">Settings</strong>
          <button id="sp-close" title="Close" style="border:0;background:#111726;color:#b9c7dc;border-radius:8px;padding:6px 8px">✕</button>
        </div>
        <label style="display:block;margin:8px 0 4px">Mail Access URL</label>
        <input id="sp-mail" type="text" spellcheck="false" style="
          width:100%;padding:10px;border:1px solid #2a3340;border-radius:10px;
          background:#0b0f14;color:#d9e7ff" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button id="sp-reset" type="button" style="border:1px solid #3b4656;background:#121925;color:#9fb3ca;border-radius:10px;padding:8px 12px">Reset</button>
          <button id="sp-apply" type="button" style="border:0;background:#16a34a;color:#041014;border-radius:10px;padding:8px 12px;font-weight:600">Apply ✓</button>
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

    input.value = (State?.state?.mailAccess) || '';

    panel.style.display = 'block';
    setTimeout(() => { input.focus(); input.select(); }, 0);

    function close() { panel.style.display = 'none'; }

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
    };
    applyBtn.onclick = () => {
      const next = normalize(input.value);
      if (Core?.setMailAccess) Core.setMailAccess(next);
      else if (State?.setMailAccess) State.setMailAccess(next);
      Core?.rerun && Core.rerun();
      close();
    };
    closeBtn.onclick = back.onclick = close;
    panel.onkeydown = (e) => { if (e.key === 'Escape') close(); };
  }

  function setModeFromDd(value) {
    Core?.setMode && Core.setMode(value);
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

    // Textarea live
    inp?.addEventListener('input', () => Core?.rerun && Core.rerun());

    // Clear
    clear?.addEventListener('click', () => { if (inp) inp.value=''; if (out) out.textContent=''; });

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

    // Initial render
    Core?.setMode && Core.setMode('standard');
    Core?.rerun && Core.rerun();
  }

  window.App.UI = { boot };
})();