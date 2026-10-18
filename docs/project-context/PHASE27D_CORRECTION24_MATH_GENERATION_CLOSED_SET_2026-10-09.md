# Phase 27D — Correction 24: Math Generation Closed Set

Date: 2026-10-09

## Problem
Paper1-11 was generated with the latest prompt but still emitted mathematical
expressions as ordinary `<text>`. The validator correctly rejected them, but the
prompt did not express the representation choice as a closed set strongly enough.

## Changes
- Added a zero-tolerance mathematical representation closed set to the current
  universal prompt.
- Every mathematical source region must become either structured `<math>`/MathML
  or an exact tight math-only visual fallback.
- Ordinary `<text>` is explicitly forbidden for mathematical notation.
- Added mandatory final mathematical zero-tolerance preflight and invariants.
- Explicitly forbade hiding flattened math inside mixed prose blocks.
- Preserved source-fidelity and fail-closed behavior; no math is invented or solved.
- Hardened the semantic validator so valid `<math>` elsewhere in the same `<content>`
  cannot mask a second flattened mathematical `<text>` node.
- Examination UI and unrelated project logic were not changed.

## Verification intent
The next regenerated paper must be evaluated from the original source using this
updated prompt. Existing Paper1-11 remains regression evidence and is not rewritten.
