# B3 Spark native RC2 · 20/10/2026

Candidate branch: `candidate/continuation-20261015`. Build: `v2-pilot-20261020-b3-spark-native-rc2`.
Parent: `7b53fc1d00d1dd6309427f2e8dfb8ee23c977ac5`. Production remains B2. This checkpoint does not authorize production.

## Implemented and checked

- Native Firestore payment transaction binds credit balance and schedule, immutable receipt, cash delta, audit and accepted operation. Exact retries return the original receipt. A collector credits central cash without permission to read its private balance.
- Credit creation, interest renewal and refinance use immutable domain authorizations and row certificates. Calendar proofs preserve rest days, month-end dates and optional weekly extras.
- Single partner-loan creation, interest payment, capital return, settlement and contact update are implemented and integrated. Journals are preserved, expenses and cash are atomic, maturity duplicates are rejected and canonical document paths are enforced.
- Offline financial submissions traverse the real UI bridge and retain the original unconfirmed intent. Transport failures and lost acknowledgements retry the same operation ID; no payment is projected before Cloud acceptance.
- Old-session online callbacks cannot alter a previous user's queue. A session change during replay suspends untouched intents. Confirmed replay refreshes the current Cloud projection without a hydration loop.
- Actual PWA shell and service worker include cash, credit, partners and payment factories. Spark bootstrap does not import Functions.

## Evidence retained

Previous 55 + 29 checks, eight recovered worker contracts and the stable 361-case Actions result are retained as historical evidence. They are not recertified physical-device checks.

On the current implementation: 68 native cases including identity and the actual UI bridge passed, plus five focused compatibility scripts. Emulator evidence includes 21 credit rule cases; 12 partner rule cases; five partner SDK cases with two independent clients; four private-cash payment SDK cases; four technical read-isolation checks; and two offline/reconnection SDK checks. Evidence retains its source/rules hashes: tests from earlier hashes are historical, not represented as all running on one final production artifact.

## Isolated validation and remaining boundaries

Use only a demo Firebase project and fictional accounts. The HTTPS lab overlays configuration/bootstrap outside this source and uses the native staged rules `v2/cloud/firestore-spark-native.rules`. Its source manifest must identify the candidate commit. Never deploy that overlay or emulator credentials to production.

Bulk partner settlement, backdated/future cash, historical commissions, reuse of closed-credit uniqueness keys, protected administrative closure, production baseline migration and read-only rules recovery remain unfinished. Unsupported native operations fail closed; no generic financial-write bypass is enabled. These boundaries prevent production certification, even if the isolated candidate's covered flows pass.

The new native workflow is focused QA only. Archived Functions/external-server experiments are not the active Spark transport and must not be invoked or deployed. Production requires completed contracts, protected baseline/rollback evidence, physical PC and Xiaomi validation and the user's explicit approval of the exact SHA. Never restore financial records during rollback.
