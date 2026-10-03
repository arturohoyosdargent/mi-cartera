# Candidate: protected device journal and individual commercial portfolios

Build: `v2-pilot-20261003-b2-pending-protected-3`.
Verified production rollback: `d0df8a8`, `v2-pilot-20261002-b2-commercial-mobile-5`.

## Completed changes

- Preexisting pending device operations stop all automatic startup, online, focus and explicit replay before queue writes. New submissions also stop before enqueueing. The read-only journal displays local rows immediately and can export the exact raw journal. Server confirmation checks are optional, read-only and compare actor, operation ID and fingerprint; they never acknowledge or resend a row.
- An independent `app/diario-seguro.html` entry restores the existing Firebase identity and reads only its owner's local journal. It does not load financial runtime, hydration, Firestore or Service Worker update code. Identity changes close the diagnostic. The same origin, owner and Firebase application name are preserved.
- Per-credit beneficiary/reference and assignment preserve the titular, sibling credits, past payments, original collector, cash and commissions. Scoped client-contact grants allow reading only the related contact. Access is revoked when current credits and eligible historical payments are absent. Shared-contact authorization avoids the Firestore 1,000-expression limit.
- Mobile assignment shows reference, capital, balance, date and state in a wrapping selected-credit summary. Switching clients resets the individual-credit choice and enables the all-credit checkbox.
- Mobile portfolio, agenda, payment history, client history, Cash/Balance and audit queries provide filters, detail navigation and pagination. Short WhatsApp text remains editable before directed sharing. Previously approved graphic renderer and financial/schedule engines are unchanged.

## Verification

- Complete source/browser regression: 256/256 passed, zero failures or skipped cases.
- Actual shipped Firebase SDK 10.14.1 against candidate rules in loopback `demo-cartera-final`: own-worker atomic operations and idempotency, contact grants, sibling isolation, query/write denials, revocation, inactive-worker denial, commission/cash-account denial. Reproducible integration scripts are in `v2/tests/*.integration.cjs` (Firestore 8380, Auth 9199, fictional project only).
- Two concurrent worker funding attempts: one applies, one rejects stale shared revision; leader debit and worker credit each occur once, consolidated change zero.
- Browser at 393×873: credit choice/reset and individual reassignment; original historical payment/cash unchanged in emulator; Balance opens the historical movement with its original collector. Read-only view displays four fictitious rows and exports their journal.
- PWA install and activation from the stable Service Worker to the candidate preserve exact raw journal and portfolio bytes. Candidate startup/reconnect/focus/explicit flush transmit zero operations when the journal already has pending rows.
- Independent review found no reproducible defects in journal/identity guards, individual assignment and same-origin additive diagnostic entry.
- Production read-only comparison: 1,192 documents, 17 collections, 0 added/removed/changed; no production writes. No real clients were used for test operations.

## Release gate

The four real Redmi operations have not yet been identified or compared with their Cloud confirmations. This candidate is **not authorized for final production release yet**. Do not retry, delete, alter or acknowledge those entries blindly.

An auxiliary diagnostic delivery can retain every existing stable asset and add only `diario-seguro.html`, `diario-seguro-v2.js` and `pending-review-v2.js`. The prepared package was compared with Hosting: all 76 existing assets are byte-identical, including the stable release and Service Worker. It has not been deployed. Opening that direct page does not control any other already-open stable financial tab.

Final integration/deployment remains gated on identifying those four rows, exact Cloud fingerprint comparison and an explicitly chosen safe reconciliation. Preserve the stable rollback and the candidate bundle.
