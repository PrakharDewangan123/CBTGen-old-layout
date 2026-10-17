"""Conservative extraction of source PDF/DOCX content for CBTGen.

This module extracts evidence; it does not infer answers, split questions, or
claim OCR success. Callers must pass an owner ID obtained from trusted auth.
"""

from __future__ import annotations

from hashlib import sha256
from io import BytesIO
from pathlib import PurePath
import re
import secrets
from typing import Any
import zipfile

# User-facing import limit is 10 MB (decimal bytes), enforced by both client and server.
MAX_SOURCE_BYTES = 10_000_000
MAX_DOCX_ENTRIES = 2_000
MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_DOCX_COMPRESSION_RATIO = 200
ALLOWED_EXTENSIONS = {".pdf", ".docx"}


class ExtractionError(ValueError):
    """Raised when a source cannot be safely processed."""


def _safe_filename(filename: str) -> str:
    # Keep only the basename; never use this value to form a filesystem path.
    value = PurePath(str(filename or "source")).name.replace("\x00", "")
    return value[:240] or "source"


def _validate_input(filename: str, data: bytes) -> tuple[str, str]:
    safe_name = _safe_filename(filename)
    suffix = PurePath(safe_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ExtractionError("Only PDF and DOCX are supported by the current processing service.")
    if not isinstance(data, bytes) or not data:
        raise ExtractionError("The source document is empty or invalid.")
    if len(data) > MAX_SOURCE_BYTES:
        raise ExtractionError("The source document exceeds the 10 MB upload limit.")
    if suffix == ".pdf" and not data.startswith(b"%PDF-"):
        raise ExtractionError("The file extension is PDF, but the content signature is invalid.")
    if suffix == ".docx":
        if not data.startswith(b"PK"):
            raise ExtractionError("The file extension is DOCX, but the ZIP container signature is invalid.")
        # DOCX is a ZIP container. Inspect its central directory before python-docx
        # opens it, limiting archive expansion and rejecting malformed containers.
        try:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > MAX_DOCX_ENTRIES:
                    raise ExtractionError("The DOCX contains too many internal components to process safely.")
                expanded_bytes = sum(max(0, entry.file_size) for entry in entries)
                if expanded_bytes > MAX_DOCX_UNCOMPRESSED_BYTES:
                    raise ExtractionError("The DOCX expands beyond the safe processing limit.")
                for entry in entries:
                    if entry.flag_bits & 0x1:
                        raise ExtractionError("Encrypted DOCX components are not supported.")
                    if entry.file_size > 0 and entry.compress_size == 0:
                        raise ExtractionError("The DOCX contains an invalid compressed component.")
                    if entry.compress_size > 0 and entry.file_size / entry.compress_size > MAX_DOCX_COMPRESSION_RATIO:
                        raise ExtractionError("The DOCX contains a component with an unsafe compression ratio.")
                names = {entry.filename for entry in entries}
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    raise ExtractionError("The file is not a valid DOCX document package.")
        except ExtractionError:
            raise
        except (zipfile.BadZipFile, OSError, ValueError) as exc:
            raise ExtractionError("The DOCX container is corrupt or invalid.") from exc
    return safe_name, suffix


def _require_owner(owner_id: str) -> str:
    owner = str(owner_id or "").strip()
    if not owner:
        raise ExtractionError("A trusted authenticated owner ID is required.")
    if len(owner) > 256 or re.search(r"[\x00-\x1f]", owner):
        raise ExtractionError("The authenticated owner ID is invalid.")
    return owner


def _base_report(filename: str, data: bytes, owner_id: str, file_type: str) -> dict[str, Any]:
    return {
        "reportVersion": "1.0",
        "jobId": "extract-" + secrets.token_hex(16),
        "owner": {"userId": _require_owner(owner_id)},
        "source": {
            "fileName": filename,
            "fileType": file_type,
            "mimeType": "application/pdf" if file_type == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "byteLength": len(data),
            "sha256": sha256(data).hexdigest(),
        },
        "elements": [],
        "warnings": [],
        "status": "extracted",
    }


def _page_layout_regions(page: Any, page_number: int) -> list[dict[str, Any]]:
    """Return conservative non-text regions from PDF image and vector geometry."""
    regions: list[dict[str, Any]] = []
    try:
        for index, image_block in enumerate(page.get_text("dict").get("blocks", []), start=1):
            if image_block.get("type") != 1:
                continue
            x0, y0, x1, y1 = [float(v) for v in image_block.get("bbox", (0, 0, 0, 0))]
            if x1 > x0 and y1 > y0:
                regions.append({
                    "regionId": f"p{page_number}-image-{index}", "kind": "image-region",
                    "bounds": {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0},
                    "coordinateUnit": "pdf-points", "reviewStatus": "not-reviewed",
                })
    except Exception:
        pass
    try:
        for index, drawing in enumerate(page.get_drawings(), start=1):
            rect = drawing.get("rect")
            if rect is None or rect.is_empty or rect.is_infinite:
                continue
            x0, y0, x1, y1 = map(float, (rect.x0, rect.y0, rect.x1, rect.y1))
            if x1 - x0 < 2 or y1 - y0 < 2:
                continue
            regions.append({
                "regionId": f"p{page_number}-vector-{index}", "kind": "vector-region",
                "bounds": {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0},
                "coordinateUnit": "pdf-points", "reviewStatus": "not-reviewed",
            })
    except Exception:
        pass
    return regions


def _ocr_pdf_page(page: Any, page_number: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """OCR a rendered PDF page with Tesseract when available; return evidence and warnings."""
    warnings: list[dict[str, Any]] = []
    try:
        import pytesseract
        from PIL import Image
        from pytesseract import Output
    except Exception:
        return [], [{"code": "OCR_ENGINE_UNAVAILABLE", "pageNumber": page_number,
                     "message": "Install pytesseract, Pillow, and the Tesseract OCR binary to process scanned pages."}]

    try:
        # Render at 220 dpi to improve recognition while keeping memory bounded per page.
        pix = page.get_pixmap(dpi=220, alpha=False)
        image = Image.open(BytesIO(pix.tobytes("png")))
        raw = pytesseract.image_to_data(image, output_type=Output.DICT, config="--psm 3")
        sx = float(pix.width) / float(page.rect.width)
        sy = float(pix.height) / float(page.rect.height)
        grouped: dict[tuple[int, int, int], list[int]] = {}
        count = len(raw.get("text", []))
        for i in range(count):
            word = str(raw["text"][i] or "").strip()
            try:
                conf = float(raw.get("conf", ["-1"] * count)[i])
            except (TypeError, ValueError):
                conf = -1
            if not word or conf < 0:
                continue
            key = (int(raw.get("block_num", [0] * count)[i]),
                   int(raw.get("par_num", [0] * count)[i]),
                   int(raw.get("line_num", [0] * count)[i]))
            grouped.setdefault(key, []).append(i)

        elements: list[dict[str, Any]] = []
        for line_index, (key, indices) in enumerate(sorted(grouped.items()), start=1):
            word_records = []
            text_parts = []
            char_offset = 0
            for i in indices:
                word = str(raw["text"][i] or "").strip()
                if not word:
                    continue
                try:
                    wx = int(raw["left"][i])
                    wy = int(raw["top"][i])
                    ww = int(raw["width"][i])
                    wh = int(raw["height"][i])
                    word_confidence = float(raw.get("conf", ["-1"] * count)[i])
                except (TypeError, ValueError, IndexError):
                    continue
                if ww <= 0 or wh <= 0:
                    continue
                if text_parts:
                    char_offset += 1  # separating space in the joined line
                start_offset = char_offset
                end_offset = start_offset + len(word)
                word_records.append({
                    "text": word,
                    "start": start_offset,
                    "end": end_offset,
                    "bounds": {
                        "x": wx / sx, "y": wy / sy,
                        "width": ww / sx, "height": wh / sy,
                    },
                    "confidence": word_confidence / 100.0
                    if word_confidence >= 0 else None,
                })
                text_parts.append(word)
                char_offset = end_offset
            words = text_parts
            if not words:
                continue
            left = min(int(raw["left"][i]) for i in indices)
            top = min(int(raw["top"][i]) for i in indices)
            right = max(int(raw["left"][i]) + int(raw["width"][i]) for i in indices)
            bottom = max(int(raw["top"][i]) + int(raw["height"][i]) for i in indices)
            confidence_values = []
            for i in indices:
                try:
                    value = float(raw.get("conf", ["-1"] * count)[i])
                    if value >= 0:
                        confidence_values.append(value / 100.0)
                except (TypeError, ValueError):
                    pass
            if right <= left or bottom <= top:
                continue
            elements.append({
                "elementId": f"p{page_number}-ocr-line-{line_index}", "kind": "text-line",
                "text": " ".join(words), "pageNumber": page_number,
                "wordBounds": word_records,
                "bounds": {"x": left / sx, "y": top / sy, "width": (right - left) / sx, "height": (bottom - top) / sy},
                "coordinateUnit": "pdf-points", "extractionMethod": "tesseract-ocr",
                "confidence": round(sum(confidence_values) / len(confidence_values), 4) if confidence_values else None,
                "reviewStatus": "needs-review",
            })
        if not elements:
            warnings.append({"code": "OCR_NO_TEXT", "pageNumber": page_number,
                             "message": "OCR ran but did not recognize usable text on this page; manual review is required."})
        else:
            low_conf = [item for item in elements if item.get("confidence") is None or item["confidence"] < 0.72]
            if low_conf:
                warnings.append({"code": "OCR_LOW_CONFIDENCE", "pageNumber": page_number,
                                 "lineCount": len(low_conf), "message": "Some OCR lines have low confidence and require review."})
        return elements, warnings
    except Exception:
        return [], [{"code": "OCR_PROCESSING_FAILED", "pageNumber": page_number,
                     "message": "OCR could not process this page. Keep the source and review it manually."}]


def extract_pdf(filename: str, data: bytes, *, owner_id: str) -> dict[str, Any]:
    """Extract native PDF text blocks and their page-point bounding boxes."""
    safe_name, suffix = _validate_input(filename, data)
    if suffix != ".pdf":
        raise ExtractionError("extract_pdf requires a PDF source.")
    report = _base_report(safe_name, data, owner_id, "pdf")

    try:
        import pymupdf
        with pymupdf.open(stream=data, filetype="pdf") as document:
            if document.is_encrypted:
                raise ExtractionError("Encrypted PDFs are not supported; provide an unlocked copy.")
            if document.page_count < 1:
                raise ExtractionError("The PDF contains no pages.")
            if document.page_count > 1000:
                raise ExtractionError("The PDF exceeds the 1,000-page processing limit.")
            pages = []
            for page_index, page in enumerate(document):
                blocks = page.get_text("dict").get("blocks", [])
                raw_blocks = page.get_text("rawdict").get("blocks", [])
                raw_by_bbox = {}
                for raw_block in raw_blocks:
                    if raw_block.get("type") != 0:
                        continue
                    for raw_line in raw_block.get("lines", []):
                        line_bbox = raw_line.get("bbox")
                        if not line_bbox or len(line_bbox) != 4:
                            continue
                        key = tuple(round(float(v), 2) for v in line_bbox)
                        raw_spans = []
                        for raw_span in raw_line.get("spans", []):
                            chars = []
                            for char in raw_span.get("chars", []):
                                char_text = str(char.get("c", ""))
                                char_bbox = char.get("bbox")
                                if not char_text or not char_bbox or len(char_bbox) != 4:
                                    continue
                                cx0, cy0, cx1, cy1 = map(float, char_bbox)
                                if cx1 <= cx0 or cy1 <= cy0:
                                    continue
                                chars.append({
                                    "text": char_text,
                                    "bounds": {
                                        "x": cx0, "y": cy0,
                                        "width": cx1 - cx0, "height": cy1 - cy0,
                                    },
                                })
                            raw_spans.append({"chars": chars})
                        raw_by_bbox.setdefault(key, []).append(raw_spans)
                page_elements = []
                text_chars = 0
                for block_index, block in enumerate(blocks):
                    if block.get("type") != 0:
                        continue
                    lines = []
                    text_lines = []
                    for line_index, line in enumerate(block.get("lines", []), start=1):
                        spans = line.get("spans", [])
                        line_text = "".join(span.get("text", "") for span in spans)
                        if not line_text:
                            continue
                        lines.append(line_text)

                        line_box = line.get("bbox")
                        line_entry = {"lineIndex": line_index, "text": line_text}
                        if line_box and len(line_box) == 4:
                            lx0, ly0, lx1, ly1 = map(float, line_box)
                            if lx1 > lx0 and ly1 > ly0:
                                line_entry["bounds"] = {
                                    "x": lx0, "y": ly0,
                                    "width": lx1 - lx0, "height": ly1 - ly0,
                                }

                        span_entries = []
                        for span_index, span in enumerate(spans, start=1):
                            span_text = str(span.get("text", ""))
                            span_box = span.get("bbox")
                            if not span_text or not span_box or len(span_box) != 4:
                                continue
                            sx0, sy0, sx1, sy1 = map(float, span_box)
                            if sx1 <= sx0 or sy1 <= sy0:
                                continue

                            span_entry = {
                                "spanIndex": span_index,
                                "text": span_text,
                                "bounds": {
                                    "x": sx0, "y": sy0,
                                    "width": sx1 - sx0, "height": sy1 - sy0,
                                },
                            }

                            # Character boxes are read from PyMuPDF rawdict by
                            # matching this span's text and line geometry below.
                            span_entries.append(span_entry)
                        line_key = (
                            tuple(round(float(v), 2) for v in line_box)
                            if line_box and len(line_box) == 4 else None
                        )
                        raw_candidates = raw_by_bbox.get(line_key, []) if line_key else []
                        raw_spans = raw_candidates.pop(0) if raw_candidates else []
                        for span_entry, raw_span in zip(span_entries, raw_spans):
                            span_entry["characters"] = raw_span.get("chars", [])
                        line_entry["spans"] = span_entries
                        line_entry["characters"] = [
                            char
                            for span_entry in span_entries
                            for char in span_entry.get("characters", [])
                        ]
                        text_lines.append(line_entry)

                    text = "\n".join(lines).strip()
                    if not text:
                        continue
                    bbox = block.get("bbox", (0, 0, 0, 0))
                    x0, y0, x1, y1 = [float(value) for value in bbox]
                    if x1 <= x0 or y1 <= y0:
                        report["warnings"].append({"code": "INVALID_TEXT_BOUNDS", "pageNumber": page_index + 1, "blockIndex": block_index})
                        continue
                    text_chars += len(text)
                    page_elements.append({
                        "elementId": f"p{page_index + 1}-text-{block_index + 1}",
                        "kind": "text-block",
                        "text": text,
                        "pageNumber": page_index + 1,
                        "bounds": {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0},
                        "textLines": text_lines,
                        "coordinateUnit": "pdf-points",
                        "extractionMethod": "native-pdf-text",
                        "confidence": 1.0,
                        "reviewStatus": "not-reviewed",
                    })
                is_sparse = text_chars < 20
                page_warnings = []
                extraction_method = "native-pdf-text"
                if is_sparse:
                    ocr_elements, ocr_warnings = _ocr_pdf_page(page, page_index + 1)
                    page_elements.extend(ocr_elements)
                    page_warnings.extend(ocr_warnings)
                    extraction_method = "tesseract-ocr" if ocr_elements else "ocr-pending"
                    if not ocr_elements and not any(w.get("code") == "OCR_NO_TEXT" for w in ocr_warnings):
                        page_warnings.append({
                            "code": "OCR_REQUIRED", "pageNumber": page_index + 1,
                            "message": "This page has little or no extractable native text; OCR or manual review is required.",
                        })
                regions = _page_layout_regions(page, page_index + 1)
                pages.append({
                    "pageNumber": page_index + 1,
                    "width": float(page.rect.width),
                    "height": float(page.rect.height),
                    "coordinateUnit": "pdf-points",
                    "nativeTextCharacterCount": text_chars,
                    "ocrAttempted": is_sparse,
                    "ocrRequired": is_sparse and not any(e.get("extractionMethod") == "tesseract-ocr" for e in page_elements),
                    "extractionMethod": extraction_method,
                    "elements": page_elements,
                    "layoutRegions": regions,
                    "warnings": page_warnings,
                })
                report["warnings"].extend(page_warnings)
            report["pageCount"] = document.page_count
            report["pages"] = pages
            report["status"] = "review-required" if report["warnings"] else "extracted"
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError("The PDF could not be parsed safely.") from exc
    return report


def extract_docx(filename: str, data: bytes, *, owner_id: str) -> dict[str, Any]:
    """Extract DOCX paragraphs and tables in document order, without fake page coordinates."""
    safe_name, suffix = _validate_input(filename, data)
    if suffix != ".docx":
        raise ExtractionError("extract_docx requires a DOCX source.")
    report = _base_report(safe_name, data, owner_id, "docx")
    try:
        from docx import Document
        from docx.oxml.table import CT_Tbl
        from docx.oxml.text.paragraph import CT_P
        from docx.table import Table
        from docx.text.paragraph import Paragraph

        document = Document(BytesIO(data))
        body = document.element.body
        paragraph_index = 0
        table_index = 0
        for child in body.iterchildren():
            if isinstance(child, CT_P):
                paragraph_index += 1
                paragraph = Paragraph(child, document)
                text = paragraph.text.strip()
                if not text:
                    continue
                style = paragraph.style.name if paragraph.style is not None else ""
                report["elements"].append({
                    "elementId": f"paragraph-{paragraph_index}",
                    "kind": "heading" if style.lower().startswith("heading") or style.lower() == "title" else "paragraph",
                    "style": style,
                    "text": text,
                    "documentOrder": len(report["elements"]) + 1,
                    "extractionMethod": "docx-ooxml",
                    "reviewStatus": "not-reviewed",
                })
            elif isinstance(child, CT_Tbl):
                table_index += 1
                table = Table(child, document)
                rows = []
                for row in table.rows:
                    rows.append([cell.text.strip() for cell in row.cells])
                report["elements"].append({
                    "elementId": f"table-{table_index}",
                    "kind": "table",
                    "rows": rows,
                    "documentOrder": len(report["elements"]) + 1,
                    "extractionMethod": "docx-ooxml",
                    "reviewStatus": "not-reviewed",
                })
        if not report["elements"]:
            report["warnings"].append({"code": "NO_TEXT_CONTENT", "message": "No paragraph or table text was extracted from this DOCX."})
            report["status"] = "review-required"
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError("The DOCX could not be parsed safely. It may be corrupt or unsupported.") from exc
    report["status"] = "review-required" if report["warnings"] else "extracted"
    return report


def extract_document(filename: str, data: bytes, *, owner_id: str) -> dict[str, Any]:
    """Dispatch supported documents to the corresponding conservative extractor."""
    safe_name, suffix = _validate_input(filename, data)
    if suffix == ".pdf":
        return extract_pdf(safe_name, data, owner_id=owner_id)
    return extract_docx(safe_name, data, owner_id=owner_id)
