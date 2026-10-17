import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

SERVICE_DIR = (
    Path(__file__).resolve().parents[2]
    / "services"
    / "document_processing"
)
sys.path.insert(0, str(SERVICE_DIR))

from api import app, LOCAL_DEV_OWNER  # noqa: E402


class DocumentProcessingBatchCropTests(unittest.TestCase):
    def setUp(self):
        self.saved_enable = os.environ.pop(
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH", None
        )
        self.saved_secret = os.environ.pop(
            "CBTGEN_LOCAL_DEV_SECRET", None
        )
        self.client = TestClient(
            app, client=("127.0.0.1", 12345)
        )
        self.secret = "test-secret-for-batch-tests"

    def tearDown(self):
        os.environ.pop("CBTGEN_ENABLE_LOCAL_DEV_AUTH", None)
        os.environ.pop("CBTGEN_LOCAL_DEV_SECRET", None)

        if self.saved_enable is not None:
            os.environ["CBTGEN_ENABLE_LOCAL_DEV_AUTH"] = (
                self.saved_enable
            )
        if self.saved_secret is not None:
            os.environ["CBTGEN_LOCAL_DEV_SECRET"] = (
                self.saved_secret
            )

    def make_pdf(self):
        import pymupdf

        document = pymupdf.open()
        page = document.new_page(width=300, height=200)
        page.insert_text((30, 40), "Question content")
        page.insert_text((30, 80), "Option A")
        data = document.tobytes()
        document.close()
        return data

    def headers(self):
        return {
            "Origin": "http://localhost:5176",
            "X-CBTGen-Local-Dev-Secret": self.secret,
        }

    def post_batch(self, data, crops, source_hash=None):
        return self.client.post(
            "/v1/crops/batch",
            headers=self.headers(),
            data={
                "source_sha256": (
                    source_hash
                    if source_hash is not None
                    else hashlib.sha256(data).hexdigest()
                ),
                "crops": json.dumps(crops),
            },
            files={
                "file": ("sample.pdf", data, "application/pdf")
            },
        )

    def test_batch_endpoint_fails_closed_without_auth(self):
        data = self.make_pdf()
        response = self.client.post(
            "/v1/crops/batch",
            data={
                "source_sha256": hashlib.sha256(data).hexdigest(),
                "crops": json.dumps([
                    {
                        "pageNumber": 1,
                        "role": "question-content",
                        "regionBounds": {
                            "x": 10, "y": 10,
                            "width": 180, "height": 60,
                        },
                    }
                ]),
            },
            files={
                "file": ("sample.pdf", data, "application/pdf")
            },
        )
        self.assertEqual(response.status_code, 401)

    def test_batch_returns_images_and_preserves_review_status(self):
        data = self.make_pdf()
        crops = [
            {
                "pageNumber": 1,
                "role": "question-content",
                "regionBounds": {
                    "x": 10, "y": 10,
                    "width": 180, "height": 60,
                },
                "contentBounds": {
                    "x": 20, "y": 20,
                    "width": 150, "height": 30,
                },
                "paddingPoints": 2,
                "dpi": 120,
            },
            {
                "pageNumber": 1,
                "role": "option-content",
                "regionBounds": {
                    "x": 10, "y": 55,
                    "width": 180, "height": 40,
                },
                "contentBounds": {
                    "x": 20, "y": 60,
                    "width": 120, "height": 20,
                },
                "paddingPoints": 2,
                "dpi": 120,
            },
        ]

        with tempfile.TemporaryDirectory() as output:
            with patch.dict(os.environ, {
                "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
                "CBTGEN_LOCAL_DEV_SECRET": self.secret,
                "CBTGEN_CROP_OUTPUT_ROOT": output,
            }):
                response = self.post_batch(data, crops)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(
            payload["sourceSha256"],
            hashlib.sha256(data).hexdigest(),
        )
        self.assertEqual(payload["reviewStatus"], "needs-review")
        self.assertEqual(len(payload["results"]), 2)

        for index, item in enumerate(payload["results"]):
            self.assertEqual(item["requestIndex"], index)
            self.assertTrue(item["ok"], item)
            result = item["result"]
            self.assertTrue(
                result["imageDataUrl"].startswith(
                    "data:image/png;base64,"
                )
            )
            self.assertEqual(result["reviewStatus"], "needs-review")
            self.assertEqual(
                result["owner"]["userId"], LOCAL_DEV_OWNER
            )
            self.assertNotIn("path", result)
            self.assertNotIn("relativePath", result)

    def test_batch_rejects_wrong_source_hash(self):
        data = self.make_pdf()
        with patch.dict(os.environ, {
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
            "CBTGEN_LOCAL_DEV_SECRET": self.secret,
        }):
            response = self.post_batch(
                data,
                [{
                    "pageNumber": 1,
                    "role": "question-content",
                    "regionBounds": {
                        "x": 10, "y": 10,
                        "width": 180, "height": 60,
                    },
                }],
                source_hash="0" * 64,
            )

        self.assertEqual(response.status_code, 422)
        self.assertNotIn("Traceback", response.text)

    def test_batch_reports_invalid_item_without_hiding_valid_item(self):
        data = self.make_pdf()
        crops = [
            {
                "pageNumber": 1,
                "role": "question-content",
                "regionBounds": {
                    "x": 10, "y": 10,
                    "width": 180, "height": 60,
                },
            },
            {
                "pageNumber": 0,
                "role": "question-content",
                "regionBounds": {
                    "x": 10, "y": 10,
                    "width": 180, "height": 60,
                },
            },
        ]

        with tempfile.TemporaryDirectory() as output:
            with patch.dict(os.environ, {
                "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
                "CBTGEN_LOCAL_DEV_SECRET": self.secret,
                "CBTGEN_CROP_OUTPUT_ROOT": output,
            }):
                response = self.post_batch(data, crops)

        self.assertEqual(response.status_code, 200, response.text)
        results = response.json()["results"]
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["requestIndex"], 0)
        self.assertTrue(results[0]["ok"], results[0])
        self.assertEqual(results[1]["requestIndex"], 1)
        self.assertFalse(results[1]["ok"])
        self.assertIn("error", results[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
