import io
import unittest
import zipfile
from unittest.mock import patch

import pymupdf
from docx import Document

from services.document_processing.extractor import (
    MAX_SOURCE_BYTES, ExtractionError, _validate_input, extract_document, extract_docx, extract_pdf
)


def make_pdf(text="Question 1: What is 2 + 2?\n(A) 3  (B) 4"):
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((60, 90), text)
    data = doc.tobytes()
    doc.close()
    return data


def make_docx():
    doc = Document()
    doc.add_heading("Mathematics", level=1)
    doc.add_paragraph("Question 1: What is 2 + 2?")
    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Option A"
    table.cell(0, 1).text = "3"
    table.cell(1, 0).text = "Option B"
    table.cell(1, 1).text = "4"
    stream = io.BytesIO()
    doc.save(stream)
    return stream.getvalue()


class DocumentExtractorTests(unittest.TestCase):
    def test_pdf_extracts_text_with_page_point_geometry_and_digest(self):
        result = extract_pdf("paper.pdf", make_pdf(), owner_id="user-1")
        self.assertEqual(result["source"]["fileType"], "pdf")
        self.assertEqual(result["pageCount"], 1)
        element = result["pages"][0]["elements"][0]
        self.assertIn("Question 1", element["text"])
        self.assertEqual(element["coordinateUnit"], "pdf-points")
        self.assertGreater(element["bounds"]["width"], 0)
        self.assertEqual(len(result["source"]["sha256"]), 64)
        self.assertEqual(result["owner"]["userId"], "user-1")

    def test_sparse_pdf_page_is_flagged_for_ocr_not_fabricated(self):
        result = extract_pdf("scan.pdf", make_pdf(""), owner_id="user-1")
        self.assertTrue(result["pages"][0]["ocrAttempted"])
        self.assertTrue(any(w["code"] in {"OCR_REQUIRED", "OCR_NO_TEXT", "OCR_PROCESSING_FAILED"} for w in result["warnings"]))

    def test_docx_extracts_paragraphs_and_tables_in_order(self):
        result = extract_docx("paper.docx", make_docx(), owner_id="user-1")
        kinds = [item["kind"] for item in result["elements"]]
        self.assertEqual(kinds, ["heading", "paragraph", "table"])
        self.assertEqual(result["elements"][2]["rows"][0], ["Option A", "3"])
        self.assertNotIn("bounds", result["elements"][0])


    def test_ocr_words_are_grouped_into_lines_with_pdf_point_coordinates(self):
        fake_data = {
            "text": ["Question", "1", "What", "is", "2+2?"],
            "conf": ["95", "93", "91", "90", "89"],
            "block_num": [1, 1, 1, 1, 1], "par_num": [1, 1, 1, 1, 1],
            "line_num": [1, 1, 1, 1, 1],
            "left": [20, 100, 130, 170, 200], "top": [30, 30, 30, 30, 30],
            "width": [70, 10, 35, 15, 45], "height": [20, 20, 20, 20, 20],
        }
        with patch("pytesseract.image_to_data", return_value=fake_data) as mock_ocr:
            result = extract_pdf("scan.pdf", make_pdf(""), owner_id="user-1")
        page = result["pages"][0]
        ocr = [e for e in page["elements"] if e["extractionMethod"] == "tesseract-ocr"]
        self.assertEqual(len(ocr), 1)
        self.assertEqual(ocr[0]["text"], "Question 1 What is 2+2?")
        self.assertEqual(len(ocr[0]["wordBounds"]), 5)
        self.assertEqual(
            [word["text"] for word in ocr[0]["wordBounds"]],
            ["Question", "1", "What", "is", "2+2?"],
        )
        self.assertEqual(
            ocr[0]["wordBounds"][0]["start"],
            0,
        )
        self.assertGreater(
            ocr[0]["wordBounds"][0]["bounds"]["width"], 0
        )
        self.assertEqual(ocr[0]["coordinateUnit"], "pdf-points")
        self.assertGreater(ocr[0]["confidence"], 0.85)
        self.assertEqual(ocr[0]["reviewStatus"], "needs-review")
        self.assertTrue(page["ocrAttempted"])
        mock_ocr.assert_called_once()
        self.assertEqual(mock_ocr.call_args.kwargs["config"], "--psm 3")

    def test_pdf_layout_regions_include_vector_geometry(self):
        doc = pymupdf.open()
        page = doc.new_page(width=595, height=842)
        page.draw_rect(pymupdf.Rect(100, 100, 240, 180))
        data = doc.tobytes()
        doc.close()
        result = extract_pdf("diagram.pdf", data, owner_id="user-1")
        regions = result["pages"][0]["layoutRegions"]
        self.assertTrue(any(region["kind"] == "vector-region" for region in regions))
        region = next(region for region in regions if region["kind"] == "vector-region")
        self.assertGreater(region["bounds"]["width"], 100)

    def test_owner_is_required(self):
        with self.assertRaises(ExtractionError):
            extract_document("paper.pdf", make_pdf(), owner_id="")

    def test_rejects_mismatched_extension_and_signature(self):
        with self.assertRaises(ExtractionError):
            extract_pdf("fake.pdf", b"not a pdf", owner_id="user-1")

    def test_rejects_unsupported_extensions(self):
        with self.assertRaises(ExtractionError):
            extract_document("paper.png", b"image", owner_id="user-1")


    def test_upload_limit_is_exactly_10_decimal_megabytes(self):
        self.assertEqual(MAX_SOURCE_BYTES, 10_000_000)
        _validate_input("at-limit.pdf", b"%PDF-" + b"0" * (MAX_SOURCE_BYTES - 5))
        with self.assertRaisesRegex(ExtractionError, "10 MB upload limit"):
            _validate_input("over-limit.pdf", b"%PDF-" + b"0" * MAX_SOURCE_BYTES)

    def test_docx_zip_expansion_ratio_is_limited(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", "<Types/>" )
            archive.writestr("word/document.xml", "A" * 500_000)
        with self.assertRaisesRegex(ExtractionError, "unsafe compression ratio"):
            _validate_input("suspicious.docx", stream.getvalue())

    def test_docx_must_contain_required_package_parts(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
            archive.writestr("not-a-docx.txt", "hello")
        with self.assertRaisesRegex(ExtractionError, "valid DOCX document package"):
            _validate_input("fake.docx", stream.getvalue())

    def test_source_name_is_not_used_as_a_path(self):
        result = extract_pdf("../../paper.pdf", make_pdf(), owner_id="user-1")
        self.assertEqual(result["source"]["fileName"], "paper.pdf")


if __name__ == "__main__":
    unittest.main()
