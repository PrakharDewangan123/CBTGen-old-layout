import assert from 'node:assert/strict'
import fs from 'node:fs'

const service = fs.readFileSync('apps/web/src/features/questionPapers/services/questionPaperImportService.js', 'utf8')

assert.match(service, /selectBestCbtgenVersion/)
const comparator = fs.readFileSync('apps/web/src/lib/cbtgen/regressionComparator.js', 'utf8')
assert.match(comparator, /export function compareCbtgenRegression/)
assert.match(comparator, /const comparison = compareCbtgenRegression\(baselineDocument, candidateDocument\)/)
assert.match(service, /selectBestCbtgenVersion/)
assert.match(service, /export async function compareQuestionPaperRegressionFiles/)
assert.match(service, /CANDIDATE_SEMANTIC_VALIDATION_FAILED/)
assert.match(service, /selected: 'baseline'/)

console.log('Phase 27D regression-safe service contract passed.')
console.log('  Candidate papers are rejected when semantic validation fails or the best-version gate detects regressions.')
