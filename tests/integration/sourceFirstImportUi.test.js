import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const importUi = readFileSync(new URL('../../apps/web/src/features/questionPapers/components/ImportQuestionPaper.jsx', import.meta.url), 'utf8')
const questionPapersPage = readFileSync(new URL('../../apps/web/src/features/questionPapers/pages/QuestionPapers.jsx', import.meta.url), 'utf8')
const faq = readFileSync(new URL('../../apps/web/src/features/faq/pages/FAQ.jsx', import.meta.url), 'utf8')

assert.match(importUi, /\.pdf,\.docx,application\/pdf/)
assert.match(importUi, /Extract document/)
assert.match(importUi, /does not save a paper to your library/i)
assert.match(importUi, /extractSourceDocument\(file/)
assert.doesNotMatch(importUi, /Choose CBTGen Paper|Validate Paper|Copy correction report|\\.cbtgen/)
assert.match(importUi, /convertReviewedCandidatesToCbtgenXml/)
assert.match(importUi, /validateCbtgenXml/)
assert.match(importUi, /CBTGen XML draft — not saved/)
assert.match(importUi, /Semantic validation/)
assert.match(importUi, /Scoring readiness/)
assert.match(importUi, /nothing has been saved/i)
assert.doesNotMatch(questionPapersPage, /conversionPrompt|ConversionPromptBlock|Copy Prompt|Convert to XML|official conversion prompt|import the\s+resulting XML/i)
assert.doesNotMatch(faq, /import the resulting XML|CBTGen XML or a ZIP package|\.xml \(a CBTGen/i)

console.log('Source-first import UI contract tests passed.')
console.log('Prompt UI removed; PDF/DOCX processing action connected to the API client; unsaved state clearly disclosed.')
