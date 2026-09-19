// Mi Cartera PRO V2 — pilot activation gate.
// This file contains no credentials and does not connect Firebase by itself.
(function(root){'use strict';
const DEFAULTS=Object.freeze({mode:'VALIDATION',cloudEnabled:false,allowRealWrites:false,orgId:'',requireGreenQa:true});
function normalize(raw){raw=raw||{};return Object.freeze({mode:String(raw.mode||DEFAULTS.mode).toUpperCase(),cloudEnabled:raw.cloudEnabled===true,allowRealWrites:raw.allowRealWrites===true,orgId:String(raw.orgId||'').trim(),requireGreenQa:raw.requireGreenQa!==false});}
function evaluate(raw){const c=normalize(raw),reasons=[];if(c.mode!=='PILOT')reasons.push('MODE_NOT_PILOT');if(!c.cloudEnabled)reasons.push('CLOUD_DISABLED');if(!c.allowRealWrites)reasons.push('REAL_WRITES_DISABLED');if(!c.orgId)reasons.push('ORG_ID_REQUIRED');if(c.orgId&&!/^v2-/.test(c.orgId))reasons.push('V2_NAMESPACE_REQUIRED');if(c.orgId==='mi-cartera')reasons.push('V1_NAMESPACE_FORBIDDEN');return Object.freeze({ready:reasons.length===0,config:c,reasons:Object.freeze(reasons)});}
const state=evaluate(root.MI_CARTERA_V2_PILOT_CONFIG);
root.MiCarteraV2PilotConfig={defaults:DEFAULTS,normalize,evaluate,state};
})(window);