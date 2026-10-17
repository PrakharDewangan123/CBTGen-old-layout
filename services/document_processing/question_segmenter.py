"""Conservative question/option boundary detection over CBTGen extraction reports.

This module identifies textual boundary candidates only. It does not solve questions,
assert answer correctness, infer missing answer keys, or crop images. Every result keeps
source element and text-line provenance and is marked for human review.
"""
from __future__ import annotations

from hashlib import sha256
import re
from typing import Any, Iterable

# Restrict question markers to line starts and require punctuation or a word boundary.

_QUESTION_PATTERNS = (
    re.compile(r"^\s*Q\s*\.?\s*(?P<number>[1-9]\d{0,2})\s*[.)\]:-]?\s+(?P<body>\S.*)$", re.I),
    re.compile(r"^\s*(?:question\s*)?(?P<number>[1-9]\d{0,2})\s*[.)\]:-]\s*(?P<body>\S.*)$", re.I),
    re.compile(r"^\s*question\s+(?P<number>[1-9]\d{0,2})\s*[:.)-]?\s*(?P<body>\S.*)$", re.I),
    re.compile(r"^\s*Q\s*(?P<number>[1-9]\d{0,2})\s*[.)\]:-]\s*(?P<body>\S.*)$", re.I),
)

_STANDALONE_Q_PATTERN = re.compile(
    r"^\s*Q\s*\.\s*(?P<number>[1-9]\d{0,2})\s*[.)]?\s*$",
    re.I,
)

_INSTRUCTION_LINE_PATTERN = re.compile(
    r"^\s*(?:"
    r"this section contains|each question has|for each question\b|"
    r"marks will be awarded|full marks|partial marks|zero marks|negative marks|"
    r"for example,|space for rough work|answers for the above questions|"
    r"\([A-D]\)\s+and\s*$|"
    r"\([A-D]\)\s+are all the correct options\b|"
    r"\([A-D]\)\s+will result in\b"
    r")",
    re.I,
)


_OPTION_LABEL = r"(?:XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I|[A-H]|[1-4])"
_OPTION_PATTERN = re.compile(
    rf"^\s*(?:\((?P<paren>{_OPTION_LABEL})\)|"
    rf"\[(?P<bracket>{_OPTION_LABEL})\]|"
    rf"(?P<plain>{_OPTION_LABEL})\s*[.)])\s*(?P<body>\S.*)$",
    re.I,
)
_SECTION_PATTERN = re.compile(
    r"^\s*(?P<label>(?:SECTION|PART)\s+[A-Z0-9IVX]+)\b\s*[:.)-]?\s*(?P<title>.*)$",
    re.I,
)
_MARKS_PATTERN = re.compile(
    r"\[\s*(\d+(?:\.\d+)?)\s*marks?\s*\]|"
    r"\(\s*(\d+(?:\.\d+)?)\s*marks?\s*\)|"
    r"\+\s*(\d+(?:\.\d+)?)\s*marks?",
    re.I,
)
_OPTION_MARKER_PATTERN = re.compile(
    rf"(?<!\S)(?:\((?P<paren>{_OPTION_LABEL})\)|"
    rf"\[(?P<bracket>{_OPTION_LABEL})\])(?=\s)",
    re.I,
)


def _option_label_key(label: str) -> tuple[str, int] | None:
    """Return a label family and sequence value for conservative validation."""
    value = label.strip()
    upper = value.upper()

    if re.fullmatch(r"[A-H]", upper):
        return ("alpha", ord(upper) - ord("A") + 1)

    roman_values = {
        "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
        "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12,
    }
    if upper in roman_values:
        return ("roman", roman_values[upper])

    if re.fullmatch(r"[1-4]", value):
        return ("numeric", int(value))

    return None


def _option_segments(line: str) -> list[tuple[str, str, int]]:
    """Return conservative option segments, preserving each marker's offset."""
    markers = list(_OPTION_MARKER_PATTERN.finditer(line))

    if len(markers) >= 2:
        labels = [
            (match.group("paren") or match.group("bracket"))
            for match in markers
        ]
        keys = [_option_label_key(label) for label in labels]
        consecutive = (
            all(key is not None for key in keys)
            and len({key[0] for key in keys if key is not None}) == 1
            and all(
                keys[index][1] == keys[index - 1][1] + 1
                for index in range(1, len(keys))
                if keys[index] is not None and keys[index - 1] is not None
            )
        )

        if consecutive:
            segments = []
            for index, marker in enumerate(markers):
                end = markers[index + 1].start() if index + 1 < len(markers) else len(line)
                body = line[marker.end():end].strip()
                if not body:
                    break
                segments.append((labels[index], body, marker.start()))
            else:
                if len(segments) == len(markers):
                    return segments

    match = _OPTION_PATTERN.match(line)
    if match:
        label = match.group("paren") or match.group("bracket") or match.group("plain")
        return [(label, match.group("body").strip(), match.start())]

    return []



def _iter_text_sources(report: dict[str, Any]) -> Iterable[dict[str, Any]]:
    """Yield textual elements, spatially pairing standalone PDF question labels."""
    if report.get("source", {}).get("fileType") == "pdf":
        for page in report.get("pages", []):
            elements = [
                {**element, "pageNumber": page.get("pageNumber"),
                 "sourceElementId": element.get("elementId")}
                for element in page.get("elements", [])
                if str(element.get("text", "")).strip()
            ]

            labels = []
            for element in elements:
                match = _STANDALONE_Q_PATTERN.fullmatch(
                    str(element.get("text", "")).strip()
                )
                bounds = element.get("bounds")
                if match and isinstance(bounds, dict) and isinstance(bounds.get("y"), (int, float)):
                    labels.append((element, int(match.group("number"))))

            paired_label_ids = set()
            paired_text = {}
            for label, number in labels:
                lb = label["bounds"]
                lx = float(lb.get("x", 0))
                ly = float(lb["y"])
                choices = []
                for candidate in elements:
                    if candidate is label or candidate.get("elementId") in paired_text:
                        continue
                    text = str(candidate.get("text", "")).strip()
                    cb = candidate.get("bounds")
                    if not text or not isinstance(cb, dict):
                        continue
                    if _STANDALONE_Q_PATTERN.fullmatch(text) or _SECTION_PATTERN.match(text):
                        continue
                    if not isinstance(cb.get("x"), (int, float)) or not isinstance(cb.get("y"), (int, float)):
                        continue
                    cx, cy = float(cb["x"]), float(cb["y"])
                    # Prefer the first question-text line above or nearly level
                    # with the standalone printed label. A later continuation
                    # line must not win just because its y-coordinate is closer.
                    vertical_gap = ly - cy
                    if cx <= lx + 8:
                        continue
                    if vertical_gap < -2 or vertical_gap > 14:
                        continue
                    choices.append((vertical_gap, cx - lx, candidate))
                if choices:
                    _, _, target = min(
                        choices,
                        key=lambda item: (abs(item[0]), item[1]),
                    )
                    paired_text[target["elementId"]] = (number, label)
                    paired_label_ids.add(label["elementId"])

            # Pair standalone alphabetic option labels with nearby body
            # elements before ordinary text segmentation. Require a spatially
            # aligned body and a consecutive label sequence to reduce false
            # positives from equations, prose, and isolated parenthesized text.
            option_label_pattern = re.compile(
                r"^\s*(?:\((?P<paren>[A-Ha-h])\)|"
                r"\[(?P<bracket>[A-Ha-h])\]|"
                r"(?P<plain>[A-Ha-h])\s*[.)])\s*$",
                re.I,
            )
            standalone_option_labels = []
            for item in elements:
                if item.get("elementId") in paired_label_ids:
                    continue
                label_match = option_label_pattern.fullmatch(
                    str(item.get("text", "")).strip()
                )
                bounds = item.get("bounds")
                if (
                    label_match
                    and isinstance(bounds, dict)
                    and isinstance(bounds.get("x"), (int, float))
                    and isinstance(bounds.get("y"), (int, float))
                ):
                    label_value = (
                        label_match.group("paren")
                        or label_match.group("bracket")
                        or label_match.group("plain")
                    ).upper()
                    standalone_option_labels.append(
                        (item, label_value, float(bounds["y"]))
                    )

            option_pairs = []
            reserved_body_ids = set()
            for label_element, label_value, label_y in standalone_option_labels:
                label_bounds = label_element["bounds"]
                label_x = float(label_bounds["x"])
                choices = []

                for candidate in elements:
                    candidate_id = candidate.get("elementId")
                    if (
                        candidate is label_element
                        or candidate_id in paired_text
                        or candidate_id in reserved_body_ids
                    ):
                        continue

                    candidate_text = str(candidate.get("text", "")).strip()
                    candidate_bounds = candidate.get("bounds")
                    if not candidate_text or not isinstance(candidate_bounds, dict):
                        continue
                    if (
                        option_label_pattern.fullmatch(candidate_text)
                        or _STANDALONE_Q_PATTERN.fullmatch(candidate_text)
                        or _SECTION_PATTERN.match(candidate_text)
                        or _INSTRUCTION_LINE_PATTERN.search(candidate_text)
                        or re.search(
                            r"\b(?:answer\s*key|answers?\s+for\s+the\s+above\s+questions|ans\s+for\s+q\.?\s*\d+)\b",
                            candidate_text,
                            re.I,
                        )
                        or _question_marker(candidate_text)
                        or _option_segments(candidate_text)
                    ):
                        continue

                    candidate_x = candidate_bounds.get("x")
                    candidate_y = candidate_bounds.get("y")
                    if not isinstance(candidate_x, (int, float)) or not isinstance(
                        candidate_y, (int, float)
                    ):
                        continue

                    horizontal_gap = float(candidate_x) - label_x
                    vertical_gap = abs(float(candidate_y) - label_y)
                    if not 8 < horizontal_gap <= 240 or vertical_gap > 14:
                        continue

                    choices.append(
                        (vertical_gap, horizontal_gap, candidate)
                    )

                if choices:
                    _, _, body_element = min(
                        choices, key=lambda item: (item[0], item[1])
                    )
                    reserved_body_ids.add(body_element.get("elementId"))
                    option_pairs.append(
                        (label_element, label_value, label_y, body_element)
                    )

            # Accept only runs of at least two spatially paired, consecutive
            # labels. A single isolated "(A)" is not enough evidence.
            option_pairs.sort(key=lambda item: (item[2], item[1]))
            accepted_option_pairs = []
            run = []
            for pair in option_pairs:
                if run:
                    previous = run[-1]
                    consecutive = ord(pair[1]) == ord(previous[1]) + 1
                    nearby = 0 < pair[2] - previous[2] <= 100
                    if not consecutive or not nearby:
                        if len(run) >= 2:
                            accepted_option_pairs.extend(run)
                        run = []
                run.append(pair)
            if len(run) >= 2:
                accepted_option_pairs.extend(run)

            for label_element, label_value, _, body_element in accepted_option_pairs:
                body_element["text"] = (
                    f"({label_value}) {str(body_element['text']).strip()}"
                )
                body_element["printedOptionLabelSourceElementId"] = (
                    label_element.get("elementId")
                )
                body_element["spatiallyPairedStandaloneOptionLabel"] = True
                paired_label_ids.add(label_element.get("elementId"))

            ordered = sorted(
                (e for e in elements if e.get("elementId") not in paired_label_ids),
                key=lambda e: (
                    float(e.get("bounds", {}).get("y", 0)),
                    float(e.get("bounds", {}).get("x", 0)),
                    str(e.get("elementId", "")),
                ),
            )
            for element in ordered:
                pairing = paired_text.get(element.get("elementId"))
                if pairing:
                    number, label = pairing
                    # Preserve the text element as the primary source while
                    # retaining the printed-label provenance separately.
                    element["text"] = f"Q.{number} {str(element['text']).strip()}"
                    element["printedLabelSourceElementId"] = label.get("elementId")
                    element["spatiallyPairedStandaloneLabel"] = True
                yield element
    else:
        for element in sorted(report.get("elements", []), key=lambda e: e.get("documentOrder", 0)):
            if element.get("text", "").strip():
                yield {**element, "sourceElementId": element.get("elementId")}
            elif element.get("kind") == "table":
                # Table cells remain source evidence; do not flatten them into guessed question prose.
                for row_index, row in enumerate(element.get("rows", []), start=1):
                    for cell_index, cell in enumerate(row, start=1):
                        if str(cell).strip():
                            yield {"text": str(cell), "kind": "table-cell", "sourceElementId": element.get("elementId"),
                                   "tableRow": row_index, "tableColumn": cell_index,
                                   "documentOrder": element.get("documentOrder", 0)}


def _stable_id(prefix: str, source_hash: str, source_element_id: str, line_index: int, start: int) -> str:
    raw = f"{source_hash}|{source_element_id}|{line_index}|{start}".encode("utf-8")
    return f"{prefix}-{sha256(raw).hexdigest()[:20]}"


def _question_marker(line: str) -> re.Match[str] | None:
    # An explicit Q-number marker is stronger evidence than leading OCR debris.
    # Accept it mid-line only when the prefix looks like mathematical notation.
    embedded = re.search(
        r"\bQ\.?\s*(?P<number>[1-9]\d{0,2})\s*[.):\-]?\s+(?P<body>\S.*)$",
        line,
        re.I,
    )
    if embedded:
        prefix = line[:embedded.start()]
        if prefix and re.fullmatch(r"[\s\d+\-*/=|()[\]{}.,<>_^]+", prefix):
            return embedded

    # Preserve existing behavior for ordinary question markers at line start.
    for pattern in _QUESTION_PATTERNS:
        match = pattern.match(line)
        if match:
            return match

    return None


def detect_question_structure(report: dict[str, Any]) -> dict[str, Any]:
    """Add review-required question/option candidates to a copy of an extraction report."""
    if not isinstance(report, dict) or not isinstance(report.get("source"), dict):
        raise ValueError("A valid document extraction report is required.")
    source_hash = str(report["source"].get("sha256", ""))
    if not re.fullmatch(r"[a-fA-F0-9]{64}", source_hash):
        raise ValueError("The extraction report must contain a valid source SHA-256 digest.")
    if not report.get("owner", {}).get("userId"):
        raise ValueError("Owner metadata is required before segmentation.")

    candidates: list[dict[str, Any]] = []
    options: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    current_question: dict[str, Any] | None = None
    current_option: dict[str, Any] | None = None
    previous_question_number: int | None = None
    pending_standalone_questions: list[dict[str, Any]] = []

    text_sources = list(_iter_text_sources(report))

    # Treat 1.–4. as numeric options only when a complete sequence immediately
    # follows an explicit question stem. Ordinary numbered questions at the
    # start of a document remain question boundaries.
    numeric_option_source_indices: set[int] = set()
    numeric_option_line = re.compile(
        r"^\s*(?P<label>[1-4])[.)]\s*(?P<body>\S.*)$"
    )

    for start_index in range(1, max(1, len(text_sources) - 3)):
        previous_text = str(text_sources[start_index - 1].get("text", "")).strip()
        previous_match = _question_marker(previous_text)

        if previous_match is None or not previous_match.group("body").strip():
            continue

        sequence_indices = range(start_index, start_index + 4)
        if start_index + 3 >= len(text_sources):
            continue

        labels = []
        valid_sequence = True

        for index in sequence_indices:
            candidate_text = str(text_sources[index].get("text", "")).strip()
            match = numeric_option_line.fullmatch(candidate_text)

            if match is None:
                valid_sequence = False
                break

            labels.append(int(match.group("label")))

        if valid_sequence and labels == [1, 2, 3, 4]:
            numeric_option_source_indices.update(sequence_indices)

    for element_index, element in enumerate(text_sources):
        text = str(element.get("text", ""))
        lines = text.splitlines() or [text]
        for line_index, line in enumerate(lines, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            section_match = _SECTION_PATTERN.match(stripped)
            if section_match:
                sections.append({
                    "sectionId": _stable_id("section", source_hash, str(element.get("sourceElementId")), line_index, 0),
                    "label": section_match.group("label"), "title": section_match.group("title").strip(),
                    "source": {"elementId": element.get("sourceElementId"), "lineIndex": line_index,
                               "pageNumber": element.get("pageNumber"), "documentOrder": element.get("documentOrder")},
                    "reviewStatus": "needs-review",
                })
                continue

            standalone_match = (None if element.get("spatiallyPairedStandaloneLabel") else _STANDALONE_Q_PATTERN.fullmatch(stripped))
            if standalone_match:
                number = int(standalone_match.group("number"))
                if previous_question_number is not None and number <= previous_question_number:
                    warnings.append({
                        "code": "QUESTION_NUMBER_SEQUENCE_AMBIGUOUS",
                        "message": "Detected question numbering is not strictly increasing; review boundaries and possible multi-section numbering.",
                        "sourceElementId": element.get("sourceElementId"),
                        "lineIndex": line_index,
                    })
                previous_question_number = number
                current_question = {
                    "questionId": _stable_id(
                        "question", source_hash,
                        str(element.get("sourceElementId")), line_index, 0,
                    ),
                    "printedNumber": number,
                    "textCandidate": "",
                    "marksCandidate": None,
                    "source": {
                        "elementId": element.get("sourceElementId"),
                        "lineIndex": line_index,
                        "pageNumber": element.get("pageNumber"),
                        "documentOrder": element.get("documentOrder"),
                        "extractionMethod": element.get("extractionMethod"),
                        "confidence": element.get("confidence"),
                    },
                    "options": [],
                    "reviewStatus": "needs-review",
                    "confidence": "heuristic-candidate",
                }
                candidates.append(current_question)
                pending_standalone_questions.append(current_question)
                current_question = None
                current_option = None
                continue


            # A matrix-like numeric fragment immediately before an explicit
            # Q-number marker is not a separate numbered question.
            # Keep this rule narrow to avoid suppressing legitimate questions.
            next_text = ""
            if element_index + 1 < len(text_sources):
                next_text = str(
                    text_sources[element_index + 1].get("text", "")
                ).strip()

            matrix_fragment_before_explicit_question = (
                re.fullmatch(
                    r"\s*\d+\s+-\s*\d+(?:\s+-\s*\d+)+\s*",
                    stripped,
                )
                is not None
                and re.match(
                    r"^\s*Q\s*\.?\s*[1-9]\d{0,2}\b",
                    next_text,
                    re.I,
                )
                is not None
            )

            if matrix_fragment_before_explicit_question:
                continue


            # OCR can confuse a damaged option marker with a numbered
            # question, e.g. "4) ... B) ...". Avoid creating a new question
            # when the same line also contains a separate option-like marker.
            numbered_option_fragment = (
                re.match(r"^\s*[1-9]\d{0,2}\)\s+\S", stripped) is not None
                and re.search(
                    r"(?<!\w)[([]?[A-Ha-h][)\].]\s*",
                    stripped[
                        re.match(r"^\s*[1-9]\d{0,2}\)\s+\S", stripped).end():
                    ],
                ) is not None
            )

            if numbered_option_fragment:
                if current_question is not None:
                    current_question["textCandidate"] = (
                        f'{current_question["textCandidate"]}\n{stripped}'
                        if current_question["textCandidate"]
                        else stripped
                    )
                warnings.append({
                    "code": "AMBIGUOUS_OPTION_MARKER",
                    "message": (
                        "A numbered fragment also contains an option-like "
                        "marker; preserve it for manual review."
                    ),
                    "sourceElementId": element.get("sourceElementId"),
                    "lineIndex": line_index,
                })
                continue

            # A short, low-confidence OCR fragment between two question
            # boundaries may resemble "2) 5" without being a real question.
            next_source = (
                text_sources[element_index + 1]
                if element_index + 1 < len(text_sources)
                else {}
            )
            next_source_text = str(next_source.get("text", "")).strip()
            next_source_has_question_marker = (
                _STANDALONE_Q_PATTERN.fullmatch(next_source_text) is not None
                or _question_marker(next_source_text) is not None
            )

            bounds = element.get("bounds")
            current_y = bounds.get("y") if isinstance(bounds, dict) else None
            next_bounds = next_source.get("bounds")
            next_y = (
                next_bounds.get("y")
                if isinstance(next_bounds, dict)
                else None
            )
            low_confidence_ocr_fragment = (
                element.get("extractionMethod") == "tesseract-ocr"
                and isinstance(element.get("confidence"), (int, float))
                and element["confidence"] < 0.6
                and re.fullmatch(r"\s*\d{1,3}\)\s+\d+\s*", stripped) is not None
            )
            fragment_between_questions = (
                current_question is not None
                and current_question.get("source", {}).get("pageNumber")
                    == element.get("pageNumber")
                and next_source.get("pageNumber") == element.get("pageNumber")
                and next_source_has_question_marker
                and isinstance(current_y, (int, float))
                and isinstance(next_y, (int, float))
                and current_y < next_y
            )

            if low_confidence_ocr_fragment and fragment_between_questions:
                current_question["textCandidate"] = (
                    f'{current_question["textCandidate"]}\n{stripped}'
                    if current_question["textCandidate"]
                    else stripped
                )
                warnings.append({
                    "code": "QUESTION_NUMBER_SEQUENCE_AMBIGUOUS",
                    "message": (
                        "A short, low-confidence OCR fragment between "
                        "question boundaries was preserved for manual review."
                    ),
                    "sourceElementId": element.get("sourceElementId"),
                    "lineIndex": line_index,
                })
                continue

            qmatch = (
                None
                if element_index in numeric_option_source_indices
                else _question_marker(stripped)
            )

            if qmatch:
                number = int(qmatch.group("number"))
                if previous_question_number is not None and number <= previous_question_number:
                    warnings.append({"code": "QUESTION_NUMBER_SEQUENCE_AMBIGUOUS", "message": "Detected question numbering is not strictly increasing; review boundaries and possible multi-section numbering.", "sourceElementId": element.get("sourceElementId"), "lineIndex": line_index})
                previous_question_number = number
                marks_matches = list(_MARKS_PATTERN.finditer(stripped))
                marks = marks_matches[-1].group(1) or marks_matches[-1].group(2) or marks_matches[-1].group(3) if marks_matches else None
                current_question = {
                    "questionId": _stable_id("question", source_hash, str(element.get("sourceElementId")), line_index, qmatch.start()),
                    "printedNumber": number,
                    "textCandidate": qmatch.group("body").strip(),
                    "marksCandidate": float(marks) if marks else None,
                    "source": {"elementId": element.get("sourceElementId"), "lineIndex": line_index,
                               "pageNumber": element.get("pageNumber"), "documentOrder": element.get("documentOrder"),
                               "extractionMethod": element.get("extractionMethod"), "confidence": element.get("confidence")},
                    "options": [], "reviewStatus": "needs-review", "confidence": "heuristic-candidate",
                }
                candidates.append(current_question)
                current_option = None
                continue

            if pending_standalone_questions:
                # Do not mistake option lines or section instructions for question text.
                if _option_segments(stripped):
                    continue
                if _INSTRUCTION_LINE_PATTERN.search(stripped):
                    continue
                if re.match(r"^\s*(?:SECTION|PART)\b", stripped, re.I):
                    continue
                if re.search(r"\b(?:answer\s*key|correct\s+answers?)\b", stripped, re.I):
                    continue

                # Pair the next prose line with the oldest marker awaiting text.
                # This is a heuristic; multi-column PDFs still require human review.
                pending_standalone_questions[0]["textCandidate"] = stripped
                current_question = pending_standalone_questions.pop(0)
                continue

                        # Do not attach options from a different PDF page to the
            # current question. Page-level instructions can resemble
            # option markers, especially in OCR output.
            current_page = (
                current_question.get("source", {}).get("pageNumber")
                if current_question is not None
                else None
            )
            element_page = element.get("pageNumber")

            if (
                current_question is not None
                and current_page is not None
                and element_page is not None
                and current_page != element_page
            ):
                continue

            if _INSTRUCTION_LINE_PATTERN.search(stripped):
                continue

            # Answer-key lines are source content, not question options.
            # Preserve the existing warning while skipping option parsing.
            if re.search(
                r"\b(?:"
                r"answer\s*key|"
                r"answers?\s+for\s+the\s+above\s+questions|"
                r"ans\s+for\s+q\.?\s*\d+"
                r")\b",
                stripped,
                re.I,
            ):
                if re.search(
                    r"\b(?:answer\s*key|answers?\s+for\s+the\s+above\s+questions)\b",
                    stripped,
                    re.I,
                ):
                    warnings.append({
                        "code": "ANSWER_KEY_TEXT_PRESENT",
                        "message": "Answer-key text was detected; correctness is not inferred.",
                        "sourceElementId": element.get("sourceElementId"),
                        "lineIndex": line_index,
                    })
                continue

            option_segments = _option_segments(stripped)

            # Flag malformed inline option markers for human review.
            # Do not silently reinterpret OCR text such as (Cc) as (C).
            if option_segments and len(option_segments) == 1:
                if re.search(r"(?<!\S)\([A-H]{2,}\)(?=\s)", stripped, re.I):
                    warnings.append({
                        "code": "AMBIGUOUS_OPTION_MARKER",
                        "message": (
                            "A malformed option-like marker was found within "
                            "an option candidate. Manual review is required."
                        ),
                        "sourceElementId": element.get("sourceElementId"),
                        "lineIndex": line_index,
                    })

            if option_segments:
                for label, body, marker_start in option_segments:
                    option = {
                        "optionId": _stable_id(
                            "option", source_hash,
                            str(element.get("sourceElementId")),
                            line_index, marker_start,
                        ),
                        "printedLabel": label,
                        "textCandidate": body,
                        "source": {
                            "elementId": element.get("sourceElementId"),
                            "lineIndex": line_index,
                            "pageNumber": element.get("pageNumber"),
                            "documentOrder": element.get("documentOrder"),
                            "printedLabelSourceElementId": element.get(
                                "printedOptionLabelSourceElementId"
                            ),
                            "markerStart": marker_start,
                        },
                        "reviewStatus": "needs-review",
                        "confidence": "heuristic-candidate",
                    }
                    if current_question is None:
                        warnings.append({
                            "code": "OPTION_WITHOUT_QUESTION",
                            "message": "An option-like line appeared before a detected question boundary.",
                            "sourceElementId": element.get("sourceElementId"),
                            "lineIndex": line_index,
                        })
                        option["orphanCandidate"] = True
                        options.append(option)
                    else:
                        current_question["options"].append(option)
                        current_option = option
                continue

            # Append ordinary PDF prose to the current question only after
            # question and option markers have had a chance to be recognized.
            is_pdf_page_line = (
                element.get("pageNumber") is not None
                and element.get("sourceElementId") is not None
            )
            is_answer_key_line = bool(re.search(
                r"\b(?:answer\s*key|correct\s+answers?)\b",
                stripped,
                re.I,
            )) or bool(re.match(
                r"^\s*(?:Ans(?:wer)?\s+(?:for|to)\s+Q\.?|Ans\s+key\b)",
                stripped,
                re.I,
            ))

            if (
                current_question is not None
                and is_pdf_page_line
                and current_question.get("source", {}).get("pageNumber")
                    == element.get("pageNumber")
                and isinstance(element.get("bounds"), dict)
                and isinstance(element["bounds"].get("y"), (int, float))
                and not _INSTRUCTION_LINE_PATTERN.search(stripped)
                and not is_answer_key_line
            ):
                candidate_y = float(element["bounds"]["y"])

                # First check whether this line continues the most recent option.
                # This check is independent of question-stem continuation state.
                option_page = (
                    current_option.get("source", {}).get("pageNumber")
                    if current_option is not None
                    else None
                )
                option_y = None
                if current_option is not None:
                    option_source_id = current_option.get("source", {}).get("elementId")
                    option_source_bounds = next(
                        (
                            item.get("bounds")
                            for source_page in report.get("pages", [])
                            if source_page.get("pageNumber") == element.get("pageNumber")
                            for item in source_page.get("elements", [])
                            if item.get("elementId") == option_source_id
                        ),
                        None,
                    )
                    if isinstance(option_source_bounds, dict):
                        option_y = option_source_bounds.get("y")

                option_gap = (
                    candidate_y - float(option_y)
                    if isinstance(option_y, (int, float))
                    else None
                )
                if (
                    current_option is not None
                    and option_page == element.get("pageNumber")
                    and option_gap is not None
                    and 0 <= option_gap <= 36
                ):
                    confidence = element.get("confidence")
                    low_confidence_ocr = (
                        element.get("extractionMethod") == "tesseract-ocr"
                        and (
                            not isinstance(confidence, (int, float))
                            or confidence < 0.60
                        )
                    )
                    if low_confidence_ocr:
                        warnings.append({
                            "code": "LOW_CONFIDENCE_OPTION_CONTINUATION",
                            "message": (
                                "A low-confidence OCR line was not merged into "
                                "the option candidate. Inspect the original "
                                "source before accepting or excluding it."
                            ),
                            "sourceElementId": element.get("sourceElementId"),
                            "lineIndex": line_index,
                            "confidence": confidence,
                            "questionId": current_question.get("questionId"),
                            "optionId": current_option.get("optionId"),
                        })
                        continue

                    current_option["textCandidate"] += " " + stripped
                    current_option["source"].setdefault(
                        "continuationElementIds", []
                    ).append(element.get("sourceElementId"))
                    current_question["_continuationLastY"] = candidate_y
                    continue

                # Otherwise preserve the existing question-stem continuation rule.
                last_y = current_question.get("_continuationLastY")
                if last_y is None:
                    source_id = current_question.get("source", {}).get("elementId")
                    source_bounds = next(
                        (
                            item.get("bounds")
                            for source_page in report.get("pages", [])
                            if source_page.get("pageNumber") == element.get("pageNumber")
                            for item in source_page.get("elements", [])
                            if item.get("elementId") == source_id
                        ),
                        None,
                    )
                    if isinstance(source_bounds, dict) and isinstance(
                        source_bounds.get("y"), (int, float)
                    ):
                        last_y = float(source_bounds["y"])
                    elif current_question.get("textCandidate"):
                        last_y = candidate_y

                if last_y is not None and -2 <= candidate_y - last_y <= 36:
                    if current_question.get("textCandidate"):
                        current_question["textCandidate"] += " " + stripped
                    else:
                        current_question["textCandidate"] = stripped
                    current_question["_continuationLastY"] = candidate_y
                continue
                continue

            if re.search(r"\b(?:answer\s*key|correct\s+answers?)\b", stripped, re.I):
                warnings.append({"code": "ANSWER_KEY_TEXT_PRESENT", "message": "Answer-key-like text was found. It is not interpreted as verified answer evidence by this detector.", "sourceElementId": element.get("sourceElementId"), "lineIndex": line_index})

    for question in candidates:
        labels = [item["printedLabel"] for item in question["options"]]
        if len(labels) != len(set(labels)):
            warnings.append({"code": "DUPLICATE_OPTION_LABELS", "message": "A question has repeated option labels; manual review is required.", "questionId": question["questionId"]})
        if not question["options"]:
            question["optionDetection"] = "no-option-boundary-detected"
        else:
            question["optionDetection"] = "candidate-options-detected"

    result = dict(report)
    result["segmentation"] = {
        "version": "0.1", "method": "conservative-line-boundary-heuristics",
        "questions": candidates, "orphanOptionCandidates": options, "sections": sections,
        "warnings": warnings,
        "status": "review-required" if candidates or options or sections or warnings else "no-boundaries-detected",
        "notice": "These are boundary candidates, not verified question semantics or answer keys. Human review is required.",
    }
    return result
