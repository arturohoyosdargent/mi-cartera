// Compartir el detalle del crédito como imagen o texto desde móvil/PC.
(function(){
  if(window.__prestamoYaCreditShare)return;
  window.__prestamoYaCreditShare=true;

  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const wrap=(ctx,text,max)=>{const words=String(text||'').split(' '),lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width<=max)line=test;else{if(line)lines.push(line);line=w}}if(line)lines.push(line);return lines};

  function detailText(){
    const body=document.getElementById('creditDetailBody');
    if(!body)return 'Detalle del crédito';
    return clean(body.innerText||body.textContent||'Detalle del crédito');
  }

  function canvasImage(text){
    return new Promise(resolve=>{
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      const max=900,pad=42,lineH=30,titleH=70;
      ctx.font='22px Arial';
      const raw=String(text).split(/\n+/).map(clean).filter(Boolean),lines=[];
      for(const row of raw){const ws=wrap(ctx,row,max-pad*2);lines.push(...ws)}
      canvas.width=max;canvas.height=Math.min(7000,titleH+pad+lines.length*lineH+pad);
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#78c7ef';ctx.fillRect(0,0,canvas.width,titleH);
      ctx.fillStyle='#ffffff';ctx.font='bold 28px Arial';ctx.fillText('Préstamo Ya · Detalle del crédito',pad,44);
      ctx.fillStyle='#30343a';ctx.font='22px Arial';
      let y=titleH+pad+4;
      for(const line of lines){if(y>canvas.height-pad)break;ctx.fillText(line,pad,y);y+=lineH}
      canvas.toBlob(b=>resolve(b),'image/png');
    });
  }

  window.shareCreditDetail=async function(){
    const text=detailText();
    try{
      const blob=await canvasImage(text);
      const file=new File([blob],'detalle-credito.png',{type:'image/png'});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({title:'Detalle del crédito · Préstamo Ya',text:'Detalle del crédito',files:[file]});
        return;
      }
      if(navigator.share){await navigator.share({title:'Detalle del crédito · Préstamo Ya',text});return;}
      await navigator.clipboard.writeText(text);
      if(typeof window.toast==='function')window.toast('Detalle copiado. Puedes pegarlo en WhatsApp o correo.');
    }catch(e){
      if(e?.name==='AbortError')return;
      try{await navigator.clipboard.writeText(text);if(typeof window.toast==='function')window.toast('Detalle copiado para compartir.')}catch(_){if(typeof window.toast==='function')window.toast('No se pudo compartir el detalle.')}}
  };

  function install(){
    const section=document.getElementById('creditDetail');
    const body=document.getElementById('creditDetailBody');
    if(!section||!body){setTimeout(install,300);return;}
    if(document.getElementById('shareCreditBtn'))return;
    const bar=document.createElement('div');bar.className='actionbar';bar.id='creditShareBar';
    bar.innerHTML='<button type="button" class="btn blue wide" id="shareCreditBtn">📤 Compartir detalle del crédito</button>';
    section.insertBefore(bar,body);
    document.getElementById('shareCreditBtn').addEventListener('click',window.shareCreditDetail);
  }
  install();
})();
