# CBTGen Secure PDF Extraction and Crop Pipeline

## Status

This document defines the implementation direction. The PDF/OCR/crop engine itself is **not implemented yet**. The current change establishes owner-scoped local paper storage as a prerequisite.

## Product contract

The source PDF remains authoritative. A processing job creates:

1. A structured extraction manifest containing source-page coordinates, detected content regions, stable internal question/option IDs, confidence/review flags, and asset ownership.
2. Cropped visual assets for diagrams, image options, equations or other regions that cannot be represented faithfully as structured content.
3. CBTGen XML v1.0 plus assets in the existing supported package format.

Text, question types, sections, subjects, instructions, marks, answer evidence and configuration remain structured data where supported. Printed question/option labels are not asset identities and should not be embedded in content crops. Meaningful labels inside diagrams/equations must be preserved.

## Identity and authorization are separate

- Paper/question fingerprints identify equivalent content according to CBTGen's normalization rules.
- Asset SHA-256 digests detect binary changes and support integrity checks.
- Stable asset IDs connect a crop to a specific question/option/content block.
- Owner IDs and authorization determine who can read, list, update, delete, preview or practice a paper.
- A matching fingerprint or asset digest never grants access.

Portable source-paper XML must not contain account, billing, slot, attempt or session state. Ownership is enforced by the storage/API layer.

## Owner-scoped local storage

Version 4 introduces these IndexedDB stores:

- `papersByOwner`, compound key `[userId, fingerprint]`
- `sourcePapersByOwner`, compound key `[userId, sourceId]`

Local storage APIs require the owner ID for saves, reads, lists and deletes. Reads additionally verify the returned record's `userId`. A missing owner fails closed.

During upgrade, legacy records are migrated only if the existing local library metadata maps their fingerprint/source ID to exactly one active owner. Ambiguous records remain in legacy stores and are not exposed by the new APIs. This avoids assigning an old record to the wrong account. If an old record cannot be migrated unambiguously, re-import the original `.xml`, `.zip` or `.cbtgen` package while signed in to the correct account.

This client-side separation protects against accidental cross-account leakage in the same browser. It is not a substitute for server-side authorization in a future production backend; the server must authorize every paper and asset request independently.

## Crop pipeline stages

1. Inspect source format: digital PDF, scanned PDF, or mixed.
2. Extract native text/coordinates where available; use OCR/layout detection when required.
3. Build reading order, question/option regions, and non-croppable structural metadata.
4. Detect printed identifiers separately from semantic content.
5. Create crop candidates with source-page provenance and conservative margins.
6. Validate clipping, label leakage, content ownership, duplicate/missing asset IDs, and asset references.
7. Require review for ambiguous boundaries, OCR disagreement, uncertain math/diagram ownership, or missing content.
8. Export through the existing CBTGen XML/package contract and run the existing validators.

## Security requirements

- No global cross-user asset lookup by fingerprint alone.
- No trust in client-supplied owner IDs without checking the authenticated session/API owner.
- No path traversal or unsafe archive extraction.
- Reject duplicate asset IDs, missing references, mismatched ownership and unsafe MIME/content.
- Do not silently score or infer answer keys when evidence is missing.
- Keep source data, session data, results and usage/billing records separate.
- Add regression tests for identical papers uploaded by multiple users, same asset IDs across users, ownerless calls, unauthorized deletion, account switching, and ambiguous legacy migration.

## Implemented internal manifest contract (initial slice)

`src/lib/cbtgen/extractionManifest.js` defines the internal extraction manifest contract and a deterministic structural validator. It is intentionally independent of the React UI and CBTGen XML serialization. It validates:

- required owner/paper scope and source SHA-256 provenance;
- unique page, region, asset IDs and package-relative paths;
- source page numbers, coordinate units and region bounds against known page dimensions;
- semantic region kinds, extraction method, confidence and review status;
- owner-scope references and paper ownership consistency;
- prohibition on turning printed question/option identifiers into crop assets;
- safe raster crop MIME types and asset-to-source-region references;
- missing or mismatched asset links.

The module provides `sha256Hex()` using Web Crypto and does not send source bytes to an external service. It does not perform PDF parsing, OCR, crop rendering, pixel-level label detection or human review; those remain subsequent implementation stages. Structural validation cannot prove a crop is visually complete.

Internal manifest owner IDs are for processing/storage authorization and audit only. Do not serialize them into portable CBTGen XML.
