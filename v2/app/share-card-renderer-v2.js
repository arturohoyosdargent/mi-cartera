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
      const balance=qs.reduce((s,q)=>s+(D.balance?.(q)??Math.max(0,Number(q.balance??q.amount??0))),0);
      return {total,paid:Math.max(0,total-balance),balance};
    }
    const total=Number(cr?.total||0);
    const paid=Number(cr?.principalPaid||0)+Number(cr?.interestPaid||0)+Number(cr?.penaltyPaid||0);
    return {total,paid,balance:Math.max(0,total-paid)};
  }
  function canvas(title,subtitle,client){
    const cv=document.createElement('canvas');
    cv.width=900;cv.height=1280;
    const x=cv.getContext('2d');
    x.fillStyle='#f4f9fc';x.fillRect(0,0,900,1280);
    x.fillStyle='#1197dc';x.fillRect(28,24,844,138);
    x.fillStyle='#fff';x.font='700 36px Arial';x.fillText('PRÉSTAMO YA',58,73);
    x.font='700 23px Arial';x.fillText(title,58,116);
    x.font='16px Arial';x.fillText(subtitle,58,143);
    x.fillStyle='#e8f5fb';round(x,38,184,824,102,18);
    txt(x,'Cliente',62,218,15,false,'#6b737b');
    txt(x,client?.name||client||'Cliente',62,252,25,true,'#17345f');
    if(client?.phone)txt(x,'Teléfono: '+client.phone,500,250,17,false,'#17345f');
    return {cv,x};
  }
  function round(x,a,b,w,h,r){
    x.beginPath();
    if(typeof x.roundRect==='function'){x.roundRect(a,b,w,h,r);}
    else{
      const q=Math.max(0,Math.min(Number(r)||0,w/2,h/2));
      x.moveTo(a+q,b);x.lineTo(a+w-q,b);x.quadraticCurveTo(a+w,b,a+w,b+q);
      x.lineTo(a+w,b+h-q);x.quadraticCurveTo(a+w,b+h,a+w-q,b+h);
      x.lineTo(a+q,b+h);x.quadraticCurveTo(a,b+h,a,b+h-q);
      x.lineTo(a,b+q);x.quadraticCurveTo(a,b,a+q,b);
    }
    x.closePath();x.fill();
  }
  function txt(x,s,a,b,z=18,bold=false,color='#17345f',align='left'){
    x.fillStyle=color;x.font=`${bold?'700':'400'} ${z}px Arial`;x.textAlign=align;x.fillText(String(s??''),a,b);
  }
  function metric(x,label,value,col,row,color='#087bd1'){
    const a=62+col*405,b=340+row*92;
    txt(x,label,a,b,15,false,'#6b737b');
    txt(x,value,a,b+31,23,true,color);
  }
  function footer(x){
    x.fillStyle='#e8f5fb';round(x,38,1160,824,72,16);
    txt(x,'¡Gracias por confiar en nosotros!',62,1191,18,true,'#087bd1');
    txt(x,'Juntos hacemos tus metas posibles.',62,1217,14,false,'#17345f');
    txt(x,'PRÉSTAMO YA · CONFIANZA · COMPROMISO · TU PROGRESO',450,1260,12,true,'#087bd1','center');
  }
  function proposal(d,clientArg){
    const cv=document.createElement('canvas');cv.width=720;cv.height=1080;const x=cv.getContext('2d'),client=clientArg||d.client;
    x.fillStyle='#f8fcff';x.fillRect(0,0,720,1080);
    x.fillStyle='#1197dc';round(x,18,18,684,126,18);x.strokeStyle='#fff';x.lineWidth=3;x.strokeRect(42,43,24,18);x.beginPath();x.moveTo(48,49);x.lineTo(60,49);x.moveTo(48,56);x.lineTo(57,56);x.stroke();txt(x,'PRÉSTAMO YA',78,62,29,true,'#fff');txt(x,'Tu aliado en soluciones financieras',42,91,14,false,'#fff');txt(x,d.kind==='renewal'?'PROPUESTA DE RENOVACIÓN':'PROPUESTA DE CRÉDITO',42,123,16,true,'#fff');
    x.fillStyle='#e8f5fb';x.beginPath();x.arc(360,205,42,0,Math.PI*2);x.fill();x.strokeStyle='#087bd1';x.lineWidth=5;x.beginPath();x.moveTo(326,205);x.lineTo(348,190);x.lineTo(370,209);x.lineTo(394,191);x.stroke();txt(x,'¡Estamos listos para apoyarte!',360,258,25,true,'#17345f','center');
    x.fillStyle='#eef8fd';round(x,36,286,648,105,18);txt(x,'Cliente',58,320,13,false,'#6b737b');txt(x,client?.name||'Cliente',58,349,20,true);if(client?.phone)txt(x,'Tel. '+client.phone,430,349,14,false,'#17345f');
    x.fillStyle='#eef8fd';round(x,36,414,648,214,18);
    txt(x,d.kind==='renewal'?'Nuevo capital':'Monto del crédito',58,448,13,false,'#6b737b');txt(x,money(d.capital),58,480,27,true,'#087bd1');txt(x,'Cuota',390,448,13,false,'#6b737b');txt(x,money(d.installment),390,480,22,true,'#087bd1');
    txt(x,'Plazo',58,522,13,false,'#6b737b');txt(x,`${d.term} cuotas`,58,550,19,true);txt(x,'Total a pagar',390,522,13,false,'#6b737b');txt(x,money(d.total),390,550,19,true,'#087bd1');
    txt(x,d.kind==='renewal'?'Saldo anterior':'Interés',58,590,13,false,'#6b737b');txt(x,d.kind==='renewal'?money(d.previousBalance):`${Number(d.rate||0)}%`,58,616,18,true);txt(x,'Primera cuota',390,590,13,false,'#6b737b');txt(x,fmt(d.first),390,616,18,true);
    x.fillStyle='#edf9f0';round(x,36,650,648,84,18);x.strokeStyle='#187536';x.lineWidth=3;x.beginPath();x.moveTo(70,712);x.lineTo(70,681);x.quadraticCurveTo(53,686,56,671);x.quadraticCurveTo(72,671,70,688);x.quadraticCurveTo(87,684,88,669);x.quadraticCurveTo(71,671,70,693);x.stroke();txt(x,'Tu esfuerzo de hoy construye nuevas oportunidades.',100,688,16,true,'#187536');txt(x,'Pequeños pasos, grandes logros.',100,714,14,false,'#187536');
    txt(x,'Primeras cuotas',58,782,19,true);txt(x,'#',58,816,13,true);txt(x,'Fecha',112,816,13,true);txt(x,'Cuota',340,816,13,true);txt(x,'Saldo',535,816,13,true);
    const fallbackRows=Array.from({length:Math.max(0,Number(d.term)||0)},(_,i)=>({number:i+1,date:advance(d.first,i,d.freq),amount:i===Number(d.term)-1?Math.max(0,Number(d.total||0)-Number(d.installment||0)*Math.max(0,Number(d.term)-1)):Number(d.installment||0)})),rows=Array.isArray(d.schedule)&&d.schedule.length?d.schedule:fallbackRows;let saldo=Number(d.total||0);
    rows.slice(0,4).forEach((q,i)=>{saldo=Math.max(0,saldo-Number(q.amount||0));const y=850+i*38;txt(x,q.number??q.n??i+1,58,y,13);txt(x,fmt(q.date),112,y,13);txt(x,money(q.amount),340,y,13,false,'#087bd1');txt(x,money(saldo),535,y,13);});
    txt(x,'¡Gracias por tu confianza!',360,1012,18,true,'#087bd1','center');x.fillStyle='#1197dc';x.fillRect(18,1034,684,28);return blob(cv);
  }
  function advance(first,i,freq){
    if(!i)return first;
    const p=root.MiCarteraV2CreditFormParity;
    if(freq==='monthly')return p?.addMonths?.(first,i)||first;
    return p?.addDays?.(first,i*({daily:1,weekly:7,biweekly:14}[freq]||1))||first;
  }
  function credit(cr,c){
    const cv=document.createElement('canvas'),rows=(cr.schedule||[]).slice(0,8),cardH=Math.max(790,760+rows.length*38);cv.width=720;cv.height=cardH;const x=cv.getContext('2d'),t=creditTotals(cr);
    x.fillStyle='#f8fcff';x.fillRect(0,0,720,cardH);x.fillStyle='#1197dc';round(x,18,18,684,126,18);
    txt(x,'▱  PRÉSTAMO YA',42,62,29,true,'#fff');txt(x,'Tu aliado en soluciones financieras',42,91,14,false,'#fff');txt(x,'DETALLE DEL CRÉDITO',42,123,16,true,'#fff');
    x.fillStyle='#eef8fd';round(x,36,174,648,100,18);txt(x,'Cliente',58,207,13,false,'#6b737b');txt(x,c?.name||'Cliente',58,238,20,true);if(c?.phone)txt(x,'Tel. '+c.phone,430,238,14,false,'#17345f');
    x.fillStyle='#eef8fd';round(x,36,298,648,190,18);txt(x,'Capital',58,334,13,false,'#6b737b');txt(x,money(cr.capital),58,365,24,true,'#087bd1');txt(x,'Total',390,334,13,false,'#6b737b');txt(x,money(t.total),390,365,20,true,'#087bd1');
    txt(x,'Pagado',58,414,13,false,'#6b737b');txt(x,money(t.paid),58,444,20,true,'#187536');txt(x,'Saldo actual',390,414,13,false,'#6b737b');txt(x,money(t.balance),390,444,20,true,t.balance>0?'#b83232':'#187536');
    x.fillStyle='#edf9f0';round(x,36,512,648,78,18);x.strokeStyle='#087bd1';x.lineWidth=3;x.beginPath();x.arc(70,548,9,0,Math.PI*2);x.moveTo(70,557);x.lineTo(70,571);x.stroke();txt(x,'Mantén tus cuotas al día para conservar tu crédito disponible.',100,551,14,true,'#187536');txt(x,'Estamos contigo en cada paso.',100,574,13,false,'#187536');
    txt(x,'Cronograma',58,638,20,true);txt(x,'#',52,675,13,true);txt(x,'Fecha',98,675,13,true);txt(x,'Cuota',270,675,13,true);txt(x,'Saldo',430,675,13,true);txt(x,'Estado',565,675,13,true);
    rows.forEach((q,i)=>{const y=712+i*38,s=installmentStatus(q);txt(x,q.number??q.n??i+1,52,y,12);txt(x,fmt(D.fromInstallment?.(q)||q.date),98,y,12);txt(x,money(q.amount),270,y,12,false,'#087bd1');txt(x,money(D.balance?.(q)??q.balance??q.amount),430,y,12);txt(x,s,565,y,11,true,s==='PAGADA'?'#187536':'#b83232');});
    const footY=cardH-42;txt(x,'¡Gracias por tu confianza!',360,footY-18,18,true,'#087bd1','center');x.fillStyle='#1197dc';x.fillRect(18,footY,684,20);return blob(cv);
  }
  function receiptInstallmentIndex(p,cr){const qs=Array.isArray(cr?.schedule)?cr.schedule:[];if(!qs.length)return 0;const total=qs.length,amount=Math.max(0,Number(p?.amount||0)),explicit=Number(p?.installmentNumber||p?.installmentNo||p?.quotaNumber||0);let current=explicit>0?Math.min(total,explicit):0;if(!current){const paidAfter=qs.reduce((sum,q)=>sum+Math.max(0,Number(q.amount||0)-(D.balance?.(q)??Math.max(0,Number(q.balance??q.amount??0)))),0),paidBefore=Math.max(0,paidAfter-amount);let acc=0;for(let i=0;i<qs.length;i++){acc+=Number(qs[i].amount||0);if(paidBefore<acc-0.005){current=i+1;break}}}if(!current)current=Math.max(1,qs.findIndex(q=>(D.balance?.(q)??Number(q.balance??q.amount??0))>0)+1);return current}function receiptInstallmentDate(p,cr){const qs=Array.isArray(cr?.schedule)?cr.schedule:[],i=receiptInstallmentIndex(p,cr);const q=i>0?qs[i-1]:null;return D.fromInstallment?.(q)||q?.date||p?.installmentDate||p?.dueDate||''}function receiptInstallmentLabel(p,cr){
    if(String(p?.concept||'').toUpperCase()!=='CUOTA')return p?.concept||'PAGO';
    const qs=Array.isArray(cr?.schedule)?cr.schedule:[];
    if(!qs.length)return 'CUOTA';
    const total=qs.length,current=receiptInstallmentIndex(p,cr);
    const remaining=qs.reduce((sum,q)=>sum+(D.balance?.(q)??Math.max(0,Number(q.balance??q.amount??0))),0);
    return `CUOTA ${current} DE ${total}${remaining<=0.005?' · CANCELADO':''}`;
  }
  function receipt(p,c,cr){
    const cv=document.createElement('canvas');cv.width=720;cv.height=1080;const x=cv.getContext('2d'),firstName=String(c?.name||'').trim().split(/\s+/)[0]||'cliente',t=cr?creditTotals(cr):null;
    x.fillStyle='#f8fcff';x.fillRect(0,0,720,1080);
    x.fillStyle='#1197dc';round(x,18,18,684,126,18);
    txt(x,'▱  PRÉSTAMO YA',42,62,29,true,'#fff');txt(x,'Tu aliado en soluciones financieras',42,91,14,false,'#fff');txt(x,'COMPROBANTE DE PAGO',42,123,16,true,'#fff');
    x.fillStyle='#e8f5fb';x.beginPath();x.arc(360,210,44,0,Math.PI*2);x.fill();x.strokeStyle='#087bd1';x.lineWidth=5;x.beginPath();x.moveTo(326,210);x.lineTo(348,195);x.lineTo(370,214);x.lineTo(394,196);x.stroke();txt(x,`¡Gracias, ${firstName}!`,360,268,31,true,'#17345f','center');txt(x,'Hemos registrado correctamente',360,300,17,false,'#17345f','center');txt(x,'tu pago.',360,324,17,false,'#17345f','center');
    x.fillStyle='#eef8fd';round(x,36,350,648,292,18);
    x.strokeStyle='#087bd1';x.lineWidth=3;x.beginPath();x.arc(68,382,8,0,Math.PI*2);x.moveTo(54,407);x.quadraticCurveTo(68,392,82,407);x.stroke();txt(x,'Cliente',94,382,13,false,'#6b737b');txt(x,c?.name||'Cliente',94,407,19,true);
    x.strokeStyle='#087bd1';x.lineWidth=3;x.strokeRect(58,443,20,20);x.beginPath();x.moveTo(63,453);x.lineTo(73,453);x.moveTo(68,448);x.lineTo(68,458);x.stroke();txt(x,'Monto recibido',94,443,13,false,'#6b737b');txt(x,money(p?.amount),94,474,28,true,'#087bd1');
    x.strokeStyle='#087bd1';x.lineWidth=3;x.strokeRect(58,514,22,20);x.beginPath();x.moveTo(58,521);x.lineTo(80,521);x.stroke();txt(x,'Fecha de pago',94,514,13,false,'#6b737b');txt(x,fmt(p?.date),94,539,18,true);const due=receiptInstallmentDate(p,cr);if(due){txt(x,'Cuota correspondiente a',390,514,13,false,'#6b737b');txt(x,fmt(due),390,539,18,true);}
    x.strokeStyle='#087bd1';x.lineWidth=3;x.strokeRect(58,573,22,18);x.beginPath();x.moveTo(63,579);x.lineTo(75,579);x.moveTo(63,585);x.lineTo(72,585);x.stroke();txt(x,'Concepto',94,573,13,false,'#6b737b');txt(x,receiptInstallmentLabel(p,cr),94,598,18,true);
    if(t){txt(x,'Total del crédito',390,443,13,false,'#6b737b');txt(x,money(t.total),390,472,20,true,'#087bd1');txt(x,'Saldo actual',390,514,13,false,'#6b737b');txt(x,money(t.balance),390,543,20,true,'#b83232');}
    x.fillStyle='#edf9f0';round(x,36,666,648,112,18);x.strokeStyle='#187536';x.lineWidth=3;x.beginPath();x.moveTo(70,725);x.lineTo(70,694);x.quadraticCurveTo(52,699,56,684);x.quadraticCurveTo(72,684,70,701);x.quadraticCurveTo(87,697,88,682);x.quadraticCurveTo(71,684,70,706);x.stroke();txt(x,'Tus pagos puntuales nos ayudan a mantener tu crédito disponible',102,704,14,true,'#187536');txt(x,'y seguir creciendo juntos.',102,734,16,true,'#187536');
    txt(x,'¡Gracias por tu confianza!',360,835,19,true,'#087bd1','center');txt(x,'PRÉSTAMO YA · CONFIANZA · COMPROMISO · TU PROGRESO',360,884,11,true,'#087bd1','center');
    x.fillStyle='#1197dc';x.beginPath();x.moveTo(18,920);x.quadraticCurveTo(180,965,360,930);x.quadraticCurveTo(540,895,702,940);x.lineTo(702,1018);x.quadraticCurveTo(520,985,360,1012);x.quadraticCurveTo(180,1040,18,1002);x.closePath();x.fill();
    txt(x,'Tu pago nos acerca a nuevas oportunidades.',360,974,14,true,'#fff','center');
    return blob(cv);
  }
  function reminder(d,c){
    const cv=document.createElement('canvas');cv.width=720;cv.height=1080;const x=cv.getContext('2d'),due=D.normalize?.(d?.date)||String(d?.date||'').slice(0,10),today=D.today?.()||localToday(),overdue=Boolean(due&&due<today),state=overdue?'VENCIDA':'PENDIENTE';
    x.fillStyle='#f8fcff';x.fillRect(0,0,720,1080);x.fillStyle='#1197dc';round(x,18,18,684,126,18);txt(x,'▱  PRÉSTAMO YA',42,62,29,true,'#fff');txt(x,'Tu aliado en soluciones financieras',42,91,14,false,'#fff');txt(x,'RECORDATORIO DE PAGO',42,123,16,true,'#fff');
    x.fillStyle='#e8f5fb';x.beginPath();x.arc(360,210,43,0,Math.PI*2);x.fill();x.strokeStyle='#087bd1';x.lineWidth=4;x.beginPath();x.arc(360,208,18,Math.PI,0);x.moveTo(342,208);x.lineTo(342,226);x.lineTo(378,226);x.lineTo(378,208);x.moveTo(353,232);x.quadraticCurveTo(360,240,367,232);x.stroke();txt(x,'Recordatorio de tu cuota',360,270,27,true,'#17345f','center');txt(x,'Estamos para ayudarte a mantener tu crédito al día.',360,305,15,false,'#17345f','center');
    x.fillStyle='#eef8fd';round(x,36,340,648,118,18);txt(x,'Cliente',58,375,13,false,'#6b737b');txt(x,c?.name||d?.clientName||'Cliente',58,405,20,true);if(c?.phone)txt(x,'Tel. '+c.phone,430,405,14,false,'#17345f');
    x.fillStyle='#fff5f3';round(x,36,486,648,190,18);txt(x,'Monto pendiente',58,526,13,false,'#6b737b');txt(x,money(d?.amount),58,562,29,true,'#b83232');txt(x,'Fecha de vencimiento',390,526,13,false,'#6b737b');txt(x,fmt(d?.date),390,558,19,true);txt(x,'Estado',58,618,13,false,'#6b737b');txt(x,state,58,648,19,true,overdue?'#b83232':'#087bd1');txt(x,'Tipo',390,618,13,false,'#6b737b');txt(x,'CUOTA',390,648,18,true);
    x.fillStyle='#edf9f0';round(x,36,712,648,126,18);x.strokeStyle='#187536';x.lineWidth=3;x.beginPath();x.moveTo(70,770);x.lineTo(70,742);x.quadraticCurveTo(52,746,55,730);x.quadraticCurveTo(72,730,70,748);x.quadraticCurveTo(88,744,88,728);x.quadraticCurveTo(70,730,70,752);x.stroke();txt(x,'Mantener tus pagos al día fortalece tu historial',102,752,15,true,'#187536');txt(x,'y nos permite seguir acompañándote con tu crédito.',102,780,15,true,'#187536');txt(x,'Si ya realizaste el pago, puedes ignorar este recordatorio.',102,814,12,false,'#4b6b58');
    txt(x,'¡Gracias por tu confianza!',360,914,19,true,'#087bd1','center');txt(x,'PRÉSTAMO YA · CONFIANZA · COMPROMISO · TU PROGRESO',360,950,11,true,'#087bd1','center');x.fillStyle='#1197dc';x.beginPath();x.moveTo(18,980);x.quadraticCurveTo(180,1020,360,992);x.quadraticCurveTo(540,964,702,1004);x.lineTo(702,1062);x.lineTo(18,1062);x.closePath();x.fill();return blob(cv);
  }
  function blob(cv){
    return new Promise((resolve,reject)=>{
      try{
        if(typeof cv.toBlob==='function'){
          cv.toBlob(b=>b?resolve(b):reject(new Error('CANVAS_BLOB_EMPTY')),'image/png');
          return;
        }
        const data=cv.toDataURL('image/png'),parts=data.split(','),bin=atob(parts[1]),bytes=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
        resolve(new Blob([bytes],{type:'image/png'}));
      }catch(e){reject(e)}
    })
  }
  root.MiCarteraV2ShareCard={proposal,credit,receipt,reminder,money,fmt,installmentStatus,creditTotals,receiptInstallmentLabel,receiptInstallmentDate};
})(window);
