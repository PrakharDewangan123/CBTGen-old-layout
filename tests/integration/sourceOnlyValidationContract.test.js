import fs from 'node:fs'
import assert from 'node:assert/strict'

const validator = fs.readFileSync('apps/web/src/lib/cbtgen/semanticValidator.js', 'utf8')
const importService = fs.readFileSync('apps/web/src/features/questionPapers/services/questionPaperImportService.js', 'utf8')

assert.match(
  validator,
  /correctRefs\.length === 0[\s\S]*!hasAnswerKeyContent[\s\S]*addWarning\([\s\S]*'ANSWER_KEY_MISSING'/,
  'Empty choice answer-key containers must be treated as missing answer data.'
)

assert.match(
  validator,
  /!value && !range && !hasAnswerKeyContent[\s\S]*addWarning\([\s\S]*'ANSWER_KEY_MISSING'/,
  'Empty numeric answer-key containers must be treated as missing answer data.'
)

assert.match(
  validator,
  /!mapping && !hasAnswerKeyContent[\s\S]*addWarning\([\s\S]*'ANSWER_KEY_MISSING'/,
  'Empty match answer-key containers must be treated as missing answer data.'
)

assert.match(
  validator,
  /if \(!mapping\)[\s\S]*addError\([\s\S]*'MATCH_MAPPING_MISSING'[\s\S]*contains answer-key data but is missing its mapping/,
  'Malformed non-empty match answer data must remain an error.'
)

assert.match(
  validator,
  /answerKeyStatus[\s\S]*missingAnswerQuestions\.length === 0[\s\S]*'COMPLETE'[\s\S]*'MISSING'/,
  'Answer-key readiness must continue to distinguish complete and missing answer data.'
)

assert.match(
  validator,
  /scoringReady[\s\S]*missingAnswerQuestions\.length === 0/,
  'Source-only papers must remain not ready for automatic scoring.'
)

assert.match(
  importService,
  /validationResult\.valid/,
  'Import must continue to gate on semantic validity rather than silently accepting errors.'
)

console.log('Source-only validation contract test passed.')
console.log('  Empty answer-key containers are warnings, not structural errors.')
console.log('  Malformed non-empty answer data remains an error.')
console.log('  SOURCE_ONLY remains valid but scoringReady=false.')
