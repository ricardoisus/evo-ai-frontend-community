# Instagram Studio

Requested by Ricardo on 22 October 2026: complete Instagram module UX, optimized for his daily operation, a distinct visual language, free canvas with supported branches, and automatic draft saving with **Descartar rascunho**. Backend contract: `docs/instagram-graph-v2.md` in the CRM repository. This change does not deploy or enable commercial sending.

## Operation

Open `/automations/instagram`. The overview keeps search/status filters and distinguishes running and published versions. The editor has Construir, Testar and Acompanhar. Desktop uses React Flow with typed blocks, handles, zoom, fit controls, auto layout and a property/preview inspector. Mobile uses a scrollable block list and explicit connection selectors; dragging is unnecessary. Native dialogs trap focus and restore it on close; labels, errors and operating states do not rely on color.

Rascunho saves after 800 ms without changes. A single in-flight save never overwrites a newer local revision; a later revision is saved next using the new lock. Loading failure retries the original proof rather than creating a replacement. Saving failure retains local edits. HTTP 409 stops autosaving and offers server reload or copying local changes. No localStorage copy of configuration or messages is introduced. Navigation warns while edits have not been confirmed by the server.

Discard confirms the change summary, then restores the complete published graph through the server with optimistic locking. It never pauses, activates or rewrites the active version. When no version exists, it resets to the initial model. Publish first flushes and validates the saved draft, then reviews messages and connections before making a new immutable version. Publication and activation are separate. Layout-only changes can reuse server-verified functional acceptance.

Simulation consumes the published version and synthetic content/caption, highlights the selected path and does not call a transport. The interactive Direct preview labels draft/published and is illustrative when multiple message branches exist; use simulation to verify a specific branch. Real testing uses the server-authorized profile only. Polling waits for the real click and accepted material, refreshes server activation readiness, and never hydrates over unsaved edits. It pauses polling while the document is hidden. Acompanhar filters the 50 recent eligible deliveries by version, date and outcome, and shows the persisted per-node trace or legacy receipt timeline. Registration/PDF/email remain explicitly unavailable when no receipt supplies their evidence.

## Local prototype

Run `npm run dev -- --host 127.0.0.1 --port 5176` and open `/instagram-studio-preview.html`. `/instagram-studio-mobile.html` renders the same components inside a real 390×844 iframe viewport. `/instagram-studio-overview.html` provides a read-only overview fixture. These are development HTML entries, not application routes or production build entries. Data is synthetic and sending/activation are disabled. The optional `?proof=<synthetic UUID>` adapter addresses only `http://127.0.0.1:3186/api/v1` for an explicitly started isolated Rails harness; do not use a real proof ID or production API here.

## Verification

The targeted suite passes 27 tests. Vitest covers autosave, in-flight edits, discard, conflict, failed loading, navigation, safe graph connections, legacy conversion, review differences and overview navigation. Existing editor tests continue to exercise the v1 component in isolation for compatibility. TypeScript, scoped ESLint and production build must pass before PR acceptance.

Browser review used 1280×720 desktop and the 390×844 iframe for mobile; screenshots are stored in the Vetorial project under `Vetorial - Instagram AMH/implementacao/ux-studio-2026-10-22`. Manual integrated verification exercised real Rails API persistence and discard on an isolated database with outbound HTTP blocked. Production inspection reached login; this revision has not been verified inside an authenticated production browser or with a real Meta event.

## Rollout

Backend PR/migration must precede this frontend. Preserve published v1 snapshots and all receipts. Publishing a converted v2 draft is explicit. Do not deploy this interface against a backend without v2 draft, validation, discard, trace and readiness support. Commercial activation and real test sends need separate authorization. Rollback instructions and backend compatibility constraints are documented in the CRM contract; do not leave active v2 rules on a v1-only worker.

## Visual review

- [Overview](instagram-studio/visao-geral.png)
- [Canvas desktop](instagram-studio/canvas-desktop.png)
- [Mobile viewport 390×844](instagram-studio/editor-mobile-390.png)
- [Accessible discard confirmation](instagram-studio/descarte-acessivel.png)

## Canvas refinement — 23 October 2026

Ricardo requested a canvas-first layout, compact header and blocks, retractable properties, visible zoom icons, less instructional copy and the colors of this Evolution installation. The editor now uses the application's theme tokens (with the same sienna/ivory/charcoal fallbacks in the isolated preview). Properties start closed, open on block selection and can be closed from either the toolbar or inspector. Preview is also retractable. Dedicated Lucide controls provide zoom in/out, 100%, fit flow and focus selected block. Branch labels remain on output ports without being repeated on every edge. The local preview no longer adds a 24px outer frame.

Verification: 28 targeted Vitest tests pass, including inspector open/close/selection; scoped ESLint, TypeScript and production build pass (existing large-chunk warning). Browser inspection was blocked by the computer-use URL policy, so no new screenshot or visual-browser approval is claimed. The older screenshots above precede this refinement.

Working checkout: `/Users/ricardohenrique/Projetos/evo-crm/evo-ai-frontend-community`; branch `codex/instagram-visual-builder`; baseline `19be745`. This refinement is local and must be reviewed before merging or deploying. No production changes or sends were made. Next step: visual review at the existing local preview URL and PR review before integration into main.
