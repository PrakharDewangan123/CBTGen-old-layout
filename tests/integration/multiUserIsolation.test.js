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

const localStorage = new MemoryStorage()

globalThis.localStorage = localStorage
globalThis.window = {
  localStorage,
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
    {
      id: 'user-b',
      role: 'student',
      name: 'Student B',
      email: 'student-b@example.com',
      password: 'b',
    },
  ],
  packs: [
    {
      id: 'pack-a',
      userId: 'user-a',
      status: 'active',
      maxSlots: 3,
      usesPerSlot: 3,
    },
    {
      id: 'pack-b',
      userId: 'user-b',
      status: 'active',
      maxSlots: 3,
      usesPerSlot: 3,
    },
  ],
  questionPapers: [
    {
      id: 'qp-a',
      userId: 'user-a',
      name: 'Student A Paper',
      fingerprint: 'fingerprint-a',
      status: 'active',
    },
    {
      id: 'qp-b',
      userId: 'user-b',
      name: 'Student B Paper',
      fingerprint: 'fingerprint-b',
      status: 'active',
    },
  ],
  slots: [
    {
      id: 'slot-a',
      userId: 'user-a',
      packId: 'pack-a',
      qpId: 'qp-a',
      usesPerSlot: 3,
      used: 1,
      status: 'active',
    },
    {
      id: 'slot-b',
      userId: 'user-b',
      packId: 'pack-b',
      qpId: 'qp-b',
      usesPerSlot: 3,
      used: 2,
      status: 'active',
    },
  ],
  purchases: [],
  sessions: [],
  results: [],
}

localStorage.setItem('cbtgen_mock_db', JSON.stringify(db))

const { cbtgenApi } = await import('../../apps/web/src/lib/api/cbtgenApi.js')

function selectUser(email) {
  localStorage.setItem('cbtgen_user_email', email)
  localStorage.setItem('cbtgen_logged_in', 'true')
}

selectUser('student-a@example.com')
const userA = await cbtgenApi.auth.getCurrentUser()
const papersA = await cbtgenApi.questionPapers.list()

assert.equal(userA.id, 'user-a')
assert.deepEqual(papersA.map(paper => paper.id), ['qp-a'])
assert.equal(papersA[0].usage.used, 1)
assert.equal(papersA[0].usage.slotCount, 1)

const cannotReadBFromA = await cbtgenApi.questionPapers.get('qp-b')
assert.equal(cannotReadBFromA.success, false)

selectUser('student-b@example.com')
const userB = await cbtgenApi.auth.getCurrentUser()
const papersB = await cbtgenApi.questionPapers.list()

assert.equal(userB.id, 'user-b')
assert.deepEqual(papersB.map(paper => paper.id), ['qp-b'])
assert.equal(papersB[0].usage.used, 2)
assert.equal(papersB[0].usage.slotCount, 1)

const cannotReadAFromB = await cbtgenApi.questionPapers.get('qp-a')
assert.equal(cannotReadAFromB.success, false)

assert.notEqual(papersA[0].usage.used, papersB[0].usage.used)

console.log('✓ Multi-user isolation passed')
console.log('  Student A sees only qp-a and slot-a usage.')
console.log('  Student B sees only qp-b and slot-b usage.')
console.log('  Cross-user QP access is rejected.')
