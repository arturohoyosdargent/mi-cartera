'use strict';
function operation(){return {id:'native-op',type:'PAYMENT',actorId:'fake-admin',createdAt:'2026-10-19T00:00:00Z',writes:[
 {kind:'set',path:'credits/c1',expectedVersion:1,data:{id:'c1',clientId:'client1',routeId:'r1',capital:100,total:120,principalPaid:33.33,interestPaid:6.67,penaltyPaid:0,status:'ACTIVO',version:2,schedule:[{number:1,date:'2026-10-19',amount:30,paid:30,balance:0,status:'PAGADA'},{number:2,date:'2026-10-20',amount:50,paid:10,balance:40,status:'PARCIAL'},{number:3,date:'2026-10-21',amount:40,paid:0,balance:40,status:'PENDIENTE'}]}},
 {kind:'create',path:'payments/p1',expectedVersion:0,data:{id:'p1',creditId:'c1',clientId:'client1',routeId:'r1',userId:'fake-admin',workerId:'',workerAttribution:{source:'CREDIT_ASSIGNMENT_AT_PAYMENT'},amount:40,date:'2026-10-19',concept:'CUOTA',capitalAmount:33.33,interestAmount:6.67,penaltyAmount:0,operationId:'native-op',version:1}},
 {kind:'create',path:'entries/e1',expectedVersion:0,data:{id:'e1',ref:'p1',amount:40,date:'2026-10-19',type:'INGRESO',concept:'COBRO_CUOTA',routeId:'r1',version:1}},
 {kind:'create',path:'audit/a1',expectedVersion:0,data:{id:'a1',actorId:'fake-admin',role:'admin',action:'PAYMENT',entityType:'PAYMENT',entityId:'p1',operationId:'native-op',at:'2026-10-19T00:00:00Z',detail:{amount:40},version:1}}
 ]}}

module.exports={operation};
