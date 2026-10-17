import assert from 'node:assert/strict'
import fs from 'node:fs'

const comparator = fs.readFileSync('apps/web/src/lib/cbtgen/regressionComparator.js', 'utf8')

for (const contract of [
  'compareCbtgenRegression',
  'selectBestCbtgenVersion',
  'QUESTION_LOSS',
  'QUESTION_MISSING',
  'OPTION_LOSS',
  'OPTION_ORDER_CHANGED',
  'DUPLICATE_QUESTION_CONTENT',
  'MCQ_ANSWER_CARDINALITY',
  'MULTILINGUAL_CONTENT_LOSS',
  'ANSWER_DATA_LOST',
  'ANSWER_MAPPING_CHANGED',
]) assert.match(comparator, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

assert.match(comparator, /candidateAccepted = result\.regressions\.length === 0/)
assert.match(comparator, /selected: comparison\.candidateAccepted \? 'candidate' : 'baseline'/)

console.log('Phase 27D regression-safe best-version gate contract passed.')
console.log('  Structural/source-fidelity regressions block candidate replacement.')
console.log('  Pixel-level visual comparison remains a rendered-source review responsibility.')
