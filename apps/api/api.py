"""Optional FastAPI transport for CBTGen document extraction.

Production authentication remains fail-closed. The optional local-development
mode is intended only for testing on loopback and is not user authentication.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from packages.document_processing.extractor import extract_document, ExtractionError, MAX_SOURCE_BYTES
from packages.document_processing.question_segmenter import detect_question_structure
from packages.document_processing.crop_proposals import propose_pdf_crops
from packages.document_processing.crop_engine import CropError, crop_pdf_region

app = FastAPI(title="CBTGen Document Processing", version="0.1.0")

LOCAL_DEV_OWNER = "cbtgen-local-development"


def _local_dev_enabled() -> bool:
    return (
        os.environ.get("CBTGEN_ENABLE_LOCAL_DEV_AUTH") == "1"
        and bool(os.environ.get("CBTGEN_LOCAL_DEV_SECRET", "").strip())
    )


def get_authenticated_owner(
    request: Request,
    x_cbtgen_local_dev_secret: str | None = Header(default=None),
) -> str:
    """Use a dedicated owner only in explicitly enabled local testing."""
    if not _local_dev_enabled():
        raise HTTPException(
            status_code=401,
            detail="Authentication middleware is not configured.",
        )

    # Require a loopback TCP peer; do not trust forwarded IP headers.
    peer = request.client.host if request.client else ""
    if peer not in {"127.0.0.1", "::1"}:
        raise HTTPException(status_code=403, detail="Local development access only.")

    # Reject cross-origin browser requests. The secret itself is injected
    # server-side by the local Vite proxy and must never enter frontend code.
    origin = request.headers.get("origin", "")
    parsed_origin = urlsplit(origin)
    if (
        parsed_origin.scheme != "http"
        or parsed_origin.hostname not in {"localhost", "127.0.0.1", "::1"}
        or not parsed_origin.netloc
    ):
        raise HTTPException(status_code=403, detail="Local development origin required.")

    expected = os.environ.get("CBTGEN_LOCAL_DEV_SECRET", "")
    if not x_cbtgen_local_dev_secret or not hmac.compare_digest(
        x_cbtgen_local_dev_secret, expected
    ):
        raise HTTPException(status_code=401, detail="Invalid local development credential.")

    return LOCAL_DEV_OWNER


@app.get("/health")
def health():
    return {
        "service": "cbtgen-document-processing",
        "status": "ok",
        # This is deliberately false until real authentication is integrated.
        "authConfigured": False,
        "localDevelopmentAuthEnabled": _local_dev_enabled(),
    }


@app.post("/v1/extractions")
async def create_extraction(
    file: UploadFile = File(...),
    owner_id: str = Depends(get_authenticated_owner),
):
    filename = file.filename or "source"
    data = await file.read(MAX_SOURCE_BYTES + 1)
    await file.close()

    if len(data) > MAX_SOURCE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="The source document exceeds the 10 MB upload limit.",
        )

    try:
        report = extract_document(filename, data, owner_id=owner_id)
        report = detect_question_structure(report)

        # A4.4: attach conservative, human-review-only crop proposals to PDFs.
        # Keep the existing extraction and segmentation report fields intact.
        source_info = report.get("source", {})
        if str(source_info.get("fileType", "")).lower() == "pdf":
            report["cropProposals"] = propose_pdf_crops(report)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Do not leak internal paths or parser stack traces to clients.
        raise HTTPException(
            status_code=500,
            detail="Document processing failed safely.",
        ) from exc

    return JSONResponse(report)



@app.post("/v1/pages/preview")
async def preview_pdf_page(
    file: UploadFile = File(...),
    page_number: int = Form(...),
    owner_id: str = Depends(get_authenticated_owner),
):
    """Render one PDF page for visual crop selection; do not persist it."""
    filename = file.filename or "source.pdf"
    data = await file.read(MAX_SOURCE_BYTES + 1)
    await file.close()
    if len(data) > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail="The source document exceeds the 10 MB upload limit.")
    if not filename.lower().endswith(".pdf") or not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="A valid PDF source is required.")
    if page_number < 1:
        raise HTTPException(status_code=422, detail="page_number must be a 1-based positive integer.")
    try:
        import pymupdf
        source_hash = hashlib.sha256(data).hexdigest()
        document = pymupdf.open(stream=data, filetype="pdf")
        try:
            if page_number > len(document):
                raise HTTPException(status_code=422, detail="page_number is outside the source PDF.")
            page = document[page_number - 1]
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(150 / 72, 150 / 72), alpha=False)
            png = pixmap.tobytes("png")
            if len(png) > 12_000_000:
                raise HTTPException(status_code=413, detail="Rendered page preview is too large.")
            return JSONResponse({
                "pageNumber": page_number,
                "pageCount": len(document),
                "sourceSha256": source_hash,
                "pageWidthPoints": float(page.rect.width),
                "pageHeightPoints": float(page.rect.height),
                "imageWidthPixels": int(pixmap.width),
                "imageHeightPixels": int(pixmap.height),
                "imageDataUrl": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
                "reviewStatus": "preview-only",
                "persisted": False,
                "owner": {"userId": owner_id},
            })
        finally:
            document.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The PDF page could not be rendered safely.") from exc

@app.post("/v1/crops")
async def create_crop(
    file: UploadFile = File(...),
    source_sha256: str = Form(...),
    page_number: int = Form(...),
    region_bounds: str = Form(...),
    content_bounds: str | None = Form(default=None),
    role: str = Form(default="content-region"),
    padding_points: float = Form(default=2.0),
    dpi: int = Form(default=180),
    owner_id: str = Depends(get_authenticated_owner),
):
    # Create a review-pending PNG crop from an authenticated PDF upload.
    filename = file.filename or "source.pdf"
    data = await file.read(MAX_SOURCE_BYTES + 1)
    await file.close()

    if len(data) > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail="The source document exceeds the 10 MB upload limit.")
    if not filename.lower().endswith(".pdf") or not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="A valid PDF source is required.")

    try:
        parsed_region = json.loads(region_bounds)
        parsed_content = json.loads(content_bounds) if content_bounds else None
        if not isinstance(parsed_region, dict):
            raise ValueError("region_bounds must be a JSON object.")
        if parsed_content is not None and not isinstance(parsed_content, dict):
            raise ValueError("content_bounds must be a JSON object.")

        actual_hash = hashlib.sha256(data).hexdigest()
        if source_sha256.lower() != actual_hash:
            raise CropError("source_sha256 does not match the uploaded PDF.")

        configured_root = os.environ.get("CBTGEN_CROP_OUTPUT_ROOT", "").strip()
        output_root = Path(configured_root).expanduser() if configured_root else (
            Path(__file__).resolve().parents[2] / "packages" / "document_processing" / "data" / "crops"
        )
        result = crop_pdf_region(
            filename, data, owner_id=owner_id, source_sha256=source_sha256,
            page_number=page_number, region_bounds=parsed_region,
            content_bounds=parsed_content, role=role, output_root=output_root,
            padding_points=padding_points, dpi=dpi,
        )

        # Resolve the persisted crop and ensure it remains inside the configured root.
        root_resolved = output_root.resolve()
        image_path = (root_resolved / result["path"]).resolve()
        if not image_path.is_relative_to(root_resolved) or not image_path.is_file():
            raise CropError("Generated crop could not be safely retrieved.")
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")

        # Do not expose filesystem paths. Return the image for review and provenance.
        public_result = {
            key: value for key, value in result.items()
            if key not in {"path", "relativePath", "owner"}
        }
        public_result["imageDataUrl"] = "data:image/png;base64," + encoded
        public_result["owner"] = {"userId": owner_id}
        return JSONResponse(public_result)
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid crop geometry or parameters.") from exc
    except CropError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Crop generation failed safely.") from exc


@app.post("/v1/crops/batch")
async def create_crops_batch(
    file: UploadFile = File(...),
    source_sha256: str = Form(...),
    crops: str = Form(...),
    owner_id: str = Depends(get_authenticated_owner),
):
    """Generate multiple review-pending crops from one authenticated PDF upload."""
    filename = file.filename or "source.pdf"
    data = await file.read(MAX_SOURCE_BYTES + 1)
    await file.close()

    if len(data) > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail="The source document exceeds the 10 MB upload limit.")
    if not filename.lower().endswith(".pdf") or not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="A valid PDF source is required.")

    try:
        requests = json.loads(crops)
        if not isinstance(requests, list) or not requests or len(requests) > 100:
            raise ValueError("crops must contain between 1 and 100 requests.")

        actual_hash = hashlib.sha256(data).hexdigest()
        if not hmac.compare_digest(str(source_sha256).lower(), actual_hash):
            raise CropError("Source SHA-256 does not match the uploaded PDF.")

        configured_root = os.environ.get("CBTGEN_CROP_OUTPUT_ROOT", "").strip()
        output_root = Path(configured_root).expanduser() if configured_root else (
            Path(__file__).resolve().parents[2] / "packages" / "document_processing" / "data" / "crops"
        )
        root_resolved = output_root.resolve()
        results = []

        for index, item in enumerate(requests):
            try:
                if not isinstance(item, dict):
                    raise ValueError("Each crop request must be an object.")

                page_number = item.get("pageNumber")
                role = item.get("role")
                region = item.get("regionBounds")
                content = item.get("contentBounds")
                padding = item.get("paddingPoints", 0)
                dpi = item.get("dpi", 150)

                if not isinstance(page_number, int) or isinstance(page_number, bool) or page_number < 1:
                    raise ValueError("Invalid page number.")
                if role not in {"question-content", "option-content"}:
                    raise ValueError("Invalid crop role.")
                if not isinstance(region, dict) or (content is not None and not isinstance(content, dict)):
                    raise ValueError("Invalid crop bounds.")
                if not isinstance(padding, (int, float)) or isinstance(padding, bool) or not 0 <= padding <= 24:
                    raise ValueError("Invalid crop padding.")
                if not isinstance(dpi, int) or isinstance(dpi, bool) or not 72 <= dpi <= 300:
                    raise ValueError("Invalid crop resolution.")

                result = crop_pdf_region(
                    filename,
                    data,
                    owner_id=owner_id,
                    source_sha256=actual_hash,
                    page_number=page_number,
                    region_bounds=region,
                    content_bounds=content,
                    role=role,
                    output_root=output_root,
                    padding_points=padding,
                    dpi=dpi,
                )

                image_path = (root_resolved / result["path"]).resolve()
                if not image_path.is_relative_to(root_resolved) or not image_path.is_file():
                    raise CropError("Generated crop could not be safely retrieved.")

                public_result = {
                    key: value for key, value in result.items()
                    if key not in {"path", "relativePath", "owner"}
                }
                public_result["imageDataUrl"] = (
                    "data:image/png;base64,"
                    + base64.b64encode(image_path.read_bytes()).decode("ascii")
                )
                public_result["owner"] = {"userId": owner_id}
                results.append({"requestIndex": index, "ok": True, "result": public_result})

            except (ValueError, TypeError, CropError, KeyError):
                results.append({
                    "requestIndex": index,
                    "ok": False,
                    "error": "This crop request failed validation or could not be processed.",
                })
            except Exception:
                results.append({
                    "requestIndex": index,
                    "ok": False,
                    "error": "Crop generation failed safely.",
                })

        return JSONResponse({
            "sourceSha256": actual_hash,
            "reviewStatus": "needs-review",
            "results": results,
        })

    except HTTPException:
        raise
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid batch crop request.") from exc
    except CropError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Batch crop generation failed safely.") from exc
