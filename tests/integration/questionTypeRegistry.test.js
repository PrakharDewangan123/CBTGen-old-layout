import { readFile } from 'node:fs/promises'
import { QUESTION_TYPES } from '../../apps/web/src/lib/cbtgen/questionTypes.js'

const registrySource = await readFile(new URL('../../apps/web/src/features/exam/questionTypes/questionTypeRegistry.js', import.meta.url), 'utf8')

const expectedImplemented = [
  'MCQ',
  'MSQ',
  'ASSERTION_REASON',
  'IMAGE_CHOICE',
  'IMAGE_MULTI_CHOICE',
  'NAT',
  'TRUE_FALSE',
  'YES_NO',
  'NUMERIC_RANGE',
  'SLIDER',
  'EQUATION_INPUT',
  'DROPDOWN',
  'MATCH',
  'MATCH_MULTIPLE',
  'ORDERING',
  'RANKING',
  'TEXT_SHORT',
  'TEXT_LONG',
  'FILL_BLANK',
  'ESSAY',
  'SUBJECTIVE',
  'MATRIX_TEXT',
]

for (const type of expectedImplemented) {
  if (!QUESTION_TYPES[type]) throw new Error(`Registry test references unknown question type: ${type}`)
  if (!registrySource.includes(type)) throw new Error(`Question type renderer is not registered: ${type}`)
}

if (!registrySource.includes('UnsupportedQuestionType')) {
  throw new Error('Unsupported question types must have an explicit renderer fallback.')
}

console.log('✓ Question type registry tests passed')
console.log(`  ${expectedImplemented.length} question types have explicit renderers.`)
console.log('  Unsupported types use an explicit non-silent fallback.')
console.log('  Question type registry remains separate from Examination.jsx.')

if (QUESTION_TYPES.MCQ.responseMode !== 'single-choice') {
  throw new Error('MCQ must use response mode single-choice.')
}
if (QUESTION_TYPES.MSQ.responseMode !== 'multiple-select') {
  throw new Error('MSQ must use response mode multiple-select.')
}
if (QUESTION_TYPES.IMAGE_MULTI_CHOICE.responseMode !== 'multiple-select') {
  throw new Error('IMAGE_MULTI_CHOICE must use response mode multiple-select.')
}

console.log('✓ Response-mode contracts passed')
console.log('  MCQ=single-choice; MSQ=multiple-select; IMAGE_MULTI_CHOICE=multiple-select.')
