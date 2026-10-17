import unittest
from packages.document_processing.question_segmenter import detect_question_structure


def report(text, source_type="docx"):
    return {
        "source": {"fileType": source_type, "sha256": "a" * 64},
        "owner": {"userId": "owner-1"},
        "elements": [{"elementId": f"p{i}", "kind": "paragraph", "text": line,
                      "documentOrder": i, "extractionMethod": "docx-ooxml", "reviewStatus": "not-reviewed"}
                     for i, line in enumerate(text.split("\n"), start=1)],
        "warnings": [],
    }


class QuestionSegmenterTests(unittest.TestCase):
    def test_detects_question_options_and_marks_as_review_candidates(self):
        result = detect_question_structure(report("SECTION A: Physics\nQuestion 1: What is force? [2 marks]\n(A) Mass\n(B) Acceleration\n2. Calculate velocity\nA. 10 m/s\nB. 20 m/s"))
        seg = result["segmentation"]
        self.assertEqual(len(seg["sections"]), 1)
        self.assertEqual(len(seg["questions"]), 2)
        self.assertEqual(seg["questions"][0]["printedNumber"], 1)
        self.assertEqual(seg["questions"][0]["marksCandidate"], 2.0)
        self.assertEqual([o["printedLabel"] for o in seg["questions"][0]["options"]], ["A", "B"])
        self.assertTrue(all(q["reviewStatus"] == "needs-review" for q in seg["questions"]))

    def test_q_dot_number_format_is_detected(self):
        result = detect_question_structure(report(
            "Q.1 In a historical experiment, determine Planck's constant.\n"
            "(A) 6.0 x 10^-34 (B) 6.4 x 10^-34 "
            "(C) 6.6 x 10^-34 (D) 6.8 x 10^-34\n"
            "Q.2 A uniform wooden stick rests against a wall."
        ))
        questions = result["segmentation"]["questions"]
        self.assertEqual([q["printedNumber"] for q in questions], [1, 2])
        first = questions[0]
        self.assertIn("historical experiment", first["textCandidate"])
        self.assertEqual(
            [option["printedLabel"] for option in first["options"]],
            ["A", "B", "C", "D"],
        )

    def test_matrix_ocr_line_before_explicit_question_marker_is_not_a_question(self):
        result = detect_question_structure(report(
            "3 -1 -2\n"
            "Q44 Let P be a matrix, where a is real.\n"
            "i3 -5 0\n"
            "2\n"
            "ke R, k+0 and J is the identity matrix."
        ))
        segmentation = result["segmentation"]

        q44 = next(
            (
                question for question in segmentation["questions"]
                if question["printedNumber"] == 44
            ),
            None,
        )

        self.assertIsNotNone(q44)
        self.assertIn("Let P be a matrix", q44["textCandidate"])
        self.assertFalse(any(
            question["printedNumber"] == 3
            and question["textCandidate"].strip() == "-1 -2"
            for question in segmentation["questions"]
        ))


    def test_matrix_numeric_fragment_before_q44_is_not_a_question(self):
        result = detect_question_structure(report(
            "3 -1 -2\n"
            "Q44 Let P be a matrix, where a is real.\n"
            "i3 -5 0\n"
            "2\n"
            "ke R, k+0 and J is the identity matrix."
        ))
        questions = result["segmentation"]["questions"]

        q44 = next(
            (q for q in questions if q["printedNumber"] == 44),
            None,
        )
        self.assertIsNotNone(q44)
        self.assertFalse(any(
            q["printedNumber"] == 3
            and q["source"]["elementId"] == "p1"
            for q in questions
        ))

    def test_numbered_option_fragment_does_not_create_false_question(self):
        result = detect_question_structure(report(
            "Q.2 A uniform wooden stick rests against a wall.\n"
            "h V3. 16V3 h 3 16V3\n"
            "4) SiMe fo *Nn B) 22, s=-22N\n"
            "(C) ; f= (D) 7 716 if 3\n"
            "Q.3 A water cooler question follows."
        ))

        segmentation = result["segmentation"]
        questions = segmentation["questions"]

        self.assertEqual(
            [question["printedNumber"] for question in questions],
            [2, 3],
        )
        self.assertFalse(any(
            question["printedNumber"] == 4
            for question in questions
        ))
        self.assertIn(
            "4) SiMe fo *Nn B) 22, s=-22N",
            questions[0]["textCandidate"],
        )


    def test_decimal_lines_are_not_question_number_zero(self):
        result = detect_question_structure(report("0.3 2.0\n0.4 1.0\n0.5 0.4"))
        questions = result["segmentation"]["questions"]
        self.assertEqual(questions, [])

    def test_numbered_questions_remain_questions_after_numeric_option_support(self):
        result = detect_question_structure(report(
            "1. First independent question\n"
            "2. Second independent question\n"
            "3. Third independent question"
        ))
        questions = result["segmentation"]["questions"]
        self.assertEqual(
            [question["printedNumber"] for question in questions],
            [1, 2, 3],
        )

    def test_question_number_zero_is_rejected(self):
        result = detect_question_structure(report("0. What is shown?\n1. First question"))
        questions = result["segmentation"]["questions"]
        self.assertEqual([q["printedNumber"] for q in questions], [1])

    def test_extended_alphabetic_option_labels_are_recognized(self):
        result = detect_question_structure(report(
            "Question 1: Select the correct statements\n"
            "(A) Alpha\n(B) Beta\n(C) Gamma\n(D) Delta\n"
            "(E) Epsilon\n(F) Zeta\n(G) Eta\n(H) Theta"
        ))
        question = result["segmentation"]["questions"][0]
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            list("ABCDEFGH"),
        )

    def test_parenthesized_roman_option_labels_are_recognized(self):
        result = detect_question_structure(report(
            "Question 1: Select the correct statements\n"
            "(i) First\n(ii) Second\n(iii) Third\n(iv) Fourth"
        ))
        question = result["segmentation"]["questions"][0]
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["i", "ii", "iii", "iv"],
        )

    def test_numeric_option_labels_are_recognized(self):
        result = detect_question_structure(report(
            "Question 10: Select the correct sequence\n"
            "1. First\n"
            "2. Second\n"
            "3. Third\n"
            "4. Fourth"
        ))
        question = result["segmentation"]["questions"][0]
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["1", "2", "3", "4"],
        )

    def test_answer_key_numeric_labels_do_not_become_options(self):
        result = detect_question_structure(report(
            "Question 1: Select one\n"
            "(A) Alpha\n(B) Beta\n"
            "Answer key: 1-B"
        ))
        question = result["segmentation"]["questions"][0]
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B"],
        )
        self.assertNotIn("correctAnswer", question)

    def test_multiple_options_on_one_line_are_not_silently_merged(self):
        result = detect_question_structure(report(
            "Question 1: Select the correct option\n(A) Alpha (B) Beta (C) Gamma (D) Delta"
        ))
        question = result["segmentation"]["questions"][0]
        labels = [option["printedLabel"] for option in question["options"]]
        self.assertEqual(labels, ["A", "B", "C", "D"])

    def test_does_not_infer_answer_key_or_correctness(self):
        result = detect_question_structure(report("Question 1: 2+2?\n(A) 3\n(B) 4\nAnswer key: 1-B"))
        self.assertNotIn("correctAnswer", result["segmentation"]["questions"][0])
        self.assertTrue(any(w["code"] == "ANSWER_KEY_TEXT_PRESENT" for w in result["segmentation"]["warnings"]))

    def test_flags_orphan_options_and_repeated_labels(self):
        result = detect_question_structure(report("(A) orphan\nQuestion 1: Choose\n(A) first\n(A) duplicate"))
        self.assertEqual(len(result["segmentation"]["orphanOptionCandidates"]), 1)
        self.assertTrue(any(w["code"] == "DUPLICATE_OPTION_LABELS" for w in result["segmentation"]["warnings"]))

    def test_requires_valid_source_hash_and_owner(self):
        bad_hash = report("Question 1: Test")
        bad_hash["source"]["sha256"] = "invalid"
        with self.assertRaises(ValueError):
            detect_question_structure(bad_hash)
        no_owner = report("Question 1: Test")
        no_owner["owner"] = {}
        with self.assertRaises(ValueError):
            detect_question_structure(no_owner)

    def test_same_source_and_boundaries_generate_stable_ids(self):
        source = report("Question 1: Test\n(A) One")
        first = detect_question_structure(source)["segmentation"]
        second = detect_question_structure(source)["segmentation"]
        self.assertEqual(first["questions"][0]["questionId"], second["questions"][0]["questionId"])
        self.assertEqual(first["questions"][0]["options"][0]["optionId"], second["questions"][0]["options"][0]["optionId"])

    def test_pdf_page_elements_are_used(self):
        source = {"source": {"fileType": "pdf", "sha256": "b" * 64}, "owner": {"userId": "owner-1"},
                  "pages": [{"pageNumber": 3, "elements": [{"elementId": "p3-text-1", "text": "Q7) Select one", "extractionMethod": "native-pdf-text", "confidence": 1.0}]}]}
        result = detect_question_structure(source)["segmentation"]["questions"][0]
        self.assertEqual(result["printedNumber"], 7)
        self.assertEqual(result["source"]["pageNumber"], 3)


    def test_standalone_q_dot_marker_is_preserved(self):
        result = detect_question_structure(report(
            "Q.20\n"
            "One mole of an ideal gas expands isothermally.\n"
            "(A) 5.763 (B) 1.013 (C) -1.013 (D) -5.763"
        ))
        questions = result["segmentation"]["questions"]
        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["printedNumber"], 20)
        self.assertIn("One mole of an ideal gas", questions[0]["textCandidate"])
        self.assertEqual(
            [option["printedLabel"] for option in questions[0]["options"]],
            ["A", "B", "C", "D"],
        )

    def test_stacked_standalone_markers_pair_with_following_question_text(self):
        result = detect_question_structure(report(
            "Q.20\n"
            "Q.21\n"
            "Q.22\n"
            "Q.23\n"
            "One mole of an ideal gas expands isothermally.\n"
            "(A) 5.763 (B) 1.013 (C) -1.013 (D) -5.763\n"
            "The increasing order of atomic radii is\n"
            "(A) Al<Ga<In<Tl (B) Ga<Al<In<Tl\n"
            "Among the listed compounds, the number of paramagnetic compounds is\n"
            "(A) 2 (B) 3 (C) 4 (D) 5\n"
            "On complete hydrogenation, natural rubber produces\n"
            "(A) ethylene-propylene copolymer (B) vulcanised rubber"
        ))
        questions = result["segmentation"]["questions"]
        self.assertEqual(
            [q["printedNumber"] for q in questions],
            [20, 21, 22, 23],
        )
        self.assertIn("One mole", questions[0]["textCandidate"])
        self.assertIn("atomic radii", questions[1]["textCandidate"])
        self.assertIn("paramagnetic compounds", questions[2]["textCandidate"])
        self.assertIn("natural rubber", questions[3]["textCandidate"])



    def test_pdf_continuation_with_approximately_32_point_gap_is_preserved(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "f" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 15,
                "elements": [
                    {
                        "elementId": "q1-label",
                        "text": "Q.1",
                        "bounds": {"x": 55, "y": 374.727, "height": 10},
                    },
                    {
                        "elementId": "q1-prompt",
                        "text": "Q.1 A particle moves along a straight line.",
                        "bounds": {"x": 90, "y": 374.727, "height": 15},
                    },
                    {
                        "elementId": "q1-continuation",
                        "text": "Its displacement is given by the equation x equals t squared.",
                        "bounds": {"x": 90, "y": 406.473, "height": 15},
                    },
                    {
                        "elementId": "q1-options",
                        "text": "(A) 1 (B) 2 (C) 3 (D) 4",
                        "bounds": {"x": 90, "y": 441.491, "height": 15},
                    },
                    {
                        "elementId": "answer-key-heading",
                        "text": "Answer Key",
                        "bounds": {"x": 90, "y": 513.818, "height": 15},
                    },
                ],
            }],
        }

        question = detect_question_structure(source)["segmentation"]["questions"][0]

        self.assertIn("A particle moves along a straight line", question["textCandidate"])
        self.assertIn("Its displacement is given by the equation", question["textCandidate"])
        self.assertNotIn("(A) 1", question["textCandidate"])
        self.assertNotIn("Answer Key", question["textCandidate"])
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B", "C", "D"],
        )

    def test_pdf_standalone_label_multiline_prompt_and_options(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "c" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 15,
                "elements": [
                    {"elementId": "q20-label", "text": "Q.20",
                     "bounds": {"x": 52.36, "y": 54.33, "height": 10.47}},
                    {"elementId": "q20-line1",
                     "text": "One mole of an ideal gas at 300 K expands",
                     "bounds": {"x": 88.04, "y": 46.80, "height": 15.71}},
                    {"elementId": "q20-line2",
                     "text": "isothermally from 1.0 L to 2.0 L",
                     "bounds": {"x": 87.71, "y": 59.89, "height": 17.02}},
                    {"elementId": "q20-line3",
                     "text": "change in entropy of surroundings is",
                     "bounds": {"x": 88.04, "y": 76.91, "height": 16.04}},
                    {"elementId": "q20-options",
                     "text": "(A) 5.763 (B) 1.013 (C) -1.013 (D) -5.763",
                     "bounds": {"x": 88.36, "y": 111.93, "height": 14.40}},
                ],
            }],
        }

        question = detect_question_structure(source)["segmentation"]["questions"][0]

        self.assertEqual(question["printedNumber"], 20)
        self.assertIn("One mole of an ideal gas", question["textCandidate"])
        self.assertIn("isothermally from 1.0 L to 2.0 L", question["textCandidate"])
        self.assertIn("change in entropy of surroundings", question["textCandidate"])
        self.assertNotIn("(A) 5.763", question["textCandidate"])
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B", "C", "D"],
        )
        self.assertTrue(all(
            option["reviewStatus"] == "needs-review"
            for option in question["options"]
        ))


    def test_malformed_inline_option_marker_is_not_silently_split(self):
        result = detect_question_structure(report(
            "Question 22: Count the compounds\n"
            "(A) 2 (B) 3 (Cc) 4 (D) 5"
        ))
        question = result["segmentation"]["questions"][0]
        # Do not infer that OCR "(Cc)" means "(C)".
        self.assertEqual(
            [o["printedLabel"] for o in question["options"]],
            ["A"],
        )
        self.assertIn("(B) 3 (Cc) 4 (D) 5", question["options"][0]["textCandidate"])

    def test_malformed_inline_option_marker_emits_review_warning(self):
        result = detect_question_structure(report(
            "Question 22: Count the compounds\n"
            "(A) 2 (B) 3 (Cc) 4 (D) 5"
        ))
        segmentation = result["segmentation"]
        question = segmentation["questions"][0]

        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A"],
        )
        self.assertIn(
            "(Cc) 4",
            question["options"][0]["textCandidate"],
        )
        self.assertTrue(any(
            warning["code"] == "AMBIGUOUS_OPTION_MARKER"
            for warning in segmentation["warnings"]
        ))

    def test_answer_key_and_marking_instructions_are_not_options(self):
        result = detect_question_structure(report(
            "Question 23: Choose the correct product\n"
            "(A) Alpha (B) Beta (C) Gamma (D) Delta\n"
            "Ans for Q.23: (A)\n"
            "For each question, darkening all options will result in negative marks."
        ))
        question = result["segmentation"]["questions"][0]
        self.assertEqual(
            [o["printedLabel"] for o in question["options"]],
            ["A", "B", "C", "D"],
        )
        bodies = [o["textCandidate"] for o in question["options"]]
        self.assertFalse(any("negative marks" in body for body in bodies))
        self.assertNotIn("Ans for Q.23: (A)", question["textCandidate"])


    def test_distant_pdf_page_elements_are_not_appended_to_question(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "d" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 15,
                "elements": [
                    {
                        "elementId": "q23-label",
                        "text": "Q.23",
                        "bounds": {"x": 55, "y": 287, "height": 10},
                    },
                    {
                        "elementId": "q23-prompt",
                        "text": "On complete hydrogenation, natural rubber produces",
                        "bounds": {"x": 90, "y": 283, "height": 15},
                    },
                    {
                        "elementId": "q23-options",
                        "text": "(A) Alpha (B) Beta (C) Gamma (D) Delta",
                        "bounds": {"x": 90, "y": 300, "height": 15},
                    },
                    {
                        "elementId": "page-bottom-reference",
                        "text": "17/36",
                        "bounds": {"x": 61, "y": 749, "height": 10},
                    },
                    {
                        "elementId": "page-bottom-mark",
                        "text": "*1",
                        "bounds": {"x": 553, "y": 741, "height": 10},
                    },
                ],
            }],
        }

        question = detect_question_structure(source)["segmentation"]["questions"][0]

        self.assertIn("natural rubber", question["textCandidate"])
        self.assertNotIn("17/36", question["textCandidate"])
        self.assertNotIn("*1", question["textCandidate"])
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B", "C", "D"],
        )

    def test_pdf_marking_instruction_fragments_are_not_options(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "e" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 15,
                "elements": [
                    {
                        "elementId": "q23-label",
                        "text": "Q.23",
                        "bounds": {"x": 55, "y": 287, "height": 10},
                    },
                    {
                        "elementId": "q23-prompt",
                        "text": "On complete hydrogenation, natural rubber produces",
                        "bounds": {"x": 90, "y": 283, "height": 15},
                    },
                    {
                        "elementId": "q23-options",
                        "text": (
                            "(A) ethylene-propylene copolymer "
                            "(B) vulcanised rubber "
                            "(C) polypropylene (D) polybutylene"
                        ),
                        "bounds": {"x": 90, "y": 300, "height": 15},
                    },
                    {
                        "elementId": "instruction-c",
                        "text": "(C) and",
                        "bounds": {"x": 90, "y": 317, "height": 15},
                    },
                    {
                        "elementId": "instruction-d",
                        "text": (
                            "(D) are all the correct options for a question, "
                            "darkening all"
                        ),
                        "bounds": {"x": 90, "y": 334, "height": 15},
                    },
                    {
                        "elementId": "instruction-a",
                        "text": "(A) and",
                        "bounds": {"x": 90, "y": 351, "height": 15},
                    },
                    {
                        "elementId": "instruction-b",
                        "text": (
                            "(B) will result in ~2 marks, as a wrong option "
                            "is also darkened."
                        ),
                        "bounds": {"x": 90, "y": 368, "height": 15},
                    },
                ],
            }],
        }

        question = detect_question_structure(source)["segmentation"]["questions"][0]

        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B", "C", "D"],
        )
        self.assertFalse(any(
            "correct options for a question" in option["textCandidate"]
            or "wrong option is also darkened" in option["textCandidate"]
            for option in question["options"]
        ))

    def test_ocr_numeric_fragment_between_questions_is_not_a_new_question(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "d" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 26,
                "elements": [
                    {
                        "elementId": "q45-label",
                        "text": "Q.45",
                        "bounds": {"x": 50, "y": 100, "height": 10},
                    },
                    {
                        "elementId": "q46-label",
                        "text": "Q.46",
                        "bounds": {"x": 50, "y": 300, "height": 10},
                    },
                    {
                        "elementId": "q45-prompt",
                        "text": "In a triangle XYZ, find the correct statements.",
                        "bounds": {"x": 90, "y": 95, "height": 15},
                        "extractionMethod": "tesseract-ocr",
                        "confidence": 0.93,
                    },
                    *[
                        {
                            "elementId": f"q45-option-{label.lower()}",
                            "text": f"({label}) {body}",
                            "bounds": {"x": 90, "y": y, "height": 12},
                            "extractionMethod": "tesseract-ocr",
                            "confidence": 0.9,
                        }
                        for label, body, y in [
                            ("A", "First", 130),
                            ("B", "Second", 150),
                            ("C", "Third", 170),
                            ("D", "Fourth", 190),
                        ]
                    ],
                    {
                        "elementId": "ambiguous-fragment",
                        "text": "2) 5",
                        "bounds": {"x": 90, "y": 210, "height": 10},
                        "extractionMethod": "tesseract-ocr",
                        "confidence": 0.48,
                    },
                    {
                        "elementId": "q46-prompt",
                        "text": "A solution curve of the differential equation passes through (1,3).",
                        "bounds": {"x": 90, "y": 295, "height": 15},
                        "extractionMethod": "tesseract-ocr",
                        "confidence": 0.79,
                    },
                ],
            }],
        }

        segmentation = detect_question_structure(source)["segmentation"]
        questions = segmentation["questions"]

        self.assertEqual(
            [question["printedNumber"] for question in questions],
            [45, 46],
        )
        self.assertTrue(any(
            warning["code"] == "QUESTION_NUMBER_SEQUENCE_AMBIGUOUS"
            for warning in segmentation["warnings"]
        ))


    def test_pdf_standalone_option_labels_pair_with_separate_bodies(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "d" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 9,
                # Deliberately not in reading order: PDF elements may be
                # returned in an order that differs from their page layout.
                "elements": [
                    {
                        "elementId": "q11-option-a-body",
                        "text": "The magnitude of induced emf is (4) volt",
                        "bounds": {"x": 123, "y": 202, "height": 14},
                    },
                    {
                        "elementId": "q11-question",
                        "text": "Q.11 A conducting loop has a triangular shape.",
                        "bounds": {"x": 61, "y": 40, "height": 14},
                    },
                    {
                        "elementId": "q11-option-a-label",
                        "text": "(A)",
                        "bounds": {"x": 95, "y": 210, "height": 12},
                    },
                    {
                        "elementId": "q11-option-b-label",
                        "text": "(B)",
                        "bounds": {"x": 95, "y": 238, "height": 12},
                    },
                    {
                        "elementId": "q11-option-b-body",
                        "text": "An additional emf is induced",
                        "bounds": {"x": 123, "y": 238, "height": 14},
                    },
                    {
                        "elementId": "q11-option-b-continuation",
                        "text": "volt is induced in the wire",
                        "bounds": {"x": 123, "y": 250, "height": 14},
                    },
                    {
                        "elementId": "q11-option-c-label",
                        "text": "(C)",
                        "bounds": {"x": 95, "y": 286, "height": 12},
                    },
                    {
                        "elementId": "q11-option-c-body",
                        "text": "The induced current is opposite",
                        "bounds": {"x": 123, "y": 286, "height": 14},
                    },
                    {
                        "elementId": "q11-option-c-continuation",
                        "text": "hypotenuse",
                        "bounds": {"x": 123, "y": 300, "height": 14},
                    },
                    {
                        "elementId": "q11-option-d-label",
                        "text": "(D)",
                        "bounds": {"x": 95, "y": 316, "height": 12},
                    },
                    {
                        "elementId": "q11-option-d-body",
                        "text": "There is a repulsive force",
                        "bounds": {"x": 122, "y": 316, "height": 14},
                    },
                    {
                        "elementId": "q11-rough-work",
                        "text": "Space for rough work",
                        "bounds": {"x": 251, "y": 344, "height": 12},
                    },
                    {
                        "elementId": "q11-answer-key",
                        "text": "Answers for the above questions",
                        "bounds": {"x": 190, "y": 396, "height": 12},
                    },
                ],
            }],
        }

        question = detect_question_structure(source)["segmentation"]["questions"][0]

        self.assertEqual(question["printedNumber"], 11)
        self.assertEqual(
            [option["printedLabel"] for option in question["options"]],
            ["A", "B", "C", "D"],
        )
        self.assertIn("The magnitude of induced emf", question["options"][0]["textCandidate"])
        self.assertIn("An additional emf", question["options"][1]["textCandidate"])
        self.assertIn(
            "volt is induced in the wire",
            question["options"][1]["textCandidate"],
        )
        self.assertIn("The induced current", question["options"][2]["textCandidate"])
        self.assertIn(
            "hypotenuse",
            question["options"][2]["textCandidate"],
        )
        self.assertIn("repulsive force", question["options"][3]["textCandidate"])
        self.assertNotIn(
            "hypotenuse",
            question["options"][3]["textCandidate"],
        )
        self.assertNotIn(
            "Space for rough work",
            " ".join(option["textCandidate"] for option in question["options"]),
        )
        self.assertNotIn(
            "Answers for the above questions",
            " ".join(option["textCandidate"] for option in question["options"]),
        )
        self.assertNotIn("Space for rough work", question["textCandidate"])
        self.assertNotIn("Answers for the above questions", question["textCandidate"])
        self.assertTrue(all(
            option["reviewStatus"] == "needs-review"
            for option in question["options"]
        ))


    def test_low_confidence_ocr_option_continuation_is_flagged(self):
        source = {
            "source": {"fileType": "pdf", "sha256": "e" * 64},
            "owner": {"userId": "owner-1"},
            "pages": [{
                "pageNumber": 1,
                "elements": [
                    {
                        "elementId": "q1",
                        "text": "Q.1 Choose the correct statement.",
                        "bounds": {"x": 50, "y": 40, "height": 14},
                    },
                    {
                        "elementId": "q1-option-a",
                        "text": "(A) First option",
                        "bounds": {"x": 80, "y": 100, "height": 14},
                        "confidence": 0.95,
                        "extractionMethod": "tesseract-ocr",
                    },
                    {
                        "elementId": "q1-option-a-noise",
                        "text": "Fa",
                        "bounds": {"x": 80, "y": 115, "height": 12},
                        "confidence": 0.37,
                        "extractionMethod": "tesseract-ocr",
                    },
                ],
            }],
        }

        result = detect_question_structure(source)["segmentation"]
        question = next(
            item for item in result["questions"]
            if item.get("printedNumber") == 1
        )
        option = question["options"][0]

        self.assertEqual(option["reviewStatus"], "needs-review")
        self.assertNotIn("Fa", option["textCandidate"])
        warning = next(
            item for item in result["warnings"]
            if item.get("code") == "LOW_CONFIDENCE_OPTION_CONTINUATION"
        )
        self.assertEqual(warning["sourceElementId"], "q1-option-a-noise")
        self.assertEqual(warning["confidence"], 0.37)


if __name__ == "__main__":
    unittest.main()
