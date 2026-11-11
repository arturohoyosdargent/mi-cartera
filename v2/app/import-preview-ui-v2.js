// Mi Cartera PRO V2 — local, read-only client import preview.
(function(root){'use strict';
const MAX_BYTES=5*1024*1024,PAGE_SIZE=25;

function install(){
 const panel=document.getElementById('importPreviewPanel');
 if(!panel)return;
 const picker=document.getElementById('importPreviewFile');
 const status=document.getElementById('importPreviewStatus');
 const output=document.getElementById('importPreviewResult');
 const clearButton=document.getElementById('importPreviewClear');
 let revision=0,saving=false;

 function authorizedStorage(){
  const storage=root.MiCarteraV2SessionStorage;
  const session=storage?.state();
  return session?.ready&&['admin','supervisor'].includes(String(session.role).toLowerCase())?storage:null;
 }
 function clear(){
  revision++;
  picker.value='';
  status.textContent='';
  output.replaceChildren();
  clearButton.disabled=true;
 }
 function refreshAccess(){
  const allowed=!!authorizedStorage();
  panel.hidden=!allowed;
  picker.disabled=!allowed||saving;
  if(!allowed){panel.open=false;clear()}
 }
 function text(tag,value){
  const el=document.createElement(tag);
  el.textContent=value;
  return el;
 }
 function list(title,items){
  if(!items?.length)return;
  const ul=document.createElement('ul');
  for(const item of items)ul.append(text('li',item));
  output.append(text('p',title),ul);
 }
 function showImport(draft,clients,request){
  const core=root.MiCarteraV2ClientImportCore,actions=root.MiCarteraV2DurableActions;
  if(!core||!actions?.importClients||root.MI_CARTERA_V2_PILOT_CONFIG?.backendMode!=='b2-compatible'||
    root.MI_CARTERA_V2_PILOT_CONFIG?.allowClientImport===false)return;
  const prepared=core.prepare(draft.rows,{existingClients:clients,hasOmittedCells:draft.hasOmittedCells});
  if(!prepared.eligible){
   list('Revisa el archivo antes de importar',prepared.issues.slice(0,PAGE_SIZE));
   return;
  }
  const count=prepared.clients.length,description=count===1?'cliente nuevo':'clientes nuevos';
  const button=text('button','Importar '+count+' '+description);
  button.type='button';button.className='btn blue';button.id='importClientsButton';
  button.onclick=async()=>{
   if(saving||request!==revision)return;
   saving=true;
   button.disabled=picker.disabled=clearButton.disabled=true;
   try{
    const result=await actions.importClients(draft,()=>request===revision);
    if(request!==revision||result.status==='CANCELLED')return;
    clear();
    const label=result.count===1?'cliente guardado':'clientes guardados';
    status.textContent=result.count+' '+label+(result.status==='CONFIRMED_REFRESH'?
     '. Abre de nuevo Clientes después de sincronizar para ver el resultado.':'.');
   }catch(error){
    if(request===revision)status.textContent=error?.message||'No se pudo confirmar la importación.';
   }finally{
    saving=false;
    refreshAccess();
    if(request===revision&&!panel.hidden)button.disabled=clearButton.disabled=false;
   }
  };
  output.append(text('p','Los clientes se guardarán juntos. Las rutas quedarán por asignar.'),button);
 }
 function showResult(result,workbook,draft,clients,request){
  output.replaceChildren();
  const count=(n,s,p)=>n+' '+(n===1?s:p);
  status.textContent=result.errors.length?'Revisa las columnas del archivo antes de continuar.':
   [count(result.total,'fila','filas'),count(result.valid,'válida','válidas'),
    count(result.duplicates,'duplicada','duplicadas'),result.invalid+' con errores'].join(' · ');
  if(workbook){
   output.append(text('p','Hoja revisada: '+workbook.sheetName+
    (workbook.otherVisibleSheets?' · Se revisó solo la primera hoja visible con datos.':'')+'.'));
   if(workbook.omittedCells)output.append(text('p','Celdas omitidas por contener fórmulas o errores: '+workbook.omittedCells+'.'));
  }
  list('Errores del archivo',result.errors);
  list('Observaciones',result.warnings);
  if(result.columns.length)output.append(text('p','Columnas reconocidas: '+result.columns.map(c=>c.label).join(', ')+'.'));
  showImport(draft,clients,request);
  if(!result.rows.length)return;

  const ordered=[...result.rows].sort((a,b)=>Number(!!(b.errors.length||b.duplicate))-Number(!!(a.errors.length||a.duplicate)));
  const holder=document.createElement('div');
  const controls=document.createElement('div');
  controls.className='row';
  const prev=text('button','Anterior'),next=text('button','Siguiente'),position=text('p','');
  prev.type=next.type='button';prev.className=next.className='btn';
  controls.append(prev,next);
  output.append(text('p','Filas con observaciones primero.'),holder,position,controls);
  let page=0;
  function renderPage(){
   const start=page*PAGE_SIZE;
   holder.replaceChildren();
   for(const row of ordered.slice(start,start+PAGE_SIZE)){
    const card=document.createElement('div');
    card.className='card';
    card.append(text('strong','Fila '+row.number+' · '+(row.values.name||'Sin nombre')));
    for(const column of result.columns){
     const value=row.values[column.key];
     if(column.key!=='name'&&value)card.append(text('p',column.label+': '+value));
    }
    if(row.errors.length){
     const ul=document.createElement('ul');
     ul.className='blocked';
     for(const error of row.errors)ul.append(text('li',error));
     card.append(ul);
    }else if(row.duplicate){
     card.append(text('p','Revisar duplicado.'));
    }
    holder.append(card);
   }
   position.textContent=(start+1)+'–'+Math.min(start+PAGE_SIZE,ordered.length)+' de '+ordered.length+' filas';
   prev.disabled=!page;
   next.disabled=start+PAGE_SIZE>=ordered.length;
   controls.hidden=ordered.length<=PAGE_SIZE;
  }
  prev.onclick=()=>{if(page>0){page--;renderPage()}};
  next.onclick=()=>{if((page+1)*PAGE_SIZE<ordered.length){page++;renderPage()}};
  renderPage();
 }
 async function inspect(){
  const file=picker.files?.[0],storage=authorizedStorage(),request=++revision;
  output.replaceChildren();
  status.textContent='';
  clearButton.disabled=!file||!storage;
  if(!file||!storage)return;
  const ext=/\.(csv|xlsx)$/i.exec(file.name)?.[1].toLowerCase();
  if(!ext){status.textContent='Selecciona un archivo .csv o .xlsx. Si usas .xls, guárdalo primero como .xlsx.';return}
  if(!file.size||file.size>MAX_BYTES){status.textContent='Elige un archivo con datos y de hasta 5 MB.';return}
  let token;
  try{token=storage.capture()}catch{status.textContent='La sesión cambió. Vuelve a seleccionar el archivo.';return}
  status.textContent='Leyendo '+file.name+'…';
  let rows,workbook;
  try{
   const buffer=await file.arrayBuffer();
   if(request!==revision)return;
   if(ext==='xlsx'){
    workbook=await root.MiCarteraV2ImportXlsx.read(buffer);
    rows=workbook.rows;
   }else{
    rows=root.MiCarteraV2ImportPreviewCore.parseCsv(decodeCsv(buffer));
   }
  }catch(error){
   if(request===revision)status.textContent=error?.message||'No se pudo leer el archivo.';
   return;
  }
  if(request!==revision)return;
  let clients;
  try{
   if(authorizedStorage()!==storage)throw Error('scope');
   clients=storage.readCurrentClients(token);
  }catch{
   status.textContent='No se pudo verificar la cartera de esta sesión. Vuelve a seleccionar el archivo tras sincronizar.';
   refreshAccess();
   return;
  }
  try{
   const draft={rows,token,hasOmittedCells:!!workbook?.omittedCells};
   showResult(root.MiCarteraV2ImportPreviewCore.validate(rows,{existingClients:clients}),workbook,draft,clients,request);
  }catch(error){
   status.textContent=error?.message||'No se pudo validar el archivo.';
  }
 }

 picker.addEventListener('change',inspect);
 clearButton.addEventListener('click',clear);
 root.addEventListener('v2-auth-cloud-state',()=>{clear();refreshAccess()});
 root.addEventListener('v2-session-storage-state',refreshAccess);
 root.addEventListener('mi-cartera-v2-sync',refreshAccess);
 root.addEventListener('storage',event=>{
  if(!event.key||['mi-cartera-v2-validation-state','mi-cartera-v2-local-owner','mi-cartera-v2-active-scope'].includes(event.key)){
   clear();refreshAccess();
  }
 });
 refreshAccess();
}

function decodeCsv(buffer){
 const bytes=new Uint8Array(buffer);
 if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(bytes);
 if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be',{fatal:true}).decode(bytes);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
 catch{return new TextDecoder('windows-1252').decode(bytes)}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})(window);
