import assert from 'node:assert/strict'

class MemoryStorage {
  constructor() { this.store = new Map() }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null }
  setItem(key, value) { this.store.set(key, String(value)) }
  removeItem(key) { this.store.delete(key) }
  clear() { this.store.clear() }
}

function createIndexedDbStub() {
  return {
    open() {
      const request = {}
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: () => true },
          close() {},
          transaction() {
            return {
              objectStore() {
                return {
                  getAll() {
                    const read = {}
                    queueMicrotask(() => {
                      read.result = []
                      read.onsuccess?.()
                    })
                    return read
                  },
                  get() {
                    const read = {}
                    queueMicrotask(() => {
                      read.result = null
                      read.onsuccess?.()
                    })
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

globalThis.localStorage.setItem('cbtgen_mock_db', JSON.stringify({
  users: [{
    id: 'user-a',
    role: 'student',
    name: 'Student A',
    email: 'student-a@example.com',
    password: 'a',
  }],
  packs: [{
    id: 'pack-a',
    userId: 'user-a',
    status: 'active',
    maxSlots: 1,
    usesPerSlot: 3,
  }],
  questionPapers: [
    { id: 'qp-unattempted', userId: 'user-a', name: 'Unattempted Paper', fingerprint: 'fp-unattempted', status: 'active' },
    { id: 'qp-attempted', userId: 'user-a', name: 'Attempted Paper', fingerprint: 'fp-attempted', status: 'active' },
  ],
  slots: [],
  purchases: [],
  sessions: [],
  practiceAuthorizations: [],
  usageEvents: [],
  results: [],
}))
globalThis.localStorage.setItem('cbtgen_user_email', 'student-a@example.com')
globalThis.localStorage.setItem('cbtgen_logged_in', 'true')

const { cbtgenApi } = await import('../../src/lib/api/cbtgenApi.js')

const removable = await cbtgenApi.questionPapers.getLifecycle('qp-unattempted')
assert.equal(removable.success, true)
assert.equal(removable.lifecycle.canRemove, true)

const removed = await cbtgenApi.questionPapers.remove('qp-unattempted')
assert.equal(removed.success, true)

const afterRemoval = await cbtgenApi.questionPapers.list()
assert.equal(afterRemoval.some(paper => paper.id === 'qp-unattempted'), false)

const missing = await cbtgenApi.questionPapers.get('qp-unattempted')
assert.equal(missing.success, false)

const authorized = await cbtgenApi.questionPapers.authorizePractice(
  'qp-attempted',
  'remove-lock-test-001',
)
assert.equal(authorized.success, true)

const locked = await cbtgenApi.questionPapers.getLifecycle('qp-attempted')
assert.equal(locked.lifecycle.canRemove, false)

const blocked = await cbtgenApi.questionPapers.remove('qp-attempted')
assert.equal(blocked.success, false)
assert.equal(blocked.code, 'QP_ATTEMPT_LOCKED')

const stillPresent = await cbtgenApi.questionPapers.get('qp-attempted')
assert.equal(stillPresent.success, true)

const rawDb = JSON.parse(globalThis.localStorage.getItem('cbtgen_mock_db'))
assert.equal(rawDb.sessions.length, 1, 'Removal must not create or delete attempts.')
assert.equal(rawDb.practiceAuthorizations.length, 1)
assert.equal(rawDb.usageEvents.length, 1)

console.log('✓ Question-paper removal safety tests passed')
console.log('  Unattempted QP can be removed from the active library.')
console.log('  Removed QP is no longer returned by list/get.')
console.log('  Attempted QP removal is rejected by the API lifecycle lock.')
console.log('  Removal does not refund, consume, or mutate practice usage.')
