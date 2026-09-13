// Préstamo Ya — eliminación manual controlada de un crédito
(()=>{

'use strict';

if(window.__prestamoYaManualDelete)return;
window.__prestamoYaManualDelete=true;

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[m]));

const getCredit=id=>
  (window.db?.credits||[]).find(c=>String(c.id)===String(id));

const getClient=cr=>
  (window.db?.clients||[]).find(c=>String(c.id)===String(cr?.clientId));

const getPayments=cr=>
  (window.db?.payments||[]).filter(
    p=>String(p.creditId)===String(cr?.id)
  );

const notify=msg=>{
  try{
    if(typeof window.toast==='function') window.toast(msg);
    else alert(msg);
  }catch(_){
    alert(msg);
  }
};

async function deleteCredit(id){

  const cr=getCredit(id);

  if(!cr){
    notify('❌ Crédito no encontrado.');
    return;
  }

  const client=getClient(cr);
  const payments=getPayments(cr);

  if(payments.length){
    notify(
      '❌ Este crédito tiene '+payments.length+
      ' pago(s) asociado(s). Por seguridad no se puede eliminar.'
    );
    return;
  }

  const user=
    typeof window.currentUser==='function'
      ? window.currentUser()
      : null;

  const role=user?.role || '';

  if(!['admin','supervisor'].includes(role)){
    notify('❌ Solo Administrador o Supervisor puede eliminar créditos.');
    return;
  }

  const clientName=client?.name || 'Cliente no vinculado';

  const ok=confirm(
`⚠️ ELIMINAR CRÉDITO

Crédito: #${cr.id}
Cliente: ${clientName}
Capital: S/ ${Number(cr.capital||0).toFixed(2)}
Total: S/ ${Number(cr.total||0).toFixed(2)}

Se eliminará ÚNICAMENTE este crédito.

NO se eliminará:
• el cliente
• otros créditos
• otros clientes

Esta operación es para poder crear nuevamente el crédito desde cero.

¿CONFIRMAR ELIMINACIÓN?`
  );

  if(!ok)return;

  try{

    /*
      1. ELIMINACIÓN LOCAL
    */

    const index=
      (window.db.credits||[]).findIndex(
        x=>String(x.id)===String(cr.id)
      );

    if(index>=0){
      window.db.credits.splice(index,1);
    }

    /*
      2. ELIMINAR PAGOS LOCALES DEL CRÉDITO
         En condiciones normales serán cero porque
         arriba bloqueamos créditos con pagos.
    */

    if(Array.isArray(window.db.payments)){
      window.db.payments=
        window.db.payments.filter(
          p=>String(p.creditId)!==String(cr.id)
        );
    }

    /*
      3. PERSISTIR LOCALMENTE
    */

    if(typeof window.persist==='function'){
      await window.persist();
    }

    /*
      4. ELIMINACIÓN FIRESTORE
         Usa la sesión Firebase existente.
    */

    let cloudDeleted=false;

    try{

      const firebaseApp=
        await import(
          'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'
        );

      const firebaseAuth=
        await import(
          'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'
        );

      const firebaseFirestore=
        await import(
          'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'
        );

      const apps=firebaseApp.getApps();

      if(apps.length){

        const app=firebaseApp.getApp();

        const auth=firebaseAuth.getAuth(app);

        const current=auth.currentUser;

        if(!current){
          throw new Error('Sin sesión Firebase.');
        }

        const fs=firebaseFirestore.getFirestore(app);

        const cfg=window.MI_CARTERA_CLOUD||{
          orgId:'mi-cartera'
        };

        const orgId=cfg.orgId||'mi-cartera';

        await firebaseFirestore.deleteDoc(
          firebaseFirestore.doc(
            fs,
            `orgs/${orgId}/credits`,
            String(cr.id)
          )
        );

        cloudDeleted=true;
      }

    }catch(cloudError){

      console.error(
        'Préstamo Ya · eliminación Cloud:',
        cloudError
      );

      /*
        Restauramos el crédito local si Cloud no pudo
        eliminarlo. Así no queda la cartera inconsistente.
      */

      if(index>=0){
        window.db.credits.splice(index,0,cr);
      }

      if(typeof window.persist==='function'){
        await window.persist();
      }

      notify(
        '❌ Cloud rechazó la eliminación. '+
        'El crédito NO fue eliminado localmente.'
      );

      return;
    }

    /*
      5. AUDITORÍA
    */

    try{
      if(typeof window.audit==='function'){
        window.audit(
          'CREDITO_ELIMINADO_MANUAL',
          '#'+cr.id+' · '+clientName
        );
      }
    }catch(_){}

    /*
      6. REFRESCAR PANTALLA
    */

    try{
      if(typeof window.renderAll==='function'){
        window.renderAll();
      }
    }catch(_){}

    notify(
      '✅ Crédito eliminado correctamente. '+
      'El cliente se conservó.'
    );

    /*
      7. VOLVER A CRÉDITOS
    */

    setTimeout(()=>{
      try{
        if(typeof window.go==='function'){
          window.go('credits');
        }
      }catch(_){}
    },500);

  }catch(error){

    console.error(
      'Préstamo Ya · eliminar crédito:',
      error
    );

    notify(
      '❌ No se pudo eliminar el crédito: '+
      (error?.message||'Error desconocido')
    );
  }
}

window.__prestamoYaDeleteCredit=deleteCredit;


/*
========================================================
BOTÓN "ELIMINAR ESTE CRÉDITO"
========================================================
*/

function addDeleteButtons(){

  try{

    const cards=
      document.querySelectorAll('#creditsList .card');

    cards.forEach(card=>{

      if(card.dataset.manualDeleteAdded==='1')return;

      const buttons=
        card.querySelectorAll('button');

      let creditId=null;

      buttons.forEach(btn=>{

        const onclick=
          btn.getAttribute('onclick')||'';

        const match=
          onclick.match(
            /(?:showCredit|openCollect|editCredit)\(\s*['"]?([^'")]+)/
          );

        if(match&&!creditId){
          creditId=match[1];
        }
      });

      if(!creditId)return;

      const cr=getCredit(creditId);

      if(!cr)return;

      const user=
        typeof window.currentUser==='function'
          ? window.currentUser()
          : null;

      if(!['admin','supervisor'].includes(user?.role)){
        return;
      }

      const del=document.createElement('button');

      del.type='button';
      del.className='btn red';

      del.textContent='🗑️ Eliminar este crédito';

      del.style.marginTop='8px';
      del.style.width='100%';

      del.onclick=()=>{
        window.__prestamoYaDeleteCredit(cr.id);
      };

      card.appendChild(del);

      card.dataset.manualDeleteAdded='1';

    });

  }catch(error){

    console.warn(
      'Préstamo Ya · botones eliminar:',
      error
    );

  }
}


/*
========================================================
ACTUALIZACIÓN AUTOMÁTICA DE LA LISTA
========================================================
*/

function install(){

  addDeleteButtons();

  setTimeout(addDeleteButtons,500);
  setTimeout(addDeleteButtons,1500);
  setTimeout(addDeleteButtons,3000);

}

install();

new MutationObserver(()=>{
  addDeleteButtons();
}).observe(
  document.documentElement,
  {
    childList:true,
    subtree:true
  }
);

})();
