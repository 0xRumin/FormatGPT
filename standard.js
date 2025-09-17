// standard.js (FULL)
(function () {
  const { splitFlexible } = App.Utils;
  const { renderStandardBlock } = App.Renderers;
  const { state } = App.State;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'standard',
    label: 'Standard',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const out = [];
      for (const row of rows) {
        out.push(renderStandardBlock(splitFlexible(row), state.blue));
        out.push("");
      }
      return out.join("\n").trim();
    }
  });
})();