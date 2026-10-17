import unittest

from services.document_processing.crop_proposals import propose_pdf_crops


HASH = "a" * 64


def make_report():
    return {
        "source": {"fileType": "pdf", "sha256": HASH},
        "pages": [
            {
                "pageNumber": 1,
                "width": 300.0,
                "height": 400.0,
                "elements": [
                    {
                        "elementId": "q1",
                        "text": "Q1 Select one",
                        "bounds": {"x": 20, "y": 30, "width": 150, "height": 15},
                    },
                    {
                        "elementId": "o1",
                        "text": "(A) Alpha",
                        "bounds": {"x": 35, "y": 60, "width": 80, "height": 12},
                    },
                    {
                        "elementId": "q2",
                        "text": "Q2 Select another",
                        "bounds": {"x": 20, "y": 180, "width": 160, "height": 15},
                    },
                ],
            }
        ],
        "segmentation": {
            "questions": [
                {
                    "questionId": "question-1",
                    "printedNumber": 1,
                    "source": {"pageNumber": 1, "elementId": "q1"},
                    "options": [
                        {
                            "optionId": "option-1a",
                            "printedLabel": "A",
                            "source": {"elementId": "o1"},
                        }
                    ],
                },
                {
                    "questionId": "question-2",
                    "printedNumber": 2,
                    "source": {"pageNumber": 1, "elementId": "q2"},
                    "options": [],
                },
            ],
        },
    }


class CropProposalTests(unittest.TestCase):
    def test_question_and_option_proposals_are_review_only(self):
        result = propose_pdf_crops(make_report())
        self.assertEqual(result["status"], "review-required")
        self.assertEqual(result["summary"]["approvedCount"], 0)
        self.assertGreaterEqual(result["summary"]["proposalCount"], 3)
        self.assertTrue(all(
            p["reviewStatus"] == "needs-review"
            and p["humanApprovalRequired"]
            and not p["labelExclusionConfirmed"]
            for p in result["proposals"]
        ))

    def test_question_band_can_stop_after_final_option_before_answer_key(self):
        report = make_report()
        page = report["pages"][0]

        page["elements"].extend([
            {
                "elementId": "answer-key",
                "text": "Answers for the above questions",
                "bounds": {"x": 20, "y": 300, "width": 180, "height": 12},
            },
        ])

        # Keep the answer key on the page, but don't misrepresent it
        # as the next question anchor.
        report["segmentation"]["questions"] = [
            report["segmentation"]["questions"][0]
        ]

        result = propose_pdf_crops(report)
        question = next(
            p for p in result["proposals"]
            if p["role"] == "question-content"
            and p["questionId"] == "question-1"
        )

        self.assertLessEqual(
            question["regionBounds"]["y"] + question["regionBounds"]["height"],
            297.0,
        )
        self.assertEqual(question["reviewStatus"], "needs-review")
        self.assertTrue(question["humanApprovalRequired"])
        self.assertFalse(question["labelExclusionConfirmed"])


    def test_final_question_boundary_does_not_extend_into_answer_key(self):
        report = make_report()
        page = report["pages"][0]

        report["segmentation"]["questions"] = [
            report["segmentation"]["questions"][0]
        ]

        option_element = next(
            element for element in page["elements"]
            if element["elementId"] == "o1"
        )
        option_element["bounds"] = {
            "x": 35, "y": 290, "width": 80, "height": 20
        }

        page["elements"].append({
            "elementId": "answer-key",
            "text": "Answer Key",
            "bounds": {"x": 20, "y": 300, "width": 180, "height": 12},
        })

        result = propose_pdf_crops(report)
        question = next(
            proposal for proposal in result["proposals"]
            if proposal["role"] == "question-content"
            and proposal["questionId"] == "question-1"
        )

        proposed_bottom = (
            question["regionBounds"]["y"]
            + question["regionBounds"]["height"]
        )
        self.assertLessEqual(proposed_bottom, 300.0)
        self.assertEqual(question["reviewStatus"], "needs-review")
        self.assertTrue(question["humanApprovalRequired"])


    def test_question_band_stops_at_next_question_anchor(self):
        result = propose_pdf_crops(make_report())
        question = next(
            p for p in result["proposals"]
            if p["role"] == "question-content"
            and p["questionId"] == "question-1"
        )
        self.assertEqual(question["regionBounds"]["y"], 30.0)
        self.assertEqual(question["regionBounds"]["height"], 150.0)
        self.assertLessEqual(
            question["regionBounds"]["y"] + question["regionBounds"]["height"],
            180.0,
        )

    def test_all_proposal_bounds_stay_inside_page(self):
        result = propose_pdf_crops(make_report())
        for proposal in result["proposals"]:
            b = proposal["regionBounds"]
            self.assertGreater(b["width"], 0)
            self.assertGreater(b["height"], 0)
            self.assertGreaterEqual(b["x"], 0)
            self.assertGreaterEqual(b["y"], 0)
            self.assertLessEqual(b["x"] + b["width"], 300)
            self.assertLessEqual(b["y"] + b["height"], 400)

    def test_proposal_ids_are_stable(self):
        first = propose_pdf_crops(make_report())
        second = propose_pdf_crops(make_report())
        self.assertEqual(
            [p["proposalId"] for p in first["proposals"]],
            [p["proposalId"] for p in second["proposals"]],
        )

    def test_no_questions_returns_no_proposals(self):
        report = make_report()
        report["segmentation"]["questions"] = []
        result = propose_pdf_crops(report)
        self.assertEqual(result["status"], "no-proposals")
        self.assertEqual(result["summary"]["proposalCount"], 0)
        self.assertEqual(result["pages"][0]["status"], "no-question-candidates")

    def test_shared_option_source_is_flagged(self):
        report = make_report()
        report["segmentation"]["questions"][0]["options"].append({
            "optionId": "option-1b",
            "printedLabel": "B",
            "source": {"elementId": "o1"},
        })
        result = propose_pdf_crops(report)
        shared = [
            p for p in result["proposals"]
            if "MULTIPLE_OPTIONS_SHARE_SOURCE_ELEMENT" in p["uncertaintyCodes"]
        ]
        self.assertEqual(len(shared), 2)

    def test_missing_question_geometry_does_not_create_question_crop(self):
        report = make_report()
        report["pages"][0]["elements"][0].pop("bounds")
        result = propose_pdf_crops(report)
        question_proposals = [
            p for p in result["proposals"]
            if p["role"] == "question-content"
            and p["questionId"] == "question-1"
        ]
        self.assertEqual(question_proposals, [])
        self.assertEqual(result["pages"][0]["status"], "uncertain-boundaries")


    def test_confidence_metadata_never_claims_visual_verification(self):
        result = propose_pdf_crops(make_report())

        self.assertGreater(len(result["proposals"]), 0)

        for proposal in result["proposals"]:
            self.assertEqual(proposal["confidence"]["level"], "low")
            self.assertEqual(proposal["confidence"]["contentCompleteness"], "unverified")
            self.assertEqual(proposal["confidence"]["printedLabelExclusion"], "unverified")
            self.assertFalse(proposal["qualityChecks"]["visualInspectionCompleted"])
            self.assertFalse(proposal["qualityChecks"]["contentCompletenessVerified"])
            self.assertFalse(proposal["qualityChecks"]["printedLabelExclusionVerified"])
            self.assertFalse(proposal["labelExclusionConfirmed"])
            self.assertTrue(proposal["humanApprovalRequired"])
            self.assertEqual(proposal["reviewStatus"], "needs-review")

    def test_shared_option_source_has_ambiguous_boundary_quality(self):
        report = make_report()
        report["segmentation"]["questions"][0]["options"].append({
            "optionId": "option-1b",
            "printedLabel": "B",
            "source": {"elementId": "o1"},
        })

        result = propose_pdf_crops(report)
        shared = [
            p for p in result["proposals"]
            if p["role"] == "option-content"
            and "MULTIPLE_OPTIONS_SHARE_SOURCE_ELEMENT" in p["uncertaintyCodes"]
        ]

        self.assertEqual(len(shared), 2)

        for proposal in shared:
            self.assertEqual(proposal["confidence"]["level"], "low")
            self.assertEqual(proposal["confidence"]["boundary"], "ambiguous")
            self.assertTrue(proposal["qualityChecks"]["sharedSourceElement"])
            self.assertTrue(proposal["humanApprovalRequired"])



    def test_question_proposals_use_anchor_width_and_remain_review_only(self):
        result = propose_pdf_crops(make_report())
        questions = [
            p for p in result["proposals"]
            if p["role"] == "question-content"
        ]

        self.assertEqual(len(questions), 2)

        expected_widths = {"question-1": 150.0, "question-2": 160.0}
        for proposal in questions:
            self.assertEqual(
                proposal["regionBounds"]["width"],
                expected_widths[proposal["questionId"]],
            )
            self.assertIn(
                "QUESTION_WIDTH_LIMITED_TO_ANCHOR; RELATED_CONTENT_MAY_BE_MISSING",
                proposal["uncertaintyCodes"],
            )
            self.assertEqual(proposal["confidence"]["level"], "low")
            self.assertEqual(proposal["confidence"]["boundary"], "unverified")
            self.assertFalse(proposal["qualityChecks"]["contentCompletenessVerified"])
            self.assertFalse(proposal["qualityChecks"]["printedLabelExclusionVerified"])
            self.assertEqual(proposal["reviewStatus"], "needs-review")
            self.assertTrue(proposal["humanApprovalRequired"])
            self.assertFalse(proposal["labelExclusionConfirmed"])

    def test_duplicate_question_anchor_positions_remain_review_only(self):
        report = make_report()
        report["segmentation"]["questions"][1]["source"]["elementId"] = "q1"

        result = propose_pdf_crops(report)

        for proposal in result["proposals"]:
            self.assertEqual(proposal["reviewStatus"], "needs-review")
            self.assertTrue(proposal["humanApprovalRequired"])
            self.assertFalse(proposal["labelExclusionConfirmed"])

        self.assertEqual(result["summary"]["approvedCount"], 0)

    def test_missing_option_geometry_is_reported_without_option_crop(self):
        report = make_report()
        report["pages"][0]["elements"] = [
            element for element in report["pages"][0]["elements"]
            if element["elementId"] != "o1"
        ]

        result = propose_pdf_crops(report)

        option_proposals = [
            p for p in result["proposals"]
            if p["role"] == "option-content"
        ]

        self.assertEqual(option_proposals, [])
        self.assertIn(
            "OPTION_SOURCE_GEOMETRY_MISSING",
            result["pages"][0]["uncertaintyCodes"],
        )
        self.assertEqual(result["pages"][0]["status"], "uncertain-boundaries")
        self.assertEqual(result["summary"]["approvedCount"], 0)

    def test_invalid_option_geometry_is_not_proposed(self):
        report = make_report()
        option_element = next(
            element for element in report["pages"][0]["elements"]
            if element["elementId"] == "o1"
        )
        option_element["bounds"] = {
            "x": 290, "y": 60, "width": 80, "height": 12
        }

        result = propose_pdf_crops(report)

        option_proposals = [
            p for p in result["proposals"]
            if p["role"] == "option-content"
        ]

        self.assertEqual(option_proposals, [])
        self.assertIn(
            "OPTION_SOURCE_GEOMETRY_MISSING",
            result["pages"][0]["uncertaintyCodes"],
        )
        self.assertEqual(result["summary"]["approvedCount"], 0)

    def test_inline_options_use_separate_ocr_word_bounds_and_remain_review_only(self):
        report = make_report()
        element = next(
            item for item in report["pages"][0]["elements"]
            if item["elementId"] == "o1"
        )
        text = "(A) Alpha (B) Beta"
        element["text"] = text
        element["textLines"] = [{"lineIndex": 1, "text": text}]
        tokens = [
            ("(A)", 0, 15, 60, 12, 12),
            ("Alpha", 4, 35, 60, 30, 12),
            ("(B)", 10, 65, 60, 12, 12),
            ("Beta", 14, 85, 60, 25, 12),
        ]
        element["wordBounds"] = [
            {
                "text": token, "start": start, "end": start + len(token),
                "bounds": {
                    "x": x, "y": y, "width": width, "height": height
                },
            }
            for token, start, x, y, width, height in tokens
        ]
        options = report["segmentation"]["questions"][0]["options"]
        options[0]["source"].update({"lineIndex": 1, "markerStart": 0})
        options.append({
            "optionId": "option-1b",
            "printedLabel": "B",
            "source": {
                "elementId": "o1", "lineIndex": 1, "markerStart": 10,
            },
        })

        result = propose_pdf_crops(report)
        proposals = [
            item for item in result["proposals"]
            if item["role"] == "option-content"
        ]
        by_id = {item["optionId"]: item for item in proposals}
        self.assertEqual(len(proposals), 2)
        a, b = by_id["option-1a"], by_id["option-1b"]
        self.assertTrue(a["qualityChecks"]["wordGeometryUsed"])
        self.assertTrue(b["qualityChecks"]["wordGeometryUsed"])
        self.assertNotEqual(a["contentBounds"], b["contentBounds"])
        self.assertEqual(a["contentBounds"]["x"], 35)
        self.assertEqual(b["contentBounds"]["x"], 85)
        for item in proposals:
            self.assertEqual(item["reviewStatus"], "needs-review")
            self.assertTrue(item["humanApprovalRequired"])
            self.assertFalse(item["labelExclusionConfirmed"])
            self.assertFalse(item["qualityChecks"]["printedLabelExclusionVerified"])
            self.assertFalse(item["qualityChecks"]["contentCompletenessVerified"])

    def test_inline_options_use_separate_character_bounds_and_remain_review_only(self):
        report = make_report()
        option_element = next(
            element for element in report["pages"][0]["elements"]
            if element["elementId"] == "o1"
        )

        text = "(A) Alpha (B) Beta"
        option_element["text"] = text
        option_element["textLines"] = [{
            "lineIndex": 1,
            "text": text,
            "characters": [
                {
                    "c": char,
                    "bbox": [35 + index * 5, 60, 39 + index * 5, 72],
                }
                for index, char in enumerate(text)
            ],
        }]

        options = report["segmentation"]["questions"][0]["options"]
        options[0]["source"].update({"lineIndex": 1, "markerStart": 0})
        options.append({
            "optionId": "option-1b",
            "printedLabel": "B",
            "source": {
                "elementId": "o1",
                "lineIndex": 1,
                "markerStart": 10,
            },
        })

        result = propose_pdf_crops(report)
        proposals = [
            proposal for proposal in result["proposals"]
            if proposal["role"] == "option-content"
        ]
        by_id = {proposal["optionId"]: proposal for proposal in proposals}

        self.assertEqual(len(proposals), 2)
        a = by_id["option-1a"]
        b = by_id["option-1b"]

        self.assertTrue(a["qualityChecks"]["characterGeometryUsed"])
        self.assertTrue(b["qualityChecks"]["characterGeometryUsed"])
        self.assertGreater(b["contentBounds"]["x"], a["contentBounds"]["x"])
        self.assertLess(
            a["contentBounds"]["x"] + a["contentBounds"]["width"],
            b["contentBounds"]["x"] + b["contentBounds"]["width"],
        )
        self.assertEqual(a["contentBounds"]["x"], 55.0)
        self.assertEqual(b["contentBounds"]["x"], 105.0)

        for proposal in proposals:
            self.assertEqual(proposal["reviewStatus"], "needs-review")
            self.assertTrue(proposal["humanApprovalRequired"])
            self.assertFalse(proposal["labelExclusionConfirmed"])
            self.assertFalse(proposal["qualityChecks"]["printedLabelExclusionVerified"])
            self.assertFalse(proposal["qualityChecks"]["contentCompletenessVerified"])
            self.assertIn(
                "OPTION_VISUAL_COMPLETENESS_UNVERIFIED",
                proposal["uncertaintyCodes"],
            )

    def test_invalid_source_hash_is_rejected(self):
        report = make_report()
        report["source"]["sha256"] = "not-a-valid-hash"
        with self.assertRaises(ValueError):
            propose_pdf_crops(report)


if __name__ == "__main__":
    unittest.main()
