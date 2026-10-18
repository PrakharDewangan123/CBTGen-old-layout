# CBTGen Phase 12 — Finalization Gate and Integration Audit

## Delivered

- Added a fail-closed finalization preflight (`apps/web/src/lib/cbtgen/finalizationGate.js`). It checks for an authenticated owner, that the reviewer belongs to that owner, source size at or below 10,000,000 bytes, canonical CBTGen root framing, forbidden DTD/entity declarations, forbidden runtime/billing metadata attributes, valid extraction-manifest structure, matching manifest ownership, completed extraction, and reviewed/non-rejected extraction regions.
- Added integration tests for successful preflight and owner mismatch, oversize source, DTD/entity, runtime metadata, unresolved review, and incomplete extraction.
- Kept portable XML separate from owner/session/billing metadata. This gate is a client-side safety preflight, not an authentication provider or server authorization system.

## Regression results

The JavaScript integration tests and Python document-processing suite passed during the current validation run. The Python suite reported 83 passing tests, and the current working tree's React production build completed successfully with `npm run build`. These local results do not establish that the complete browser-driven upload-to-exam workflow has been verified.

## Explicitly not claimed complete

- No real authentication provider or server-issued owner identity is wired in by this gate.
- The preflight does not parse XML with a browser DOM parser and does not replace the authoritative `validateCbtgenXml` semantic validator. The caller must still run semantic validation before package generation/save.
- The extraction UI's human review action is not proven end-to-end by unit tests.
- No complete browser-driven upload → OCR → review → save → launch-exam workflow has been verified.
- Local IndexedDB compression is lossless for the structured record envelope only; source files and image assets remain unmodified and this is not encryption.

## Limits remain separate

- Source import limit: 10,000,000 bytes.
- Structured local-record compression: lossless and transparent to existing getters where supported.
- Project download ZIP target: under 10 MB.
- Portable paper packages can have their own size based on their source assets; this project ZIP cap must not be silently treated as a paper-package cap.
