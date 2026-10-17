import assert from 'node:assert/strict'
import { fingerprintQuestion } from '../../apps/web/src/lib/cbtgen/fingerprint.js'

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
const image = (id) => element('image', [], '', { id })
const content = (children) => element('content', children)

function imageQuestion(assetId) {
  return element('question', [
    element('type', [], 'MCQ'),
    content([text('Select the correct diagram.'), image(assetId)]),
    element('response', [
      element('options', [
        element('option', [content([text('A')])], '', { id: 'a' }),
        element('option', [content([text('B')])], '', { id: 'b' }),
      ]),
      element('answer', [element('correctOptionRef', [], 'b')]),
    ]),
  ], '', { id: 'q-image' })
}

const pngOne = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
const pngSame = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
const pngDifferent = new Blob([new Uint8Array([1, 2, 3, 5])], { type: 'image/png' })

const sameA = await fingerprintQuestion(imageQuestion('diagram-a'), [
  { id: 'diagram-a', mime: 'image/png', blob: pngOne },
])
const sameB = await fingerprintQuestion(imageQuestion('diagram-b'), [
  { id: 'diagram-b', mime: 'image/png', blob: pngSame },
])
const changed = await fingerprintQuestion(imageQuestion('diagram-a'), [
  { id: 'diagram-a', mime: 'image/png', blob: pngDifferent },
])

assert.equal(sameA.fingerprint, sameB.fingerprint)
assert.notEqual(sameA.fingerprint, changed.fingerprint)
assert.match(sameA.normalized, /IMAGE:[0-9a-f]{64}/)

console.log('✓ Image fingerprint identity tests passed')
console.log('  Equivalent image bytes remain identical across asset IDs.')
console.log('  Meaningful image-byte changes create a different question identity.')
console.log('  Image content participates in normalized question identity.')
