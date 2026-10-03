# Candidate: protected device journal and individual commercial portfolios

Build: `v2-pilot-20261003-b2-pending-protected-5`.
Verified production rollback: `d0df8a8`, `v2-pilot-20261002-b2-commercial-mobile-5`.

## Completed changes

- Preexisting pending device operations stop all automatic startup, online, focus and explicit replay before queue writes. New submissions also stop before enqueueing. Opening the journal and exporting it are read-only. Optional Cloud checks compare actor, operation ID and fingerprint without acknowledging or resending a row.
- An independent `app/diario-seguro.html` entry restores the existing Firebase identity and reads only its owner's local journal. Opening it does not load financial runtime, hydration, Firestore or Service Worker update code. A separate explicit confirmation button loads only the server reader. Identity changes close the diagnostic. The same origin, owner and Firebase application name are preserved.
- Explicit local acknowledgement requires every pending row to have an exact APPLIED Cloud proof, including actor, ID, type, fingerprint and application time. The source bytes, owner and open panel must still match. Under the journal's exclusive browser lock, the exact raw journal is backed up before only local status/review metadata is updated. Original operation payloads and previous errors remain intact. A new journal export is downloaded automatically. No financial operation is sent or retried.
- The administrative recovery planner is not served by Hosting or loaded by the app. It accepts only verified original operations, rejects semantic duplicates and stale business versions, preserves original IDs and fingerprints, and uses create-only/update-time preconditions in atomic commits. A shared cash revision can be rebased only after fresh whole-pending cash validation. Commit requests do not retry automatically.
- Per-credit beneficiary/reference and assignment preserve the titular, sibling credits, past payments, original collector, cash and commissions. Scoped client-contact grants allow reading only the related contact. Access is revoked when current credits and eligible historical payments are absent. Shared-contact authorization avoids the Firestore 1,000-expression limit.
- Mobile assignment shows reference, capital, balance, date and state in a wrapping selected-credit summary. Switching clients resets the individual-credit choice and enables the all-credit checkbox.
- Mobile portfolio, agenda, payment history, client history, Cash/Balance and audit queries provide filters, detail navigation and pagination. Short WhatsApp text remains editable before directed sharing. Previously approved graphic renderer and financial/schedule engines are unchanged.

## Verification

- Complete source/browser regression: 274/274 passed, zero failures or skipped cases.
- Recovery-specific fictional tests verify immutable source/business records, exact fingerprints, semantic duplicate rejection, schedule integrity, CAS protection, atomic rollback and idempotent second application. Actual REST commits against the local fictitious Firestore emulator apply once and reject stale cash without partial writes.
- Local confirmation tests cover exact Cloud proofs, missing/conflicting rows, changed journal/identity/panel during reader loading, lock and backup failures, unchanged original payloads, and zero financial writes. Mobile 393x873 fixture confirms four fictitious rows to zero pending and downloads the resulting journal.
- Actual shipped Firebase SDK 10.14.1 against candidate rules in loopback `demo-cartera-final`: own-worker atomic operations and idempotency, contact grants, sibling isolation, query/write denials, revocation, inactive-worker denial, commission/cash-account denial. Reproducible integration scripts are in `v2/tests/*.integration.cjs` (Firestore 8380, Auth 9199, fictional project only).
- Two concurrent worker funding attempts: one applies, one rejects stale shared revision; leader debit and worker credit each occur once, consolidated change zero.
- Browser at 393×873: credit choice/reset and individual reassignment; original historical payment/cash unchanged in emulator; Balance opens the historical movement with its original collector. Read-only view displays four fictitious rows and exports their journal. Previously approved physical WhatsApp delivery was not repeated.
- PWA install and activation from the stable Service Worker to the candidate preserve exact raw journal and portfolio bytes. Candidate startup/reconnect/focus/explicit flush transmit zero operations when the journal already has pending rows.
- Independent review found no remaining reproducible defects in journal/identity guards, individual assignment, same-origin additive diagnostic entry, recovery validation or acknowledgement. Diagnostic summaries use new-operation dates and amounts, excluding old renewal/partner master records and summing all new partner-settlement expenses.
- Production comparison after authorized recovery: 1,192 to 1,203 documents in 17 collections; 11 original documents added, 3 original documents updated, none removed and zero differences outside the verified recovery allowlist. All original business fields and operation fingerprints match. Recovery made 16 authorized document write events across 14 unique documents; QA itself used only fictional data. The exported device journal remains byte-identical and this PC made no device-storage writes.

## Release gate

The supplied Redmi journal identified four relevant original operations: one was already APPLIED and three were absent. After exact comparison, the three originals were recovered once using atomic preconditioned commits. All four now have exact APPLIED Cloud proofs. No operation was reconstructed from guessed amounts or dates.

The supplied journal has 20 rows: 17 already synchronized, one conflict and two pending. This PC cannot change or inspect current Redmi local storage. Final integration/deployment remains gated on the user explicitly acknowledging the three locally unresolved rows through exact Cloud proof and returning the resulting journal/status. Do not replay, delete or blindly acknowledge them.

An auxiliary diagnostic delivery retains every existing stable asset and serves only `diario-seguro.html`, `diario-seguro-v2.js` and `pending-review-v2.js`. All 76 stable assets must remain byte-identical, including the release and Service Worker; all 79 served files must match the prepared package after delivery. Opening the direct page does not control any other already-open stable financial tab. The full financial candidate remains unpublished until the local acknowledgement gate is satisfied. Preserve the stable rollback and candidate bundle.
