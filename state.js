// js/state.js
(function(){
  window.App = window.App || {};
  const { DEFAULT_MAIL } = App.Config;

  function normalizeMailAccess(s){
    const v=(s||"").trim();
    if(!v) return DEFAULT_MAIL;
    if(/^https?:\/\//i.test(v)) return v;
    if(/^\/\//.test(v)) return "https:"+v;
    return "https://"+v;
  }

  const state = {
    blue:false,
    addMail:false,
    mailAccess: normalizeMailAccess(localStorage.getItem("mailAccess")||""),
    mode:"standard"
  };

  function setMailAccess(v){
    state.mailAccess = normalizeMailAccess(v);
    localStorage.setItem("mailAccess", state.mailAccess);
  }
  function initState(){ /* reserved */ }

  App.State = { state, setMailAccess, initState, normalizeMailAccess };
})();