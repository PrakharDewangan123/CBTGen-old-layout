"""Conservative, review-only crop proposals for PDF question extraction.

This module proposes geometry only. It does not render images, remove labels,
infer answers, approve crops, or modify the canonical CBTGen XML contract.
All coordinates use PDF points.
"""

from __future__ import annotations

from hashlib import sha256
import json
import math
import re
from typing import Any


PROPOSAL_VERSION = "1.2"


def _stable_id(source_hash: str, page: int, role: str, identity: str,
               bounds: dict[str, float]) -> str:
    canonical = json.dumps(
        {
            "version": PROPOSAL_VERSION,
            "sourceSha256": source_hash,
            "pageNumber": page,
            "role": role,
            "identity": identity,
            "bounds": {
                key: round(bounds[key], 3)
                for key in ("x", "y", "width", "height")
            },
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return "proposal-" + sha256(canonical.encode("utf-8")).hexdigest()[:24]


def _valid_bounds(value: Any, page_width: float,
                  page_height: float) -> dict[str, float] | None:
    if not isinstance(value, dict):
        return None

    try:
        x = float(value["x"])
        y = float(value["y"])
        width = float(value["width"])
        height = float(value["height"])
    except (KeyError, TypeError, ValueError):
        return None

    if not all(math.isfinite(v) for v in (x, y, width, height)):
        return None
    if width <= 0 or height <= 0:
        return None
    if x < 0 or y < 0 or x + width > page_width or y + height > page_height:
        return None

    return {
        "x": round(x, 3),
        "y": round(y, 3),
        "width": round(width, 3),
        "height": round(height, 3),
    }


def _page_elements(page: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result = {}
    for element in page.get("elements", []):
        if not isinstance(element, dict):
            continue
        element_id = element.get("elementId")
        if element_id:
            result[str(element_id)] = element
    return result


def _option_word_bounds(
    element: dict[str, Any],
    option: dict[str, Any],
    grouped_options: list[dict[str, Any]],
    page_width: float,
    page_height: float,
) -> dict[str, float] | None:
    """Estimate option-body bounds from OCR words with verified text offsets."""
    source = option.get("source", {})
    try:
        line_index = int(source.get("lineIndex"))
        marker_start = int(source.get("markerStart"))
    except (TypeError, ValueError):
        return None

    lines = element.get("textLines", [])
    line = next(
        (item for item in lines if isinstance(item, dict)
         and item.get("lineIndex") == line_index),
        None,
    ) if isinstance(lines, list) else None
    text = line.get("text") if isinstance(line, dict) else element.get("text")
    words = element.get("wordBounds")
    if not isinstance(text, str) or not isinstance(words, list) or not words:
        return None

    label = str(option.get("printedLabel", "")).upper()
    marker_pattern = re.compile(
        r"\(\s*" + re.escape(label) + r"\s*\)|"
        r"\[\s*" + re.escape(label) + r"\s*\]",
        re.I,
    )
    marker = marker_pattern.match(text, marker_start)
    if not marker:
        return None

    body_start = marker.end()
    body_end = len(text)
    for sibling in grouped_options:
        if sibling is option:
            continue
        sibling_source = sibling.get("source", {})
        try:
            sibling_line = int(sibling_source.get("lineIndex"))
            sibling_start = int(sibling_source.get("markerStart"))
        except (TypeError, ValueError):
            continue
        if sibling_line == line_index and sibling_start > marker_start:
            body_end = min(body_end, sibling_start)

    while body_start < body_end and text[body_start].isspace():
        body_start += 1
    while body_end > body_start and text[body_end - 1].isspace():
        body_end -= 1
    if body_start >= body_end:
        return None

    boxes = []
    for word in words:
        if not isinstance(word, dict):
            return None
        try:
            start = int(word["start"])
            end = int(word["end"])
        except (KeyError, TypeError, ValueError):
            return None
        if end <= body_start or start >= body_end:
            continue
        bounds = _valid_bounds(
            word.get("bounds"), page_width, page_height
        )
        if not bounds:
            return None
        boxes.append(bounds)

    if not boxes:
        return None
    x0 = min(box["x"] for box in boxes)
    y0 = min(box["y"] for box in boxes)
    x1 = max(box["x"] + box["width"] for box in boxes)
    y1 = max(box["y"] + box["height"] for box in boxes)
    return _valid_bounds({
        "x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0,
    }, page_width, page_height)


def _option_character_bounds(
    element: dict[str, Any],
    option: dict[str, Any],
    grouped_options: list[dict[str, Any]],
    page_width: float,
    page_height: float,
) -> dict[str, float] | None:
    """Find text-body geometry only when source characters match the line exactly."""
    option_source = option.get("source", {})
    try:
        line_index = int(option_source.get("lineIndex"))
        marker_start = int(option_source.get("markerStart"))
    except (TypeError, ValueError):
        return None

    lines = element.get("textLines", [])
    if not isinstance(lines, list):
        return None
    line = next(
        (item for item in lines
         if isinstance(item, dict) and item.get("lineIndex") == line_index),
        None,
    )
    if not line or not isinstance(line.get("text"), str):
        return None

    text = line["text"]
    characters = line.get("characters")
    if not isinstance(characters, list) or not characters:
        return None

    # PyMuPDF rawdict character records use "c" and "bbox".
    if "".join(str(char.get("c", "")) for char in characters) != text:
        return None
    if marker_start < 0 or marker_start >= len(text):
        return None

    label = str(option.get("printedLabel", "")).upper()
    marker_pattern = re.compile(
        r"\(\s*" + re.escape(label) + r"\s*\)|"
        r"\[\s*" + re.escape(label) + r"\s*\]",
        re.I,
    )
    marker = marker_pattern.match(text, marker_start)
    if not marker:
        return None

    body_start = marker.end()
    body_end = len(text)

    # If several options share a line, stop before the next sibling marker.
    sibling_starts = []
    for sibling in grouped_options:
        if sibling is option:
            continue
        sibling_source = sibling.get("source", {})
        try:
            sibling_line = int(sibling_source.get("lineIndex"))
            sibling_start = int(sibling_source.get("markerStart"))
        except (TypeError, ValueError):
            continue
        if sibling_line == line_index and sibling_start > marker_start:
            sibling_starts.append(sibling_start)
    if sibling_starts:
        body_end = min(body_end, min(sibling_starts))

    # Ignore whitespace at both ends; require actual non-space body characters.
    while body_start < body_end and text[body_start].isspace():
        body_start += 1
    while body_end > body_start and text[body_end - 1].isspace():
        body_end -= 1
    if body_start >= body_end:
        return None

    boxes = []
    for char in characters[body_start:body_end]:
        bbox = char.get("bbox")
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            return None
        try:
            x0, y0, x1, y1 = map(float, bbox)
        except (TypeError, ValueError):
            return None
        if not all(math.isfinite(v) for v in (x0, y0, x1, y1)):
            return None
        if x1 <= x0 or y1 <= y0:
            return None
        boxes.append((x0, y0, x1, y1))

    # Include only the verified text body. Diagrams and other separate visual
    # elements may lie outside it, so completeness must remain unverified.
    return _valid_bounds({
        "x": min(box[0] for box in boxes),
        "y": min(box[1] for box in boxes),
        "width": max(box[2] for box in boxes) - min(box[0] for box in boxes),
        "height": max(box[3] for box in boxes) - min(box[1] for box in boxes),
    }, page_width, page_height)


def propose_pdf_crops(report: dict[str, Any]) -> dict[str, Any]:
    """Return review-pending geometry proposals without changing source data.

    Question proposals are conservative page-width bands from a detected
    question anchor to the next detected question anchor on that page.
    Option proposals use their source element bounds where available.

    Printed-label exclusion cannot be established from block-level geometry.
    Consequently every proposal requires human review, and ambiguous label
    boundaries are explicitly flagged.
    """
    if not isinstance(report, dict):
        raise ValueError("report must be an object")

    source = report.get("source", {})
    source_hash = str(source.get("sha256", "")).lower()
    if len(source_hash) != 64 or any(c not in "0123456789abcdef" for c in source_hash):
        raise ValueError("A valid source SHA-256 is required")

    segmentation = report.get("segmentation", {})
    pages = report.get("pages", [])
    questions = segmentation.get("questions", [])

    page_by_number = {}
    for page in pages:
        if not isinstance(page, dict):
            continue
        try:
            number = int(page.get("pageNumber"))
            width = float(page.get("width"))
            height = float(page.get("height"))
        except (TypeError, ValueError):
            continue
        if (
            number > 0
            and math.isfinite(width)
            and math.isfinite(height)
            and width > 0
            and height > 0
        ):
            page_by_number[number] = {
                **page,
                "_proposalWidth": width,
                "_proposalHeight": height,
                "_elementMap": _page_elements(page),
            }

    questions_by_page: dict[int, list[dict[str, Any]]] = {}
    for question in questions:
        if not isinstance(question, dict):
            continue
        source_info = question.get("source", {})
        try:
            page_number = int(source_info.get("pageNumber"))
        except (TypeError, ValueError):
            continue
        if page_number in page_by_number:
            questions_by_page.setdefault(page_number, []).append(question)

    proposals = []
    page_results = []

    for page_number in sorted(page_by_number):
        page = page_by_number[page_number]
        page_width = page["_proposalWidth"]
        page_height = page["_proposalHeight"]
        element_map = page["_elementMap"]

        anchors = []
        for question in questions_by_page.get(page_number, []):
            source_info = question.get("source", {})
            element_id = str(source_info.get("elementId", ""))
            element = element_map.get(element_id)
            bounds = _valid_bounds(
                element.get("bounds") if element else None,
                page_width,
                page_height,
            )
            if bounds:
                anchors.append((bounds["y"], question, bounds, element_id))

        anchors.sort(key=lambda item: (item[0], str(item[1].get("questionId", ""))))

        page_proposal_ids = []
        page_uncertainties = []

        for index, (anchor_y, question, anchor_bounds, element_id) in enumerate(anchors):
            inferred_final_boundary = False

            if index + 1 < len(anchors):
                next_anchor_y = anchors[index + 1][0]
            else:
                # For the final question, use valid option geometry to
                # propose a lower boundary when available. This remains
                # a heuristic and never constitutes human approval.
                option_bottoms = []
                options = question.get("options", [])

                for option in options if isinstance(options, list) else []:
                    if not isinstance(option, dict):
                        continue

                    option_source = option.get("source", {})
                    option_element_id = str(
                        option_source.get("elementId")
                        or option.get("sourceElementId")
                        or ""
                    )
                    option_element = element_map.get(option_element_id)

                    option_bounds = _valid_bounds(
                        option_element.get("bounds") if option_element else None,
                        page_width,
                        page_height,
                    )

                    if option_bounds:
                        option_bottoms.append(
                            option_bounds["y"] + option_bounds["height"]
                        )

                answer_key_top = None
                answer_key_pattern = re.compile(
                    r"\b(?:answer\s*key|answers?\s+for\s+the\s+above\s+questions|correct\s+answers?)\b",
                    re.I,
                )
                for page_element in page.get("elements", []):
                    if not isinstance(page_element, dict):
                        continue
                    if not answer_key_pattern.search(
                        str(page_element.get("text", ""))
                    ):
                        continue
                    heading_bounds = _valid_bounds(
                        page_element.get("bounds"),
                        page_width,
                        page_height,
                    )
                    if heading_bounds is None:
                        continue
                    heading_y = heading_bounds["y"]
                    if heading_y > anchor_y and (
                        answer_key_top is None or heading_y < answer_key_top
                    ):
                        answer_key_top = heading_y

                if option_bottoms:
                    option_bottom = max(option_bottoms)
                    next_anchor_y = min(
                        page_height,
                        max(
                            anchor_bounds["y"] + anchor_bounds["height"],
                            option_bottom + 12.0,
                        ),
                    )
                    inferred_final_boundary = True
                    if answer_key_top is not None:
                        next_anchor_y = min(
                            next_anchor_y,
                            max(
                                anchor_y + anchor_bounds["height"],
                                answer_key_top - 3.0,
                            ),
                        )
                else:
                    # Preserve the conservative fallback when option geometry
                    # is unavailable, while respecting a detected answer key.
                    next_anchor_y = page_height
                    if answer_key_top is not None:
                        next_anchor_y = min(
                            next_anchor_y,
                            max(
                                anchor_y + anchor_bounds["height"],
                                answer_key_top - 3.0,
                            ),
                        )

            # Avoid a zero-height or inverted band when extraction candidates
            # share the same vertical coordinate.
            band_top = max(0.0, anchor_y)
            band_bottom = min(page_height, next_anchor_y)
            if band_bottom <= band_top:
                band_bottom = min(
                    page_height,
                    max(band_top + anchor_bounds["height"], band_top + 1.0),
                )

            if band_bottom <= band_top:
                page_uncertainties.append("INVALID_QUESTION_BAND")
                continue

            # Use the question anchor's horizontal extent rather than the
            # entire page width. This avoids automatically including unrelated
            # columns and side content. Vertical coverage remains heuristic.
            question_bounds = _valid_bounds({
                "x": anchor_bounds["x"],
                "y": band_top,
                "width": anchor_bounds["width"],
                "height": band_bottom - band_top,
            }, page_width, page_height)

            if not question_bounds:
                page_uncertainties.append("INVALID_QUESTION_BOUNDS")
                continue

            question_id = str(question.get("questionId", ""))
            uncertainty_codes = [
                "PRINTED_QUESTION_LABEL_EXCLUSION_UNVERIFIED",
                "QUESTION_CONTENT_AND_DIAGRAM_COMPLETENESS_UNVERIFIED",
                "QUESTION_WIDTH_LIMITED_TO_ANCHOR; RELATED_CONTENT_MAY_BE_MISSING",
                "HUMAN_BOUNDARY_REVIEW_REQUIRED",
            ]

            if inferred_final_boundary:
                uncertainty_codes.append(
                    "FINAL_QUESTION_BOUNDARY_INFERRED_FROM_OPTION_GEOMETRY"
                )

            proposal = {
                "proposalId": _stable_id(
                    source_hash, page_number, "question-content",
                    question_id or element_id, question_bounds,
                ),
                "proposalVersion": PROPOSAL_VERSION,
                "role": "question-content",
                "questionId": question_id or None,
                "optionId": None,
                "pageNumber": page_number,
                "sourceElementId": element_id,
                "sourceBounds": anchor_bounds,
                "regionBounds": question_bounds,
                "contentBounds": question_bounds.copy(),
                "coordinateUnit": "pdf-points",
                "proposalStatus": "proposed",
                "reviewStatus": "needs-review",
                "confidence": {
                    "level": "low",
                    "meaning": "Geometry heuristic only; not semantic or visual verification.",
                    "geometry": "validated-page-bounds",
                    "boundary": "unverified",
                    "contentCompleteness": "unverified",
                    "printedLabelExclusion": "unverified",
                },
                "qualityChecks": {
                    "boundsInsidePage": True,
                    "visualInspectionCompleted": False,
                    "contentCompletenessVerified": False,
                    "printedLabelExclusionVerified": False,
                },
                "uncertaintyCodes": uncertainty_codes,
                "labelExclusionConfirmed": False,
                "humanApprovalRequired": True,
            }
            proposals.append(proposal)
            page_proposal_ids.append(proposal["proposalId"])
            page_uncertainties.extend(uncertainty_codes)

            # Option crops are proposed only when the segmenter points to a
            # source element with its own valid geometry. Multiple options
            # mapped to one element are explicitly marked ambiguous.
            options = question.get("options", [])
            options_by_element: dict[str, list[dict[str, Any]]] = {}
            for option in options if isinstance(options, list) else []:
                if not isinstance(option, dict):
                    continue
                option_source = option.get("source", {})
                option_element_id = str(
                    option_source.get("elementId")
                    or option.get("sourceElementId")
                    or ""
                )
                if option_element_id:
                    options_by_element.setdefault(option_element_id, []).append(option)

            for option_element_id, grouped_options in options_by_element.items():
                option_element = element_map.get(option_element_id)
                option_bounds = _valid_bounds(
                    option_element.get("bounds") if option_element else None,
                    page_width,
                    page_height,
                )
                if not option_bounds:
                    page_uncertainties.append("OPTION_SOURCE_GEOMETRY_MISSING")
                    continue

                shared_source = len(grouped_options) > 1
                for option in grouped_options:
                    option_id = str(option.get("optionId", ""))
                    codes = [
                        "PRINTED_OPTION_LABEL_EXCLUSION_UNVERIFIED",
                        "HUMAN_BOUNDARY_REVIEW_REQUIRED",
                    ]
                    if shared_source:
                        codes.append("MULTIPLE_OPTIONS_SHARE_SOURCE_ELEMENT")

                    word_bounds = _option_word_bounds(
                        option_element, option, grouped_options,
                        page_width, page_height,
                    )
                    character_bounds = _option_character_bounds(
                        option_element, option, grouped_options,
                        page_width, page_height,
                    )
                    proposed_content_bounds = (
                        character_bounds or word_bounds or option_bounds
                    )
                    character_geometry_used = character_bounds is not None
                    word_geometry_used = (
                        character_bounds is None and word_bounds is not None
                    )
                    if character_geometry_used or word_geometry_used:
                        codes.extend([
                            "OPTION_TEXT_GEOMETRY_ONLY",
                            "OPTION_VISUAL_COMPLETENESS_UNVERIFIED",
                            "PRINTED_LABEL_EXCLUSION_NOT_VISUALLY_VERIFIED",
                        ])

                    option_proposal = {
                        "proposalId": _stable_id(
                            source_hash, page_number, "option-content",
                            option_id or option_element_id, proposed_content_bounds,
                        ),
                        "proposalVersion": PROPOSAL_VERSION,
                        "role": "option-content",
                        "questionId": question_id or None,
                        "optionId": option_id or None,
                        "printedLabel": option.get("printedLabel"),
                        "pageNumber": page_number,
                        "sourceElementId": option_element_id,
                        "sourceBounds": option_bounds,
                        "regionBounds": option_bounds.copy(),
                        "contentBounds": proposed_content_bounds.copy(),
                        "coordinateUnit": "pdf-points",
                        "proposalStatus": "proposed",
                        "reviewStatus": "needs-review",
                        "confidence": {
                            "level": "low",
                            "meaning": (
                                "Shared source geometry is ambiguous; individual option boundaries cannot be separated reliably."
                                if shared_source
                                else "Source text-block geometry only; visual boundaries and printed-label exclusion remain unverified."
                            ),
                            "geometry": "validated-page-bounds",
                            "boundary": "ambiguous" if shared_source else "unverified",
                            "contentCompleteness": "unverified",
                            "printedLabelExclusion": "unverified",
                        },
                        "qualityChecks": {
                            "boundsInsidePage": True,
                            "visualInspectionCompleted": False,
                            "contentCompletenessVerified": False,
                            "printedLabelExclusionVerified": False,
                            "sharedSourceElement": shared_source,
                            "characterGeometryUsed": character_geometry_used,
                            "wordGeometryUsed": word_geometry_used,
                        },
                        "uncertaintyCodes": codes,
                        "labelExclusionConfirmed": False,
                        "humanApprovalRequired": True,
                    }
                    proposals.append(option_proposal)
                    page_proposal_ids.append(option_proposal["proposalId"])
                    page_uncertainties.extend(codes)

        if not questions_by_page.get(page_number):
            status = "no-question-candidates"
        elif not anchors:
            status = "uncertain-boundaries"
        elif page_uncertainties:
            status = "uncertain-boundaries"
        else:
            status = "proposals-pending-review"

        page_results.append({
            "pageNumber": page_number,
            "status": status,
            "proposalCount": len(page_proposal_ids),
            "proposalIds": page_proposal_ids,
            "uncertaintyCodes": sorted(set(page_uncertainties)),
            "humanApprovalRequired": True,
        })

    return {
        "version": PROPOSAL_VERSION,
        "method": "conservative-pdf-element-geometry",
        "status": "review-required" if proposals else "no-proposals",
        "notice": (
            "Proposals are unverified geometry only. Review all boundaries, "
            "printed labels, diagrams, equations, and option separation before use."
        ),
        "pages": page_results,
        "proposals": proposals,
        "summary": {
            "pageCount": len(page_results),
            "proposalCount": len(proposals),
            "reviewRequiredCount": len(proposals),
            "approvedCount": 0,
        },
    }
