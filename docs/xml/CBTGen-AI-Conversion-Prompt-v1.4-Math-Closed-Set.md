# CBTGen AI Conversion Prompt v1.4 — Mathematical Representation Closed Set

This revision preserves the current CBTGen universal conversion prompt and adds a zero-tolerance mathematical representation contract.

## Core rule
Every mathematical source region has exactly two legal representations:

1. `<math format="latex">...</math>` or reliable MathML;
2. an exact tight math-only visual asset.

Ordinary `<text>` is not a valid mathematical representation.

## Generation gate
For every mathematical region, the converter must explicitly choose structured math or exact visual fallback. If neither is safely possible, conversion fails and the three public deliverables must not be serialized as successful output.

## Final invariant
Before serialization:

- unresolved mathematical regions = 0
- flattened mathematical regions = 0

The validator remains fail-closed and does not invent or rewrite mathematics.
