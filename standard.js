// Standard mode 
(function(){
  const { splitFlexible, coalesceTokenOnlyRows } = App.Utils;
  const { renderStandard } = App.Renderers;

  App.App.registerMode({
    id: 'standard',
    label: 'Standard',
    run(text){
      const rows = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if(!rows.length) return '';
      const merged = coalesceTokenOnlyRows(rows);
      const out=[];
      for(const row of merged){
        out.push(renderStandard(splitFlexible(row)));
        out.push('');
      }
      return out.join('\n').trim();
    }
  });
})();
