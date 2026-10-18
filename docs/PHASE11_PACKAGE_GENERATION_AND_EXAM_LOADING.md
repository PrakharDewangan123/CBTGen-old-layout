# Phase 11 — Package generation and exam-time loading foundation

This phase adds a dependency-free ZIP package writer and an owner-scoped stored-content loader.

## Package generation

- Emits a ZIP archive containing root-level `paper.xml` and declared `assets/` entries.
- Uses ZIP STORE entries so binary asset bytes are not re-encoded or degraded.
- Checks the canonical XML root, blocks DTD/entity declarations, validates manifest-to-binary mapping, rejects duplicate IDs/paths, missing assets, and unsafe paths.
- Excludes account IDs, usage, billing, and session metadata by accepting only XML plus explicitly supplied assets.
- Input XML must already be validated and contain the canonical `<assets>` manifest. This is a foundation; it does not itself convert extraction-manifest data into CBTGen XML.

## Exam-time loading

`loadOwnedPaperContent(record, authenticatedOwnerId)` checks owner scope before and after transparent decompression and refuses incomplete content. The caller must pass an owner ID derived from the authenticated application session, never a browser-selected owner ID.

## Not yet complete

- UI integration for exporting a saved paper.
- Full conversion from approved extraction manifest to canonical CBTGen XML.
- Real authenticated end-to-end upload → review → package → owner-scoped library persistence.
- Complete browser-based exam smoke test.
