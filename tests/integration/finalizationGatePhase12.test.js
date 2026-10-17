import assert from 'node:assert/strict'
import { validatePaperFinalization } from '../../src/lib/cbtgen/finalizationGate.js'

const manifest = {
  manifestVersion: '1.0', jobId: 'job-1', createdAt: '2026-10-12T00:00:00.000Z',
  owner: { userId: 'user-1', paperId: 'paper-1' },
  source: { fileName: 'source.pdf', mimeType: 'application/pdf', sha256: 'a'.repeat(64), pageCount: 1 },
  pages: [{ pageId: 'page-1', pageNumber: 1, width: 600, height: 800, coordinateUnit: 'pixels' }],
  regions: [{ regionId: 'question-1', pageNumber: 1, kind: 'question-content', extractionMethod: 'manual-review', reviewStatus: 'accepted', confidence: 1, bounds: { x: 10, y: 10, width: 100, height: 50 }, owner: { scope: 'question', paperId: 'paper-1', questionId: 'q1' } }],
  assets: [], warnings: [], status: 'complete',
}
const good = { authenticatedOwnerId: 'user-1', reviewedByOwnerId: 'user-1', sourceFileSizeBytes: 1000, reviewedXmlText: '<cbtgen version="1.0"><questions/></cbtgen>', manifest }
assert.equal(validatePaperFinalization(good).ready, true)
assert.equal(validatePaperFinalization({ ...good, authenticatedOwnerId: '' }).ready, false)
assert.ok(validatePaperFinalization({ ...good, reviewedByOwnerId: 'user-2' }).errors.some(e => e.code === 'REVIEW_OWNER_MISMATCH'))
assert.ok(validatePaperFinalization({ ...good, sourceFileSizeBytes: 10_000_001 }).errors.some(e => e.code === 'SOURCE_FILE_TOO_LARGE'))
assert.ok(validatePaperFinalization({ ...good, reviewedXmlText: '<cbtgen><x/></cbtgen><!DOCTYPE x>' }).errors.some(e => e.code === 'XML_DTD_FORBIDDEN'))
assert.ok(validatePaperFinalization({ ...good, reviewedXmlText: '<cbtgen userId="user-1"></cbtgen>' }).errors.some(e => e.code === 'RUNTIME_METADATA_IN_XML'))
assert.ok(validatePaperFinalization({ ...good, manifest: { ...manifest, owner: { ...manifest.owner, userId: 'user-2' } } }).errors.some(e => e.code === 'MANIFEST_OWNER_MISMATCH'))
assert.ok(validatePaperFinalization({ ...good, manifest: { ...manifest, regions: [{ ...manifest.regions[0], reviewStatus: 'needs-review' }] } }).errors.some(e => e.code === 'REVIEW_INCOMPLETE'))
assert.ok(validatePaperFinalization({ ...good, manifest: { ...manifest, status: 'in-progress' } }).errors.some(e => e.code === 'EXTRACTION_NOT_COMPLETE'))
console.log('✓ Phase 12 finalization gate contract passed (owner, size, review state, manifest, XML safety).')
