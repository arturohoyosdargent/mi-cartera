// Préstamo Ya — motor único para compartir reportes como imagen visual.
(function(){
 'use strict';
 if(window.__prestamoYaShareImageEngine)return;
 window.__prestamoYaShareImageEngine=true;
 const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
 const wrap=(ctx,text,max)=>{const words=String(text||'').split(' '),out=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width<=max)line=t;else{if(line)out.push(line);line=w}}if(line)out.push(line);return out};
 function creditCanvas(text){
   const rows=String(text||'').split(/\n/).map(clean),idx=rows.findIndex(r=>/^CRONOGRAMA$/i.test(r));if(idx<0)return null;
   const c=document.createElement('canvas'),x=c.getContext('2d'),W=1000,p=38,header=rows.slice(0,idx).filter(Boolean),schedule=rows.slice(idx+1).filter(Boolean);
   c.width=W;c.height=Math.max(500,Math.min(7600,230+header.length*38+schedule.length*64));x.fillStyle='#f4f6f7';x.fillRect(0,0,W,c.height);x.fillStyle='#78c7ef';x.fillRect(0,0,W,82);x.fillStyle='#fff';x.font='bold 30px Arial';x.fillText('PRÉSTAMO YA',p,52);x.font='bold 23px Arial';x.fillText('DETALLE DEL CRÉDITO',W-330,50);
   let y=110;x.fillStyle='#fff';x.fillRect(p,y,W-p*2,header.length*38+34);x.strokeStyle='#d7dadd';x.strokeRect(p,y,W-p*2,header.length*38+34);x.fillStyle='#30343a';x.font='23px Arial';y+=34;header.forEach(r=>{wrap(x,r,W-p*2-30).forEach(l=>{x.fillText(l,p+15,y);y+=30})});
   y+=26;x.font='bold 25px Arial';x.fillText('Cronograma',p,y);y+=18;const cols=[p,p+90,p+280,p+540,p+750,W-p];x.fillStyle='#e9edf0';x.fillRect(p,y,W-p*2,48);x.fillStyle='#30343a';x.font='bold 20px Arial';['#','Fecha','Cuota','Pagado','Saldo'].forEach((v,i)=>x.fillText(v,cols[i]+10,y+31));y+=48;
   x.font='20px Arial';schedule.forEach((r,i)=>{const m=r.match(/^(?:([A-Za-z0-9]+)\.)?\s*([^·]+)·\s*([^·]+)·\s*(S\/\s*[0-9.,]+)\s*·\s*Saldo\s*(S\/\s*[0-9.,]+)/i),n=m?.[1]||String(i+1),date=m?.[2]?.trim()||'',type=m?.[3]?.trim()||'',amount=m?.[4]||'',saldo=m?.[5]||'',vals=[n,date,type==='Pago adicional'?'Adicional':amount,'',saldo];x.fillStyle=i%2?'#fff':'#f8fafb';x.fillRect(p,y,W-p*2,58);x.fillStyle='#30343a';vals.forEach((v,j)=>x.fillText(v,cols[j]+10,y+36));y+=58});
   return new Promise(resolve=>c.toBlob(resolve,'image/png'));
 }
 const imageFromText=text=>new Promise(resolve=>{const special=creditCanvas(text);if(special)return special.then(resolve);const c=document.createElement('canvas'),x=c.getContext('2d'),W=1000,p=46,lh=34,lines=[];x.font='24px Arial';String(text||'').split(/\n/).forEach(r=>{const q=clean(r);if(!q){lines.push('');return}lines.push(...wrap(x,q,W-p*2))});const H=Math.max(220,100+lines.length*lh+p);c.width=W;c.height=Math.min(H,8000);x.fillStyle='#f4f6f7';x.fillRect(0,0,W,H);x.fillStyle='#78c7ef';x.fillRect(0,0,W,82);x.fillStyle='#fff';x.font='bold 31px Arial';x.fillText('PRÉSTAMO YA',p,51);x.fillStyle='#30343a';x.font='24px Arial';let y=125;lines.forEach(line=>{if(y<=H-p)x.fillText(line,p,y);y+=lh});c.toBlob(resolve,'image/png')});
 const originalShare=navigator.share?.bind(navigator);if(!originalShare)return;
 navigator.share=async function(data){try{if(data?.files?.length)return originalShare(data);if(data?.text){const blob=await imageFromText(data.text),file=new File([blob],'prestamo-ya-reporte.png',{type:'image/png'});if(navigator.canShare?.({files:[file]}))return originalShare({title:data.title||'Préstamo Ya',text:'Préstamo Ya — reporte',files:[file]});}}catch(e){if(e?.name==='AbortError')throw e}return originalShare(data)};
 window.PrestamoYaShareImage={version:'v2',imageFromText};
})();
