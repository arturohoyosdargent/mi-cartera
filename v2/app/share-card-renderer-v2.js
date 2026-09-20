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
  function round(x,a,b,w,h,r){x.beginPath();x.roundRect(a,b,w,h,r);x.fill()}
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
  function proposal(d,c){
    const {cv,x}=canvas('PROPUESTA DE CRÉDITO','¡Estamos listos para apoyarte!',c||d.client);
    metric(x,'Monto del crédito',money(d.capital),0,0);
    metric(x,'Cuota referencial',money(d.installment),1,0);
    metric(x,'Plazo',`${d.term} cuotas`,0,1);
    metric(x,'Total a pagar',money(d.total),1,1);
    metric(x,'Tasa de interés',`${Number(d.rate||0)}%`,0,2);
    metric(x,'Fecha de inicio',fmt(d.first),1,2);
    x.fillStyle='#e8f5fb';round(x,38,615,824,94,18);
    txt(x,'Tu esfuerzo hoy construye un mejor futuro.',62,655,21,true,'#17345f');
    txt(x,'Pequeños pasos, grandes logros.',62,684,16,false,'#17345f');
    txt(x,'Primeras cuotas',62,760,23,true);
    txt(x,'#',65,805,15,true);txt(x,'Fecha',130,805,15,true);txt(x,'Cuota',430,805,15,true);txt(x,'Saldo',690,805,15,true);
    const fallbackRows=Array.from({length:Math.max(0,Number(d.term)||0)},(_,i)=>({number:i+1,date:advance(d.first,i,d.freq),amount:i===Number(d.term)-1?Math.max(0,Number(d.total||0)-Number(d.installment||0)*Math.max(0,Number(d.term)-1)):Number(d.installment||0)}));
    const rows=Array.isArray(d.schedule)&&d.schedule.length?d.schedule:fallbackRows;
    let saldo=Number(d.total||0);
    rows.slice(0,6).forEach((q,i)=>{
      saldo=Math.max(0,saldo-Number(q.amount||0));const y=850+i*50,label=q.number??q.n??i+1;
      txt(x,label,65,y,15);txt(x,fmt(q.date),130,y,15);txt(x,money(q.amount),430,y,15,false,q.extra?'#b83232':'#087bd1');txt(x,money(saldo),690,y,15);
    });
    footer(x);return blob(cv);
  }
  function advance(first,i,freq){
    if(!i)return first;
    const p=root.MiCarteraV2CreditFormParity;
    if(freq==='monthly')return p?.addMonths?.(first,i)||first;
    return p?.addDays?.(first,i*({daily:1,weekly:7,biweekly:14}[freq]||1))||first;
  }
  function credit(cr,c){
    const {cv,x}=canvas('DETALLE DEL CRÉDITO','Consulta el estado de tu crédito',c),t=creditTotals(cr);
    metric(x,'Capital',money(cr.capital),0,0);
    metric(x,'Interés',`${Number(cr.rate||0)}%`,1,0);
    metric(x,'Total',money(t.total),0,1);
    metric(x,'Pagado',money(t.paid),1,1);
    metric(x,'Saldo',money(t.balance),0,2,'#b83232');
    metric(x,'Vencimiento',fmt(cr.maturityDate||cr.endDate),1,2);
    txt(x,'Cronograma',62,655,23,true);
    txt(x,'#',55,700,15,true);txt(x,'Fecha',105,700,15,true);txt(x,'Cuota',320,700,15,true);txt(x,'Saldo',520,700,15,true);txt(x,'Estado',690,700,15,true);
    (cr.schedule||[]).slice(0,8).forEach((q,i)=>{
      const y=745+i*48,s=installmentStatus(q),label=q.number??q.n??i+1;
      txt(x,label,55,y,14);txt(x,fmt(D.fromInstallment?.(q)||q.date),105,y,14);txt(x,money(q.amount),320,y,14,false,q.extra?'#b83232':'#087bd1');txt(x,money(D.balance?.(q)??q.balance??q.amount),520,y,14);txt(x,s,690,y,13,true,s==='PAGADA'?'#187536':'#b83232');
    });
    footer(x);return blob(cv);
  }
  function receipt(p,c,cr){
    const {cv,x}=canvas('COMPROBANTE DE PAGO','Tu pago fue registrado correctamente',c);
    x.fillStyle='#e8f5fb';round(x,38,322,824,170,18);
    txt(x,'MONTO RECIBIDO',62,365,17,true,'#6b737b');txt(x,money(p?.amount),62,425,42,true,'#087bd1');
    txt(x,'Fecha',510,365,15,false,'#6b737b');txt(x,fmt(p?.date),510,400,22,true);
    txt(x,'Concepto',510,442,15,false,'#6b737b');txt(x,p?.concept||'PAGO',510,477,20,true);
    if(cr){const t=creditTotals(cr);metric(x,'Total del crédito',money(t.total),0,3);metric(x,'Saldo actual',money(t.balance),1,3,'#b83232');}
    else {metric(x,'Estado','PAGO CONFIRMADO',0,3,'#187536');}
    const firstName=String(c?.name||'').trim().split(/\s+/)[0]||'cliente';
    x.fillStyle='#e8f5fb';round(x,38,800,824,145,18);txt(x,`¡Gracias, ${firstName}!`,62,842,25,true,'#187536');txt(x,`Hemos recibido tu pago de ${money(p?.amount)} del ${fmt(p?.date)}.`,62,880,17,false);txt(x,'Gracias por tu puntualidad y confianza en PRÉSTAMO YA.',62,914,17,true,'#17345f');
    footer(x);return blob(cv);
  }
  function reminder(d,c){
    const {cv,x}=canvas('RECORDATORIO DE PAGO','Un formato claro para mantener tu crédito al día',c);
    const due=D.normalize?.(d?.date)||String(d?.date||'').slice(0,10);
    const today=D.today?.()||new Date().toISOString().slice(0,10);
    const overdue=Boolean(due&&due<today);
    const state=overdue?'VENCIDA':'PENDIENTE';
    const stateColor=overdue?'#b83232':'#087bd1';
    metric(x,'Cuota pendiente',money(d?.amount),0,0,'#b83232');
    metric(x,'Vencimiento',fmt(d?.date),1,0,'#17345f');
    metric(x,'Estado',state,0,1,stateColor);
    metric(x,'Tipo','Recordatorio',1,1,'#087bd1');

    x.fillStyle='#e8f5fb';round(x,38,548,824,112,18);
    txt(x,'Recuerda realizar tu pago a tiempo.',62,592,22,true,'#17345f');
    txt(x,overdue?'Tu cuota figura vencida.':'Pequeños pagos, grandes metas.',62,625,16,false,'#17345f');

    txt(x,'Detalle del pago',62,710,23,true);
    x.fillStyle='#e8f5fb';round(x,38,735,824,170,18);
    txt(x,'Concepto',62,775,15,true);txt(x,'Importe',430,775,15,true);txt(x,'Fecha',690,775,15,true);
    txt(x,'Cuota pendiente',62,825,15);txt(x,money(d?.amount),430,825,15,false,'#b83232');txt(x,fmt(d?.date),690,825,15);

    x.fillStyle='#fff';round(x,38,930,824,150,18);
    txt(x,'¿Necesitas ayuda?',62,975,22,true,'#087bd1');
    txt(x,'Comunícate con nosotros por WhatsApp para cualquier consulta.',62,1015,17,false,'#17345f');
    txt(x,'PRÉSTAMO YA está contigo en cada paso.',62,1050,17,true,'#187536');
    footer(x);return blob(cv);
  }
  function blob(cv){return new Promise(r=>cv.toBlob(r,'image/png'))}
  root.MiCarteraV2ShareCard={proposal,credit,receipt,reminder,money,fmt,installmentStatus,creditTotals};
})(window);
