import fs from 'node:fs'
import assert from 'node:assert/strict'

const validator = fs.readFileSync('apps/web/src/lib/cbtgen/semanticValidator.js', 'utf8')

assert.match(
  validator,
  /function validateMatch\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Match validation must receive the shared warnings collection.'
)

assert.match(
  validator,
  /validateMatch\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'The question-type dispatcher must pass the match validator its error collection.'
)

assert.match(
  validator,
  /function validateMatch[\s\S]*?if \(!mapping && !hasAnswerKeyContent\) \{[\s\S]*?addWarning\(\s*warnings,\s*'ANSWER_KEY_MISSING'/,
  'Missing match answer-key data must be recorded as a warning rather than throwing a scope error.'
)

console.log('Match warning-scope contract test passed.')
