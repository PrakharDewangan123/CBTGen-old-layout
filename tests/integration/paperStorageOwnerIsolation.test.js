import assert from 'node:assert/strict'

const databases = new Map()

function keyFor(record, keyPath) {
  const parts = Array.isArray(keyPath) ? keyPath : [keyPath]
  return JSON.stringify(parts.map(part => record[part]))
}

function createRequest(run) {
  const request = {}
  queueMicrotask(() => {
    try {
      run(request)
    } catch (error) {
      request.error = error
      request.onerror?.()
    }
  })
  return request
}

function makeDb(name) {
  const db = {
    name,
    version: 0,
    stores: new Map(),
    objectStoreNames: {
      contains(storeName) { return db.stores.has(storeName) },
    },
    createObjectStore(storeName, options = {}) {
      const store = { keyPath: options.keyPath, records: new Map() }
      db.stores.set(storeName, store)
      return store
    },
    close() {},
    transaction(storeName) {
      const storeData = db.stores.get(storeName)
      if (!storeData) throw new Error(`Missing store: ${storeName}`)
      const transaction = { oncomplete: null, onerror: null, onabort: null }
      const complete = () => queueMicrotask(() => transaction.oncomplete?.())
      transaction.objectStore = () => ({
        put(record) {
          const request = createRequest(req => {
            storeData.records.set(keyFor(record, storeData.keyPath), structuredClone(record))
            req.result = record[storeData.keyPath]
            req.onsuccess?.()
            complete()
          })
          return request
        },
        get(key) {
          return createRequest(req => {
            req.result = structuredClone(storeData.records.get(JSON.stringify(key))) || null
            req.onsuccess?.()
            complete()
          })
        },
        getAll() {
          return createRequest(req => {
            req.result = [...storeData.records.values()].map(record => structuredClone(record))
            req.onsuccess?.()
            complete()
          })
        },
        delete(key) {
          return createRequest(req => {
            storeData.records.delete(JSON.stringify(key))
            req.onsuccess?.()
            complete()
          })
        },
      })
      return transaction
    },
  }
  return db
}

globalThis.window = {
  indexedDB: {
    open(name, version) {
      const request = {}
      queueMicrotask(() => {
        let db = databases.get(name)
        const isNew = !db
        if (!db) {
          db = makeDb(name)
          databases.set(name, db)
        }
        if (isNew || db.version < version) {
          db.version = version
          request.result = db
          request.onupgradeneeded?.()
        }
        request.result = db
        request.onsuccess?.()
      })
      return request
    },
  },
}

const storage = await import('../../apps/web/src/lib/cbtgen/paperStorage.js')

function record(userId, sourceFileName) {
  return {
    userId,
    fingerprint: 'same-content-fingerprint',
    xmlText: `<cbtgen owner="${userId}"/>`,
    paper: { exam: { name: `${userId} paper` }, questions: [] },
    sourceFileName,
    assets: [],
  }
}

await storage.savePaper(record('user-a', 'a.pdf'))
await storage.savePaper(record('user-b', 'b.pdf'))

const a = await storage.getPaper('same-content-fingerprint', 'user-a')
const b = await storage.getPaper('same-content-fingerprint', 'user-b')
assert.equal(a.userId, 'user-a')
assert.equal(a.sourceFileName, 'a.pdf')
assert.equal(b.userId, 'user-b')
assert.equal(b.sourceFileName, 'b.pdf')
assert.equal(await storage.getPaper('same-content-fingerprint', 'user-c'), null)
assert.deepEqual((await storage.listPapers('user-a')).map(item => item.userId), ['user-a'])
assert.deepEqual((await storage.listPapers('user-b')).map(item => item.userId), ['user-b'])

await storage.saveSourcePaper({
  userId: 'user-a', sourceId: 'same-source-id', xmlText: '<cbtgen/>',
  paper: { questions: [] }, sourceFileName: 'source-a.pdf', assets: [],
})
await storage.saveSourcePaper({
  userId: 'user-b', sourceId: 'same-source-id', xmlText: '<cbtgen/>',
  paper: { questions: [] }, sourceFileName: 'source-b.pdf', assets: [],
})
assert.equal((await storage.getSourcePaper('same-source-id', 'user-a')).sourceFileName, 'source-a.pdf')
assert.equal((await storage.getSourcePaper('same-source-id', 'user-b')).sourceFileName, 'source-b.pdf')
assert.equal(await storage.getSourcePaper('same-source-id', 'user-c'), null)

await storage.deletePaper('same-content-fingerprint', 'user-a')
assert.equal(await storage.getPaper('same-content-fingerprint', 'user-a'), null)
assert.equal((await storage.getPaper('same-content-fingerprint', 'user-b')).userId, 'user-b')
await storage.deleteSourcePaper('same-source-id', 'user-a')
assert.equal(await storage.getSourcePaper('same-source-id', 'user-a'), null)
assert.equal((await storage.getSourcePaper('same-source-id', 'user-b')).userId, 'user-b')

await assert.rejects(
  storage.savePaper({ ...record('', 'missing-owner.pdf'), userId: '' }),
  /authenticated paper owner is required/i,
)
await assert.rejects(storage.listPapers(), /authenticated paper owner is required/i)

console.log('✓ Local paper-storage owner isolation passed')
console.log('  Identical fingerprints and source IDs remain scoped to each user.')
console.log('  Reads, lists, and deletes cannot cross owner boundaries.')
console.log('  Ownerless storage operations fail closed.')
