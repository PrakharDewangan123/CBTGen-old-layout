import { decodePaperContent, encodePaperContent } from './storage/losslessRecordCompression.js'

const DB_NAME = 'cbtgen_paper_library'
const DB_VERSION = 4
const STORE_NAME = 'papersByOwner'
const SOURCE_STORE_NAME = 'sourcePapersByOwner'

function requireOwnerId(userId) {
  const ownerId = String(userId || '').trim()
  if (!ownerId) {
    throw new Error('An authenticated paper owner is required for local storage access.')
  }
  return ownerId
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(
        new Error(
          'IndexedDB is not available in this browser.'
        )
      )
      return
    }

    const request = window.indexedDB.open(
      DB_NAME,
      DB_VERSION
    )

    request.onupgradeneeded = () => {
      const db = request.result

      // Version 4 introduces owner-scoped stores. Legacy records are migrated
      // only when the local library metadata identifies exactly one owner.
      // Ambiguous/unowned records stay in the legacy stores and are never
      // exposed by the owner-scoped APIs.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: ['userId', 'fingerprint'],
        })
      }

      if (!db.objectStoreNames.contains(SOURCE_STORE_NAME)) {
        db.createObjectStore(SOURCE_STORE_NAME, {
          keyPath: ['userId', 'sourceId'],
        })
      }

      const libraryDb = (() => {
        try {
          return JSON.parse(window.localStorage?.getItem('cbtgen_mock_db') || 'null')
        } catch {
          return null
        }
      })()

      const ownerIdsFor = (records, key, value) => [...new Set(
        (Array.isArray(records) ? records : [])
          .filter(record => record && record.status !== 'deleted' && String(record[key] || '') === String(value || ''))
          .map(record => String(record.userId || '').trim())
          .filter(Boolean),
      )]

      const migrateLegacyStore = (legacyName, destinationName, idField, ownerRecords) => {
        if (!db.objectStoreNames.contains(legacyName)) return
        const legacyStore = request.transaction.objectStore(legacyName)
        if (typeof legacyStore.openCursor !== 'function') return
        const destination = request.transaction.objectStore(destinationName)
        const cursorRequest = legacyStore.openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (!cursor) return
          const legacyRecord = cursor.value
          const owners = ownerIdsFor(ownerRecords, idField, legacyRecord[idField])
          if (owners.length === 1) {
            destination.put({ ...legacyRecord, userId: owners[0] })
          }
          cursor.continue()
        }
      }

      if (libraryDb) {
        migrateLegacyStore('papers', STORE_NAME, 'fingerprint', libraryDb.questionPapers)
        migrateLegacyStore('sourcePapers', SOURCE_STORE_NAME, 'sourceId', libraryDb.questionPapers)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(
        request.error ||
          new Error(
            'Unable to open CBTGen paper storage.'
          )
      )
    }
  })
}

/**
 * Save the complete question paper locally.
 *
 * Server/API:
 * - account
 * - pack
 * - slots
 * - usage
 * - QP metadata
 * - authoritative fingerprint
 *
 * IndexedDB:
 * - complete XML
 * - normalized question model
 * - source filename
 */
export async function savePaper({
  userId, fingerprint, xmlText, paper, sourceFileName = '', assets = [],
}) {
  const ownerId = requireOwnerId(userId)
  if (!fingerprint) throw new Error('A paper fingerprint is required for local storage.')
  if (typeof xmlText !== 'string' || !xmlText.trim()) throw new Error('The source XML is empty.')
  if (!paper) throw new Error('The normalized paper model is missing.')

  const record = {
    userId: ownerId, fingerprint, xmlText, paper, sourceFileName, assets,
    savedAt: new Date().toISOString(),
  }
  // Compression completes before opening a read/write transaction so IndexedDB
  // never becomes inactive while asynchronous compression is running.
  const storedRecord = await encodePaperContent(record)
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).put(storedRecord)
    request.onsuccess = () => resolve(record)
    request.onerror = () => reject(request.error || new Error('Unable to save the question paper locally.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

/**
 * Save a source-only paper whose answer key is not yet available.
 *
 * This record deliberately does NOT use a CBTGen content fingerprint.
 * A paper without reliable answer data is not identity-ready because the
 * authoritative question identity includes the correct answer content.
 */
export async function saveSourcePaper({
  userId, sourceId, xmlText, paper, sourceFileName = '', assets = [],
}) {
  const ownerId = requireOwnerId(userId)
  if (!sourceId) throw new Error('A source paper id is required for source-only storage.')
  if (typeof xmlText !== 'string' || !xmlText.trim()) throw new Error('The source XML is empty.')
  if (!paper) throw new Error('The normalized paper model is missing.')

  const record = {
    userId: ownerId, sourceId, xmlText, paper, sourceFileName, assets,
    identityStatus: 'PENDING_ANSWER_KEY', scoringReady: false,
    savedAt: new Date().toISOString(),
  }
  const storedRecord = await encodePaperContent(record)
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SOURCE_STORE_NAME, 'readwrite')
    const request = transaction.objectStore(SOURCE_STORE_NAME).put(storedRecord)
    request.onsuccess = () => resolve(record)
    request.onerror = () => reject(request.error || new Error('Unable to save the source-only question paper locally.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

/**
 * Read a source-only paper by its storage id.
 */
export async function getSourcePaper(sourceId, userId) {
  if (!sourceId || !userId) return null
  const ownerId = requireOwnerId(userId)
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SOURCE_STORE_NAME, 'readonly')
    const store = transaction.objectStore(SOURCE_STORE_NAME)
    const request = store.get([ownerId, String(sourceId)])

    request.onsuccess = async () => {
      try {
        const record = request.result || null
        resolve(record?.userId === ownerId ? await decodePaperContent(record) : null)
      } catch (error) { reject(error) }
    }
    request.onerror = () => reject(request.error || new Error('Unable to read the source-only question paper.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

/**
 * Delete a source-only paper from local storage.
 */
export async function deleteSourcePaper(sourceId, userId) {
  if (!sourceId) return
  const ownerId = requireOwnerId(userId)
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SOURCE_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(SOURCE_STORE_NAME)
    const request = store.delete([ownerId, String(sourceId)])
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Unable to delete the source-only question paper.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

/**
 * Get a complete paper by its
 * authoritative content fingerprint.
 */
export async function getPaper(fingerprint, userId) {
  if (!fingerprint || !userId) return null
  const ownerId = requireOwnerId(userId)
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get([ownerId, String(fingerprint)])
    request.onsuccess = async () => {
      try {
        const record = request.result || null
        resolve(record?.userId === ownerId ? await decodePaperContent(record) : null)
      } catch (error) { reject(error) }
    }
    request.onerror = () => reject(request.error || new Error('Unable to read the question paper.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

/**
 * Resolve a locally stored paper for an API question-paper record.
 *
 * Exact fingerprint lookup is always attempted first. The active
 * question-paper metadata is stored only as a recovery hint for older
 * mock sessions whose fingerprint may be stale.
 */
export async function getPaperForQuestionPaper(questionPaper) {
  if (!questionPaper?.userId) return null
  const ownerId = requireOwnerId(questionPaper.userId)

  if (questionPaper.fingerprint) {
    const exact = await getPaper(questionPaper.fingerprint, ownerId)
    if (exact) return exact
  }

  // Preserve the legacy recovery behavior, but search only this owner's
  // scoped records. Metadata is a recovery hint, never an ownership key.
  const papers = await listPapers(ownerId)
  const candidates = papers.filter(record => {
    const exam = record?.paper?.exam || {}

    if (
      questionPaper.qpId &&
      exam.qpId &&
      String(questionPaper.qpId) === String(exam.qpId)
    ) return true

    const sameName = questionPaper.name && exam.name &&
      String(questionPaper.name).trim() === String(exam.name).trim()
    if (!sameName) return false

    const sameYear = questionPaper.year == null || exam.year == null ||
      String(questionPaper.year) === String(exam.year)
    const samePaperNumber = questionPaper.paperNumber == null || exam.paperNumber == null ||
      String(questionPaper.paperNumber) === String(exam.paperNumber)

    return sameYear && samePaperNumber
  })

  return candidates.length === 1 ? candidates[0] : null
}

/**
 * Check whether the complete paper
 * exists locally.
 */
export async function hasPaper(fingerprint, userId) {
  return Boolean(await getPaper(fingerprint, userId))
}

/**
 * Delete only the local paper.
 *
 * This does NOT modify server/API
 * usage or slot information.
 */
export async function deletePaper(fingerprint, userId) {
  if (!fingerprint) return
  const ownerId = requireOwnerId(userId)
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete([ownerId, String(fingerprint)])
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Unable to delete the local question paper.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

/**
 * List all locally stored papers.
 */
export async function listPapers(userId) {
  const ownerId = requireOwnerId(userId)
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = async () => {
      try {
        const owned = (request.result || []).filter(record => record?.userId === ownerId)
        resolve(await Promise.all(owned.map(decodePaperContent)))
      } catch (error) { reject(error) }
    }
    request.onerror = () => reject(request.error || new Error('Unable to list local question papers.'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}
