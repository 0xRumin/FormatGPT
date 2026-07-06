// standard.js (FULL)
(function () {
  const { splitFlexible, isEmail } = App.Utils;
  const { renderStandardBlock } = App.Renderers;
  const { state } = App.State;

  // A row has a mail chunk when one of its colon-fields is a pipe bundle whose
  // first segment is an email (email|mailpass|refresh_token|clientID).
  function rowHasMailChunk(row) {
    return splitFlexible(row).some(p => {
      const s = (p || "").trim();
      if (s.indexOf("|") < 0) return false;
      return isEmail((s.split("|")[0] || "").trim());
    });
  }

  App.App = App.App || {};
  App.App.registerMode({
    id: 'standard',
    label: 'Standard',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      // Reveal the Chunk Mode toggle only when a mail chunk is actually present.
      const hasChunk = rows.some(rowHasMailChunk);
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.toggle("has-mail-chunk", hasChunk);
      }
      const out = [];
      for (const row of rows) {
        out.push(renderStandardBlock(splitFlexible(row), state.blue));
        out.push("");
      }
      return out.join("\n").trim();
    }
  });
})();