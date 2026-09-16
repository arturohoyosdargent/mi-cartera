# Mi Cartera PRO V2 — Greenfield boundary

V2 is a new application core, not a patch loader for V1.

## Hard rules
- V1 production modules under the repository root are LEGACY and must not be imported by V2 runtime.
- V2 runtime may only import files under `/v2/` plus approved vendor/Firebase SDK modules.
- Financial truth is derived from immutable operations and versioned credit records.
- One business action = one deterministic `operationId` = one atomic transaction.
- CAPITAL, INTERES and MORA are separate allocations. Only CAPITAL reduces principal.
- Interest-only renewal closes the old period as RENOVADO, records interest against that period and creates exactly one successor with unchanged principal.
- Deletions use tombstones/versioning; stale replicas cannot recreate deleted records.
- Offline queue stores operations, never arbitrary snapshots of the whole database.
- Conflict resolution is by version/precondition; never blind local-wins/cloud-wins merge.
- Legacy migration is read-only until reconciliation produces an explicit migration plan.

## Acceptance gates before production
1. Unit/domain tests pass.
2. Atomic/idempotency tests pass, including retry and simulated disconnect.
3. Alfredo regression: S/600 + S/120 interest creates one payment and one successor only, after repeated retries.
4. Elias regression: S/60 previous principal balance + S/200 new capital produces S/140 cash disbursed and S/240 new total at 20%.
5. Legacy audit has no unexplained orphan/duplicate operation that would be silently migrated.
6. Shadow migration totals reconcile before any production cutover.
7. V1 remains available as rollback snapshot until V2 production verification is complete.

## Cutover
V2 will be published separately for validation. It will not replace `main`/current GitHub Pages until all gates pass and production data migration is explicitly reconciled.