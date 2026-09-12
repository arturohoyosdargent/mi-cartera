// Préstamo Ya — motor único para compartir reportes como imagen.
(function(){
 'use strict';
 if(window.__prestamoYaShareImageEngine)return;
 window.__prestamoYaShareImageEngine=true;
 const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
 const money=s=>String(s??'');
 const wrap=(ctx,text,max)=>{const words=String(text||'').split(' '),out=[];let line='';for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width<=max)line=t;else{if(line)out.push(line);line=w}}if(line)out.push(line);return out};
 const imageFromText=text=>new Promise(resolve=>{
   const c=document.createElement('canvas'),x=c.getContext('2d'),W=1000,p=46,lh=34;
   const rows=String(text||'').split(/\n/),lines=[];x.font='24px Arial';
   rows.forEach(r=>{const q=clean(r);if(!q){lines.push('');return}lines.push(...wrap(x,q,W-p*2))});
   const H=Math.max(220,100+lines.length*lh+p);c.width=W;c.height=Math.min(H,8000);
   x.fillStyle='#f4f6f7';x.fillRect(0,0,W,H);
   x.fillStyle='#78c7ef';x.fillRect(0,0,W,82);
   x.fillStyle='#fff';x.font='bold 31px Arial';x.fillText('PRÉSTAMO YA',p,51);
   x.fillStyle='#30343a';x.font='24px Arial';let y=125;
   lines.forEach((line,i)=>{if(y>H-p)return;if(/^CRONOGRAMA$/i.test(line)){x.font='bold 25px Arial';}else{x.font='24px Arial';}x.fillText(line,p,y);y+=lh});
   c.toBlob(resolve,'image/png');
 });
 const originalShare=navigator.share?.bind(navigator);
 if(!originalShare)return;
 navigator.share=async function(data){
   try{
     if(data?.files?.length)return originalShare(data);
     if(data?.text){
       const blob=await imageFromText(data.text),file=new File([blob],'prestamo-ya-reporte.png',{type:'image/png'});
       if(navigator.canShare?.({files:[file]}))return originalShare({title:data.title||'Préstamo Ya',text:'Préstamo Ya — reporte',files:[file]});
     }
   }catch(e){if(e?.name==='AbortError')throw e;}
   return originalShare(data);
 };
 window.PrestamoYaShareImage={version:'v1',imageFromText};
})();
