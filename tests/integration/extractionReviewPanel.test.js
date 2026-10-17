import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../../src/features/questionPapers/components/ExtractionReviewPanel.jsx', import.meta.url), 'utf8')
assert.match(panel, /Review extracted questions/)
assert.match(panel, /checked this question against the original source/i)
assert.match(panel, /checked this option against the source/i)
assert.match(panel, /pendingCount > 0/)
assert.match(panel, /reviewStatus: 'human-reviewed'/)
assert.match(panel, /never invents a correct answer/i)
assert.match(panel, /Authenticated saving, asset authorization, package generation and final CBTGen validation must still run/)
assert.match(panel, /onApprove\(/)
console.log('Extraction review panel contract tests passed.')
