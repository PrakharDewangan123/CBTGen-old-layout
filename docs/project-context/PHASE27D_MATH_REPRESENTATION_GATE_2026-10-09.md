# Phase 27D — Mathematical Representation Semantic Gate

Date: 2026-10-09

## Purpose

Prevent a conversion from being treated as semantically valid when mathematical
notation has been flattened into ordinary `<text>` and the exact mathematical
structure has not been preserved.

## Rule

For each `<content>` element, high-confidence mathematical notation detected in
a direct `<text>` child is a hard validation failure unless that same content
contains direct structured `<math>` content.

The validator does not solve, rewrite, or infer mathematics. It only fails the
candidate so the converter must either:

1. recover exact structured mathematics; or
2. preserve the exact expression as a tight math-only visual fallback.

This is intentionally fail-closed. A general question/diagram image does not
silently count as a math fallback.

## Scope

The detection is universal and is not tied to JEE, 2016, Mathematics, Physics,
or any particular paper. It covers high-confidence mathematical markers such
as roots, integrals, summations, Greek mathematical symbols, inequalities,
trigonometric/logarithmic/limit notation, explicit equations, fractions, and
superscripts/caret powers.

## Prompt synchronization

The current universal source-lock + option-distinction prompt is synchronized
into:

- `docs/project-context/prompts/CBTGen_AI_Conversion_Prompt_v1.0_CURRENT.txt`
- `docs/project-context/prompts/CBTGen_AI_Conversion_Prompt_MASTER_CURRENT.txt`
- `docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md`

The previous prompt remains preserved in the prompt history / previous-master
artifact and is not deleted.
