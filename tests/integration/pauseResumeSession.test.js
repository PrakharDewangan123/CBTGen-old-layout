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
    { id: 'resume-user', role: 'student', name: 'Resume Student', email: 'resume@example.com', password: 'test' },
  ],
  packs: [
    { id: 'resume-pack', userId: 'resume-user', status: 'active', maxSlots: 2, usesPerSlot: 3 },
  ],
  questionPapers: [
    { id: 'resume-qp', userId: 'resume-user', name: 'Resume Paper', fingerprint: 'resume-fp', status: 'active' },
  ],
  slots: [
    { id: 'resume-slot', userId: 'resume-user', packId: 'resume-pack', qpId: 'resume-qp', qpFingerprint: 'resume-fp', usesPerSlot: 3, used: 1, status: 'active' },
  ],
  purchases: [],
  sessions: [],
  practiceAuthorizations: [],
  usageEvents: [],
  results: [],
}

globalThis.localStorage.setItem('cbtgen_mock_db', JSON.stringify(db))
globalThis.localStorage.setItem('cbtgen_user_email', 'resume@example.com')
globalThis.localStorage.setItem('cbtgen_logged_in', 'true')

const { cbtgenApi } = await import('../../apps/web/src/lib/api/cbtgenApi.js')

const authorized = await cbtgenApi.questionPapers.authorizePractice(
  'resume-qp',
  'resume-test-001',
)
assert.equal(authorized.success, true)
assert.equal(authorized.usage.used, 2)

await cbtgenApi.questionPapers.updateSessionStatus(
  authorized.session.id,
  'paused',
  { pausedAt: new Date().toISOString(), pauseReason: 'manual' },
)

const resumable = await cbtgenApi.questionPapers.getResumableSession('resume-qp')
assert.equal(resumable.success, true)
assert.equal(resumable.session.id, authorized.session.id)
assert.equal(resumable.session.status, 'paused')

const afterResumeCheck = await cbtgenApi.questionPapers.get('resume-qp')
assert.equal(afterResumeCheck.usage.used, 2, 'Resume must not consume another practice use.')

await cbtgenApi.questionPapers.updateSessionStatus(
  authorized.session.id,
  'completed',
  { completedAt: new Date().toISOString() },
)

const noLongerResumable = await cbtgenApi.questionPapers.getResumableSession('resume-qp')
assert.equal(noLongerResumable.session, null)

console.log('✓ Pause/resume session safety tests passed')
console.log('  Paused attempt remains resumable.')
console.log('  Resume does not consume another usage.')
console.log('  Completed attempt is no longer resumable.')
