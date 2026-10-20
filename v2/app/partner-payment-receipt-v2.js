// Read-only receipts derived from accepted partner expenses and their existing loan journals.
(function(root){'use strict';
const KEY='mi-cartera-v2-validation-state',CATEGORIES=['INTERES_SOCIO','DEVOLUCION_CAPITAL_SOCIO'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>root.MiCarteraV2ShareCard.money(x),read=()=>JSON.parse(root.localStorage.getItem(KEY)||'{}');
const fmt=x=>root.MiCarteraV2ShareCard.fmt(x),futureNotice='Este registro tiene una fecha futura. El comprobante estará disponible desde la fecha del pago.';
let revision=0;
function phone(value){const digits=String(value||'').replace(/\D/g,'');if(!digits)return '';const result=digits.length===9?'51'+digits:digits;if(!/^[1-9]\d{9,14}$/.test(result))throw Error('Registra un WhatsApp válido con código de país.');return result}
function build(id){
 if(root.MiCarteraPartners?.canView?.()!==true)throw Error('La sesión no permite consultar comprobantes de socios.');
 const d=read(),matches=(d.cashMovements||[]).filter(x=>String(x.id)===String(id)&&!x.tombstone);
 if(matches.length!==1)throw Error('No existe un movimiento único para este comprobante.');
 const row=matches[0];if(row.type!=='EGRESO'||!CATEGORIES.includes(row.category))throw Error('El movimiento no es un pago a socio.');
 const master=(d.cashMovements||[]).find(x=>!x.tombstone&&x.partnerLoan&&String(x.id)===String(row.partnerLoanId||row.ref));
 const loan=master?.partnerLoan,journal=loan&&(row.category==='INTERES_SOCIO'?loan.interestPayments:loan.repayments),payment=journal?.find(x=>x.id===row.id);
 if(!payment||Number(payment.amount)!==Number(row.amount)||payment.date!==row.date||!Number.isFinite(row.amount)||row.amount<=0)throw Error('El historial del pago está incompleto o no coincide. No se generó el comprobante.');
 if(row.category==='INTERES_SOCIO'&&(!payment.due||row.interestDue&&row.interestDue!==payment.due))throw Error('El periodo del pago no coincide con su historial.');
 root.MiCarteraPartnerLoans.date(row.date);root.MiCarteraPartnerLoans.date(loan.date);if(row.category==='INTERES_SOCIO')root.MiCarteraPartnerLoans.date(payment.due);
 if(!Number.isFinite(loan.principal)||loan.principal<=0)throw Error('No se pudo identificar el capital de este pago.');
 const audit=(d.audit||[]).find(x=>x.detail?.ids?.includes(row.id)&&x.operationId);
 if(row.operationId&&audit?.operationId&&row.operationId!==audit.operationId)throw Error('La operación no coincide con la auditoría.');
 const operationId=String(row.operationId||audit?.operationId||row.id);
 return Object.freeze({id:row.id,operationId,loanId:master.id,partner:loan.partner,phone:phone(master.partnerPhone||loan.phone),principal:loan.principal,deliveryDate:loan.date,due:row.category==='INTERES_SOCIO'?payment.due:'',amount:row.amount,date:row.date,future:row.date>root.MiCarteraV2Dates.today(),kind:row.category,label:row.category==='INTERES_SOCIO'?'Intereses':'Devolución de capital',period:row.category==='INTERES_SOCIO'?'Vencimiento '+String(payment.due):'Entrega del '+loan.date});
}
function showFutureNotice(){let node=document.getElementById('v2PartnerReceiptNotice');if(!node){node=document.createElement('p');node.id='v2PartnerReceiptNotice';node.setAttribute('role','status');node.tabIndex=-1;node.style='padding:12px;background:#fff1bd;border-radius:10px';(document.getElementById('partnerList')||document.getElementById('partners')||document.querySelector('main')||document.body).prepend(node)}node.textContent=futureNotice;node.focus();node.scrollIntoView?.({block:'nearest'});return 'not-yet-paid'}
function assertPaid(r){if(r.future===true||r.date>root.MiCarteraV2Dates.today())throw Error(futureNotice)}
function text(r){assertPaid(r);return 'Hola, '+r.partner+'. Registré el pago de '+money(r.amount)+' por '+r.label.toLowerCase()+' el '+fmt(r.date)+(r.due?', con vencimiento '+fmt(r.due):'')+'. Corresponde al capital de '+money(r.principal)+' que entregaste el '+fmt(r.deliveryDate)+'. Gracias por tu confianza.'}
function scope(){const a=root.MiCarteraV2AuthCloudGate?.requireReady?.(),session=root.MiCarteraV2SessionStorage;return {uid:a?.uid,revision,token:session?.capture?.()}}
function assertScope(expected,receipt){if(revision!==expected.revision||root.MiCarteraV2AuthCloudGate?.requireReady?.().uid!==expected.uid||root.MiCarteraPartners?.canView?.()!==true)throw Error('La sesión cambió. Vuelve a abrir el comprobante.');if(expected.token)root.MiCarteraV2SessionStorage.assertCurrent(expected.token);if(JSON.stringify(build(receipt.id))!==JSON.stringify(receipt))throw Error('El pago o contacto cambió. Vuelve a abrir el comprobante.')}
async function preview(id){
 const receipt=build(id);
 if(receipt.future)return showFutureNotice();
 const expected=scope(),renderer=await root.MiCarteraV2PaymentReceipt.ensureRenderer();assertScope(expected,receipt);
 const blob=await renderer.partnerReceipt(receipt);assertScope(expected,receipt);
 const file=new root.File([blob],'prestamo-ya-comprobante-socio.png',{type:'image/png'}),imageUrl=root.URL.createObjectURL(file);
 const shareImage=async()=>{assertScope(expected,receipt);if(root.navigator.share&&(!root.navigator.canShare||root.navigator.canShare({files:[file]}))){try{await root.navigator.share({title:'Comprobante al socio',text:text(receipt),files:[file]});return 'shared'}catch(error){if(error?.name==='AbortError')return 'cancelled';throw error}}const url=root.URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>root.URL.revokeObjectURL(url),1000);return 'downloaded'};
 const promise=root.MiCarteraV2SharePreview.open({title:'Vista previa · Comprobante al socio',summary:'<b>Socio:</b> '+esc(receipt.partner)+'<br><b>Capital original:</b> '+esc(money(receipt.principal))+'<br><b>Entrega:</b> '+esc(fmt(receipt.deliveryDate))+'<br><b>Concepto:</b> '+esc(receipt.label)+(receipt.due?'<br><b>Vencimiento:</b> '+esc(fmt(receipt.due)):'')+'<br><b>Fecha de pago:</b> '+esc(fmt(receipt.date))+'<br><b>Importe pagado:</b> '+esc(money(receipt.amount)),message:text(receipt),imageUrl,send:()=>{assertScope(expected,receipt);if(!receipt.phone)return shareImage();const opened=root.open('https://wa.me/'+receipt.phone+'?text='+encodeURIComponent(text(receipt)),'_blank','noopener,noreferrer');return opened?'whatsapp-opened':'whatsapp-requested'}});
 const modal=document.getElementById('v2SharePreview');modal.dataset.partnerReceipt=receipt.id;modal.querySelector('img').alt='Comprobante de pago al socio PRÉSTAMO YA';
 const buttons=modal.querySelectorAll('.v2-share-preview-actions button'),copy=buttons[0],copyStatus=document.createElement('p');copyStatus.dataset.partnerCopyStatus='';copyStatus.setAttribute('role','status');modal.querySelector('.v2-share-preview-actions').after(copyStatus);
 copy.onclick=async()=>{
  try{
   assertScope(expected,receipt);const message=text(receipt);let copied=false;
   if(root.navigator.clipboard?.writeText){try{await root.navigator.clipboard.writeText(message);copied=true}catch{}}
   if(!copied){assertScope(expected,receipt);const field=modal.querySelector('#v2SharePreviewMessage');field.focus();field.select();field.setSelectionRange(0,field.value.length);copied=Boolean(document.execCommand?.('copy'))}
   assertScope(expected,receipt);copyStatus.textContent=copied?'Mensaje copiado.':'No se pudo copiar. Selecciona el mensaje y cópialo manualmente.';
  }catch{copyStatus.textContent='No se pudo copiar. Vuelve a abrir el comprobante con tu sesión activa.'}
 };
 buttons[2].textContent=receipt.phone?'Abrir WhatsApp':'Compartir imagen';
 if(receipt.phone){const extra=document.createElement('button');extra.type='button';extra.className='btn';extra.textContent='Compartir / guardar imagen';extra.onclick=()=>shareImage().catch(error=>root.alert(error.message));modal.querySelector('.v2-share-preview-actions').appendChild(extra)}
 return promise;
}
root.addEventListener('v2-partner-payment-recorded',event=>{const ids=event.detail?.ids||[];if(!ids.length)return;if(ids.length>1)root.alert('Se registraron '+ids.length+' devoluciones. Cada comprobante está disponible en el historial.');preview(ids[0]).catch(()=>root.alert('El pago quedó registrado. No se pudo abrir el comprobante; puedes reintentarlo desde el historial.'))});
for(const event of ['v2-auth-cloud-state','v2-session-storage-state','storage'])root.addEventListener(event,()=>{revision++;const modal=document.getElementById('v2SharePreview');if(modal?.dataset.partnerReceipt)root.MiCarteraV2SharePreview.close()});
root.MiCarteraV2PartnerReceipt=Object.freeze({build,text,preview,phone});
})(window);
