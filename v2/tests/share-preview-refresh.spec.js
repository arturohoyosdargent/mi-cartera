const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, '../app');
const shell = fs.readFileSync(path.join(app, 'operational-shell.html'), 'utf8');
const sw = fs.readFileSync(path.join(app, 'service-worker.js'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(app, 'release.json'), 'utf8'));
const preview = fs.readFileSync(path.join(app, 'share-preview-v2.js'), 'utf8');
const refresh = fs.readFileSync(path.join(app, 'refresh-controller-v2.js'), 'utf8');
const durable = fs.readFileSync(path.join(app, 'durable-actions-v2.js'), 'utf8');

assert.ok(shell.includes('<script src="share-preview-v2.js"></script>'), 'share preview module must load in the operational shell');
assert.ok(shell.includes('<script src="refresh-controller-v2.js"></script>'), 'manual refresh module must load in the operational shell');
assert.ok(sw.includes("'./share-preview-v2.js'"), 'share preview module must be in the offline shell');
assert.ok(sw.includes("'./refresh-controller-v2.js'"), 'manual refresh module must be in the offline shell');
assert.ok(sw.includes(`const BUILD='${release.build}'`), 'service worker must match the release build');

assert.ok(preview.includes('Confirmar y enviar'), 'sharing must require an explicit confirmation');
assert.ok(preview.includes('No se abrirá WhatsApp ni el panel de compartir hasta que confirmes.'), 'preview must explain that no message is sent before confirmation');
assert.ok(preview.includes('previewCredit'), 'credit detail sharing must be previewed');
assert.ok(preview.includes('previewReminder'), 'payment reminders must be previewed');
assert.ok(preview.includes('previewPayment'), 'payment receipts must be previewed');
assert.ok(preview.includes('const shareCredit=cards.shareCredit') && preview.includes('cards.shareCredit=id=>previewCredit(id)'), 'credit share action must be intercepted before sending');
assert.ok(preview.includes('const remind=agenda.remind') && preview.includes('agenda.remind=id=>'), 'agenda reminder action must be intercepted before sending');
assert.ok(durable.includes("root.MiCarteraV2SharePreview?.previewCredit?.(r.newCredit.id)"), 'both renewal flows must preview the newly created credit after durable save');
assert.equal((durable.match(/root\.MiCarteraV2SharePreview\?\.previewCredit\?\.\(r\.newCredit\.id\)/g)||[]).length,2,'interest and capital renewal must both enter preview flow');
assert.ok(durable.indexOf("await commit('INTEREST_RENEWAL'") < durable.indexOf("root.MiCarteraV2SharePreview?.previewCredit?.(r.newCredit.id)"), 'interest renewal preview must happen only after durable commit');
assert.ok(durable.indexOf("await commit('REFINANCE'") < durable.lastIndexOf("root.MiCarteraV2SharePreview?.previewCredit?.(r.newCredit.id)"), 'capital renewal preview must happen only after durable commit');

assert.ok(refresh.includes('manualRefreshButton'), 'manual refresh button must be created');
assert.ok(refresh.includes('MiCarteraV2CloudRehydration?.rehydrate'), 'refresh must rehydrate Cloud data when available');
assert.ok(refresh.includes('Guarda el cliente o el crédito antes de actualizar'), 'refresh must protect unsaved forms');
assert.ok(refresh.includes('location?.reload'), 'refresh must reload only after a new published PWA version is detected');

console.log('V2 share preview and safe refresh: PASS');
