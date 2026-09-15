// Préstamo Ya — defensa de sesión ante datos Cloud parciales v1
(function(){
  'use strict';
  if(window.__prestamoYaCurrentUserGuardV1)return;
  window.__prestamoYaCurrentUserGuardV1=true;
  const fallback={id:'u-admin',name:'Administrador',role:'admin',active:true};
  const safeUsers=()=>{
    try{
      if(typeof db!=='undefined'){
        if(!Array.isArray(db.users))db.users=[];
        if(!db.users.length)db.users.push({...fallback});
        if(!db.currentUserId)db.currentUserId='u-admin';
        window.db=db;
        return db.users;
      }
    }catch(e){console.warn('Préstamo Ya · normalización de usuarios',e)}
    if(window.db&&typeof window.db==='object'){
      if(!Array.isArray(window.db.users))window.db.users=[];
      if(!window.db.users.length)window.db.users.push({...fallback});
      if(!window.db.currentUserId)window.db.currentUserId='u-admin';
      return window.db.users;
    }
    return [fallback];
  };
  window.currentUser=function(){
    const users=safeUsers();
    let id='u-admin';
    try{id=(typeof currentUserId!=='undefined'&&currentUserId)||window.db?.currentUserId||'u-admin'}catch(_){}
    return users.find(u=>String(u?.id)===String(id))||users[0]||fallback;
  };
  safeUsers();
})();
