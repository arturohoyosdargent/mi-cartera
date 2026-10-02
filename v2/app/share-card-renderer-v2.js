// Mi Cartera PRO V2 — single branded visual language for proposal, credit, receipt and collection reminder sharing.
(function(root){
  'use strict';

  const D=root.MiCarteraV2Dates||{};
  const money=n=>'S/ '+Number(n||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmt=s=>{
    if(!s)return '-';
    const v=D.normalize?.(s)||String(s).slice(0,10);
    try{return new Date(v+'T12:00:00').toLocaleDateString('es-PE')}catch{return v}
  };
  const installmentStatus=q=>{
    const balance=D.balance?.(q)??Number(q?.balance??(Number(q?.amount||0)-Number(q?.paid||0)));
    if(balance<=0)return 'PAGADA';
    const date=D.fromInstallment?.(q)||String(q?.date||'');
    if(date&&date<(D.today?.()||new Date().toISOString().slice(0,10)))return 'VENCIDA';
    return q?.status||'PENDIENTE';
  };
  function creditTotals(cr){
    const qs=Array.isArray(cr?.schedule)?cr.schedule:[];
    if(qs.length){
      const total=qs.reduce((s,q)=>s+Number(q.amount||0),0);
      const balance=qs.reduce((s,q)=>s+(D.balance?.(q)??Math.max(0,Number(q.balance??q.amount)||0)),0);
      return {total,paid:Math.max(0,total-balance),balance};
    }
    const total=Number(cr?.total||0);
    const paid=Number(cr?.principalPaid||0)+Number(cr?.interestPaid||0)+Number(cr?.penaltyPaid||0);
    return {total,paid,balance:Math.max(0,total-paid)};
  }
  function proposalBreakdown(d){
    const rows=Array.isArray(d.schedule)?d.schedule:[],regular=rows.filter(q=>!q.extra),extra=rows.filter(q=>q.extra);
    if(d.kind!=='renewal'||Number(d.term)!==4||d.freq!=='weekly'||regular.length!==4||extra.length!==1)return '';
    return `4 cuotas semanales de ${money(regular[0].amount)} + 5.ª cuota adicional ${money(extra[0].amount)} = ${money(d.total)}`;
  }
  function advance(first,i,freq){
    if(!i)return first;
    const p=root.MiCarteraV2CreditFormParity;
    if(freq==='monthly')return p?.addMonths?.(first,i)||first;
    return p?.addDays?.(first,i*({daily:1,weekly:7,biweekly:14}[freq]||1))||first;
  }
  function receiptInstallmentLabel(p,cr){
    if(String(p?.concept||'').toUpperCase()!=='CUOTA')return p?.concept||'PAGO';
    const qs=Array.isArray(cr?.schedule)?cr.schedule:[];
    const total=Number(p?.totalInstallments||qs.length||0);
    if(!total)return 'CUOTA';
    const from=Number(p?.installmentFrom||0),to=Number(p?.installmentTo||0),explicit=Number(p?.installmentNumber||p?.installmentNo||p?.quotaNumber||0);
    if(from>0&&to>from)return `CUOTAS ${Math.min(total,from)}–${Math.min(total,to)} DE ${total}`;
    let current=explicit>0?Math.min(total,explicit):0;
    if(!current&&qs.length){
      const amount=Math.max(0,Number(p?.amount||0));
      const paidAfter=qs.reduce((sum,q)=>sum+Math.max(0,Number(q.amount||0)-(D.balance?.(q)??Math.max(0,Number(q.balance??q.amount)||0))),0);
      const paidBefore=Math.max(0,paidAfter-amount);
      let acc=0;
      for(let i=0;i<qs.length;i++){acc+=Number(qs[i].amount||0);if(paidBefore<acc-0.005){current=i+1;break}}
    }
    if(!current)current=1;
    const remaining=qs.length?qs.reduce((sum,q)=>sum+(D.balance?.(q)??Math.max(0,Number(q.balance??q.amount)||0)),0):NaN;
    return `CUOTA ${current} DE ${total}${Number.isFinite(remaining)&&remaining<=0.005?' · CANCELADO':''}`;
  }

  const BLUE='#087bd1',INK='#17345f',MUTED='#607583',PALE='#eaf5fc';
  function round(x,a,b,w,h,r=14){x.beginPath();x.roundRect(a,b,w,h,r);x.fill()}
  function txt(x,s,a,b,z=18,bold=false,color=INK,align='left',width){
    x.fillStyle=color;x.textAlign=align;let size=z;x.font=(bold?'700 ':'400 ')+size+'px Arial';
    if(width)while(size>12&&x.measureText(String(s)).width>width){size--;x.font=(bold?'700 ':'400 ')+size+'px Arial'}
    if(width)x.fillText(String(s??''),a,b,width);else x.fillText(String(s??''),a,b);
  }
  function icon(x,name,a,b,size=40,color=BLUE){
    x.save();x.translate(a,b);x.scale(size/40,size/40);x.strokeStyle=color;x.fillStyle=color;x.lineWidth=2.3;x.lineCap='round';x.lineJoin='round';x.beginPath();
    if(name==='user'){x.arc(20,10,6,0,Math.PI*2);x.fill();x.beginPath();x.moveTo(8,33);x.quadraticCurveTo(7,20,20,20);x.quadraticCurveTo(33,20,32,33);x.closePath();x.fill()}
    else if(name==='plant'){x.moveTo(20,28);x.lineTo(20,13);x.stroke();x.beginPath();x.moveTo(20,19);x.bezierCurveTo(2,19,4,2,19,14);x.bezierCurveTo(35,-1,37,15,20,19);x.fill();x.beginPath();x.moveTo(8,28);x.lineTo(32,28);x.lineTo(28,39);x.lineTo(12,39);x.closePath();x.fill()}
    else if(name==='target'){for(const r of [15,10,5]){x.moveTo(20+r,22);x.arc(20,22,r,0,Math.PI*2)}x.moveTo(20,22);x.lineTo(36,5);x.moveTo(29,6);x.lineTo(36,5);x.lineTo(36,12);x.stroke()}
    else if(name==='coin'){for(const y of [11,18,25]){x.moveTo(31,y);x.ellipse(20,y,11,5,0,0,Math.PI*2)}x.moveTo(9,11);x.lineTo(9,29);x.moveTo(31,11);x.lineTo(31,29);x.stroke()}
    else if(name==='percent'){x.arc(20,20,17,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(13,28);x.lineTo(27,12);x.moveTo(16,12);x.arc(13,12,3,0,Math.PI*2);x.moveTo(30,28);x.arc(27,28,3,0,Math.PI*2);x.stroke()}
    else if(name==='bars'){for(const [i,h] of [12,21,31].entries()){x.fillRect(6+i*11,36-h,7,h)}}
    else if(name==='handshake'){x.moveTo(3,17);x.lineTo(12,8);x.lineTo(20,12);x.lineTo(28,8);x.lineTo(38,18);x.lineTo(27,31);x.quadraticCurveTo(24,35,21,30);x.lineTo(11,22);x.moveTo(12,8);x.lineTo(20,12);x.lineTo(14,19);x.quadraticCurveTo(14,23,18,21);x.lineTo(25,15);x.lineTo(34,24);x.moveTo(8,13);x.lineTo(3,22);x.moveTo(34,13);x.lineTo(38,22);x.stroke()}
    else if(name==='bell'){x.moveTo(8,28);x.lineTo(12,24);x.lineTo(12,15);x.bezierCurveTo(12,3,28,3,28,15);x.lineTo(28,24);x.lineTo(32,28);x.closePath();x.moveTo(16,33);x.quadraticCurveTo(20,39,24,33);x.stroke()}
    else {x.roundRect(8,4,25,32,3);if(name==='calendar'){x.moveTo(8,14);x.lineTo(33,14);x.moveTo(14,1);x.lineTo(14,8);x.moveTo(27,1);x.lineTo(27,8);x.moveTo(14,21);x.lineTo(18,21);x.moveTo(23,21);x.lineTo(27,21);x.moveTo(14,28);x.lineTo(18,28)}else{for(const y of [13,21,29]){x.moveTo(14,y);x.lineTo(27,y)}}x.stroke()}
    x.restore();
  }
  function sheet(title,subtitle,height=1080,titleIcon='document'){
    const cv=document.createElement('canvas');cv.width=720;cv.height=1080;cv.height=Math.max(940,height);const x=cv.getContext('2d');
    x.fillStyle='#f0f8fd';x.fillRect(0,0,720,cv.height);x.fillStyle='#fff';round(x,18,130,684,cv.height-154,18);
    const g=x.createLinearGradient(26,20,694,122);g.addColorStop(0,'#0083cf');g.addColorStop(1,'#24aaf0');x.fillStyle=g;round(x,26,18,668,104,17);
    txt(x,'PRÉSTAMO YA',54,65,35,true,'#fff');txt(x,'Tus metas, más cerca',145,92,19,false,'#fff');x.strokeStyle='#bde9ff';x.lineWidth=1;x.beginPath();x.moveTo(421,38);x.lineTo(421,101);x.stroke();icon(x,'coin',447,43,46,'#fff');
    for(const [i,s] of ['SOLUCIONES','FINANCIERAS','PARA UN','MEJOR MAÑANA'].entries())txt(x,s,512,47+i*15,12,true,'#fff');
    x.fillStyle='#d9effb';x.beginPath();x.arc(90,177,35,0,Math.PI*2);x.fill();icon(x,titleIcon,69,155,42);txt(x,title,144,163,28,true,INK,'left',528);txt(x,subtitle,144,190,19,true,MUTED,'left',524);txt(x,'Revisa los detalles de tu ficha.',144,214,15,false,MUTED);
    return {cv,x};
  }
  function clientBlock(x,c,y=232){x.fillStyle=PALE;round(x,42,y,636,88,14);x.fillStyle='#d3edfc';x.beginPath();x.arc(88,y+44,29,0,Math.PI*2);x.fill();icon(x,'user',69,y+23,39);txt(x,'Cliente:',137,y+23,15,false,MUTED);txt(x,c?.name||'Cliente',137,y+48,24,true,INK,'left',520);if(c?.phone)txt(x,'Teléfono: '+c.phone,137,y+72,16,false,MUTED);}
  function metrics(x,items,y=334){const h=Math.ceil(items.length/2)*66+16;x.fillStyle='#f5f9fc';round(x,42,y,636,h,14);items.forEach((m,i)=>{const a=59+(i%2)*319,b=y+14+Math.floor(i/2)*66;icon(x,m[2]||'document',a,b+9,32,'#506876');txt(x,m[0],a+45,b+17,15,false,MUTED);txt(x,m[1],a+45,b+43,23,true,m[3]||BLUE,'left',254)});return y+h}
  function opportunity(x,y,lines){x.fillStyle='#e8f5fd';round(x,42,y,636,94,14);x.fillStyle='#d3edfc';x.beginPath();x.arc(88,y+47,29,0,Math.PI*2);x.fill();icon(x,'plant',68,y+25,40,'#268c51');txt(x,lines?.[0]||'Tu esfuerzo hoy construye un mejor futuro.',137,y+32,20,true,INK,'left',470);txt(x,lines?.[1]||'Pequeños pasos, grandes logros.',137,y+59,17,false,MUTED,'left',470);txt(x,'¡Vamos por más!',570,y+81,16,true,BLUE,'center');return y+106}
  function scheduleTable(x,rows,y,total,{full=false,title='Primeras cuotas'}={}){
    icon(x,'calendar',50,y-18,27);txt(x,title,88,y+3,21,true);const tableWidth=full?620:445,baseX=50,header=y+18;
    x.fillStyle='#e7eff5';round(x,baseX,header,tableWidth,38,8);
    const cols=full?[baseX+12,baseX+49,baseX+165,baseX+278,baseX+385,baseX+496]:[baseX+12,baseX+49,baseX+206,baseX+332];
    const headers=full?['#','Fecha','Cuota','Pendiente','Restante','Estado']:['#','Fecha','Cuota','Saldo'];headers.forEach((s,i)=>txt(x,s,cols[i],header+24,15,true,MUTED));
    const fifth=rows.length===5&&rows.filter(q=>!q.extra).length===4;let remaining=Number(total||0);rows.forEach((q,i)=>{const rowY=header+38+i*36;x.fillStyle=i%2?'#eff7fc':'#f8fbfd';x.fillRect(baseX,rowY,tableWidth,36);remaining=Math.max(0,remaining-Number(q.amount||0));const b=rowY+24;txt(x,q.extra&&fifth?'5.ª':q.number??q.n??i+1,cols[0],b,16);txt(x,fmt(D.fromInstallment?.(q)||q.date),cols[1],b,16);txt(x,money(q.amount),cols[2],b,16,false,BLUE);
      if(full){txt(x,money(D.balance?.(q)??q.balance??q.amount),cols[3],b,15);txt(x,money(remaining),cols[4],b,15);const s=installmentStatus(q);txt(x,s,cols[5],b,14,true,s==='PAGADA'?'#187536':s==='VENCIDA'?'#b83232':BLUE)}else txt(x,money(remaining),cols[3],b,16);
    });
    if(!full){x.fillStyle='#e2f2fd';round(x,510,header,160,Math.max(206,38+rows.length*36),12);icon(x,'target',558,header+23,57);for(const [i,s] of ['Metas reales','al alcance','de tu mano.'].entries())txt(x,s,590,header+104+i*22,18,false,INK,'center');x.fillStyle=BLUE;x.fillRect(567,header+168,46,2)}
    return header+(full?38+rows.length*36:Math.max(206,38+rows.length*36))+12;
  }
  function breakdownBlock(x,label,y){if(!label)return y;const [a,b]=label.split(' + ');x.fillStyle='#edf8ff';round(x,42,y,636,68,12);txt(x,a+' +',58,y+27,20,true,INK,'left',604);txt(x,b,58,y+54,20,true,BLUE,'left',604);return y+80}
  function trustFooter(x,cv,y){const top=Math.max(y,cv.height-150);x.fillStyle='#e7f3fb';round(x,42,top,636,92,14);x.fillStyle='#d4eefa';x.beginPath();x.arc(88,top+46,29,0,Math.PI*2);x.fill();icon(x,'handshake',64,top+23,48);txt(x,'¡Gracias por confiar en nosotros!',137,top+35,21,true,INK,'left',507);txt(x,'Estamos para acompañarte en cada paso.',137,top+63,17,false,MUTED,'left',507);x.fillStyle='#d4ecfb';x.beginPath();x.moveTo(0,cv.height-42);x.quadraticCurveTo(180,cv.height-12,360,cv.height-31);x.quadraticCurveTo(550,cv.height-56,720,cv.height-30);x.lineTo(720,cv.height);x.lineTo(0,cv.height);x.closePath();x.fill();txt(x,'PRÉSTAMO YA',360,cv.height-23,18,true,BLUE,'center');txt(x,'CONFIANZA · COMPROMISO · TU PROGRESO',360,cv.height-7,10,false,MUTED,'center')}
  function proposal(d,c){
    const breakdown=proposalBreakdown(d),fallbackRows=Array.from({length:Math.max(0,Number(d.term)||0)},(_,i)=>({number:i+1,date:advance(d.first,i,d.freq),amount:i===Number(d.term)-1?Math.max(0,Number(d.total||0)-Number(d.installment||0)*Math.max(0,Number(d.term)-1)):Number(d.installment||0)})),all=Array.isArray(d.schedule)&&d.schedule.length?d.schedule:fallbackRows,rows=all.slice(0,breakdown?5:Math.min(5,all.length)),renewal=d.kind==='renewal';
    const items=[[renewal?'Nuevo capital':'Monto del crédito',money(d.capital),'coin'],['Cuota',money(d.installment),'calculator'],['Plazo',d.term+' cuotas','calendar'],['Total a pagar',money(d.total),'bars'],['Tasa de interés',Number(d.rate||0)+'%','percent'],['Primera cuota',fmt(d.first),'calendar']];if(renewal)items.push(['Saldo anterior',money(d.previousBalance),'coin'],['Neto a desembolsar',money(d.netDisbursement||0),'coin']);
    const metricEnd=334+Math.ceil(items.length/2)*66+16,tableY=metricEnd+118,tableEnd=tableY+18+Math.max(206,38+rows.length*36)+12,footerY=tableEnd+(breakdown?80:0)+8,{cv,x}=sheet(renewal?'PROPUESTA DE RENOVACIÓN':'PROPUESTA DE CRÉDITO','¡Estamos listos para apoyarte!',footerY+162);
    clientBlock(x,c||d.client);metrics(x,items);opportunity(x,metricEnd+12);let y=scheduleTable(x,rows,tableY,d.total,{title:breakdown?'Cronograma completo':'Primeras cuotas'});y=breakdownBlock(x,breakdown,y);trustFooter(x,cv,y+8);return blob(cv);
  }
  function credit(cr,c){
    const rows=Array.isArray(cr.schedule)?cr.schedule:[],t=creditTotals(cr),breakdown=proposalBreakdown({...cr,kind:'renewal'}),items=[['Capital',money(cr.capital),'coin'],['Total',money(t.total),'bars'],['Pagado',money(t.paid),'coin','#187536'],['Saldo actual',money(t.balance),'coin',t.balance>0?'#b83232':'#187536']],metricEnd=482,tableY=metricEnd+118,tableEnd=tableY+18+38+rows.length*36+12,footerY=tableEnd+(breakdown?80:0)+8,{cv,x}=sheet('DETALLE DEL CRÉDITO','Tu crédito, claro y al día',footerY+162);
    clientBlock(x,c);metrics(x,items);opportunity(x,metricEnd+12,['Mantén tus cuotas al día para conservar tu crédito disponible.','Estamos contigo en cada paso.']);let y=scheduleTable(x,rows,tableY,t.total,{full:true,title:'Cronograma completo'});y=breakdownBlock(x,breakdown,y);trustFooter(x,cv,y+8);return blob(cv);
  }
  function receipt(p,c,cr){
    const t=cr?creditTotals(cr):null,items=[['Monto recibido',money(p?.amount),'coin'],['Fecha',fmt(p?.date),'calendar'],['Concepto',receiptInstallmentLabel(p,cr),'document']];if(t)items.push(['Saldo actual',money(t.balance),'coin',t.balance>0?'#b83232':'#187536'],['Total del crédito',money(t.total),'bars']);const {cv,x}=sheet('COMPROBANTE DE PAGO','¡Tu pago fue registrado correctamente!',334+Math.ceil(items.length/2)*66+16+272+162,'handshake');
    clientBlock(x,c);const end=metrics(x,items);opportunity(x,end+14,['Tus pagos puntuales nos ayudan a mantener tu crédito disponible','y seguir creciendo juntos.']);x.fillStyle='#edf8ff';round(x,42,end+132,636,118,14);icon(x,'target',64,end+161,48);txt(x,'Tu pago nos acerca a nuevas oportunidades.',137,end+176,22,true,INK,'left',510);txt(x,'¡Gracias por tu confianza!',137,end+211,19,true,BLUE);trustFooter(x,cv,end+272);return blob(cv);
  }
  function reminder(d,c){
    const due=D.normalize?.(d?.date)||String(d?.date||'').slice(0,10),today=D.today?.()||localToday(),overdue=Boolean(due&&due<today),state=overdue?'VENCIDA':'PENDIENTE',{cv,x}=sheet('RECORDATORIO DE PAGO','Estamos para ayudarte a mantener tu crédito al día.',940,'bell');
    clientBlock(x,c||{name:d?.clientName});const end=metrics(x,[['Monto pendiente',money(d?.amount),'coin','#b83232'],['Fecha de vencimiento',fmt(d?.date),'calendar'],['Estado',state,'bell',overdue?'#b83232':BLUE],['Tipo','CUOTA','document']]);opportunity(x,end+14,['Mantener tus pagos al día fortalece tu historial','y nos permite seguir acompañándote con tu crédito.']);x.fillStyle='#edf8ff';round(x,42,end+132,636,126,14);icon(x,'target',64,end+165,48);txt(x,'Si ya realizaste el pago,',137,end+177,22,true,INK);txt(x,'puedes ignorar este recordatorio.',137,end+211,20,false,MUTED);trustFooter(x,cv,end+280);return blob(cv);
  }
  function localToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
  function blob(cv){return new Promise(r=>cv.toBlob(r,'image/png'))}
  root.MiCarteraV2ShareCard={proposal,proposalBreakdown,credit,receipt,reminder,money,fmt,installmentStatus,creditTotals,receiptInstallmentLabel};
})(window);
