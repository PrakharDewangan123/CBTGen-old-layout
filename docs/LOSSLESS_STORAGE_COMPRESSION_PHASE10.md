# Phase 10 — Lossless structured-content storage compression

## Separate requirements

- Source-file import limit: **10,000,000 bytes** enforced at the import boundary.
- Project ZIP delivery limit: **10 MB**, verified separately when creating a delivery.
- Storage compression: a separate, transparent optimization for structured paper content.

These limits do not depend on one another.

## Current implementation

`apps/web/src/lib/cbtgen/storage/losslessRecordCompression.js` uses the browser's native GZIP `CompressionStream` and `DecompressionStream` APIs to compress the JSON envelope containing `xmlText` and the normalized `paper` model. It only compresses payloads of at least 4 KiB and only when the compressed form saves at least 5%. If compression is unavailable, errors, or fails to meet the threshold, the original structured content is stored unchanged.

The original asset array is stored outside the compressed envelope. Image bytes are not recompressed, resampled, resized, or transcoded, so this layer cannot reduce image quality. Legacy records are still readable. Get/list operations transparently decompress new compressed records and return the same logical fields as before. Corrupt or incomplete compressed payloads fail closed rather than being returned as usable content.

## Integrity and ownership

- Owner ID and fingerprint remain uncompressed IndexedDB key/metadata fields.
- Compression does not grant access; existing owner-scoped database lookups remain mandatory.
- Content length is checked after decompression and UTF-8 JSON is parsed strictly.
- Source/image assets remain unchanged by this compression layer.

## Limits and caveats

This phase implements transparent compression of the structured XML/model payload in browser IndexedDB. It does **not** yet compress server-side database objects, source PDFs/DOCX files, image assets, or the downloadable project ZIP automatically. It is not encryption. Authentication wiring, full end-to-end persistence, exam preloading/caching, and production browser/build testing remain separate work.

## Test

Run `npm run test:lossless-compression`. The test checks a lossless round trip for Unicode, whitespace, answers, fingerprints, owner metadata and asset preservation; confirms small records avoid compression overhead; and verifies corrupted data is rejected.
