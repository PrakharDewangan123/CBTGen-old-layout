import assert from 'node:assert/strict'
import { parseSectionMarkingComment } from '../../src/features/exam/services/sourceMarkingParser.js'

const numerical = parseSectionMarkingComment(
  'SOURCE MARKING SCHEME (Section 1 — numerical value): +3 only if correct numerical value is entered; 0 in all other cases.',
)
assert.equal(numerical.correct, 3)
assert.equal(numerical.wrong, 0)
assert.equal(numerical.partial, '')
assert.equal(numerical.partialRules, '')

const multipleSelect = parseSectionMarkingComment(
  'SOURCE MARKING SCHEME (Section 2 — multiple correct options): +4 only if all correct options are chosen; +3 if exactly three correct options are chosen and all are correct; +2 if exactly two correct options are chosen and both are correct; +1 if exactly one correct option is chosen and it is correct; 0 if no option is chosen; −2 in all other cases.',
)
assert.equal(multipleSelect.correct, 4)
assert.equal(multipleSelect.wrong, -2)
assert.equal(multipleSelect.partial, '')
assert.match(multipleSelect.partialRules, /\+3/)
assert.match(multipleSelect.partialRules, /\+2/)
assert.match(multipleSelect.partialRules, /\+1/)
assert.doesNotMatch(multipleSelect.partialRules, /\+4/)

const match = parseSectionMarkingComment(
  'SOURCE MARKING SCHEME (Section 3 — matching list sets): +3 only if the option corresponding to the correct combination is chosen; 0 if no option is chosen; −1 in all other cases.',
)
assert.equal(match.correct, 3)
assert.equal(match.wrong, -1)
assert.equal(match.partial, '')
assert.equal(match.partialRules, '')

assert.equal(parseSectionMarkingComment('ordinary section comment'), null)

console.log('Source section marking prefill contract passed.')
console.log('NAT: +3 / 0; MSQ: +4 / -2 with +3/+2/+1 partial rules; MATCH: +3 / -1.')
