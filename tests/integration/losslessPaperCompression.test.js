import assert from 'node:assert/strict'
import { decodePaperContent, encodePaperContent } from '../../src/lib/cbtgen/storage/losslessRecordCompression.js'

const longText = 'Question text with exact symbols: α β γ ∑ ∫ √ ≤ ≥ → and preserved whitespace. '.repeat(500)
const original = {
  userId: 'owner-a',
  fingerprint: 'paper-fingerprint',
  xmlText: `<cbtgen version="1.0"><question>${longText}</question></cbtgen>`,
  paper: { exam: { name: 'Compression test' }, questions: [{ id: 'q1', text: longText, correctAnswer: 'α + β' }] },
  sourceFileName: 'source.pdf',
  assets: [{ id: 'diagram-1', mimeType: 'image/png', data: 'unchanged-asset-payload' }],
  savedAt: '2026-01-01T00:00:00.000Z',
}

const stored = await encodePaperContent(original)
assert.equal(stored.userId, original.userId)
assert.deepEqual(stored.assets, original.assets, 'assets remain byte-for-byte/logically unchanged outside the compressed text model')
assert.equal(stored.storageEncoding, 'gzip-json-v1', 'repetitive structured content should be compressed')
assert.ok(stored.compressedBytes < stored.uncompressedBytes)
const restored = await decodePaperContent(structuredClone(stored))
assert.equal(restored.xmlText, original.xmlText)
assert.deepEqual(restored.paper, original.paper)
assert.deepEqual(restored.assets, original.assets)
assert.equal(restored.userId, original.userId)
assert.equal(restored.fingerprint, original.fingerprint)

const small = await encodePaperContent({ ...original, xmlText: '<cbtgen/>', paper: { questions: [] } })
assert.equal(small.storageEncoding, 'plain-json-v1', 'small records should avoid compression overhead')
assert.equal((await decodePaperContent(small)).xmlText, '<cbtgen/>')

const corrupted = { ...stored, compressedContent: new ArrayBuffer(4) }
await assert.rejects(decodePaperContent(corrupted))

console.log('✓ Lossless paper compression round-trip passed')
console.log(`  Structured payload: ${stored.uncompressedBytes} → ${stored.compressedBytes} bytes`)
console.log('  Unicode, whitespace, answers, fingerprints, owner metadata, and assets preserved.')
console.log('  Small records remain uncompressed; corrupted compressed payloads fail closed.')
