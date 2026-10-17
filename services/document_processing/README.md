# CBTGen document processing service

This package is a conservative source-document extraction library and optional API adapter for CBTGen's source-first importer. The API currently fails closed until connected to trusted CBTGen authentication. Any deployment must derive `owner_id` from trusted authentication state, enforce quotas, and keep source bytes and extracted assets scoped to that user before invoking this module.

## Current support

- **Digital PDF:** native text extraction with page geometry and text-block bounding boxes using PyMuPDF.
- **Sparse/scanned PDF pages:** the service renders the page at 220 DPI and attempts OCR with Tesseract through `pytesseract`. Recognized words are grouped into lines, mapped back to PDF-point coordinates, and carry a confidence estimate. OCR-derived text is always marked `needs-review`.
- **Layout evidence:** PDF image blocks and vector drawing bounds are returned as candidate `layoutRegions`; they are not yet classified as diagrams/equations or automatically cropped.
- **OCR warnings:** unavailable OCR dependencies, processing failure, no recognized text, and low-confidence lines are surfaced instead of silently fabricating content.
- **DOCX:** paragraphs, headings, and tables are extracted in document order using python-docx. DOCX page coordinates are not invented.
- **Question structure candidates:** conservative line-start heuristics detect likely question numbers, option labels, section headings, and explicit marks notation. Each candidate retains source-element provenance and is marked `needs-review`; this is not a semantic parser and does not determine correct answers.
- **Provenance/security:** source SHA-256, content type, byte count, safe source filename, generated job ID, owner metadata, and review warnings are recorded. Source bytes are processed in memory and are not persisted by this library.
- **Limits:** supported extension/signature checks, 10 MB source upload limit (10,000,000 bytes), DOCX ZIP expansion/entry/ratio limits, 1,000-page PDF limit, encrypted PDF rejection, and mandatory trusted owner ID.

## Upload and archive safety limits

- Source upload limit: 10,000,000 bytes (10 MB decimal), checked in the UI, API, and extractor.
- PDF limit: 1,000 pages; encrypted PDFs are rejected.
- DOCX package checks: maximum 2,000 ZIP entries, maximum 100 MiB total expanded size, maximum 200:1 per-entry compression ratio, reject encrypted entries, and require the core DOCX package parts.
- These checks reduce common oversized-file and ZIP-bomb risks; they are not a substitute for sandboxing, operating-system resource limits, or trusted authentication.

## OCR system dependency

Install Python dependencies from `requirements.txt`. OCR also requires the **Tesseract executable** to be installed and available on `PATH`; installing `pytesseract` alone is not enough. If it is missing, the service emits a warning and leaves the page for manual/OCR review. Tesseract language packs may be installed according to the source paper's language; the current default OCR invocation uses Tesseract's default language.

## Run tests

From the repository root:

```bash
python -m unittest discover -s tests/python -v
node tests/integration/extractionManifest.test.js
node tests/integration/paperStorageOwnerIsolation.test.js
node tests/integration/importFormatSupport.test.js
```

## Not yet implemented

Robust semantic question/option/section segmentation and answer-key linking remain incomplete; current boundary detection is heuristic and review-required. Diagram/equation/image crop generation, printed-label exclusion, crop quality checks, human review UI, CBTGen XML/package generation from the extraction report, and authenticated React-to-service API integration are also not implemented. Do not advertise end-to-end conversion as complete until those stages and ownership checks are implemented and tested.
