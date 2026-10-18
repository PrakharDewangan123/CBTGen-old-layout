# Phase 27C — Visual Asset Ownership / Attachment Gate

Date: 2026-10-08

## Baseline

Started from the complete Phase 27B cumulative project ZIP.
No application UI or Examination UI changes were made.

## Problem addressed

The 2016 and 2022 conversion regressions showed that prompt-level crop rules were not enough to guarantee that a visual asset was attached to the correct semantic owner. The current master prompt already required pixel-level visual sign-off, but the application had no machine-checkable ownership/attachment gate beyond basic asset existence and scope checks.

## Changes

1. Expanded the canonical conversion prompt from 1,969 to 2,042 lines.
2. Added section `21A. MACHINE-CHECKABLE VISUAL OWNERSHIP GATE — HARD REQUIREMENT`.
3. Synchronized the same current prompt content into:
   - `docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md`
   - `docs/project-context/prompts/CBTGen_AI_Conversion_Prompt_MASTER_CURRENT.txt`
   - `docs/project-context/prompts/CBTGen_AI_Conversion_Prompt_v1.0_CURRENT.txt`
4. Added `collectVisualAssetUsages()` and `validateVisualAssetOwnership()` to `apps/web/src/lib/cbtgen/semanticValidator.js`.
5. The semantic validator now fail-closes for:
   - one visual asset referenced by multiple questions;
   - one visual asset attached to multiple distinct semantic owners;
   - `option-visual` assets used outside option content;
   - `question-visual` assets attached to an option;
   - `source-page` assets used as normal content.
6. The validator warns when a referenced visual asset has no declared scope or is duplicated within the same semantic owner.
7. Added `tests/integration/visualAssetOwnershipGateContract.test.js`.
8. Updated the older question-image extraction contract test to assert the current master prompt terminology rather than a removed legacy heading.

## Important limitation

This gate intentionally does **not** pretend to determine pixel contamination from image bytes. A crop containing neighboring prose cannot be reliably detected from arbitrary image binaries without the original rendered source and a visual/OCR comparison step. The prompt therefore continues to require rendered-source visual sign-off and reject-and-recrop. The new application gate enforces the machine-checkable ownership and attachment portion of that contract.

## Validation performed

All integration tests in `tests/integration/*.test.js` passed.

`npm run build` was attempted but could not run because `node_modules` is absent in the clean cumulative ZIP (`vite: not found`). No network/dependency changes were made.

## Next step

Regenerate both JEE Advanced 2016 and 2022 with the 2,042-line current master prompt, then compare the new outputs against the retained old/new regression evidence. Do not declare conversion production-ready until packaging, semantic ownership, question fidelity, structured math, and visual crop sign-off all pass.
