// Actual partner actions, branded canvas and shared preview; only device/Cloud boundaries are fictional.
const {test}=require('node:test'),a=require('node:assert/strict'),{boot}=require('./dom-harness.cjs');
const loan={id:'receipt-loan',partner:'SOCIO FICTICIO',phone:'999111222',date:'2026-09-01',principal:1000,rate:10,firstDue:'2026-10-01'};
async function setup(t){const h=await boot({fullShell:true});t.after(()=>h.close());h.w.MiCarteraV2Dates.today=()=> '2026-10-16';h.opened=[];h.copied=[];h.w.open=url=>{h.opened.push(url);return {}};h.w.URL.createObjectURL=()=> 'blob:fictional-partner-receipt';h.w.URL.revokeObjectURL=()=>{};Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>h.copied.push(text)}});await h.w.MiCarteraPartners.create(loan);return h}
async function drain(){for(let i=0;i<5;i++)await new Promise(done=>setImmediate(done))}
const visibleTechnical=/Código de operación|Referencia del movimiento|depósito bancario|registro de la aplicación|conserva este comprobante y su código/i;
function cleanVisible(value,receipt){a.doesNotMatch(value,visibleTechnical);for(const id of [receipt.id,receipt.loanId,receipt.operationId])a.ok(!value.includes(id),'technical identifiers stay internal')}

test('accepted partner interest previews the client receipt format with human payment details only',async t=>{
 const h=await setup(t);await h.w.MiCarteraPartners.interest(loan.id,{date:'2026-10-01',due:'2026-10-01',amount:100});await drain();
 const modal=h.w.document.getElementById('v2SharePreview');a.ok(modal,'a successful payment opens the existing shared preview');
 a.match(modal.textContent,/SOCIO FICTICIO/);a.match(modal.textContent,/Intereses/);a.match(modal.textContent,/1\/10\/2026/);a.match(modal.textContent,/S\/ 1,000\.00/);a.match(modal.textContent,/1\/9\/2026/);
 const expense=h.get().cashMovements.find(x=>x.category==='INTERES_SOCIO'),receipt=h.w.MiCarteraV2PartnerReceipt.build(expense.id);a.ok(expense.operationId);a.equal(receipt.operationId,expense.operationId);a.equal(receipt.loanId,loan.id);a.equal(receipt.principal,1000);a.equal(receipt.deliveryDate,loan.date);
 cleanVisible(modal.querySelector('.v2-share-preview-summary').textContent,receipt);cleanVisible(h.drawn.join('\n'),receipt);
 a.ok(h.drawn.includes('▱  PRÉSTAMO YA'));a.ok(h.drawn.includes('COMPROBANTE DE PAGO'));a.ok(h.drawn.includes('Socio'));a.ok(h.drawn.includes('INTERESES'));a.ok(h.drawn.includes('Capital original'));a.ok(h.drawn.includes('S/ 1,000.00'));a.equal(h.opened.length,0,'recording a payment never opens WhatsApp automatically');
 const before=JSON.stringify(h.get()),commits=h.commits.length;modal.querySelector('.v2-share-preview-actions button').click();await drain();cleanVisible(h.copied[0],receipt);a.match(modal.querySelector('[data-partner-copy-status]')?.textContent||'',/Mensaje copiado/);a.match(h.copied[0],/^Hola, SOCIO FICTICIO\./);a.match(h.copied[0],/Registré el pago de S\/ 100\.00 por intereses/);a.ok(h.copied[0].length<300,'WhatsApp is a short natural confirmation');
 const send=[...modal.querySelectorAll('button')].find(x=>x.textContent==='Abrir WhatsApp');send.click();await drain();a.match(h.opened[0],/^https:\/\/wa.me\/51999111222\?text=/);a.equal(new URL(h.opened[0]).searchParams.get('text'),h.copied[0]);a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,commits);
});
test('capital return receipt differs from interest and can reopen from actual history without another payment',async t=>{
 const h=await setup(t);await h.w.MiCarteraPartners.repay(loan.id,{date:'2026-10-02',amount:400,nextMonthlyInterest:60});await drain();
 const expense=h.get().cashMovements.find(x=>x.category==='DEVOLUCION_CAPITAL_SOCIO'),before=JSON.stringify(h.get()),commits=h.commits.length;
 a.ok(h.w.document.getElementById('v2SharePreview'));a.ok(h.drawn.includes('DEVOLUCIÓN DE CAPITAL'));h.w.MiCarteraV2SharePreview.close();
 const button=h.w.document.querySelector('[data-partner-receipt="'+expense.id+'"]');a.ok(button,'the actual partner history exposes the existing payment receipt');button.click();await drain();
 const modal=h.w.document.getElementById('v2SharePreview'),receipt=h.w.MiCarteraV2PartnerReceipt.build(expense.id);a.match(modal.textContent,/Devolución de capital/);a.match(modal.textContent,/S\/ 1,000\.00/);a.match(modal.textContent,/1\/9\/2026/);cleanVisible(modal.querySelector('.v2-share-preview-summary').textContent,receipt);cleanVisible(h.drawn.join('\n'),receipt);a.match(h.w.MiCarteraV2PartnerReceipt.text(receipt),/por devolución de capital/);a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,commits);a.equal(h.w.MiCarteraPartnerLoans.balance(h.get().cashMovements[0].partnerLoan),600);
});
test('rejected payment has no receipt and a receipt renderer failure cannot undo an accepted financial record',async t=>{
 const h=await setup(t),bridge=h.w.MiCarteraV2SyncBridge.submit;h.w.MiCarteraV2SyncBridge.submit=async()=>{throw Error('fixture-denied')};
 await a.rejects(h.w.MiCarteraPartners.interest(loan.id,{date:'2026-10-01',due:'2026-10-01',amount:100}),/fixture-denied/);a.equal(h.w.document.getElementById('v2SharePreview'),null);
 h.w.MiCarteraV2SyncBridge.submit=bridge;h.w.MiCarteraV2ShareCard.partnerReceipt=async()=>{throw Error('fixture-render-failed')};
 await h.w.MiCarteraPartners.interest(loan.id,{date:'2026-10-01',due:'2026-10-01',amount:100});await drain();a.equal(h.get().cashMovements.filter(x=>x.category==='INTERES_SOCIO').length,1);a.ok(h.alerts.some(x=>/pago.*registrado/i.test(x)));
});
test('receipt preview and copy/send are invalidated by account change and A-B-A',async t=>{
 const h=await setup(t);await h.w.MiCarteraPartners.interest(loan.id,{date:'2026-10-01',due:'2026-10-01',amount:100});await drain();
 const modal=h.w.document.getElementById('v2SharePreview');a.ok(modal,'the accepted payment exposes a preview to invalidate');const send=[...modal.querySelectorAll('button')].find(x=>x.textContent==='Abrir WhatsApp'),copy=modal.querySelector('.v2-share-preview-actions button'),before=JSON.stringify(h.get());
 h.setAuth({uid:'fictional-B',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]},true);h.setAuth({uid:'test-admin',role:'admin',ready:true,authenticated:true,member:true,routeIds:[]},true);
 const afterSwitch=JSON.stringify(h.get());a.equal(h.w.document.getElementById('v2SharePreview'),null);copy.click();send.click();await drain();a.equal(h.opened.length,0);a.equal(h.copied.length,0);a.equal(JSON.stringify(h.get()),afterSwitch);a.deepEqual(h.get().cashMovements,JSON.parse(before).cashMovements);
});
test('old partner contact can be registered separately without changing principal cash or payment history',async t=>{
 const h=await setup(t),before=h.get(),old=before.cashMovements[0];a.equal(typeof h.w.MiCarteraPartners.contact,'function');await h.w.MiCarteraPartners.contact(loan.id,'+51 999 444 555');const current=h.get().cashMovements[0];
 a.equal(current.partnerPhone,'51999444555');a.equal(current.amount,old.amount);a.deepEqual(current.partnerLoan,old.partnerLoan);a.equal(h.get().payments.length,before.payments.length);a.equal(h.w.document.getElementById('v2SharePreview'),null);
});
test('future dated partner payment keeps its operation but cannot produce a receipt or confirmation',async t=>{
 const h=await setup(t);await h.w.MiCarteraPartners.interest(loan.id,{date:'2026-11-16',due:'2026-10-01',amount:100});await drain();
 a.equal(Boolean(h.w.document.getElementById('v2SharePreview')),false,'future payments have no receipt preview');a.equal(h.drawn.length,0);a.equal(h.copied.length,0);a.equal(h.opened.length,0);a.match(h.w.document.getElementById('v2PartnerReceiptNotice')?.textContent||'',/fecha futura/i);a.equal(h.alerts.length,0,'future notice uses the page instead of a blocking native alert');const d=h.get(),expense=d.cashMovements.find(x=>x.category==='INTERES_SOCIO'),receipt=h.w.MiCarteraV2PartnerReceipt.build(expense.id),before=JSON.stringify(d),commits=h.commits.length;
 a.equal(receipt.future,true);a.throws(()=>h.w.MiCarteraV2PartnerReceipt.text(receipt),/fecha futura/i);await a.rejects(async()=>h.w.MiCarteraV2ShareCard.partnerReceipt(receipt),/fecha futura/i);await h.w.MiCarteraV2PartnerReceipt.preview(expense.id);a.equal(h.w.document.getElementById('v2SharePreview'),null);a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,commits);
 expense.interestDue='2026-11-01';h.set(d);a.throws(()=>h.w.MiCarteraV2PartnerReceipt.build(expense.id),/periodo|coincide/i);
});
test('settling multiple deliveries retains one operation and independent retrievable receipts without extra cash writes',async t=>{
 const h=await setup(t);await h.w.MiCarteraPartners.create({...loan,id:'receipt-second',date:'2026-09-02',firstDue:'2026-10-02',principal:500});await h.w.MiCarteraPartners.settle(loan.partner,'2026-10-03');await drain();
 const payments=h.get().cashMovements.filter(x=>x.category==='DEVOLUCION_CAPITAL_SOCIO'),before=JSON.stringify(h.get()),commits=h.commits.length;a.equal(payments.length,2);a.equal(new Set(payments.map(x=>x.operationId)).size,1);
 for(const payment of payments){const receipt=h.w.MiCarteraV2PartnerReceipt.build(payment.id);a.equal(receipt.amount,payment.amount);a.equal(receipt.id,payment.id)}
 a.equal(h.w.document.querySelectorAll('button[data-partner-receipt]').length,2);a.equal(JSON.stringify(h.get()),before);a.equal(h.commits.length,commits);
});

test('partner receipt reuses the exact client canvas layout and preserves the client drawing',async t=>{
 const h=await setup(t),frames=[];let frame;
 h.w.HTMLCanvasElement.prototype.getContext=function(){frame={width:this.width,height:this.height,geometry:[],drawing:[]};frames.push(frame);const record=frame;return new Proxy({measureText:value=>({width:String(value).length*8})},{get:(target,key)=>key in target?target[key]:(...args)=>{record.drawing.push([key,...args]);if(key!=='fillText')record.geometry.push([key,...args])},set:(target,key,value)=>{record.drawing.push(['set',key,value]);target[key]=value;return true}})};
 const renderer=h.w.MiCarteraV2ShareCard;await renderer.receipt({amount:100,date:'2026-10-01',concept:'CUOTA',installmentNumber:1,totalInstallments:1},{name:loan.partner},{total:1100,schedule:[{date:'2026-10-01',amount:1100,balance:1000}]});
 const client=frames[0],hash=drawing=>require('node:crypto').createHash('sha256').update(JSON.stringify(drawing)).digest('hex');
 a.equal(hash(client.drawing),'cfd7d9fd2a13d3cca2c5b507686be629a5cc84acde33488cba1a73a74033fb8e','the client drawing includes only the approved credit summary');
 const summary=[['save'],['translate',0,0],...[
  ['Resumen actual del crédito',58,680,'#17345f','700 14px Arial'],
  ['Cuotas pagadas: 0 de 1',58,705,'#17345f','700 13px Arial'],
  ['Total abonado',390,680,'#6b737b','400 13px Arial'],
  ['S/ 100.00',390,710,'#187536','700 19px Arial']
 ].flatMap(([text,x,y,color,font])=>[['set','fillStyle',color],['set','font',font],['set','textAlign','left'],['fillText',text,x,y]]),['restore']];
 const baseDrawing=JSON.parse(JSON.stringify(client.drawing)),summaryIndex=baseDrawing.findIndex((row,i)=>row[0]==='save'&&baseDrawing[i+1]?.[0]==='translate');
 a.ok(summaryIndex>=0);a.deepEqual(baseDrawing.slice(summaryIndex,summaryIndex+summary.length),summary,'paid count and full paid total remain in the client graphic');
 baseDrawing.splice(summaryIndex,summary.length);a.deepEqual(baseDrawing[1],['fillRect',0,0,720,1160]);baseDrawing[1][4]-=80;
 const footer=baseDrawing.find(row=>row[0]==='translate');a.deepEqual(footer,['translate',0,80]);footer[2]-=80;
 a.equal(hash(baseDrawing),'b36541830df31ab53c9bc7f9132d3ae2cc526b4c4a082aa1a38467a307bb5953','all drawing outside the approved 80px summary stays unchanged');
 await renderer.partnerReceipt({partner:loan.partner,amount:100,date:'2026-10-01',kind:'INTERES_SOCIO',principal:loan.principal,deliveryDate:loan.date,due:'2026-10-01'});
 const partner=frames[1];a.equal(partner.width,client.width);a.equal(client.height,1160);a.equal(partner.height,1080);a.deepEqual(partner.geometry,baseDrawing.filter(row=>!['set','fillText'].includes(row[0])),'both receipt types keep the same card, icons, blocks and footer outside the client credit summary');
});
