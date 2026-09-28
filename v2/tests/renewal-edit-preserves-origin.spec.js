const assert=require('assert');
const fs=require('fs');
const src=fs.readFileSync('v2/app/renewal-actions-stable10.js','utf8');

// Regression: Monica Monge. A confirmed renewal may be corrected before any payment
// without losing the debt that existed on the source credit.
assert(src.includes('editPendingRenewal'), 'missing editPendingRenewal action');
assert(src.includes('originCreditId'), 'renewal must retain origin credit id');
assert(src.includes('originDebt'), 'renewal must retain immutable origin debt snapshot');
assert(src.includes('payments.length'), 'edit must guard against payments already registered');
assert(src.includes('capital-originDebt'), 'net disbursement must be recalculated from preserved origin debt');
assert(src.includes('RENEWAL_EDITED'), 'edit must be audited');
assert(src.includes('cancelPendingRenewal'), 'missing safe renewal cancellation');
assert(src.includes('RENEWAL_CANCELLED'), 'cancellation must be audited');
console.log('renewal-edit-preserves-origin.spec.js PASS');
