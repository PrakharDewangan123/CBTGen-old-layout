"""Owner-scoped, provenance-preserving PDF region cropping for CBTGen.

Cropping is deliberately geometry-driven. This module never guesses which marks are
printed question/option labels. A caller must supply a reviewed `contentBounds` box
that excludes such labels, while retaining meaningful labels inside a diagram/equation.
All outputs are marked for review until a human approves them.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math
from pathlib import Path
import re
from typing import Any


class CropError(ValueError):
    """Raised when a crop request is invalid or unsafe."""


def _owner(owner_id: str) -> str:
    value = str(owner_id or "").strip()
    if not value or len(value) > 256 or re.search(r"[\x00-\x1f]", value):
        raise CropError("A valid authenticated owner ID is required for cropping.")
    return value


def _rect(value: Any, name: str) -> tuple[float, float, float, float]:
    if not isinstance(value, dict):
        raise CropError(f"{name} must be a rectangle object.")
    try:
        x, y = float(value["x"]), float(value["y"])
        width, height = float(value["width"]), float(value["height"])
    except (KeyError, TypeError, ValueError):
        raise CropError(f"{name} requires numeric x, y, width, and height.") from None
    if not all(math.isfinite(v) for v in (x, y, width, height)) or width <= 0 or height <= 0:
        raise CropError(f"{name} contains invalid dimensions.")
    return x, y, x + width, y + height


def _contained(rect: tuple[float, float, float, float], page_rect: Any) -> bool:
    return rect[0] >= page_rect.x0 and rect[1] >= page_rect.y0 and rect[2] <= page_rect.x1 and rect[3] <= page_rect.y1


def crop_pdf_region(
    filename: str,
    data: bytes,
    *,
    owner_id: str,
    source_sha256: str,
    page_number: int,
    region_bounds: dict[str, Any],
    content_bounds: dict[str, Any] | None = None,
    role: str = "content-region",
    output_root: str | Path,
    padding_points: float = 2.0,
    dpi: int = 180,
    printed_label_evidence: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Render a reviewed PDF content box to a PNG and return manifest metadata.

    `region_bounds` is the detected source region. `content_bounds` is the reviewed
    crop rectangle; use it to exclude a printed Q-number or option marker outside
    the meaningful content. No global label stripping or pixel erasure is performed.
    Coordinates are PDF points, matching PyMuPDF extraction reports.
    """
    _owner_id = _owner(owner_id)
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise CropError("Source PDF bytes are required.")
    actual_hash = sha256(data).hexdigest()
    if not re.fullmatch(r"[a-fA-F0-9]{64}", str(source_sha256 or "")) or actual_hash.lower() != source_sha256.lower():
        raise CropError("Source SHA-256 does not match the supplied PDF bytes.")
    if not isinstance(page_number, int) or isinstance(page_number, bool) or page_number < 1:
        raise CropError("page_number must be a 1-based positive integer.")
    if not isinstance(role, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,47}", role):
        raise CropError("role must be a short lowercase identifier.")
    try:
        padding = float(padding_points)
        render_dpi = int(dpi)
    except (TypeError, ValueError):
        raise CropError("Crop padding and DPI must be numeric.") from None
    if not math.isfinite(padding) or padding < 0 or padding > 24 or not 72 <= render_dpi <= 360:
        raise CropError("Padding must be 0–24 points and DPI must be 72–360.")
    source_rect = _rect(region_bounds, "region_bounds")
    chosen_rect = _rect(content_bounds if content_bounds is not None else region_bounds, "content_bounds")
    if chosen_rect[0] < source_rect[0] or chosen_rect[1] < source_rect[1] or chosen_rect[2] > source_rect[2] or chosen_rect[3] > source_rect[3]:
        raise CropError("content_bounds must be fully contained inside region_bounds.")
    if printed_label_evidence is not None and not isinstance(printed_label_evidence, list):
        raise CropError("printed_label_evidence must be a list of source evidence objects.")

    try:
        import pymupdf
        from PIL import Image
        from io import BytesIO
        with pymupdf.open(stream=bytes(data), filetype="pdf") as document:
            if document.is_encrypted:
                raise CropError("Encrypted PDFs cannot be cropped until unlocked.")
            if page_number > document.page_count:
                raise CropError("page_number exceeds the PDF page count.")
            page = document[page_number - 1]
            rect = pymupdf.Rect(*chosen_rect)
            if not _contained(chosen_rect, page.rect):
                raise CropError("The requested content bounds fall outside the source page.")
            # If a reviewer supplied a narrower content box, it is specifically intended
            # to exclude adjacent printed identifiers. Do not re-expand it with padding.
            reviewed_tighter_box = any(abs(a - b) > 0.001 for a, b in zip(chosen_rect, source_rect))
            applied_padding = 0.0 if reviewed_tighter_box else padding
            padded = pymupdf.Rect(max(page.rect.x0, rect.x0 - applied_padding), max(page.rect.y0, rect.y0 - applied_padding),
                               min(page.rect.x1, rect.x1 + applied_padding), min(page.rect.y1, rect.y1 + applied_padding))
            pix = page.get_pixmap(matrix=pymupdf.Matrix(render_dpi / 72, render_dpi / 72), clip=padded, alpha=False)
            png_bytes = pix.tobytes("png")
            with Image.open(BytesIO(png_bytes)) as image:
                image.verify()
            with Image.open(BytesIO(png_bytes)) as image:
                width_px, height_px = image.size
    except CropError:
        raise
    except Exception as exc:
        raise CropError(f"PDF region could not be rendered: {type(exc).__name__}.") from None

    # Stable content identity; ownership is enforced by a separate scoped path and metadata.
    canonical = json.dumps({"source": actual_hash, "page": page_number, "role": role,
                            "contentBounds": [round(v, 3) for v in chosen_rect]}, sort_keys=True, separators=(",", ":"))
    asset_id = "asset-" + sha256(canonical.encode("utf-8")).hexdigest()[:24]
    owner_scope = sha256(_owner_id.encode("utf-8")).hexdigest()[:24]
    relative_path = Path("users") / owner_scope / actual_hash / f"{asset_id}.png"
    root = Path(output_root).resolve()
    destination = (root / relative_path).resolve()
    if root not in destination.parents:
        raise CropError("Resolved crop output path escaped its output root.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Do not overwrite an existing asset with different bytes under the same stable ID.
    if destination.exists() and sha256(destination.read_bytes()).hexdigest() != sha256(png_bytes).hexdigest():
        raise CropError("An existing asset ID has conflicting bytes; refusing to overwrite it.")
    if not destination.exists():
        destination.write_bytes(png_bytes)

    return {
        "assetId": asset_id,
        "owner": {"userId": _owner_id},
        "source": {"sha256": actual_hash, "fileName": Path(str(filename or "source.pdf")).name[:240],
                   "pageNumber": page_number},
        "role": role,
        "mimeType": "image/png",
        "path": relative_path.as_posix(),
        "sha256": sha256(png_bytes).hexdigest(),
        "byteLength": len(png_bytes),
        "dimensions": {"width": width_px, "height": height_px},
        "sourceBounds": {"x": source_rect[0], "y": source_rect[1], "width": source_rect[2] - source_rect[0], "height": source_rect[3] - source_rect[1]},
        "contentBounds": {"x": chosen_rect[0], "y": chosen_rect[1], "width": chosen_rect[2] - chosen_rect[0], "height": chosen_rect[3] - chosen_rect[1]},
        "requestedPaddingPoints": padding,
        "appliedPaddingPoints": applied_padding,
        "renderedBounds": {"x": float(padded.x0), "y": float(padded.y0), "width": float(padded.width), "height": float(padded.height)},
        "renderDpi": render_dpi,
        "printedLabelEvidence": printed_label_evidence or [],
        "labelExclusionMode": "reviewed-content-bounds; no text/pixel erasure",
        "reviewStatus": "needs-review",
        "validation": {"pngVerified": True, "boundsInsidePage": True, "sourceHashMatched": True,
                       "manualContentAndLabelCheckRequired": True},
    }
