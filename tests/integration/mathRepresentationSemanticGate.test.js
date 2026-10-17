import assert from 'node:assert/strict'
import fs from 'node:fs'

const validator = fs.readFileSync(
  'src/lib/cbtgen/semanticValidator.js',
  'utf8'
)
const prompt = fs.readFileSync(
  'docs/project-context/prompts/CBTGen_AI_Conversion_Prompt_v1.0_CURRENT.txt',
  'utf8'
)

assert.match(
  validator,
  /MATH_LIKE_TEXT_PATTERN/,
  'Semantic validator must detect high-confidence mathematical notation flattened into text.'
)
assert.match(
  validator,
  /MATH_FLATTENED_INTO_TEXT/,
  'Flattened mathematical notation must be a hard semantic validation error.'
)
assert.match(
  validator,
  /validateMathematicalRepresentation\(/,
  'Question validation must invoke the mathematical representation gate.'
)
assert.match(
  validator,
  /Recover exact structured math or use a tight math-only visual fallback/,
  'The validator error must require structured math or a tight visual fallback.'
)
assert.match(
  prompt,
  /Mathematical expressions requiring structure MUST NOT be flattened into ordinary text/
)
assert.match(
  prompt,
  /Use structured <math> content whenever reliable structure can be recovered/
)
assert.match(
  prompt,
  /If exact structure cannot be reliably recovered, use a TIGHT image crop containing ONLY the exact mathematical expression/
)
assert.match(
  prompt,
  /MATHEMATICAL REPRESENTATION CLOSED SET — ZERO TOLERANCE/
)
assert.match(
  prompt,
  /There is NO third valid representation for mathematical notation/
)
assert.match(
  prompt,
  /ordinary <text> as a convenience fallback/
)
assert.match(
  prompt,
  /FINAL MATH INVARIANT/
)

console.log('Math representation semantic gate contract passed.')
console.log('  Flattened mathematical notation is rejected unless represented structurally or via the defined exact-source fallback.')

assert.match(
  validator,
  /validateUnresolvedReviewFlags\(/,
  'Unresolved conversion review flags must be checked by the semantic validator.'
)
assert.match(
  validator,
  /UNRESOLVED_REVIEW_FLAG/,
  'Known unresolved review flags must be hard validation failures.'
)

console.log('Unresolved review-flag shipping gate contract passed.')


// Mixed-content regression: a <content> containing both valid <math> and a
// second flattened mathematical <text> block must still fail. The presence of
// one valid <math> block must not mask another flattened math region.
assert.match(
  validator,
  /for \(const textElement of textElements\)/,
  'Math validation must inspect every direct <text> node in mixed content.'
)
assert.doesNotMatch(
  validator,
  /if \(containsStructuredMath\(content\)\) continue/,
  'A valid <math> sibling must not suppress validation of flattened math text.'
)

console.log('Mixed math-content masking regression contract passed.')


// Question-level review notes must be a shipping blocker, not ignored metadata.
assert.match(
  validator,
  /questions question reviewStatus/,
  'Question-level source-fidelity review statuses must be inspected.'
)
assert.match(
  validator,
  /QUESTION_SOURCE_RECONCILIATION_REQUIRED/,
  'Unresolved question-level source review must block import readiness.'
)
console.log('Question-level source reconciliation gate contract passed.')

assert.match(
  validator,
  /querySelectorAll\('content, option, leftItem, rightItem, item'\)/,
  'Flattened math checks must include direct option text and MATCH item text, not only question stem content.'
)
console.log('Option and MATCH mathematical representation coverage contract passed.')
