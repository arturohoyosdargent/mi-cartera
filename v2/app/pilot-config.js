// Mi Cartera PRO V2 — activation + commercial tenant configuration.
(function(root){'use strict';
const TENANT_KEY='mi-cartera-v2-tenant';
const DEFAULTS=Object.freeze({mode:'VALIDATION',cloudEnabled:false,allowRealWrites:false,orgId:'',requireGreenQa:true});
function cleanOrg(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,64)}
function requestedOrg(){try{const q=new URLSearchParams(root.location.search).get('org');if(q){const o=cleanOrg(q);if(o)localStorage.setItem(TENANT_KEY,o);return o}return cleanOrg(localStorage.getItem(TENANT_KEY))}catch{return ''}}
function setTenant(orgId){const o=cleanOrg(orgId);if(!o)throw new Error('ORG_ID_REQUIRED');if(o==='mi-cartera')throw new Error('LEGACY_NAMESPACE_FORBIDDEN');localStorage.setItem(TENANT_KEY,o);return o}
function normalize(raw){raw=raw||{};return Object.freeze({mode:String(raw.mode||DEFAULTS.mode).toUpperCase(),cloudEnabled:raw.cloudEnabled===true,allowRealWrites:raw.allowRealWrites===true,orgId:cleanOrg(raw.orgId||requestedOrg()),requireGreenQa:raw.requireGreenQa!==false});}
function evaluate(raw){const c=normalize(raw),reasons=[];if(!['PILOT','COMMERCIAL'].includes(c.mode))reasons.push('MODE_NOT_ACTIVE');if(!c.cloudEnabled)reasons.push('CLOUD_DISABLED');if(!c.allowRealWrites)reasons.push('REAL_WRITES_DISABLED');if(!c.orgId)reasons.push('ORG_ID_REQUIRED');if(c.orgId==='mi-cartera')reasons.push('V1_NAMESPACE_FORBIDDEN');if(c.orgId&&c.orgId!=='mi-cartera'&&!c.orgId.startsWith('v2-'))reasons.push('V2_NAMESPACE_REQUIRED');return Object.freeze({ready:reasons.length===0,config:c,reasons:Object.freeze(reasons)});}
const state=evaluate(root.MI_CARTERA_V2_PILOT_CONFIG);
root.MiCarteraV2PilotConfig={defaults:DEFAULTS,normalize,evaluate,state,requestedOrg,setTenant,TENANT_KEY};
})(window);