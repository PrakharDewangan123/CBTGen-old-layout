import assert from 'node:assert/strict'

class MemoryStorage {
  constructor() {
    this.store = new Map()
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }

  setItem(key, value) {
    this.store.set(key, String(value))
  }

  removeItem(key) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}

function createIndexedDbStub() {
  return {
    open() {
      const request = {}
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: {
            contains: () => true,
          },
          close() {},
          transaction() {
            return {
              objectStore() {
                return {
                  getAll() {
                    const read = {}
                    queueMicrotask(() => read.onsuccess?.())
                    return read
                  },
                  get() {
                    const read = {}
                    queueMicrotask(() => read.onsuccess?.())
                    return read
                  },
                  put() {},
                  clear() {},
                }
              },
              oncomplete: null,
              onerror: null,
              onabort: null,
            }
          },
        }
        request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    },
  }
}

globalThis.localStorage = new MemoryStorage()
globalThis.window = {
  localStorage: globalThis.localStorage,
  indexedDB: createIndexedDbStub(),
}

const db = {
  users: [
    {
      id: 'user-a',
      role: 'student',
      name: 'Student A',
      email: 'student-a@example.com',
      password: 'a',
    },
  ],
  packs: [
    {
      id: 'pack-a',
      userId: 'user-a',
      status: 'active',
      maxSlots: 2,
      usesPerSlot: 2,
    },
  ],
  questionPapers: [
    {
      id: 'qp-a',
      userId: 'user-a',
      name: 'Practice Paper',
      fingerprint: 'fingerprint-a',
      status: 'active',
    },
  ],
  slots: [
    {
      id: 'slot-a',
      userId: 'user-a',
      packId: 'pack-a',
      qpId: 'qp-a',
      qpFingerprint: 'fingerprint-a',
      usesPerSlot: 2,
      used: 0,
      status: 'active',
    },
  ],
  purchases: [],
  sessions: [],
  practiceAuthorizations: [],
  usageEvents: [],
  results: [],
}

globalThis.localStorage.setItem('cbtgen_mock_db', JSON.stringify(db))
globalThis.localStorage.setItem('cbtgen_user_email', 'student-a@example.com')
globalThis.localStorage.setItem('cbtgen_logged_in', 'true')

const { cbtgenApi } = await import('../../apps/web/src/lib/api/cbtgenApi.js')

const before = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(before.success, true)
assert.equal(before.usage.used, 0)

const preview = await cbtgenApi.questionPapers.previewPractice('qp-a')
assert.equal(preview.success, true)
assert.equal(preview.eligible, true)

const afterPreview = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(afterPreview.usage.used, 0, 'Preview must not consume usage.')
assert.equal(afterPreview.slots.length, 1, 'Preview must not allocate a slot.')

const requestId = 'practice-confirmation-test-001'
const first = await cbtgenApi.questionPapers.authorizePractice('qp-a', requestId)
assert.equal(first.success, true)
assert.equal(first.idempotent, false)
assert.equal(first.usage.used, 1)
assert.equal(first.session.qpId, 'qp-a')

const afterFirst = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(afterFirst.usage.used, 1)
assert.equal(afterFirst.slots.length, 1)

const retry = await cbtgenApi.questionPapers.authorizePractice('qp-a', requestId)
assert.equal(retry.success, true)
assert.equal(retry.idempotent, true)
assert.equal(retry.session.id, first.session.id, 'Retry must recover the same attempt/session.')

const afterRetry = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(afterRetry.usage.used, 1, 'Repeated confirmation must not consume twice.')

await assert.rejects(
  () => cbtgenApi.questionPapers.authorizePractice('qp-a', 'practice-confirmation-test-002-active'),
  /unfinished practice attempt/i,
  'A new attempt must not be created while an unfinished attempt exists.'
)

await cbtgenApi.questionPapers.updateSessionStatus(first.session.id, 'completed')

const second = await cbtgenApi.questionPapers.authorizePractice('qp-a', 'practice-confirmation-test-002')
assert.equal(second.success, true)
assert.equal(second.idempotent, false)
assert.equal(second.usage.used, 2)
assert.equal(second.session.id !== first.session.id, true)

const afterSecond = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(afterSecond.usage.used, 2)
assert.equal(afterSecond.slots.length, 1)

await cbtgenApi.questionPapers.updateSessionStatus(second.session.id, 'completed')

const third = await cbtgenApi.questionPapers.authorizePractice('qp-a', 'practice-confirmation-test-003')
assert.equal(third.success, true)
assert.equal(third.usage.used, 1)
assert.equal(afterSecond.slots.length, 1)

const final = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(final.slots.length, 2, 'A new slot is created only after the existing slot is exhausted.')
assert.equal(final.usage.used, 3)

const rawDb = JSON.parse(globalThis.localStorage.getItem('cbtgen_mock_db'))
assert.equal(rawDb.practiceAuthorizations.length, 3)
assert.equal(rawDb.sessions.length, 3)
assert.equal(rawDb.usageEvents.length, 3)

console.log('✓ Practice authorization safety tests passed')
console.log('  Preview does not consume usage.')
console.log('  Final authorization consumes exactly once.')
console.log('  Same request ID is idempotent against retry/double-submit.')
console.log('  Reattempt creates a new session and consumes another use.')
console.log('  Slot reuse continues until exhaustion, then a new slot is allocated.')
