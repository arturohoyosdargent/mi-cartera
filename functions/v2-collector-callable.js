'use strict';
const {createCollectorPaymentService}=require('./v2-collector-payment');
function businessDate(timestamp){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));const get=type=>parts.find(part=>part.type===type).value;return get('year')+'-'+get('month')+'-'+get('day')}
function createCollectorCallable({db,HttpsError}){
 const service=createCollectorPaymentService({businessDate,runAtomic:fn=>db.runTransaction(async native=>{
  const ref=path=>db.doc(path);
  return fn({get:async path=>{const snapshot=await native.get(ref(path));return snapshot.exists?snapshot.data():null},set:async(path,data)=>{native.set(ref(path),data)},create:async(path,data)=>{native.create(ref(path),data)}});
 })});
 return async request=>{
  try{return await service.execute({uid:request.auth?.uid},request.data)}
  catch(error){const codes=['unauthenticated','invalid-argument','permission-denied','failed-precondition','already-exists'];throw new HttpsError(codes.includes(error?.code)?error.code:'internal',codes.includes(error?.code)?error.message:'No se pudo confirmar el pago. Vuelve a intentarlo con la misma operación.')}
 };
}
module.exports={createCollectorCallable,businessDate};
