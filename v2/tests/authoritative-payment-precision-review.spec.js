'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCollectorPaymentService}=require('../../functions/v2-collector-payment');
const {businessDate}=require('../../functions/v2-collector-callable');

// Removing exact cent validation must never create a positive sub-cent mora journal.
test('a positive mora smaller than one cent is rejected before any financial write',async()=>{
 const prefix='orgs/v2-mi-cartera-pilot/',documents=new Map([
  [prefix+'members/admin',{active:true,role:'admin'}],
  [prefix+'credits/credit',{id:'credit',clientId:'client',routeId:'route',workerId:'worker',capital:100,total:120,principalPaid:0,interestPaid:0,penaltyPaid:0,status:'ACTIVO',version:1,schedule:[{number:1,date:'2026-10-12',amount:120,paid:0,balance:120}]}]
 ]);
 const before=structuredClone([...documents]);
 const service=createCollectorPaymentService({businessDate,now:()=> '2026-10-14T05:00:00.000Z',runAtomic:async callback=>callback({get:async path=>structuredClone(documents.get(path)||null),set:async(path,value)=>documents.set(path,structuredClone(value)),create:async(path,value)=>documents.set(path,structuredClone(value))})});
 await assert.rejects(service.execute({uid:'admin'},{creditId:'credit',paymentId:'payment',operationId:'operation',amount:20,expectedVersion:1,moraAmount:0.0000000001,moraPaymentId:'mora'}),error=>error.code==='invalid-argument');
 assert.deepEqual([...documents],before);
});
