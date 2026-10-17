import fs from 'node:fs'
import assert from 'node:assert/strict'

const validator = fs.readFileSync('src/lib/cbtgen/semanticValidator.js', 'utf8')

assert.match(
  validator,
  /function validateMatch\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Match validator must accept the shared warnings collection.'
)

assert.match(
  validator,
  /validateMatch\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Question-type dispatch must pass warnings into match validation.'
)

assert.match(
  validator,
  /function validateTextQuestion\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Text validator must accept the shared warnings collection.'
)

assert.match(
  validator,
  /validateTextQuestion\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Question-type dispatch must pass warnings into text validation.'
)

assert.match(
  validator,
  /function validateTechnical\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Technical validator must accept the shared warnings collection.'
)

assert.match(
  validator,
  /validateTechnical\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Question-type dispatch must pass warnings into technical validation.'
)

assert.match(
  validator,
  /function validateMedia\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Media validator must accept the shared warnings collection.'
)

assert.match(
  validator,
  /validateMedia\(\s*question,\s*type,\s*errors,\s*warnings\s*\)/,
  'Question-type dispatch must pass warnings into media validation.'
)

assert.match(
  validator,
  /type === 'SLIDER'[\s\S]*?addWarning\(\s*warnings,\s*'SLIDER_RANGE_MISSING'/,
  'Slider range absence must be recorded in warnings, not errors.'
)

assert.match(
  validator,
  /function validateMatch[\s\S]*?addWarning\(\s*warnings,\s*'ANSWER_KEY_MISSING'/,
  'Missing match answer-key data must remain a warning.'
)

assert.doesNotMatch(
  validator,
  /function validateMatch[\s\S]*?addWarning\(\s*errors,/,
  'Match validation must never send warnings into the error collection.'
)

assert.doesNotMatch(
  validator,
  /function validateTextQuestion[\s\S]*?addWarning\(\s*errors,/,
  'Text validation must never send warnings into the error collection.'
)

assert.doesNotMatch(
  validator,
  /function validateTechnical[\s\S]*?addWarning\(\s*errors,/,
  'Technical validation must never send warnings into the error collection.'
)

assert.doesNotMatch(
  validator,
  /function validateMedia[\s\S]*?addWarning\(\s*errors,/,
  'Media validation must never send warnings into the error collection.'
)

console.log('Warning collection propagation contract test passed.')
