# CBTGen XML v1.0 — Semantic Validation Contract

XSD validates structure. This document defines application-level rules that
CBTGen must enforce after XSD validation.

## A. Cross-reference validation

Reject if:
- sectionRef does not resolve to a section;
- passageRef does not resolve to a passage;
- assetRef does not resolve to an asset;
- correctOptionRef does not resolve to an option in the same question;
- MATCH left/right pair references an unknown item.

## B. Question-type validation

MCQ:
- response mode must be single-choice;
- exactly one correct option;
- at least two options.

MSQ:
- response mode must be multiple-choice;
- at least one correct option;
- at least two options.

NAT:
- response mode must be numeric;
- exactly one numeric answer representation;
- value OR range should be present;
- tolerance must not be negative;
- if both value and range exist, reject unless a future schema explicitly permits it.

MATCH:
- response mode must be mapping;
- left and right item IDs must be unique;
- mapping pairs must resolve;
- duplicate/conflicting left mappings are invalid unless a future matching
  mode explicitly permits one-to-many relationships.

ASSERTION_REASON:
- assertion and reason must be present;
- selectable response must use valid option identity semantics.

SUBJECTIVE:
- response mode must be text;
- automatic grading must not be assumed.

## C. Marking validation

- correct/incorrect/unattempted must be numeric.
- Negative marking is allowed.
- Do not assume zero incorrect marking.
- Do not infer a marking scheme from another question.
- If marking is absent, the validator must not invent it.

## D. Count consistency

Where source metadata is present:
- exam.totalQuestions must equal the number of <question> elements.
- section.questionCount must equal the number of questions referencing that
  section, unless the source intentionally describes a broader section rule;
  in such cases the discrepancy must be surfaced for review.
- section.totalMarks and exam.totalMarks should be compared with the sum of
  question marks when question-level marking is complete.

A discrepancy is a validation issue, not permission to rewrite the source.

## E. Partial marking

If partial marking is enabled:
- the application must understand the scheme before allowing automatic scoring.
- if enabled=unknown, mark the question as requiring review.
- never invent a partial-mark formula.

## F. Source-fidelity review

Flag for review when:
- OCR confidence is low;
- answer mapping is ambiguous;
- mathematical notation may have changed;
- code contains suspicious OCR substitutions;
- an image/diagram is missing;
- an option is unreadable;
- the answer key conflicts with the question structure;
- marking data conflicts with the source.

## G. Identity/fingerprinting

The semantic validator must NOT use:
- qpId alone;
- year alone;
- paperNumber alone;
- originalNumber alone;
- option labels alone;
- question position alone

as authoritative QP/question identity.

Identity analysis should use normalized source content and question-level
fingerprints.

Question matching should be tolerant of:
- whitespace differences;
- harmless punctuation differences;
- OCR normalization;
- option-label changes;
- option reordering;
- question renumbering;
- question reordering.

A distractor-only change should not automatically be classified as a wholly
new question. The identity engine should evaluate the question stem,
answer concept, type, structural content, and option relationships.

Material changes to the stem, correct-answer concept, question type, scoring
semantics, or other meaning-bearing content may result in a different
question identity.

## H. Randomization boundary

Source XML is immutable source representation.

Session generation may:
- shuffle questions;
- shuffle randomizable options;
- generate session question numbers;
- generate displayed option labels.

Session generation must preserve the mapping back to:
- source question ID;
- originalNumber;
- source option ID.

Correctness must always be evaluated using source option identity, never the
displayed label.

## I. Security boundary

Never accept client-provided XML fields as authority for:
- pack balance;
- slot availability;
- attempts used;
- user identity;
- session authorization;
- score finalization.

The server owns those values.

## J. Import states

Recommended states:

VALID
VALID_WITH_WARNINGS
REVIEW_REQUIRED
REJECTED

VALID:
- structure and semantic checks pass.

VALID_WITH_WARNINGS:
- import is safe but non-blocking issues exist.

REVIEW_REQUIRED:
- paper can be stored but automatic CBT generation/scoring should be blocked
  until specified issues are resolved.

REJECTED:
- XML is malformed or structurally/semantically unsafe to process.
