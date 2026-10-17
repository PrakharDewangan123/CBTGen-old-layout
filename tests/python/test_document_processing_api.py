import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

SERVICE_DIR = Path(__file__).resolve().parents[2] / "apps" / "api"
sys.path.insert(0, str(SERVICE_DIR))

from api import app, LOCAL_DEV_OWNER  # noqa: E402


class DocumentProcessingApiTests(unittest.TestCase):
    def setUp(self):
        self.saved_enable = os.environ.pop("CBTGEN_ENABLE_LOCAL_DEV_AUTH", None)
        self.saved_secret = os.environ.pop("CBTGEN_LOCAL_DEV_SECRET", None)
        self.client = TestClient(app, client=("127.0.0.1", 12345))

    def tearDown(self):
        os.environ.pop("CBTGEN_ENABLE_LOCAL_DEV_AUTH", None)
        os.environ.pop("CBTGEN_LOCAL_DEV_SECRET", None)
        if self.saved_enable is not None:
            os.environ["CBTGEN_ENABLE_LOCAL_DEV_AUTH"] = self.saved_enable
        if self.saved_secret is not None:
            os.environ["CBTGEN_LOCAL_DEV_SECRET"] = self.saved_secret

    def test_health_keeps_real_authentication_unconfigured(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertFalse(response.json()["authConfigured"])
        self.assertFalse(response.json()["localDevelopmentAuthEnabled"])

    def test_extraction_fails_closed_by_default(self):
        response = self.client.post(
            "/v1/extractions",
            files={"file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        self.assertEqual(response.status_code, 401)

    def test_browser_supplied_owner_id_does_not_authenticate(self):
        response = self.client.post(
            "/v1/extractions?owner_id=some-other-user",
            files={"file": ("sample.pdf", b"%PDF-1.4 test", "application/pdf")},
        )
        self.assertEqual(response.status_code, 401)

    def test_missing_file_does_not_bypass_authentication(self):
        response = self.client.post("/v1/extractions")
        self.assertIn(response.status_code, (401, 422))

    def test_local_dev_auth_assigns_backend_owned_identity(self):
        with patch.dict(os.environ, {
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
            "CBTGEN_LOCAL_DEV_SECRET": "test-secret-for-unit-tests",
        }):
            with patch("api.extract_document") as extract:
                extract.return_value = {
                    "source": {
                        "fileType": "docx",
                        "sha256": "a" * 64,
                    },
                    "elements": [
                        {
                            "elementId": "paragraph-1",
                            "kind": "paragraph",
                            "text": "Question 1: Sample question?\n(A) First option\n(B) Second option",
                            "documentOrder": 1,
                            "extractionMethod": "test",
                        }
                    ],
                    "warnings": [],
                    "owner": {"userId": LOCAL_DEV_OWNER},
                }
                response = self.client.post(
                    "/v1/extractions?owner_id=attacker-controlled",
                    headers={
                        "Origin": "http://localhost:5176",
                        "X-CBTGen-Local-Dev-Secret": "test-secret-for-unit-tests",
                    },
                    files={"file": ("sample.pdf", b"test-data", "application/pdf")},
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(extract.call_args.kwargs["owner_id"], LOCAL_DEV_OWNER)
        payload = response.json()
        self.assertEqual(payload["segmentation"]["status"], "review-required")
        self.assertEqual(len(payload["segmentation"]["questions"]), 1)
        question = payload["segmentation"]["questions"][0]
        self.assertEqual(question["printedNumber"], 1)
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B"],
        )
        self.assertEqual(question["reviewStatus"], "needs-review")

    def test_pdf_extraction_returns_review_only_crop_proposals(self):
        pdf_report = {
            "source": {
                "fileType": "pdf",
                "sha256": "a" * 64,
            },
            "pages": [
                {
                    "pageNumber": 1,
                    "width": 300,
                    "height": 200,
                    "elements": [
                        {
                            "elementId": "question-source-1",
                            "kind": "text",
                            "text": "Question 1: Sample question?",
                            "pageNumber": 1,
                            "bounds": {
                                "x": 30,
                                "y": 40,
                                "width": 150,
                                "height": 15,
                            },
                            "coordinateUnit": "pdf-points",
                            "extractionMethod": "native-pdf-text",
                            "confidence": 1.0,
                        },
                        {
                            "elementId": "option-source-a",
                            "kind": "text",
                            "text": "(A) First option",
                            "pageNumber": 1,
                            "bounds": {
                                "x": 45,
                                "y": 65,
                                "width": 100,
                                "height": 12,
                            },
                            "coordinateUnit": "pdf-points",
                            "extractionMethod": "native-pdf-text",
                            "confidence": 1.0,
                        },
                    ],
                }
            ],
            "elements": [],
            "warnings": [],
            "owner": {"userId": LOCAL_DEV_OWNER},
        }

        with patch.dict(os.environ, {
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
            "CBTGEN_LOCAL_DEV_SECRET": "test-secret-for-unit-tests",
        }):
            with patch("api.extract_document", return_value=pdf_report):
                response = self.client.post(
                    "/v1/extractions",
                    headers={
                        "Origin": "http://localhost:5176",
                        "X-CBTGen-Local-Dev-Secret":
                            "test-secret-for-unit-tests",
                    },
                    files={
                        "file": (
                            "sample.pdf",
                            b"test-data",
                            "application/pdf",
                        )
                    },
                )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        self.assertIn("cropProposals", payload)
        crop_result = payload["cropProposals"]
        self.assertIn("proposals", crop_result)

        question_proposals = [
            proposal
            for proposal in crop_result["proposals"]
            if proposal.get("role") == "question-content"
        ]
        self.assertTrue(
            question_proposals,
            "Expected at least one question-content crop proposal.",
        )

        for proposal in question_proposals:
            self.assertEqual(proposal["reviewStatus"], "needs-review")
            self.assertTrue(proposal["humanApprovalRequired"])
            self.assertFalse(proposal["labelExclusionConfirmed"])

    def test_local_dev_auth_rejects_wrong_secret(self):
        with patch.dict(os.environ, {
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
            "CBTGEN_LOCAL_DEV_SECRET": "expected-secret",
        }):
            response = self.client.post(
                "/v1/extractions",
                headers={
                    "Origin": "http://localhost:5176",
                    "X-CBTGen-Local-Dev-Secret": "wrong-secret",
                },
                files={"file": ("sample.pdf", b"test-data", "application/pdf")},
            )
        self.assertEqual(response.status_code, 401)

    def test_local_dev_auth_rejects_nonlocal_origin(self):
        with patch.dict(os.environ, {
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
            "CBTGEN_LOCAL_DEV_SECRET": "expected-secret",
        }):
            response = self.client.post(
                "/v1/extractions",
                headers={
                    "Origin": "https://example.com",
                    "X-CBTGen-Local-Dev-Secret": "expected-secret",
                },
                files={"file": ("sample.pdf", b"test-data", "application/pdf")},
            )
        self.assertEqual(response.status_code, 403)

    def test_local_dev_auth_rejects_nonloopback_peer(self):
        remote_client = TestClient(app, client=("192.0.2.10", 12345))
        with patch.dict(os.environ, {
            "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
            "CBTGEN_LOCAL_DEV_SECRET": "expected-secret",
        }):
            response = remote_client.post(
                "/v1/extractions",
                headers={
                    "Origin": "http://localhost:5176",
                    "X-CBTGen-Local-Dev-Secret": "expected-secret",
                },
                files={"file": ("sample.pdf", b"test-data", "application/pdf")},
            )
        self.assertEqual(response.status_code, 403)


    def _make_crop_test_pdf(self):
        import pymupdf
        document = pymupdf.open()
        page = document.new_page(width=300, height=200)
        page.insert_text((30, 40), "Question content")
        data = document.tobytes()
        document.close()
        return data

    def test_crop_endpoint_fails_closed_without_auth(self):
        response = self.client.post(
            "/v1/crops",
            data={"source_sha256": "0" * 64, "page_number": "1",
                  "region_bounds": '{"x":1,"y":1,"width":10,"height":10}'},
            files={"file": ("sample.pdf", b"%PDF-1.4", "application/pdf")},
        )
        self.assertEqual(response.status_code, 401)

    def test_crop_endpoint_returns_image_and_provenance_without_paths(self):
        import hashlib, tempfile, json
        data = self._make_crop_test_pdf()
        with tempfile.TemporaryDirectory() as output:
            with patch.dict(os.environ, {
                "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
                "CBTGEN_LOCAL_DEV_SECRET": "test-secret-for-unit-tests",
                "CBTGEN_CROP_OUTPUT_ROOT": output,
            }):
                response = self.client.post(
                    "/v1/crops?owner_id=attacker-controlled",
                    headers={"Origin": "http://localhost:5176",
                             "X-CBTGen-Local-Dev-Secret": "test-secret-for-unit-tests"},
                    data={
                        "source_sha256": hashlib.sha256(data).hexdigest(),
                        "page_number": "1",
                        "region_bounds": json.dumps({"x": 15, "y": 15, "width": 180, "height": 70}),
                        "content_bounds": json.dumps({"x": 20, "y": 20, "width": 160, "height": 55}),
                        "role": "question-content", "padding_points": "2", "dpi": "120",
                    },
                    files={"file": ("sample.pdf", data, "application/pdf")},
                )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["owner"]["userId"], LOCAL_DEV_OWNER)
        self.assertEqual(payload["reviewStatus"], "needs-review")
        self.assertEqual(payload["role"], "question-content")
        self.assertTrue(payload["imageDataUrl"].startswith("data:image/png;base64,"))
        self.assertNotIn("relativePath", payload)
        self.assertNotIn(str(Path.home()), response.text)

    def test_crop_endpoint_rejects_wrong_hash(self):
        import tempfile
        data = self._make_crop_test_pdf()
        with tempfile.TemporaryDirectory() as output:
            with patch.dict(os.environ, {
                "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
                "CBTGEN_LOCAL_DEV_SECRET": "test-secret-for-unit-tests",
                "CBTGEN_CROP_OUTPUT_ROOT": output,
            }):
                response = self.client.post(
                    "/v1/crops",
                    headers={"Origin": "http://localhost:5176",
                             "X-CBTGen-Local-Dev-Secret": "test-secret-for-unit-tests"},
                    data={"source_sha256": "0" * 64, "page_number": "1",
                          "region_bounds": '{"x":15,"y":15,"width":180,"height":70}'},
                    files={"file": ("sample.pdf", data, "application/pdf")},
                )
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("Traceback", response.text)

    def test_crop_endpoint_rejects_malformed_bounds(self):
        import hashlib, tempfile
        data = self._make_crop_test_pdf()
        with tempfile.TemporaryDirectory() as output:
            with patch.dict(os.environ, {
                "CBTGEN_ENABLE_LOCAL_DEV_AUTH": "1",
                "CBTGEN_LOCAL_DEV_SECRET": "test-secret-for-unit-tests",
                "CBTGEN_CROP_OUTPUT_ROOT": output,
            }):
                response = self.client.post(
                    "/v1/crops",
                    headers={"Origin": "http://localhost:5176",
                             "X-CBTGen-Local-Dev-Secret": "test-secret-for-unit-tests"},
                    data={"source_sha256": hashlib.sha256(data).hexdigest(),
                          "page_number": "1", "region_bounds": "not-json"},
                    files={"file": ("sample.pdf", data, "application/pdf")},
                )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main(verbosity=2)
