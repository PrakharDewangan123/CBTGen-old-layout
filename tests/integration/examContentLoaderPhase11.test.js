import assert from 'node:assert/strict'
import { loadOwnedPaperContent } from '../../apps/web/src/lib/cbtgen/examContentLoader.js'

const ownerRecord = { userId: 'owner-a', storageEncoding: 'plain-json-v1', xmlText: '<cbtgen/>', paper: { questions: [{ id: 'q1' }] } }
assert.deepEqual(await loadOwnedPaperContent(ownerRecord, 'owner-a'), ownerRecord)
await assert.rejects(loadOwnedPaperContent(ownerRecord, 'owner-b'), /not available/)
await assert.rejects(loadOwnedPaperContent(ownerRecord, ''), /authenticated owner/)
await assert.rejects(loadOwnedPaperContent({ ...ownerRecord, xmlText: '' }, 'owner-a'), /not ready/)
console.log('✓ Phase 11 exam-time content loader owner and readiness checks passed.')
