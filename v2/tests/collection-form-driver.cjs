'use strict';
// Explicit UI driver for existing durable-action regression cases.
// No prompt/confirm stub and no automatic acceptance inside the application.
function beginCollection(h,creditId,amount='40',{beforeConfirm}={}){
 const pending=h.w.V2UI.collect(creditId),doc=h.w.document,form=doc.getElementById('v2CollectionForm');
 if(!form)return pending; // Existing scope/active-credit guards may reject before opening.
 if(amount===null){form.querySelector('#v2CollectionCancel').click();return pending}
 const input=form.querySelector('#v2CollectionAmount');input.value=String(amount);
 input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
 form.querySelector('#v2CollectionReview').click();
 const confirm=doc.getElementById('v2CollectionConfirm');
 if(!confirm){form.querySelector('#v2CollectionCancel').click();return pending}
 beforeConfirm?.();confirm.click();return pending;
}
module.exports={beginCollection,collect:beginCollection};
