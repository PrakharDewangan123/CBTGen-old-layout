import assert from 'node:assert/strict'
import {
  findConfiguredSection,
  findConfiguredType,
  resolveInstructionMarking,
} from '../../apps/web/src/features/exam/services/instructionMarking.js'

const configSections = [
  {
    id: 'math-1',
    name: 'Mathematics — Section 1',
    declaredMarks: 24,
    types: [{ type: 'NAT', count: 8, correct: 3, wrong: 0, partial: '', partialRules: '' }],
  },
  {
    id: 'math-2',
    name: 'Mathematics — Section 2',
    declaredMarks: 24,
    types: [{ type: 'MSQ', count: 6, correct: 4, wrong: -2, partial: '', partialRules: '+3; +2; +1' }],
  },
  {
    id: 'math-3',
    name: 'Mathematics — Section 3',
    declaredMarks: 12,
    types: [{ type: 'MATCH', count: 4, correct: 3, wrong: -1, partial: '', partialRules: '' }],
  },
]

const math2 = findConfiguredSection(configSections, {
  id: 'math-2',
  name: 'Mathematics — Section 2',
})
assert.equal(math2.declaredMarks, 24)

const nat = resolveInstructionMarking({}, findConfiguredType(
  findConfiguredSection(configSections, { id: 'math-1' }),
  'NAT',
))
assert.deepEqual(nat, {
  correct: 3,
  wrong: 0,
  partial: 0,
  partialRule: '',
})

const msq = resolveInstructionMarking({}, findConfiguredType(math2, 'MSQ'))
assert.deepEqual(msq, {
  correct: 4,
  wrong: -2,
  partial: 0,
  partialRule: '+3; +2; +1',
})

const match = resolveInstructionMarking({}, findConfiguredType(
  findConfiguredSection(configSections, { id: 'math-3' }),
  'MATCH',
))
assert.deepEqual(match, {
  correct: 3,
  wrong: -1,
  partial: 0,
  partialRule: '',
})

// Explicit question-level marking remains authoritative over the configured
// fallback, which protects answer-ready papers from being overwritten.
const explicit = resolveInstructionMarking(
  { correct: 5, incorrect: -3 },
  { correct: 4, wrong: -2 },
)
assert.deepEqual(explicit, {
  correct: 5,
  wrong: -3,
  partial: 0,
  partialRule: '',
})

console.log('Instructions marking propagation contract passed.')
console.log('SOURCE_ONLY fallback: NAT +3/0; MSQ +4/-2 with +3/+2/+1; MATCH +3/-1.')
console.log('Question-level marking remains authoritative when explicitly present.')
