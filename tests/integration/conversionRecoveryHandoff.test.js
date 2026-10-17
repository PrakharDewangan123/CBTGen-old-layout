import assert from 'node:assert/strict'
import {
  clearConversionRecoveryRecord,
  createConversionRecoveryRecord,
  formatConversionCorrectionHandoff,
  loadConversionRecoveryRecord,
  saveConversionRecoveryRecord,
} from '../../apps/web/src/features/questionPapers/services/conversionRecovery.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

const storage = memoryStorage()
const result = {
  valid: false,
  status: 'REJECTED',
  errors: [
    { code: 'MATH_FLATTENED_INTO_TEXT', message: 'Question q10 has flattened mathematical notation.' },
    { code: 'NAT_VALUE_MISSING', message: 'Question q15 has no authoritative numeric answer.' },
  ],
  warnings: [{ code: 'ANSWER_KEY_MISSING', message: 'The answer key is incomplete.' }],
  summary: { examName: 'JEE Advanced 2016 Paper 1', totalQuestions: 54, sections: 9, scoringReady: false },
}
const record = createConversionRecoveryRecord({ fileName: 'paper.cbtgen', result, createdAt: '2026-10-09T10:00:00.000Z' })
assert.equal(record.errorCount, 2)
assert.equal(record.summary.totalQuestions, 54)
assert.equal(saveConversionRecoveryRecord(record, storage), true)
assert.deepEqual(loadConversionRecoveryRecord(storage), record)

const report = formatConversionCorrectionHandoff(record)
assert.match(report, /MATH_FLATTENED_INTO_TEXT/)
assert.match(report, /NAT_VALUE_MISSING/)
assert.match(report, /Do not invent answers, values, equations/)
assert.match(report, /tight math-only crop/)
assert.match(report, /whole-page screenshot as a normal question asset/)
assert.match(report, /pixel-level crop fidelity/)
assert.match(report, /question-level reviewStatus notes/)
assert.match(report, /complete corrected CBTGen output/)
assert.doesNotMatch(report, /OpenAI API|API key|AI model endpoint/i)

const huge = createConversionRecoveryRecord({
  fileName: 'large.xml',
  result: { valid: false, errors: Array.from({ length: 100 }, (_, i) => ({ code: 'E', message: `issue ${i}` })) },
})
assert.equal(huge.errors.length, 100)
assert.equal(huge.truncated, false)
assert.match(formatConversionCorrectionHandoff(huge), /issue 99/)
assert.doesNotMatch(formatConversionCorrectionHandoff(huge), /report is truncated/)

assert.equal(clearConversionRecoveryRecord(storage), true)
assert.equal(loadConversionRecoveryRecord(storage), null)
console.log('✓ Conversion recovery handoff tests passed')
console.log('  Validation reports persist locally, survive reload, and create source-safe correction instructions.')
console.log('  Reports preserve every validation issue so the external converter receives the complete correction list.')
