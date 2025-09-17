// main.js (FULL)
(function () {
  window.App = window.App || {};
  const { $, randToken } = App.Utils;
  const { state } = App.State;

  const registry = new Map();

  function registerMode(mod) {
    if (mod && mod.id && typeof mod.run === 'function') registry.set(mod.id, mod);
  }

  function setMode(id) {
    if (!registry.has(id)) id = 'standard';
    state.mode = id;

    const label = (registry.get(id)?.label) || 'Standard';
    const modeDd = $('#modeDd');
    const modeLabel = $('#modeLabel');
    if (modeDd) modeDd.dataset.value = id;
    if (modeLabel) modeLabel.textContent = label;

    const menu = $('#modeMenu');
    if (menu) {
      for (const li of menu.querySelectorAll('.dd-item')) {
        const on = li.dataset.value === id;
        li.classList.toggle('active', on);
        li.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    }
  }

  function rerun() {
    const text = ($('#inp')?.value) || '';
    let mode = registry.get(state.mode);
    if (!mode) mode = registry.get('standard');

    let body = mode.run(text);

    // Append Add Mail block only if it is NOT already present from Blue block
    if (state.addMail && body.trim() && !/🔸 Access mail:/u.test(body)) {
      body += `\n\n-------------\n🔸 Access mail:\n${state.mailAccess}`;
    }

    const out = $('#out');
    if (out) out.textContent = body;
  }

  function saveTxt() {
    const contents = ($('#out')?.textContent) || '';
    const filename = ((Math.random() < .5) ? 's' : 'k') + randToken(5) + '.txt';
    const blob = new Blob(["\uFEFF" + contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  App.App = { registerMode, setMode, rerun, saveTxt };
})();