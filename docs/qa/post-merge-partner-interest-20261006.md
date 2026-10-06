# Post-merge QA trigger — partner interest agenda

Purpose: trigger CI from the exact main merge `afe26e23ea10fc178b3ca20545fcdc50b8a2dd0c` without changing application runtime files.

Scope: documentation-only CI trigger. No deployment, no Firebase configuration changes, no financial writes.

Expected validation: QA Syntax Matrix and V2 Greenfield QA, including `v2/tests/partner-interest-agenda.spec.js`.
