// js/boot.js
window.addEventListener('DOMContentLoaded', ()=> {
  if(window.App && window.App.UI && typeof window.App.UI.boot==='function'){
    window.App.UI.boot();
  }
});