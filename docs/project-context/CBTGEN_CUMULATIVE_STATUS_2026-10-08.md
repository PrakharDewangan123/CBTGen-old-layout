# CBTGen Cumulative Project Status — 2026-10-08

## Baseline
- Application baseline before this correction: Phase 27A — Correction 21.
- Current cumulative state: Phase 27B — Conversion Validation & Regression Gate, first packaging-contract correction.
- This is the current runnable codebase supplied by the user.
- No application source code was changed while creating this baseline.
- `node_modules/` and `dist/` are intentionally excluded.

## Current master conversion prompt
`prompts/CBTGen_AI_Conversion_Prompt_MASTER_CURRENT.txt`

The current master is the hardened v1.0 production prompt. Its public schema/version identity remains v1.0; the internal prompt history is preserved separately.

## Regression corpus
The `regression/` directory contains the current 2016 and 2022 generated outputs used as conversion regression evidence.

Known 2016 regression failures remain intentionally preserved as regression evidence. The first Phase 27B root cause was isolated to the three-output XML serialization contract: package assets lacked `src`, while standalone XML used package-style `<assets><asset>` instead of embedded Base64 `<image>` definitions. See `regression/PHASE_27B_2016_PACKAGING_REGRESSION_2026-10-08.md`.

## Next phase
Phase 27B — Conversion Validation & Regression Gate.

## Cumulative ZIP rule
Every actual project change must be applied to the latest cumulative codebase, not an older backup. After each change, the complete runnable project is re-zipped and delivered. No patch-only deliverables.

## Phase 27B verification — 2026-10-08
- Full declared `test:*` integration suite passed after updating the prompt-contract tests to the current production prompt wording.
- Targeted package/standalone image-contract tests passed.
- `npm run build` was attempted but could not run because the working environment had no completed Vite installation. `npm ci` timed out twice; an offline retry failed because `zod-validation-error@4.0.2` was not cached. No dependency changes were made and `node_modules/` was removed before packaging.
- Runtime/browser visual verification was not claimed in this correction.

## Phase 27C — Visual Asset Ownership Gate (2026-10-08)

The current conversion prompt is now 2,042 lines and is synchronized across the canonical prompt and project-context current prompt copies. Phase 27C added a machine-checkable semantic visual ownership/attachment gate to `src/lib/cbtgen/semanticValidator.js`, plus a dedicated integration contract test. The gate rejects normal visual assets that are shared across different question/semantic owners, rejects scope/context mismatches, and rejects normal use of source-page assets. It does not claim to infer pixel contamination from image binaries; pixel-level crop quality remains a rendered-source preflight requirement.

All integration tests passed. `npm run build` was attempted but was not runnable in the clean environment because `node_modules` is absent (`vite: not found`); no dependency changes were made.

## Historical path clarification

The prompt and regression paths above reflect the repository layout at the time
this status document was written. In the current repository, the corresponding
locations are:

- `docs/project-context/prompts/CBTGen_AI_Conversion_Prompt_MASTER_CURRENT.txt`
- `docs/project-context/regression/PHASE_27B_2016_PACKAGING_REGRESSION_2026-10-08.md`

The original historical entries above are retained to preserve the record of the
earlier project state.

This document is a point-in-time historical snapshot; its prompt line counts,
build results, and phase status describe the state at the time of writing and
are not assertions about the current repository state.
