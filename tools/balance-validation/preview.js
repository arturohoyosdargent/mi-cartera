(function(root){
  'use strict';
  const key = 'mi-cartera-v2-validation-state';
  const uid = 'fictional-balance-validation-admin';
  const grant = {uid,role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
  let reserved = false, business = true;
  root.MiCarteraV2AuthCloudGate = {ORG:'fictional-balance-validation',state:()=>({...grant}),requireReady:()=>({...grant})};
  root.firebaseAuthV2 = {auth:{currentUser:{uid}}};
  root.MiCarteraV2SyncBridge = {status:()=>({configured:false,online:false,pending:0})};
  root.localStorage.setItem('mi-cartera-v2-local-owner',uid);
  function fixture(){
    if(business)return {clients:[{id:'client-fictional',name:'Cliente ficticio'}],
      credits:[{id:'old-fictional',clientId:'client-fictional',date:'2026-10-01',capital:1000,principalPaid:200,status:'RENOVADO',renewedTo:'active-fictional'},
        {id:'active-fictional',clientId:'client-fictional',date:'2026-10-20',capital:800,principalPaid:50,status:'ACTIVO',renewedFrom:'old-fictional',schedule:[
          {id:'due-fictional',date:'2026-10-20',balance:50,amount:100,status:'PENDIENTE'},
          {id:'next-fictional',date:'2026-10-22',balance:775,amount:775,status:'PENDIENTE'}]}],
      payments:[{id:'payment-fictional',operationId:'payment-op-fictional',creditId:'old-fictional',date:'2026-10-19',amount:240,capitalAmount:200,interestAmount:40,penaltyAmount:0},
        {id:'renewal-fictional',operationId:'renewal-op-fictional',creditId:'old-fictional',date:'2026-10-20',amount:60,capitalAmount:0,interestAmount:60,penaltyAmount:0},
        {id:'today-fictional',operationId:'today-op-fictional',creditId:'active-fictional',date:'2026-10-21',amount:55,capitalAmount:50,interestAmount:5,penaltyAmount:0}],
      cashMovements:[
        {id:'opening-fictional',date:'2026-09-30',type:'INGRESO',amount:2000,category:'APORTE_CAPITAL'},
        {id:'disbursement-fictional',date:'2026-10-01',type:'EGRESO',amount:1000,concept:'DESEMBOLSO_CREDITO',ref:'old-fictional'},
        {id:'receipt-fictional',date:'2026-10-19',type:'INGRESO',amount:240,concept:'COBRO_CUOTA',ref:'payment-fictional'},
        {id:'renewal-receipt-fictional',date:'2026-10-20',type:'INGRESO',amount:60,concept:'COBRO_INTERES',ref:'renewal-fictional'},
        {id:'cash-a-payment',date:'2026-10-21',type:'INGRESO',amount:55,concept:'COBRO_CUOTA',ref:'today-fictional'},
        {id:'cash-b-expense',date:'2026-10-21',type:'EGRESO',amount:20,category:'GASTO_OPERATIVO'},
        {id:'cash-c-capital',date:'2026-10-21',type:'INGRESO',amount:300,category:'APORTE_CAPITAL',concept:'Aporte ficticio'},
        {id:'future-expense-fictional',date:'2026-10-22',type:'EGRESO',amount:75,category:'SERVICIOS'}],
      audit:[{id:'audit-capital-fictional',entityType:'CASH',entityId:'cash-c-capital',operationId:'capital-op-fictional',actorId:uid,at:'2026-10-21T10:00:00Z'}],
      session:{actorId:uid,role:'ADMIN'}};
    return {clients:[],credits:[{id:'fictional-credit',date:'2026-10-01',capital:900,principalPaid:0,status:'ACTIVO'}],payments:[],audit:[],session:{actorId:uid,role:'ADMIN'},
      cashMovements:[
        {id:'fictional-funding',date:'2026-10-01',type:'INGRESO',amount:reserved?1200:1000,category:'APORTE_CAPITAL'},
        {id:'fictional-credit-out',date:'2026-10-01',type:'EGRESO',amount:900,concept:'DESEMBOLSO_CREDITO',ref:'fictional-credit'},
        {id:'fictional-cost',date:'2026-10-02',type:'EGRESO',amount:200,category:'GASTO_OPERATIVO'},
        ...(reserved?[{id:'fictional-reservation',date:'2026-11-01',type:'EGRESO',amount:200,category:'SERVICIOS'}]:[])
      ]};
  }
  root.localStorage.setItem(key,JSON.stringify(fixture()));
  function render(){
    root.MiCarteraV2CashMenu.renderSummary();
    root.MiCarteraV2CashMenu.renderHistory();
    root.MiCarteraV2DashboardParity.render();
  }
  function restore(){
    root.firebaseAuthV2.auth.currentUser = {uid};
    root.localStorage.setItem(key,JSON.stringify(fixture()));
    render();
    const fields = {cashSimOperating:200,cashSimPartner:0,cashSimTicket:500,cashSimRate:10,cashSimCollection:100,cashSimLoss:0,cashSimVariable:0,cashSimTarget:100};
    if(!business)for(const [id,value] of Object.entries(fields)) document.getElementById(id).value = String(value);
    document.getElementById('previewStatus').textContent = business ? 'Cartera ficticia: créditos enlazados por renovación, pagos distribuidos, gasto operativo y aporte auditado. Caja S/ 1,635; disponible S/ 1,560; cuotas pendientes S/ 825.' : reserved ? 'Reserva futura: caja física S/ 100, egreso futuro S/ 200, disponible −S/ 100.' : 'Déficit real: caja física y disponible −S/ 100.';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    root.MiCarteraV2Dates.today = () => '2026-10-21';
    document.getElementById('candidateVersion').textContent = document.documentElement.dataset.build;
    root.MiCarteraV2CashMenu.install();
    document.querySelectorAll('[data-fixture]').forEach(button=>{button.onclick=()=>{business=button.dataset.fixture==='business';reserved=button.dataset.fixture==='reservation';restore();};});
    document.getElementById('previewSignOut').onclick = () => {
      root.firebaseAuthV2.auth.currentUser = null;
      render();
      document.getElementById('previewStatus').textContent = 'Identidad nativa cerrada; autorización ficticia en caché aún presente. Los saldos y el simulador deben estar ocultos.';
    };
    document.getElementById('previewRestore').onclick = restore;
    restore();
  });
})(window);
