import assert from 'node:assert/strict'
import { convertReviewedCandidatesToCbtgenXml } from '../../apps/web/src/lib/cbtgen/extractionCandidateConverter.js'

const assets = [
  { id: 'qimg-1', src: 'assets/qimg-1.png', mimeType: 'image/png', scope: 'question-visual' },
  { id: 'opt-1-a', src: 'assets/opt-1-a.png', mimeType: 'image/png', scope: 'option-visual' },
  { id: 'opt-1-b', src: 'assets/opt-1-b.png', mimeType: 'image/png', scope: 'option-visual' },
  { id: 'qimg-2', src: 'assets/qimg-2.png', mimeType: 'image/png', scope: 'question-visual' },
  { id: 'opt-2-a', src: 'assets/opt-2-a.png', mimeType: 'image/png', scope: 'option-visual' },
  { id: 'opt-2-b', src: 'assets/opt-2-b.png', mimeType: 'image/png', scope: 'option-visual' },
]
const candidates = [
  {
    questionId: 'question-stable-1', printedNumber: '1', type: 'MCQ', reviewed: true,
    textCandidate: 'THIS MUST NEVER APPEAR IN XML', imageAssetRef: 'qimg-1',
    options: [
      { optionId: 'option-stable-1a', printedLabel: 'A', textCandidate: 'PRIVATE OPTION TEXT A', imageAssetRef: 'opt-1-a', reviewed: true },
      { optionId: 'option-stable-1b', printedLabel: 'B', textCandidate: 'PRIVATE OPTION TEXT B', imageAssetRef: 'opt-1-b', reviewed: true },
    ],
  },
  {
    questionId: 'question-stable-2', printedNumber: '2', type: 'MSQ', reviewed: true,
    textCandidate: 'THIS MUST ALSO NEVER APPEAR', imageAssetRef: 'qimg-2',
    options: [
      { optionId: 'option-stable-2a', printedLabel: 'A', textCandidate: 'PRIVATE OPTION TEXT C', imageAssetRef: 'opt-2-a', reviewed: true },
      { optionId: 'option-stable-2b', printedLabel: 'B', textCandidate: 'PRIVATE OPTION TEXT D', imageAssetRef: 'opt-2-b', reviewed: true },
    ],
  },
]
const convert = (overrides = {}) => convertReviewedCandidatesToCbtgenXml({
  reviewedQuestions: candidates, reviewStatus: 'human-reviewed',
  examName: 'Reviewed & Imported', sectionName: 'General', assets, ...overrides,
})
const xml = convert()

assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
assert.match(xml, /<cbtgen version="1\.0">/)
assert.match(xml, /<totalQuestions>2<\/totalQuestions>/)
assert.match(xml, /<questionCount>2<\/questionCount>/)
assert.match(xml, /<mode>single-choice<\/mode>/)
assert.match(xml, /<mode>multiple-select<\/mode>/)
assert.match(xml, /<name>Reviewed &amp; Imported<\/name>/)
assert.match(xml, /<answer\/>/)
assert.match(xml, /<assetRef>qimg-1<\/assetRef>/)
assert.match(xml, /<image assetRef="opt-1-a" mimeType="image\/png" scope="option-visual"\/>/)
assert.match(xml, /<asset id="qimg-1" type="image" src="assets\/qimg-1\.png"/)
assert.match(xml, /id="question-stable-1"/)
assert.match(xml, /id="option-stable-1a" label="A"/)
assert.doesNotMatch(xml, /THIS MUST NEVER APPEAR|PRIVATE OPTION TEXT|<text>/)
assert.doesNotMatch(xml, /<image[^>]*scope="source-page"/)

assert.throws(() => convert({ reviewStatus: 'needs-review' }), /human review/)
assert.throws(() => convert({ reviewedQuestions: [{ ...candidates[0], type: '' }] }), /explicit MCQ or MSQ/)
assert.throws(() => convert({ reviewedQuestions: [{ ...candidates[0], reviewed: false }] }), /explicitly reviewed/)
assert.throws(() => convert({
  reviewedQuestions: [{
    ...candidates[0],
    options: [{ ...candidates[0].options[0], reviewed: false }, candidates[0].options[1]],
  }],
}), /option A must be explicitly reviewed/)
assert.throws(() => convert({
  reviewedQuestions: [{ ...candidates[0], options: [candidates[0].options[0]] }],
}), /at least two options/)
assert.throws(() => convert({ reviewedQuestions: [candidates[0], candidates[0]] }), /Duplicate printed question number/)
assert.throws(() => convert({ reviewedQuestions: [{ ...candidates[0], questionId: '' }] }), /stable questionId/)
assert.throws(() => convert({
  reviewedQuestions: [{ ...candidates[0], imageAssetRef: 'missing-image' }],
}), /references missing image asset/)
assert.throws(() => convert({
  assets: assets.map(asset => asset.id === 'opt-1-a' ? { ...asset, scope: 'question-visual' } : asset),
}), /must have scope "option-visual"/)
assert.throws(() => convert({ assets: [...assets, { ...assets[0] }] }), /Duplicate asset id/)
assert.throws(() => convert({
  assets: assets.map(asset => asset.id === 'qimg-1' ? { ...asset, src: '../outside.png' } : asset),
}), /safe package path/)
assert.throws(() => convert({
  reviewedQuestions: [{
    ...candidates[0],
    options: [
      candidates[0].options[0],
      { ...candidates[0].options[1], optionId: candidates[0].options[0].optionId },
    ],
  }],
}), /Duplicate stable option id/)

console.log('Extraction candidate XML converter tests passed.')
console.log('  ✓ Canonical root, exam counts and section counts')
console.log('  ✓ Explicit MCQ/MSQ response modes and stable IDs')
console.log('  ✓ Image-only question and option content; OCR text is not exported')
console.log('  ✓ Asset manifest, package paths, MIME types and scope guards')
console.log('  ✓ Review, type, option-count and duplicate-identity guards')
console.log('  ✓ Empty answer keys are not inferred')
