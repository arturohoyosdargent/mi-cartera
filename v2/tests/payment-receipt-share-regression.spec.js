const assert=require('assert'),fs=require('fs'),path=require('path');
const receipt=fs.readFileSync(path.join(__dirname,'../app/payment-receipt-v2.js'),'utf8');
const cards=fs.readFileSync(path.join(__dirname,'../app/operational-cards-v2.js'),'utf8');

// Receipt sharing must never mutate payment state; it only renders/shares an already-recorded payment.
assert.ok(receipt.includes('Read/share only; never records a payment.'),'receipt module must remain read/share only');
assert.ok(receipt.includes('if(!p)throw new Error(\'PAYMENT_REQUIRED\')'),'receipt requires a persisted payment');

// Preserve the complete mobile/desktop sharing fallback chain.
assert.ok(receipt.includes("return 'file-share'"),'image/file share missing');
assert.ok(receipt.includes("return 'whatsapp'"),'WhatsApp fallback missing');
assert.ok(receipt.includes("return 'native-share'"),'native text share fallback missing');
assert.ok(receipt.includes("return 'clipboard'"),'clipboard fallback missing');
assert.ok(receipt.includes('RECEIPT_SHARE_UNAVAILABLE_NO_PHONE'),'no-phone terminal error must remain explicit');

// Payment history must expose the same receipt action so a recorded payment can be resent.
assert.ok(cards.includes('MiCarteraV2SharePreview?.previewPayment?.(paymentId)')||cards.includes('MiCarteraV2PaymentReceipt.share(p,c,cr)'),'payment history receipt action missing');
assert.ok(cards.includes('Comprobante'),'payment history receipt button missing');

console.log('V2 payment receipt share regression: PASS');
