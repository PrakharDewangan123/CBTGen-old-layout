import assert from 'node:assert/strict'
import { fingerprintQuestion, fingerprintPaper } from '../../src/lib/cbtgen/fingerprint.js'
import { compareQuestionPapers } from '../../src/lib/cbtgen/qpComparison.js'

function element(tagName, children = [], textContent = '', attributes = {}) {
  return {
    tagName,
    children,
    textContent,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null
    },
    querySelector(selector) {
      const match = selector.match(/^:scope > ([A-Za-z0-9_:-]+)$/)
      if (!match) return null
      return children.find((child) => child.tagName === match[1]) || null
    },
  }
}

const text = (value) => element('text', [], value)
const content = (value) => element('content', [text(value)])
const option = (id, value) => element('option', [content(value)], '', { id })

function mcq({ id = 'q-1', number = '1', stem = 'What is 2 + 2?', options = [['a', '3'], ['b', '4'], ['c', '5'], ['d', '6']], correctId = 'b', type = 'MCQ' } = {}) {
  const response = element('response', [
    element('options', options.map(([optionId, value]) => option(optionId, value))),
    element('answer', [element('correctOptionRef', [], correctId)]),
  ])

  return element('question', [
    element('id', [], id),
    element('originalNumber', [], number),
    element('type', [], type),
    content(stem),
    response,
  ], '', { id })
}

const paper = (questions) => ({
  documentElement: element('paper', [element('questions', questions)]),
})

const fp = (question) => fingerprintQuestion(question).then((result) => result.fingerprint)

const baseline = mcq({
  id: 'source-q-1', number: '1', stem: '  What is   2 + 2?  ',
  options: [['opt-a', '3'], ['opt-b', '4'], ['opt-c', '5'], ['opt-d', '6']], correctId: 'opt-b',
})

const metadataChanged = mcq({
  id: 'different-id', number: '99', stem: 'What is 2 + 2?',
  options: [['x', '3'], ['y', '4'], ['z', '5'], ['w', '6']], correctId: 'y',
})

const orderAndLabelsChanged = mcq({
  id: 'another-id', number: '7', stem: 'What is 2 + 2?',
  options: [['label-1', '6'], ['label-2', '4'], ['label-3', '3'], ['label-4', '5']], correctId: 'label-2',
})

const distractorChanged = mcq({
  id: 'distractor-change', stem: 'What is 2 + 2?',
  options: [['a', '100'], ['b', '4'], ['c', '5'], ['d', '6']], correctId: 'b',
})

const correctAnswerChanged = mcq({ id: 'answer-change', correctId: 'c' })
const stemChanged = mcq({ id: 'stem-change', stem: 'What is 2 + 3?' })
const typeChanged = mcq({ id: 'type-change', type: 'MSQ' })
const whitespaceVariant = mcq({ id: 'whitespace-change', stem: 'What is 2 + 2?' })

assert.equal(await fp(baseline), await fp(metadataChanged))
assert.equal(await fp(baseline), await fp(orderAndLabelsChanged))
assert.equal(await fp(baseline), await fp(distractorChanged))
assert.equal(await fp(baseline), await fp(whitespaceVariant))
assert.notEqual(await fp(baseline), await fp(correctAnswerChanged))
assert.notEqual(await fp(baseline), await fp(stemChanged))
assert.notEqual(await fp(baseline), await fp(typeChanged))

const paperA = await fingerprintPaper(paper([
  mcq({ id: 'a', number: '1', stem: 'Q1' }),
  mcq({ id: 'b', number: '2', stem: 'Q2' }),
]))

const reordered = await fingerprintPaper(paper([
  mcq({ id: 'new-b', number: '88', stem: 'Q2' }),
  mcq({ id: 'new-a', number: '77', stem: 'Q1' }),
]))

const distractorPaper = await fingerprintPaper(paper([
  mcq({ id: 'new-a', stem: 'Q1', options: [['a', 'changed'], ['b', '4'], ['c', '5'], ['d', '6']] }),
  mcq({ id: 'new-b', stem: 'Q2' }),
]))

const added = await fingerprintPaper(paper([
  mcq({ id: 'a', stem: 'Q1' }),
  mcq({ id: 'b', stem: 'Q2' }),
  mcq({ id: 'c', stem: 'Q3' }),
]))

const removed = await fingerprintPaper(paper([mcq({ id: 'a', stem: 'Q1' })]))

assert.equal(paperA.paperFingerprint, reordered.paperFingerprint)
assert.equal(paperA.paperFingerprint, distractorPaper.paperFingerprint)
assert.notEqual(paperA.paperFingerprint, added.paperFingerprint)
assert.notEqual(paperA.paperFingerprint, removed.paperFingerprint)

const exact = compareQuestionPapers(paperA, reordered)
assert.equal(exact.relationship, 'EXACT_DUPLICATE')
assert.equal(exact.exactPaperMatch, true)
assert.equal(exact.commonQuestions, 2)

const overlap = compareQuestionPapers(paperA, added)
assert.equal(overlap.relationship, 'OVERLAP_REQUIRES_REVIEW')
assert.equal(overlap.exactPaperMatch, false)
assert.equal(overlap.commonQuestions, 2)

console.log('✓ Fingerprint identity tests passed')
console.log('  Metadata/source numbers ignored.')
console.log('  Option labels/order ignored.')
console.log('  Distractor-only changes ignored.')
console.log('  Whitespace normalization preserved identity.')
console.log('  Correct-answer/stem/type changes create new question identity.')
console.log('  Add/remove question changes paper identity.')
console.log('  Reordered equivalent papers are exact duplicates.')
