(function(root){
  'use strict';
  const key = 'mi-cartera-v2-validation-state';
  const uid = 'fictional-balance-validation-admin';
  const grant = {uid,role:'admin',ready:true,authenticated:true,member:true,routeIds:[]};
  let reserved = false;
  root.MiCarteraV2AuthCloudGate = {ORG:'fictional-balance-validation',state:()=>({...grant}),requireReady:()=>({...grant})};
  root.firebaseAuthV2 = {auth:{currentUser:{uid}}};
  root.MiCarteraV2SyncBridge = {status:()=>({configured:false,online:false,pending:0})};
  root.localStorage.setItem('mi-cartera-v2-local-owner',uid);
  function fixture(){
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
    for(const [id,value] of Object.entries(fields)) document.getElementById(id).value = String(value);
    document.getElementById('previewStatus').textContent = reserved ? 'Reserva futura: caja física S/ 100, egreso futuro S/ 200, disponible −S/ 100.' : 'Déficit real: caja física y disponible −S/ 100.';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    root.MiCarteraV2Dates.today = () => '2026-10-21';
    document.getElementById('candidateVersion').textContent = document.documentElement.dataset.build;
    root.MiCarteraV2CashMenu.install();
    document.querySelectorAll('[data-fixture]').forEach(button=>{button.onclick=()=>{reserved=button.dataset.fixture==='reservation';restore();};});
    document.getElementById('previewSignOut').onclick = () => {
      root.firebaseAuthV2.auth.currentUser = null;
      render();
      document.getElementById('previewStatus').textContent = 'Identidad nativa cerrada; autorización ficticia en caché aún presente. Los saldos y el simulador deben estar ocultos.';
    };
    document.getElementById('previewRestore').onclick = restore;
    restore();
  });
})(window);
