# Sharing closure · 2026-10-03

Base/rollback: `732acc9a6960754c0c8e887b436edb054bbf5d9b` / `v2-pilot-20261003-b2-routes-assignment-1`. Original return point `d0df8a8` also retained.

The Redmi credit-detail screenshot was caused by source branching, not a financial or renderer failure: only `kind: receipt/reminder` selected the single-button panel. Credit detail, credit proposal and renewal proposal used the default three-button panel. Previous tests explicitly required that obsolete default; those contracts have been replaced by cross-entry behavior coverage.

Repository audit: V2 client-share central panel; credit-detail/proposal/payment-receipt/collection-reminder modules; renewal stable10 and still-exported stable6; SharePreview/Cards/history/Agenda/CustomerExperience forwarding. Payment commitments use the reminder/Agenda path, with no separate graphical renderer. Root legacy `credit-share*`, proposal/detail/payment fixes and image binders are outside Firebase `public: v2` and are not part of V2 production. JSON journal/backup and ICS calendar exports remain unrelated to client PNG sharing.

All graphical entries now prepare the approved PNG and editable message, then use the same single `Compartir comprobante` button. File-capability check and Web Share run inside that click. No anchor download, direct text chat or silent text-only fallback. A missing renderer/module or unsupported browser reports a controlled error. Android controls app/contact selection; recipient delivery is not claimed from the browser fixture.

Independent review identified and fixed original-owner capture in legacy renewal, stale rendering replacing a newer preview, and late rendering reopening a proposal after returning to edit/cancelling. Preparation tokens are invalidated by a newer preparation, close, logout and actual renewal exits.

The renderer and financial/core/cloud/commercial/queue/diary implementations are unchanged. Renderer argument payloads are identical to the base. No QA uses real records or writes Cloud. The localhost-only fixture runs real graphics and UI entries at 393×873; only the native OS share boundary is simulated. It checks real PNG bytes match the displayed preview, edited text, trusted click activation, zero downloads/chat opens and unchanged financial state.
