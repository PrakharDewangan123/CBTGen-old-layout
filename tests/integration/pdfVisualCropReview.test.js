import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const c=readFileSync(new URL('../../apps/web/src/features/questionPapers/components/PdfVisualCropReview.jsx',import.meta.url),'utf8')
const p=readFileSync(new URL('../../apps/web/src/features/questionPapers/components/ExtractionReviewPanel.jsx',import.meta.url),'utf8')
const i=readFileSync(new URL('../../apps/web/src/features/questionPapers/components/ImportQuestionPaper.jsx',import.meta.url),'utf8')
assert.match(c,/previewPdfPage/);assert.match(c,/cropPdfRegion/);assert.match(c,/onPointerDown/);assert.match(c,/contentBounds:bounds/);assert.match(c,/I verified the crop/)
assert.match(p,/cropPendingCount/);assert.match(p,/role="question-content"/);assert.match(p,/role="option-content"/);assert.match(p,/cropAssets:/);assert.match(i,/sourceFile=\{file\}/);assert.match(i,/reviewedQuestions, reviewStatus, cropAssets/)
console.log('PDF visual crop review source-contract tests passed.')
