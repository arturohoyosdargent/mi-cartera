const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Exercise the real renderer. Only Canvas/PNG output is fictional in Node.
function renderer(){
  const drawings=[],canvases=[];
  const document={createElement(tag){
    assert.equal(tag,'canvas');
    const context=new Proxy({
      fillText(text,x,y){drawings.push({text:String(text),x,y,font:this.font});},
      fillRect(x,y,width,height){drawings.push({rect:true,x,y,width,height});}
    },{get:(target,key)=>key in target?target[key]:(()=>{})});
    const canvas={width:0,height:0,getContext:()=>context,toBlob:callback=>callback(new Blob(['fictional-png'],{type:'image/png'}))};
    canvases.push(canvas);return canvas;
  }};
  const window={};
  const source=fs.readFileSync(path.resolve(process.env.SOURCE||'v2','app/share-card-renderer-v2.js'),'utf8');
  vm.runInNewContext(source,{window,document,Blob});
  return {api:window.MiCarteraV2ShareCard,drawings,canvases};
}

const fictionalProposal=()=>({kind:'renewal',renewalMode:'REFINANCE',capital:600,total:720,rate:20,
  term:4,freq:'weekly',first:'2026-10-16',installment:100,previousBalance:400,netDisbursement:200,
  schedule:[
    {number:1,date:'2026-10-16',amount:100},
    {number:2,date:'2026-10-23',amount:100},
    {number:3,date:'2026-10-30',amount:100},
    {number:4,date:'2026-11-06',amount:100},
    {number:'A1',date:'2026-11-11',amount:320,extra:true,type:'ADICIONAL',paymentType:'ADICIONAL'}
  ]});

test('WhatsApp contenido: renewal PNG includes the fifth additional installment and preserves its financial summary',async()=>{
  const h=renderer(),proposal=fictionalProposal(),before=JSON.stringify(proposal);
  const blob=await h.api.proposal(proposal,{name:'Cliente de prueba ficticio'});
  const text=h.drawings.filter(row=>!row.rect),additional=text.find(row=>row.text==='A1');
  assert.ok(additional,'the real renewal graphic must include its fifth A1 row');
  assert.ok(text.some(row=>row.text==='ADICIONAL'&&row.y===additional.y));
  assert.ok(text.some(row=>row.text==='S/ 320.00'&&row.y===additional.y));
  assert.ok(text.some(row=>row.text==='S/ 320.00'&&row.x===550&&row.y===additional.y),'the additional installment retains its full pending balance');
  assert.ok(text.some(row=>/4 cuotas normales\s*\+\s*1 adicional/.test(row.text)));
  assert.ok(text.some(row=>row.text==='Próximas 5 de 5 cuotas pendientes'));
  assert.ok(text.some(row=>row.text==='Cuotas pagadas: 0 de 5'));
  assert.ok(text.some(row=>row.text==='S/ 0.00'&&row.x===58&&row.y===849),'the full paid total remains zero');
  assert.ok(text.some(row=>row.text==='S/ 720.00'&&row.x===390&&row.y===849),'the full outstanding total includes the additional installment');
  assert.ok(text.some(row=>row.text==='Neto a desembolsar'));
  assert.ok(text.some(row=>row.text==='S/ 200.00'));
  assert.ok(text.some(row=>row.text==='S/ 720.00'));
  assert.equal(blob.type,'image/png');assert.equal(JSON.stringify(proposal),before);
});

test('WhatsApp contenido: up to six pending renewal installments stay above the footer as its canvas grows',async()=>{
  for(const count of [5,12]){
    const h=renderer(),proposal=fictionalProposal();
    if(count===12){proposal.term=12;proposal.total=1200;proposal.schedule=Array.from({length:12},(_,i)=>({number:i+1,date:'2026-12-01',amount:100}));}
    await h.api.proposal(proposal,{name:'Cliente geométrico ficticio'});
    const rows=h.drawings.filter(row=>!row.rect&&row.x===58&&/^([1-9]\d*|A1)$/.test(row.text));
    assert.deepEqual(rows.map(row=>row.text),count===5?['1','2','3','4','A1']:['1','2','3','4','5','6'],'the six oldest pending installments are drawn');
    assert.ok(h.drawings.some(row=>row.text===`Próximas ${Math.min(6,count)} de ${count} cuotas pendientes`));
    assert.ok(h.drawings.some(row=>row.text===`Cuotas pagadas: 0 de ${count}`));
    assert.ok(h.drawings.some(row=>row.text==='S/ 0.00'&&row.x===58&&row.y===849),'the full paid total remains zero');
    assert.ok(h.drawings.some(row=>row.text===(count===5?'S/ 720.00':'S/ 1,200.00')&&row.x===390&&row.y===849),'the outstanding total includes installments beyond the displayed six');
    const lastRow=rows.at(-1),thanks=h.drawings.find(row=>row.text==='¡Gracias por tu confianza!');
    assert.ok(thanks.y-lastRow.y>=30,'footer text must remain below the last installment');
    const bar=h.drawings.find(row=>row.rect&&row.x===18&&row.width===684&&row.height===28);
    assert.ok(bar.y>thanks.y);assert.ok(bar.y+bar.height<=h.canvases[0].height);
    assert.ok(h.canvases[0].height>1080,'schedules longer than four rows need a taller image');
    assert.ok(h.drawings.some(row=>row.rect&&row.x===0&&row.y===0&&row.height===h.canvases[0].height),'background must cover the complete image');
  }
});
