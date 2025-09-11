// UI helpers
(function(){
  window.App = window.App || {};
  const { $, splitFlexible } = App.Utils;
  const { state, setMailAccess, initState } = App.State;
  const { setMode, rerun, saveTxt } = App.App;

  /* ---------- generic menu helpers ---------- */
  function openMenu(el){ el && el.classList.add('open'); }
  function closeMenu(el){ el && el.classList.remove('open'); }
  function toggleMenu(el){ el && el.classList.toggle('open'); }

  /* ---------- Paste / Copy menus ---------- */
  function bindMenus(){
    const pasteMenu = $('#pasteMenu');
    const pasteMain = $('#pasteMain');
    const pasteCaret= $('#pasteCaret');
    const uploadAny = $('#uploadAny');
    const menuUploadAny = $('#menuUploadAny');

    const copyMenu  = $('#copyMenu');
    const copyMain  = $('#copyMain');
    const copyCaret = $('#copyCaret');
    const menuDownloadTxt = $('#menuDownloadTxt');

    document.addEventListener('click',(e)=>{
      if(pasteMenu && !pasteMenu.contains(e.target) && !pasteCaret.contains(e.target) && !pasteMain.contains(e.target)) closeMenu(pasteMenu);
      if(copyMenu  && !copyMenu.contains(e.target)  && !copyCaret.contains(e.target))  closeMenu(copyMenu);
    });

    // Paste main = try clipboard
    pasteMain?.addEventListener('click', async ()=>{
      try{
        const t = await navigator.clipboard.readText();
        if(!t){ alert('Clipboard is empty or permission denied.'); return; }
        $('#inp').value = t; rerun();
      }catch(err){
        alert('Could not read clipboard. Grant permission or use ▾ ➜ Upload a file.');
      }
    });

    // Paste caret menu = upload
    pasteCaret?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleMenu(pasteMenu); });
    menuUploadAny?.addEventListener('click', ()=>{ closeMenu(pasteMenu); uploadAny.click(); });
    uploadAny?.addEventListener('change', (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ()=>{ $('#inp').value=String(reader.result||''); rerun(); uploadAny.value=''; };
      reader.readAsText(f,'utf-8');
    });

    // Copy + Save
    copyMain?.addEventListener('click', ()=> navigator.clipboard.writeText($('#out').textContent||'') );
    copyCaret?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleMenu(copyMenu); });
    menuDownloadTxt?.addEventListener('click', ()=>{ closeMenu(copyMenu); saveTxt(); });
  }

  /* ---------- Controls (blue, add-mail, clear, mode) ---------- */
  function bindControls(){
    // Blue
    $('#blueBtn')?.addEventListener('click', ()=>{
      state.blue = !state.blue;
      $('#blueBtn').classList.toggle('is-on', state.blue);
      $('#blueBtn').setAttribute('aria-pressed', String(state.blue));
      rerun();
    });

    // Add Mail
    $('#addMailChk')?.addEventListener('change', ()=>{
      state.addMail = $('#addMailChk').checked;
      rerun();
    });

    // Input typing
    $('#inp')?.addEventListener('input', rerun);

    // Clear
    $('#clearBtn')?.addEventListener('click', ()=>{
      $('#inp').value='';
      $('#out').textContent='';
    });

    // Mode dropdown
    const modeDd = $('#modeDd');
    const modeBtn= $('#modeBtn');
    const modeMenu=$('#modeMenu');
    const modeLabel=$('#modeLabel');

    function open(){ modeDd.classList.add('open'); modeBtn.setAttribute('aria-expanded','true'); }
    function close(){ modeDd.classList.remove('open'); modeBtn.setAttribute('aria-expanded','false'); }

    modeBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); modeDd.classList.contains('open')?close():open(); });
    modeMenu?.addEventListener('click', (e)=>{
      const li = e.target.closest('.dd-item'); if(!li) return;
      setMode(li.dataset.value);
      modeLabel.textContent = li.textContent.replace(/\s*\[[^\]]*\]\s*$/,'').trim();
      for(const x of modeMenu.querySelectorAll('.dd-item')){
        const on = x===li; x.classList.toggle('active',on); x.setAttribute('aria-selected', on?'true':'false');
      }
      close(); rerun();
    });
    document.addEventListener('click',(e)=>{ if(!modeDd.contains(e.target)) close(); });
    document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') close(); });
  }

  /* ---------- Gear popover (Mail Access) ---------- */
  function buildGearPop(){
    const pop = document.createElement('div');
    pop.className = 'gear-pop';
    pop.innerHTML = `
      <div class="gp-title">Mail Access</div>
      <div class="gp-row">
        <input id="gpInput" class="gp-input" type="text" inputmode="url" />
      </div>
      <div class="gp-actions">
        <button class="icon-pill warn" id="gpReset" title="Reset">↺</button>
        <button class="icon-pill ok" id="gpSave" title="Save">✓</button>
      </div>
    `;
    return pop;
  }

  function positionUnder(el, pop){
    const r = el.getBoundingClientRect();
    const top = r.bottom + window.scrollY + 8;
    const left = r.right + window.scrollX - pop.offsetWidth;
    pop.style.top = `${top}px`;
    pop.style.left = `${Math.max(8,left)}px`;
  }

  function bindGear(){
    const gear = $('#settingsIcon');
    let open = false;
    let pop = null;

    function closePop(){
      if(!open) return;
      open=false;
      pop?.remove();
      pop=null;
      window.removeEventListener('scroll', onRelocate, true);
      window.removeEventListener('resize', onRelocate, true);
      document.removeEventListener('click', onDoc, true);
      document.removeEventListener('keydown', onEsc, true);
    }
    function onRelocate(){ if(pop) positionUnder(gear, pop); }
    function onDoc(e){ if(pop && !pop.contains(e.target) && e.target!==gear) closePop(); }
    function onEsc(e){ if(e.key==='Escape') closePop(); }

    gear?.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(open){ closePop(); return; }
      open=true;
      pop = buildGearPop();
      document.body.appendChild(pop);
      // set value & place
      const input = pop.querySelector('#gpInput');
      input.value = state.mailAccess || '';
      positionUnder(gear, pop);

      // wire actions
      pop.querySelector('#gpReset').addEventListener('click', ()=>{
        input.value = 'https://firstmail.ltd/en-US/webmail';
      });
      pop.querySelector('#gpSave').addEventListener('click', ()=>{
        setMailAccess(input.value);
        rerun();
        closePop();
      });

      // close behaviors
      window.addEventListener('scroll', onRelocate, true);
      window.addEventListener('resize', onRelocate, true);
      document.addEventListener('click', onDoc, true);
      document.addEventListener('keydown', onEsc, true);
      input.focus();
      input.select();
    });
  }

  /* ---------- boot ---------- */
  function boot(){
    initState();
    bindMenus();
    bindControls();
    bindGear();
    rerun(); // default mode already set by App.State/App.App
  }

  App.UI = { boot };
})();
window.App.boot = window.App.UI.boot;