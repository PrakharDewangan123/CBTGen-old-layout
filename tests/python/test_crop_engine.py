import hashlib
import tempfile
import unittest
from pathlib import Path

import pymupdf

from services.document_processing.crop_engine import CropError, crop_pdf_region


def make_pdf():
    doc = pymupdf.open()
    page = doc.new_page(width=300, height=200)
    page.insert_text((20, 30), "Q1", fontsize=12)
    page.draw_rect(pymupdf.Rect(60, 45, 180, 130), color=(0, 0, 0), width=1.5)
    page.draw_line((70, 115), (160, 60), color=(0, 0, 0), width=2)
    page.insert_text((90, 85), "A", fontsize=12)  # meaningful label inside diagram
    data = doc.tobytes()
    doc.close()
    return data


class CropEngineTests(unittest.TestCase):
    def setUp(self):
        self.data = make_pdf()
        self.digest = hashlib.sha256(self.data).hexdigest()
        self.temp = tempfile.TemporaryDirectory()
        self.output = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def crop(self, owner="owner-1", **kwargs):
        params = {"page_number": 1, "region_bounds": {"x": 55, "y": 40, "width": 130, "height": 95},
            "content_bounds": {"x": 60, "y": 45, "width": 120, "height": 85}, "role": "diagram", "output_root": self.output}
        params.update(kwargs)
        return crop_pdf_region("paper.pdf", self.data, owner_id=owner, source_sha256=self.digest, **params)

    def test_creates_verified_png_and_provenance_manifest(self):
        result = self.crop(printed_label_evidence=[{"printedLabel": "Q1", "source": "page text"}])
        file = self.output / result["path"]
        self.assertTrue(file.is_file())
        self.assertEqual(result["mimeType"], "image/png")
        self.assertTrue(result["validation"]["pngVerified"])
        self.assertEqual(result["reviewStatus"], "needs-review")
        self.assertIn("Q1", result["printedLabelEvidence"][0]["printedLabel"])
        self.assertEqual(result["owner"]["userId"], "owner-1")
        # A narrower reviewed content box must not be re-expanded into a printed label.
        self.assertEqual(result["appliedPaddingPoints"], 0.0)

    def test_same_source_geometry_has_stable_asset_id(self):
        first = self.crop()
        second = self.crop()
        self.assertEqual(first["assetId"], second["assetId"])
        self.assertEqual(first["sha256"], second["sha256"])

    def test_assets_are_scoped_by_owner(self):
        first = self.crop(owner="owner-1")
        second = self.crop(owner="owner-2")
        self.assertEqual(first["assetId"], second["assetId"])
        self.assertNotEqual(first["path"], second["path"])

    def test_rejects_wrong_source_hash(self):
        with self.assertRaises(CropError):
            crop_pdf_region("paper.pdf", self.data, owner_id="owner-1", source_sha256="0" * 64,
                page_number=1, region_bounds={"x": 55, "y": 40, "width": 130, "height": 95}, output_root=self.output)

    def test_rejects_missing_owner_and_out_of_region_content(self):
        with self.assertRaises(CropError):
            self.crop(owner="")
        with self.assertRaises(CropError):
            self.crop(content_bounds={"x": 1, "y": 1, "width": 100, "height": 100})

    def test_rejects_page_bounds_outside_page(self):
        with self.assertRaises(CropError):
            crop_pdf_region("paper.pdf", self.data, owner_id="owner-1", source_sha256=self.digest,
                page_number=1, region_bounds={"x": 250, "y": 150, "width": 100, "height": 80}, output_root=self.output)


if __name__ == "__main__":
    unittest.main()
