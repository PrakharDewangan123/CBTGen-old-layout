import assert from 'node:assert/strict'

class MemoryStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
  clear() { this.map.clear() }
}

function createIndexedDbStub() {
  return {
    open() {
      throw new Error('IndexedDB stub is intentionally unused in this lifecycle test.')
    },
  }
}

globalThis.localStorage = new MemoryStorage()
globalThis.window = { localStorage: globalThis.localStorage, indexedDB: createIndexedDbStub() }

const db = {
  users: [{ id: 'user-a', role: 'student', name: 'Student A', email: 'student-a@example.com', password: 'a' }],
  packs: [{ id: 'pack-a', userId: 'user-a', status: 'active', maxSlots: 2, usesPerSlot: 2 }],
  questionPapers: [{ id: 'qp-a', userId: 'user-a', name: 'Reattempt Paper', fingerprint: 'fingerprint-a', status: 'active' }],
  slots: [{ id: 'slot-a', userId: 'user-a', packId: 'pack-a', qpId: 'qp-a', qpFingerprint: 'fingerprint-a', usesPerSlot: 2, used: 0, status: 'active' }],
  purchases: [],
  sessions: [],
  practiceAuthorizations: [],
  usageEvents: [],
  results: [],
}

globalThis.localStorage.setItem('cbtgen_mock_db', JSON.stringify(db))
globalThis.localStorage.setItem('cbtgen_user_email', 'student-a@example.com')
globalThis.localStorage.setItem('cbtgen_logged_in', 'true')

const { cbtgenApi } = await import('../../src/lib/api/cbtgenApi.js')

const first = await cbtgenApi.questionPapers.authorizePractice('qp-a', 'reattempt-001')
assert.equal(first.success, true)
assert.equal(first.usage.used, 1)

await assert.rejects(
  () => cbtgenApi.questionPapers.authorizePractice('qp-a', 'reattempt-while-active'),
  /unfinished practice attempt/i
)

await cbtgenApi.questionPapers.updateSessionStatus(first.session.id, 'completed')

const second = await cbtgenApi.questionPapers.authorizePractice('qp-a', 'reattempt-002')
assert.equal(second.success, true)
assert.notEqual(second.session.id, first.session.id)
assert.equal(second.usage.used, 2)
assert.equal(second.usage.slotId, first.usage.slotId)

await cbtgenApi.questionPapers.updateSessionStatus(second.session.id, 'completed')

const third = await cbtgenApi.questionPapers.authorizePractice('qp-a', 'reattempt-003')
assert.equal(third.success, true)
assert.equal(third.usage.used, 1)
assert.notEqual(third.usage.slotId, second.usage.slotId)
assert.equal(third.usage.createdNewSlot, true)

const paper = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(paper.slots.length, 2)
assert.equal(paper.slots[0].used, 2)
assert.equal(paper.slots[1].used, 1)

const raw = JSON.parse(globalThis.localStorage.getItem('cbtgen_mock_db'))
assert.equal(raw.sessions.length, 3)
assert.equal(raw.practiceAuthorizations.length, 3)
assert.equal(raw.usageEvents.filter(event => event.consumed).length, 3)

console.log('✓ Reattempt/slot lifecycle tests passed')
console.log('  Only one unfinished attempt is allowed per QP.')
console.log('  Reattempt requires the previous attempt to be completed.')
console.log('  Reattempt creates a new session and consumes exactly one use.')
console.log('  The current slot is reused until exhausted, then a new slot is allocated.')
