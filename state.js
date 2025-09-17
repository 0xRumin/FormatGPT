// state.js (FULL)
(function () {
  window.App = window.App || {};
  const { DEFAULT_MAIL } = (window.App.Config || { DEFAULT_MAIL: "https://firstmail.ltd/en-US/webmail" });

  function normalizeMailAccess(s) {
    const v = (s || "").trim();
    if (!v) return DEFAULT_MAIL;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/\//.test(v)) return "https:" + v;
    return "https://" + v;
  }

  const state = {
    blue: false,
    addMail: false,
    mailAccess: normalizeMailAccess(localStorage.getItem("mailAccess") || DEFAULT_MAIL),
    mode: "standard",
  };

  function setMailAccess(v) {
    state.mailAccess = normalizeMailAccess(v);
    localStorage.setItem("mailAccess", state.mailAccess);
  }

  function initState() { /* room for future */ }

  window.App.State = { state, setMailAccess, initState, normalizeMailAccess };
})();