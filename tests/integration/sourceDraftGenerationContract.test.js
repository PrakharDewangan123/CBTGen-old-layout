import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const component = await readFile(
  new URL(
    '../../apps/web/src/features/questionPapers/components/ImportQuestionPaper.jsx',
    import.meta.url
  ),
  'utf8'
)

const reviewPanel = await readFile(
  new URL(
    '../../apps/web/src/features/questionPapers/components/ExtractionReviewPanel.jsx',
    import.meta.url
  ),
  'utf8'
)

const converter = await readFile(
  new URL(
    '../../apps/web/src/lib/cbtgen/extractionCandidateConverter.js',
    import.meta.url
  ),
  'utf8'
)

const validator = await readFile(
  new URL(
    '../../apps/web/src/lib/cbtgen/semanticValidator.js',
    import.meta.url
  ),
  'utf8'
)

// Review approval must provide the explicit reviewed payload.
assert.match(component, /onApprove=\{\(\{ reviewedQuestions, reviewStatus \}\)/)
assert.match(reviewPanel, /reviewStatus:\s*'human-reviewed'/)
assert.match(reviewPanel, /reviewedQuestions:\s*includedQuestions\.map/)

// Draft generation must use the reviewed payload, not bypass review.
assert.match(component, /convertReviewedCandidatesToCbtgenXml\(\{/)
assert.match(component, /reviewedQuestions,/)
assert.match(component, /reviewStatus,/)

// Generated XML must be parsed and malformed XML must be rejected.
assert.match(
  component,
  /new DOMParser\(\)\.parseFromString\(xmlText,\s*'application\/xml'\)/
)
assert.match(component, /xmlDocument\.querySelector\('parsererror'\)/)
assert.match(
  component,
  /The generated XML could not be parsed safely/
)

// Semantic validation must run on the parsed XML document.
assert.match(component, /validateCbtgenXml\(xmlDocument\)/)
assert.match(component, /if \(!validation\.valid\)/)
assert.match(component, /semantic validation rejected it/i)

// Errors must be caught and surfaced without claiming success.
assert.match(component, /catch \(error\)/)
assert.match(
  component,
  /Unable to generate or validate the XML draft/
)

// The UI must distinguish a draft from a final, saved package.
assert.match(component, /CBTGen XML draft — not saved/)
assert.match(component, /has not been saved to your library/)
assert.match(component, /authenticated finalization, package generation, and saving remain separate steps/i)

// The converter must require reviewed evidence and avoid inventing answers.
assert.match(converter, /human-reviewed/)
assert.match(converter, /reviewedQuestions/)
assert.match(converter, /answer/i)

// The validator must return explicit rejection and scoring-readiness information.
assert.match(validator, /status:\s*'REJECTED'/)
assert.match(validator, /scoringReady/)

console.log('Source draft-generation contract tests passed.')
console.log('Verified review handoff, XML parsing, semantic validation, error handling, and unsaved-state disclosure.')
console.log('Note: these are source-contract checks, not browser-level interaction tests.')
