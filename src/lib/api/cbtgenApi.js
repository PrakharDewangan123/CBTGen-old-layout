import { deriveQuestionPaperLifecycle } from '../../features/questionPapers/services/questionPaperLifecycle.js'

const DB_KEY = 'cbtgen_mock_db'
const SESSION_KEY = 'cbtgen_logged_in'
const EMAIL_KEY = 'cbtgen_user_email'

// Large completed exam results are stored in IndexedDB rather than the
// small localStorage mock database. This keeps 1,800-question attempts
// from exhausting the browser's localStorage quota.
const RESULT_DB_NAME = 'cbtgen_exam_results'
const RESULT_DB_VERSION = 1
const RESULT_STORE_NAME = 'results'

let storageReadyPromise = null

function openResultDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = window.indexedDB.open(
      RESULT_DB_NAME,
      RESULT_DB_VERSION
    )

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(RESULT_STORE_NAME)) {
        db.createObjectStore(RESULT_STORE_NAME, {
          keyPath: 'resultId',
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      reject(
        request.error ||
          new Error('Unable to open CBTGen examination result storage.')
      )
    }
  })
}

async function putResultsInIndexedDB(results) {
  if (!Array.isArray(results) || results.length === 0) return

  const db = await openResultDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESULT_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(RESULT_STORE_NAME)

    for (const result of results) {
      if (result?.resultId) {
        store.put(result)
      }
    }

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }

    transaction.onerror = () => {
      db.close()
      reject(
        transaction.error ||
          new Error('Unable to store CBTGen examination results.')
      )
    }

    transaction.onabort = () => {
      db.close()
      reject(
        transaction.error ||
          new Error('Unable to store CBTGen examination results.')
      )
    }
  })
}

async function putResultInIndexedDB(result) {
  await putResultsInIndexedDB([result])
}

async function getResultsFromIndexedDB() {
  const db = await openResultDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESULT_STORE_NAME, 'readonly')
    const store = transaction.objectStore(RESULT_STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => {
      reject(
        request.error ||
          new Error('Unable to read CBTGen examination results.')
      )
    }

    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

async function getResultFromIndexedDB(resultId) {
  if (!resultId) return null

  const db = await openResultDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESULT_STORE_NAME, 'readonly')
    const store = transaction.objectStore(RESULT_STORE_NAME)
    const request = store.get(resultId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => {
      reject(
        request.error ||
          new Error('Unable to read the CBTGen examination result.')
      )
    }

    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

async function clearResultsFromIndexedDB() {
  const db = await openResultDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RESULT_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(RESULT_STORE_NAME)
    store.clear()

    transaction.oncomplete = () => {
      db.close()
      resolve()
    }

    transaction.onerror = () => {
      db.close()
      reject(
        transaction.error ||
          new Error('Unable to clear CBTGen examination results.')
      )
    }

    transaction.onabort = () => {
      db.close()
      reject(
        transaction.error ||
          new Error('Unable to clear CBTGen examination results.')
      )
    }
  })
}

async function migrateLegacyResults() {
  const raw = localStorage.getItem(DB_KEY)

  if (!raw) {
    await openResultDatabase().then(db => db.close())
    return
  }

  let db

  try {
    db = JSON.parse(raw)
  } catch {
    return
  }

  const legacyResults = Array.isArray(db.results)
    ? db.results
    : []

  if (legacyResults.length === 0) {
    if (!Array.isArray(db.results)) {
      db.results = []
      localStorage.setItem(DB_KEY, JSON.stringify(db))
    }
    return
  }

  // Write the large immutable records to IndexedDB first. Only after that
  // succeeds do we remove them from localStorage. This preserves existing
  // attempts during migration.
  await putResultsInIndexedDB(legacyResults)

  db.results = []
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function ensureStorageReady() {
  if (!storageReadyPromise) {
    storageReadyPromise = migrateLegacyResults()
  }

  return storageReadyPromise
}

/*
|--------------------------------------------------------------------------
| CBTGen MOCK API
|--------------------------------------------------------------------------
|
| This file behaves like the future CBTGen backend API.
|
| CURRENT:
|   localStorage
|
| FUTURE:
|   Replace the functions below with fetch("/api/...")
|
| IMPORTANT:
| Components should call cbtgenApi functions.
| Components should NOT directly manipulate the mock database.
|
|--------------------------------------------------------------------------
*/

/* -----------------------------------------------------------------------
   MOCK DATABASE
------------------------------------------------------------------------ */

const DEFAULT_DB = {
  users: [
    {
      id: 'user-001',
      role: 'student',
      name: 'CBTGen Student',
      email: 'student@example.com',
      password: 'demo123',
      createdAt: '2026-09-28T10:00:00.000Z',
    },
    {
      id: 'admin-001',
      role: 'admin',
      name: 'CBTGen Admin',
      email: 'admin@cbtgen.com',
      password: 'admin123',
      createdAt: '2026-09-28T09:00:00.000Z',
    },
    {
      id: 'demo-test-001',
      role: 'student',
      name: 'CBTGen Demo Tester',
      email: 'demo.tester@cbtgen.local',
      password: 'testdemo123',
      createdAt: '2026-10-10T10:00:00.000Z',
      demoGenerationsAllowed: 2,
      demoGenerationsUsed: 0,
    },
    {
      id: 'dev-001',
      role: 'student',
      accountType: 'developer',
      unlimitedPractice: true,
      name: 'CBTGen Developer',
      email: 'developer@cbtgen.local',
      password: 'dev123',
      createdAt: '2026-10-03T10:00:00.000Z',
    },
  ],

  packs: [
    {
      id: 'pack-001',
      userId: 'user-001',

      name: 'Standard',

      price: 399,

      maxSlots: 10,

      usesPerSlot: 3,

      validityDays: 365,

      purchasedAt: '2026-09-28T10:00:00.000Z',

      expiresAt: '2027-09-28T10:00:00.000Z',

      status: 'active',
    },
  ],

  questionPapers: [
    {
      id: 'qp-001',
      userId: 'user-001',

      name: 'GATE Computer Science 2025',

      category: 'GATE',

      year: 2025,

      paperNumber: 1,

      questions: 65,

      marks: 100,

      duration: 180,

      sections: 2,

      questionTypes: ['MCQ', 'MSQ', 'NAT'],

      fingerprint:
        'sample-gate-2025-fingerprint',

      importedAt: '2026-09-28T11:00:00.000Z',

      status: 'active',
    },

    {
      id: 'qp-002',
      userId: 'user-001',

      name: 'Sample Computer Science Test',

      category: 'Practice Test',

      year: 2026,

      paperNumber: 1,

      questions: 50,

      marks: 75,

      duration: 120,

      sections: 3,

      questionTypes: ['MCQ', 'MSQ', 'NAT', 'MATCH'],

      fingerprint:
        'sample-computer-science-test-fingerprint',

      importedAt: '2026-09-29T09:00:00.000Z',

      status: 'active',
    },
  ],

  slots: [
    {
      id: 'slot-001',
      userId: 'user-001',
      packId: 'pack-001',
      qpId: 'qp-001',

      usesPerSlot: 3,
      used: 2,

      status: 'active',

      createdAt: '2026-09-28T11:01:00.000Z',
    },

    {
      id: 'slot-002',
      userId: 'user-001',
      packId: 'pack-001',
      qpId: 'qp-002',

      usesPerSlot: 3,
      used: 1,

      status: 'active',

      createdAt: '2026-09-29T09:01:00.000Z',
    },
  ],

  purchases: [
    {
      id: 'purchase-001',

      userId: 'user-001',

      packId: 'pack-001',

      packName: 'Standard',

      price: 399,

      maxSlots: 10,

      usesPerSlot: 3,

      validityDays: 365,

      purchasedAt: '2026-09-28T10:00:00.000Z',

      status: 'completed',
    },
  ],

  sessions: [],

  // Idempotency records for final practice authorization.
  practiceAuthorizations: [],

  usageEvents: [],

  // Completed immutable examination results.
  // These records are the source for future Score and Analysis pages.
  results: [],
}


/* -----------------------------------------------------------------------
   DATABASE HELPERS
------------------------------------------------------------------------ */

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}


function getDB() {
  const raw = localStorage.getItem(DB_KEY)

  if (!raw) {
    const initial = clone(DEFAULT_DB)

    localStorage.setItem(
      DB_KEY,
      JSON.stringify(initial)
    )

    return initial
  }

  try {
    const db = JSON.parse(raw)

    if (!Array.isArray(db.users)) db.users = []
    if (!Array.isArray(db.sessions)) db.sessions = []
    if (!Array.isArray(db.practiceAuthorizations)) db.practiceAuthorizations = []
    if (!Array.isArray(db.usageEvents)) db.usageEvents = []
    if (!Array.isArray(db.results)) db.results = []

    // Existing accounts created before role support remain students.
    let changed = false
    for (const user of db.users) {
      if (!user.role) {
        user.role = 'student'
        changed = true
      }
    }

    // Add the temporary unlimited development student to existing local databases.
    if (!db.users.some((user) => user.id === 'dev-001')) {
      db.users.push({
        id: 'dev-001',
        role: 'student',
        accountType: 'developer',
        unlimitedPractice: true,
        name: 'CBTGen Developer',
        email: 'developer@cbtgen.local',
        password: 'dev123',
        createdAt: '2026-10-03T10:00:00.000Z',
      })
      changed = true
    }

    // Add a clean, non-pack student account for Free Demo testing.
    // Intentionally do not attach a pack or unlimitedPractice entitlement.
    if (!db.users.some((user) => user.id === 'demo-test-001')) {
      db.users.push({
        id: 'demo-test-001',
        role: 'student',
        name: 'CBTGen Demo Tester',
        email: 'demo.tester@cbtgen.local',
        password: 'testdemo123',
        createdAt: '2026-10-10T10:00:00.000Z',
        demoGenerationsAllowed: 2,
        demoGenerationsUsed: 0,
      })
      changed = true
    }

    // Add the single platform administrator to an existing local database.
    if (!db.users.some((user) => user.id === 'admin-001')) {
      db.users.push({
        id: 'admin-001',
        role: 'admin',
        name: 'CBTGen Admin',
        email: 'admin@cbtgen.com',
        password: 'admin123',
        createdAt: '2026-09-28T09:00:00.000Z',
      })
      changed = true
    }

    if (changed) {
      localStorage.setItem(DB_KEY, JSON.stringify(db))
    }

    return db
  } catch {
    const reset = clone(DEFAULT_DB)

    localStorage.setItem(
      DB_KEY,
      JSON.stringify(reset)
    )

    return reset
  }
}


function saveDB(db) {
  localStorage.setItem(
    DB_KEY,
    JSON.stringify(db)
  )
}


function getCurrentUser() {
  const email =
    localStorage.getItem(EMAIL_KEY)

  if (!email) {
    return null
  }

  const db = getDB()

  return (
    db.users.find(
      user => user.email === email
    ) || null
  )
}


function requireUser() {
  const user = getCurrentUser()

  if (!user) {
    throw new Error(
      'You must be logged in.'
    )
  }

  return user
}

function getUserRole(user) {
  return user?.role === 'admin' ? 'admin' : 'student'
}

function isDeveloperStudent(user) {
  return (
    getUserRole(user) === 'student' &&
    user?.accountType === 'developer' &&
    user?.unlimitedPractice === true
  )
}

function requireStudent() {
  const user = requireUser()

  if (getUserRole(user) !== 'student') {
    throw new Error('This area is available to student accounts only.')
  }

  return user
}

function requireAdmin() {
  const user = requireUser()

  if (getUserRole(user) !== 'admin') {
    throw new Error('Administrator access required.')
  }

  return user
}


/* -----------------------------------------------------------------------
   AUTH
------------------------------------------------------------------------ */

async function login(email, password) {
  await ensureStorageReady()
  const db = getDB()

  const user = db.users.find(
    item =>
      item.email.toLowerCase() ===
        email.toLowerCase() &&
      item.password === password
  )

  if (!user) {
    throw new Error(
      'Invalid email or password.'
    )
  }

  localStorage.setItem(
    SESSION_KEY,
    'true'
  )

  localStorage.setItem(
    EMAIL_KEY,
    user.email
  )

  return {
    success: true,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: getUserRole(user),
      accountType: user.accountType || null,
      unlimitedPractice: user.unlimitedPractice === true,
    },
  }
}


async function logout() {
  localStorage.removeItem(
    SESSION_KEY
  )

  localStorage.removeItem(
    EMAIL_KEY
  )

  return {
    success: true,
  }
}


async function getCurrentUserApi() {
  await ensureStorageReady()
  const user = requireUser()

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: getUserRole(user),
    accountType: user.accountType || null,
    unlimitedPractice: user.unlimitedPractice === true,
    createdAt: user.createdAt,
  }
}


/* -----------------------------------------------------------------------
   QUESTION PAPER / SLOT IDENTITY HELPERS
------------------------------------------------------------------------ */

function slotBelongsToPaper(slot, qp, packId = null) {
  if (!slot || !qp) return false
  if (packId && slot.packId && slot.packId !== packId) return false

  // The QP id is the primary local record reference.
  if (slot.qpId === qp.id) return true

  // Fingerprint is the stable content identity and lets older local
  // records continue to resolve after duplicate QP records are merged.
  if (qp.fingerprint && slot.qpFingerprint === qp.fingerprint) return true
  if (qp.fingerprint && slot.fingerprint === qp.fingerprint) return true
  if (qp.fingerprint && slot.qpId === qp.fingerprint) return true

  return false
}

function normalizeQuestionPaperRecords(db, userId) {
  const userPapers = db.questionPapers.filter(
    qp => qp.userId === userId && qp.status !== 'deleted'
  )

  const byFingerprint = new Map()
  const duplicateIds = new Set()
  let changed = false

  for (const qp of userPapers) {
    const fingerprint = String(qp.fingerprint || '').trim()
    if (!fingerprint) continue

    const existing = byFingerprint.get(fingerprint)

    if (!existing) {
      byFingerprint.set(fingerprint, qp)
      continue
    }

    // Keep the earliest record as the canonical library entry.
    const existingTime = Date.parse(existing.importedAt || '') || Number.MAX_SAFE_INTEGER
    const currentTime = Date.parse(qp.importedAt || '') || Number.MAX_SAFE_INTEGER
    const canonical = currentTime < existingTime ? qp : existing
    const duplicate = canonical === qp ? existing : qp

    byFingerprint.set(fingerprint, canonical)
    duplicateIds.add(duplicate.id)
    changed = true
  }

  if (!changed) return false

  for (const slot of db.slots) {
    if (slot.userId !== userId) continue

    const duplicate = duplicateIds.has(slot.qpId)
    if (!duplicate) continue

    const duplicatePaper = userPapers.find(qp => qp.id === slot.qpId)
    const canonical = duplicatePaper?.fingerprint
      ? byFingerprint.get(duplicatePaper.fingerprint)
      : null

    if (canonical) {
      slot.qpId = canonical.id
      slot.qpFingerprint = canonical.fingerprint || null
    }
  }

  for (const session of db.sessions) {
    if (session.userId !== userId) continue
    if (!duplicateIds.has(session.qpId)) continue

    const duplicatePaper = userPapers.find(qp => qp.id === session.qpId)
    const canonical = duplicatePaper?.fingerprint
      ? byFingerprint.get(duplicatePaper.fingerprint)
      : null

    if (canonical) session.qpId = canonical.id
  }

  db.questionPapers = db.questionPapers.filter(
    qp => !duplicateIds.has(qp.id)
  )

  saveDB(db)
  return true
}

function getPaperSlots(db, userId, qp, packId = null) {
  return db.slots.filter(
    slot =>
      slot.userId === userId &&
      slotBelongsToPaper(slot, qp, packId)
  )
}

function buildPaperUsage(slots) {
  const used = slots.reduce(
    (sum, slot) => sum + Number(slot.used || 0),
    0
  )

  const capacity = slots.reduce(
    (sum, slot) => sum + Number(slot.usesPerSlot || 0),
    0
  )

  const remaining = slots.reduce(
    (sum, slot) =>
      sum + Math.max(
        0,
        Number(slot.usesPerSlot || 0) - Number(slot.used || 0)
      ),
    0
  )

  const activeSlot = slots.find(
    slot =>
      slot.status === 'active' &&
      Number(slot.used || 0) < Number(slot.usesPerSlot || 0)
  ) || null

  return {
    used,
    limit: capacity || null,
    remaining: slots.length ? remaining : null,
    slotId: activeSlot?.id || null,
    activeSlotId: activeSlot?.id || null,
    slotCount: slots.length,
    slots: clone(slots),
  }
}

/* -----------------------------------------------------------------------
   ACCOUNT
------------------------------------------------------------------------ */

async function getAccount() {
  await ensureStorageReady()
  const user = requireStudent()

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  if (isDeveloperStudent(user)) {
    const questionPapers = db.questionPapers.filter(
      item => item.userId === user.id
    )

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        accountType: user.accountType,
        unlimitedPractice: true,
      },
      pack: null,
      questionPapers: clone(questionPapers),
      slots: [],
      purchases: [],
      unlimitedPractice: true,
      summary: {
        questionPapers: questionPapers.length,
        practiceUsed: 0,
        remaining: null,
        totalCapacity: null,
        usedGenerations: 0,
        remainingGenerations: null,
        activePapers: questionPapers.length,
        totalSlots: null,
        maxSlots: null,
        unlimitedPractice: true,
      },
    }
  }

  const pack =
    db.packs.find(
      item =>
        item.userId === user.id &&
        item.status === 'active'
    ) || null

  // Free Demo allowance is separate from paid pack/slot capacity.
  // The browser mock persists this for local testing only; production enforcement requires a server.
  if (!isDeveloperStudent(user) && !db.packs.some(item => item.userId === user.id && item.status === 'active')) {
    if (!Number.isInteger(user.demoGenerationsAllowed)) user.demoGenerationsAllowed = 2
    if (!Number.isInteger(user.demoGenerationsUsed)) user.demoGenerationsUsed = 0
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  }

  const questionPapers =
    db.questionPapers.filter(
      item => item.userId === user.id
    )

  const slots =
    db.slots.filter(
      item => item.userId === user.id
    )

  const purchases =
    db.purchases.filter(
      item => item.userId === user.id
    )

  const totalCapacity = pack
    ? pack.maxSlots * pack.usesPerSlot
    : 0

  const usedGenerations = slots.reduce(
    (total, slot) => total + Number(slot.used || 0),
    0
  )

  const remainingGenerations = Math.max(
    0,
    totalCapacity - usedGenerations
  )

  // "Active papers" means unique papers that can currently be practiced:
  // either an existing slot still has uses, or another slot can be created.
  const hasPackSlotCapacity = pack
    ? slots.filter(slot => slot.packId === pack.id).length < pack.maxSlots
    : false

  const activePaperIds = new Set()

  for (const qp of questionPapers) {
    const qpSlots = getPaperSlots(db, user.id, qp, pack?.id)
    const hasRemainingUse = qpSlots.some(
      slot =>
        slot.status === 'active' &&
        Number(slot.used || 0) < Number(slot.usesPerSlot || 0)
    )

    if (hasRemainingUse || hasPackSlotCapacity) {
      activePaperIds.add(qp.id)
    }
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      demoGenerationsAllowed: user.demoGenerationsAllowed ?? null,
      demoGenerationsUsed: user.demoGenerationsUsed ?? null,
    },

    demoAllowance: (!pack && !isDeveloperStudent(user) && Number.isInteger(user.demoGenerationsAllowed))
      ? {
          allowed: user.demoGenerationsAllowed,
          used: user.demoGenerationsUsed || 0,
          remaining: Math.max(0, user.demoGenerationsAllowed - (user.demoGenerationsUsed || 0)),
        }
      : null,
    pack,
    questionPapers: clone(questionPapers),
    slots: clone(slots),
    purchases: clone(purchases),

    summary: {
      questionPapers: questionPapers.length,
      practiceUsed: usedGenerations,
      remaining: remainingGenerations,
      activePapers: activePaperIds.size,
      totalCapacity,
      usedGenerations,
      remainingGenerations,
    },
  }
}


/* -----------------------------------------------------------------------
   QUESTION PAPERS
------------------------------------------------------------------------ */

async function getQuestionPapers() {
  await ensureStorageReady()
  const user = requireStudent()

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const papers = db.questionPapers.filter(
    qp => qp.userId === user.id && qp.status !== 'deleted'
  )

  const pack = db.packs.find(
    item =>
      item.userId === user.id &&
      item.status === 'active'
  ) || null

  return papers.map(qp => {
    const qpSlots = getPaperSlots(db, user.id, qp, pack?.id)

    return {
      ...clone(qp),
      usage: isDeveloperStudent(user)
        ? {
            used: 0,
            limit: null,
            remaining: null,
            slotId: null,
            activeSlotId: null,
            slotCount: 0,
            slots: [],
            unlimited: true,
          }
        : buildPaperUsage(qpSlots),
    }
  })
}


/* -----------------------------------------------------------------------
   QUESTION PAPER DETAILS
------------------------------------------------------------------------ */

async function getQuestionPaper(qpId) {
  await ensureStorageReady()
  const user = requireStudent()

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const qp = db.questionPapers.find(
    item =>
      item.id === qpId &&
      item.userId === user.id &&
      item.status !== 'deleted'
  )

  if (!qp) {
    return {
      success: false,
      message: 'Question paper not found.',
    }
  }

  const slots = getPaperSlots(db, user.id, qp)

  const usage = isDeveloperStudent(user)
    ? {
        used: 0,
        limit: null,
        remaining: null,
        slotCount: 0,
        slotId: null,
        activeSlotId: null,
        unlimited: true,
      }
    : buildPaperUsage(slots)

  return {
    success: true,
    questionPaper: clone(qp),
    slots: clone(slots),
    usage: {
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      slotCount: usage.slotCount,
      slotId: usage.slotId,
      activeSlotId: usage.activeSlotId,
      unlimited: usage.unlimited === true,
    },
  }
}


/* -----------------------------------------------------------------------
   PRACTICE / SLOT CONSUMPTION
------------------------------------------------------------------------ */

async function getPracticeEligibility(qpId) {
  await ensureStorageReady()
  const user = requireStudent()

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const qp = db.questionPapers.find(
    item =>
      item.id === qpId &&
      item.userId === user.id &&
      item.status !== 'deleted'
  )

  if (!qp) {
    return {
      success: false,
      message: 'Question paper not found.',
    }
  }

  if (isDeveloperStudent(user)) {
    return {
      success: true,
      eligible: true,
      usage: {
        used: null,
        limit: null,
        remaining: null,
        slotId: null,
        createdNewSlot: false,
        unlimited: true,
      },
    }
  }

  const pack = db.packs.find(
    item =>
      item.userId === user.id &&
      item.status === 'active'
  ) || null

  if (!pack) {
    return {
      success: false,
      eligible: false,
      message: 'No active pack. Please recharge before starting practice.',
    }
  }

  const availableSlot = getPaperSlots(db, user.id, qp, pack.id).find(
    item =>
      item.status === 'active' &&
      Number(item.used || 0) < Number(item.usesPerSlot || 0)
  ) || null

  const userSlotCount = db.slots.filter(
    item =>
      item.userId === user.id &&
      item.packId === pack.id
  ).length

  const canCreateSlot = userSlotCount < Number(pack.maxSlots || 0)

  if (!availableSlot && !canCreateSlot) {
    return {
      success: false,
      eligible: false,
      message: 'No slots remaining in your current pack.',
    }
  }

  return {
    success: true,
    eligible: true,
    usage: {
      used: availableSlot ? Number(availableSlot.used || 0) : 0,
      limit: availableSlot ? Number(availableSlot.usesPerSlot || 0) : Number(pack.usesPerSlot || 0),
      remaining: availableSlot
        ? Math.max(0, Number(availableSlot.usesPerSlot || 0) - Number(availableSlot.used || 0))
        : Number(pack.usesPerSlot || 0),
      slotId: availableSlot?.id || null,
      createdNewSlot: !availableSlot,
      unlimited: false,
    },
  }
}

async function authorizePractice(qpId, authorizationRequestId) {
  await ensureStorageReady()
  const user = requireStudent()

  if (!authorizationRequestId) {
    throw new Error('Practice authorization request ID is required.')
  }

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const existingAuthorization = db.practiceAuthorizations.find(
    item =>
      item.userId === user.id &&
      item.requestId === authorizationRequestId
  )

  if (existingAuthorization) {
    const existingSession = db.sessions.find(
      item =>
        item.id === existingAuthorization.sessionId &&
        item.userId === user.id
    )

    if (existingSession) {
      return {
        success: true,
        idempotent: true,
        session: clone(existingSession),
        usage: clone(existingAuthorization.usage),
      }
    }

    throw new Error('The previous practice authorization could not be recovered.')
  }

  const qp = db.questionPapers.find(
    item =>
      item.id === qpId &&
      item.userId === user.id &&
      item.status !== 'deleted'
  )

  if (!qp) {
    throw new Error('Question paper not found.')
  }

  // Only one unfinished attempt may exist for a QP at a time. A new
  // attempt is a reattempt and is allowed only after the previous attempt
  // has reached completed status. This keeps Resume authoritative and
  // prevents multiple active attempts from consuming independent usage.
  const unfinishedAttempt = db.sessions.find(
    item =>
      item.userId === user.id &&
      item.qpId === qp.id &&
      ['created', 'ready', 'paused'].includes(item.status)
  )

  if (unfinishedAttempt) {
    throw new Error(
      'This question paper already has an unfinished practice attempt. Resume that attempt before starting a new practice.'
    )
  }

  // The final confirmation is the only place that may consume usage,
  // allocate/bind a slot, and create the practice session.
  if (isDeveloperStudent(user)) {
    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      qpId: qp.id,
      qpFingerprint: qp.fingerprint || null,
      slotId: null,
      createdAt: new Date().toISOString(),
      status: 'created',
      pauseCount: 0,
      resumeCount: 0,
      pausesRemaining: 5,
      development: true,
      authorizationRequestId,
    }

    const usage = {
      used: null,
      limit: null,
      remaining: null,
      slotId: null,
      createdNewSlot: false,
      unlimited: true,
    }

    db.sessions.push(session)
    db.practiceAuthorizations.push({
      id: `authorization-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      requestId: authorizationRequestId,
      userId: user.id,
      qpId: qp.id,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      usage,
    })
    db.usageEvents.push({
      id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      qpId: qp.id,
      sessionId: session.id,
      authorizationRequestId,
      type: 'PRACTICE_AUTHORIZED',
      consumed: false,
      createdAt: new Date().toISOString(),
    })
    saveDB(db)

    return {
      success: true,
      idempotent: false,
      session: clone(session),
      usage,
    }
  }

  const pack = db.packs.find(
    item =>
      item.userId === user.id &&
      item.status === 'active'
  ) || null

  if (!pack) {
    throw new Error('No active pack. Please recharge before starting practice.')
  }

  // Always reuse an active slot for this exact paper before creating another.
  // The usage increment happens only after final confirmation reaches this API.
  let slot = getPaperSlots(db, user.id, qp, pack.id).find(
    item =>
      item.status === 'active' &&
      Number(item.used || 0) < Number(item.usesPerSlot || 0)
  ) || null

  let createdNewSlot = false

  if (slot) {
    slot.used = Number(slot.used || 0) + 1
  } else {
    const userSlotCount = db.slots.filter(
      item =>
        item.userId === user.id &&
        item.packId === pack.id
    ).length

    if (userSlotCount >= Number(pack.maxSlots || 0)) {
      throw new Error('No slots remaining in your current pack.')
    }

    slot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      packId: pack.id,
      qpId: qp.id,
      qpFingerprint: qp.fingerprint || null,
      usesPerSlot: Number(pack.usesPerSlot || 0),
      used: 1,
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    db.slots.push(slot)
    createdNewSlot = true
  }

  const session = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id,
    qpId: qp.id,
    qpFingerprint: qp.fingerprint || null,
    slotId: slot.id,
    createdAt: new Date().toISOString(),
    status: 'created',
    pauseCount: 0,
    resumeCount: 0,
    pausesRemaining: 5,
    authorizationRequestId,
  }

  const usage = {
    used: Number(slot.used || 0),
    limit: Number(slot.usesPerSlot || 0),
    remaining: Math.max(
      0,
      Number(slot.usesPerSlot || 0) - Number(slot.used || 0)
    ),
    slotId: slot.id,
    createdNewSlot,
    unlimited: false,
  }

  db.sessions.push(session)
  db.practiceAuthorizations.push({
    id: `authorization-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: authorizationRequestId,
    userId: user.id,
    qpId: qp.id,
    sessionId: session.id,
    createdAt: new Date().toISOString(),
    usage,
  })
  db.usageEvents.push({
    id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id,
    qpId: qp.id,
    sessionId: session.id,
    authorizationRequestId,
    type: 'PRACTICE_AUTHORIZED',
    consumed: true,
    slotId: slot.id,
    createdAt: new Date().toISOString(),
  })
  saveDB(db)

  return {
    success: true,
    idempotent: false,
    session: clone(session),
    usage,
  }
}



async function updateExamSessionStatus(sessionId, status, metadata = {}) {
  await ensureStorageReady()
  const user = requireStudent()
  if (!sessionId) throw new Error('Examination session ID is required.')

  const db = getDB()
  const session = db.sessions.find(
    item => item.id === sessionId && item.userId === user.id
  )

  if (!session) {
    throw new Error('Examination session not found.')
  }

  if (session.status === 'completed' && status !== 'completed') {
    return { success: true, session: clone(session) }
  }

  const currentPauseCount = Math.max(0, Number(session.pauseCount ?? (session.status === 'paused' ? 1 : 0)))
  const currentResumeCount = Math.max(0, Number(session.resumeCount || 0))

  let nextPauseCount = currentPauseCount
  let nextResumeCount = Math.min(currentPauseCount, currentResumeCount)

  if (status === 'paused' && session.status !== 'paused') {
    if (currentPauseCount >= 5) {
      throw new Error('The maximum of 5 pauses has been used for this attempt.')
    }
    nextPauseCount = currentPauseCount + 1
    nextResumeCount = Math.min(currentResumeCount, nextPauseCount - 1)
  } else if (status === 'ready' && session.status === 'paused') {
    nextResumeCount = Math.min(currentPauseCount, currentResumeCount + 1)
  }

  session.status = status
  Object.assign(session, metadata)
  // Pause/resume counters are server-authoritative; restore the transition
  // values after applying ordinary metadata so clients cannot rewrite them.
  session.pauseCount = nextPauseCount
  session.resumeCount = nextResumeCount
  session.pausesRemaining = Math.max(0, 5 - nextPauseCount)
  saveDB(db)

  return { success: true, session: clone(session) }
}

async function removeQuestionPaper(qpId) {
  await ensureStorageReady()
  const user = requireStudent()
  if (!qpId) {
    return {
      success: false,
      message: 'Question paper ID is required.',
    }
  }

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const questionPaper = db.questionPapers.find(
    item =>
      item.id === qpId &&
      item.userId === user.id &&
      item.status !== 'deleted'
  )

  if (!questionPaper) {
    return {
      success: false,
      message: 'Question paper not found.',
    }
  }

  // Removal is deliberately server/API-authoritative. A QP becomes
  // non-removable as soon as any attempt, result, or paid authorization
  // exists for it. This prevents UI/history manipulation from bypassing
  // the lifecycle lock.
  const hasSession = db.sessions.some(
    session =>
      session.userId === user.id &&
      session.qpId === qpId
  )

  const hasAuthorization = db.practiceAuthorizations.some(
    authorization =>
      authorization.userId === user.id &&
      authorization.qpId === qpId
  )

  const results = (await getResultsFromIndexedDB()).filter(
    result =>
      result.userId === user.id &&
      result.qpId === qpId
  )

  if (hasSession || hasAuthorization || results.length > 0) {
    return {
      success: false,
      code: 'QP_ATTEMPT_LOCKED',
      message: 'This question paper cannot be removed because it has already been practiced.',
    }
  }

  const slots = getPaperSlots(db, user.id, questionPaper)
  const usedSlot = slots.find(slot => Number(slot.used || 0) > 0)

  if (usedSlot) {
    return {
      success: false,
      code: 'QP_ATTEMPT_LOCKED',
      message: 'This question paper cannot be removed because practice usage is already attached to it.',
    }
  }

  // Keep the historical record shape intact while hiding the paper from the
  // active library. No usage is refunded because an unattempted paper should
  // never have consumed usage in the first place.
  questionPaper.status = 'deleted'
  questionPaper.deletedAt = new Date().toISOString()
  questionPaper.updatedAt = questionPaper.deletedAt
  saveDB(db)

  return {
    success: true,
    questionPaper: clone(questionPaper),
  }
}

async function getQuestionPaperLifecycle(qpId) {
  await ensureStorageReady()
  const user = requireStudent()
  if (!qpId) {
    return {
      success: false,
      message: 'Question paper ID is required.',
    }
  }

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const questionPaper = db.questionPapers.find(
    item =>
      item.id === qpId &&
      item.userId === user.id &&
      item.status !== 'deleted'
  )

  if (!questionPaper) {
    return {
      success: false,
      message: 'Question paper not found.',
    }
  }

  const results = (await getResultsFromIndexedDB()).filter(
    result => result.userId === user.id && result.qpId === qpId
  )

  return {
    success: true,
    lifecycle: deriveQuestionPaperLifecycle({
      questionPaper,
      sessions: db.sessions.filter(session => session.userId === user.id),
      results,
    }),
  }
}

async function getResumableExamSession(qpId) {
  await ensureStorageReady()
  const user = requireStudent()
  if (!qpId) return { success: true, session: null }

  const db = getDB()
  const session = db.sessions
    .filter(item =>
      item.userId === user.id &&
      item.qpId === qpId &&
      ['created', 'ready', 'paused'].includes(item.status)
    )
    .sort((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime()
    )[0] || null

  return { success: true, session: session ? clone(session) : null }
}

/* -----------------------------------------------------------------------
   EXAM RESULTS
------------------------------------------------------------------------ */

async function saveExamResult(result) {
  const user = requireStudent()

  if (!result || typeof result !== 'object') {
    throw new Error('A valid examination result is required.')
  }

  if (!result.resultId) {
    throw new Error('Examination result ID is required.')
  }

  const db = getDB()
  const existing = await getResultFromIndexedDB(result.resultId)

  if (existing?.userId === user.id) {
    return {
      success: true,
      result: clone(existing),
      created: false,
    }
  }

  const previousResults = (await getResultsFromIndexedDB()).filter(
    item =>
      item.userId === user.id &&
      item.qpId === result.qpId
  )

  const record = clone({
    ...result,
    userId: user.id,
    attemptNumber: result.attemptNumber || previousResults.length + 1,
    recordedAt: result.recordedAt || new Date().toISOString(),
    schemaVersion: result.schemaVersion || '1.0',
  })

  await putResultInIndexedDB(record)

  if (record.sessionId) {
    const session = db.sessions.find(
      item =>
        item.id === record.sessionId &&
        item.userId === user.id
    )

    if (session) {
      session.status = 'completed'
      session.resultId = record.resultId
      session.completedAt = record.submittedAt || record.recordedAt
      saveDB(db)
    }
  }

  return {
    success: true,
    result: clone(record),
    created: true,
  }
}

async function getExamResults(qpId = null) {
  const user = requireStudent()
  const results = (await getResultsFromIndexedDB())
    .filter(item => item.userId === user.id)
    .filter(item => !qpId || item.qpId === qpId)
    .sort((a, b) => {
      const aTime = new Date(a.submittedAt || a.recordedAt || 0).getTime()
      const bTime = new Date(b.submittedAt || b.recordedAt || 0).getTime()
      return bTime - aTime
    })

  return {
    success: true,
    results: clone(results),
  }
}

async function getExamResult(resultId) {
  const user = requireStudent()
  const result = await getResultFromIndexedDB(resultId)

  if (!result || result.userId !== user.id) {
    return {
      success: false,
      message: 'Examination result not found.',
    }
  }

  return {
    success: true,
    result: clone(result),
  }
}


/* -----------------------------------------------------------------------
   IMPORT QUESTION PAPER
------------------------------------------------------------------------ */

async function importQuestionPaper(questionPaper) {
  await ensureStorageReady()
  const user = requireStudent()

  const db = getDB()
  normalizeQuestionPaperRecords(db, user.id)

  const fingerprint = String(questionPaper.fingerprint || '').trim()
  const incomingSourceId = String(questionPaper.sourceId || '').trim() || null
  const incomingIdentityStatus =
    questionPaper.identityStatus ||
    (questionPaper.scoringReady === true ? 'READY' : 'PENDING_ANSWER_KEY')
  const incomingAnswerKeyStatus =
    questionPaper.answerKeyStatus ||
    (questionPaper.scoringReady === true ? 'COMPLETE' : 'MISSING')
  const incomingScoringReady = questionPaper.scoringReady === true

  // Fingerprint is the authoritative content identity. Re-importing the same
  // paper must reconcile/update the existing library record rather than just
  // returning stale metadata. This is especially important for source-only
  // papers whose XML is stored separately in IndexedDB.
  if (fingerprint) {
    const existing = db.questionPapers.find(
      item =>
        item.userId === user.id &&
        item.fingerprint === fingerprint &&
        item.status !== 'deleted'
    )

    if (existing) {
      let changed = false

      const setIfChanged = (key, value) => {
        if (value === undefined) return
        if (JSON.stringify(existing[key]) !== JSON.stringify(value)) {
          existing[key] = value
          changed = true
        }
      }

      // Refresh the metadata from the latest import. The fingerprint still
      // remains the immutable content identity.
      setIfChanged('name', questionPaper.name || existing.name || 'Imported Question Paper')
      setIfChanged('category', questionPaper.category || existing.category || 'Imported')
      setIfChanged('year', questionPaper.year ?? existing.year ?? null)
      setIfChanged('paperNumber', questionPaper.paperNumber ?? existing.paperNumber ?? 1)
      setIfChanged('questions', Number.isFinite(Number(questionPaper.questions)) ? Number(questionPaper.questions) : existing.questions || 0)
      setIfChanged('marks', Number.isFinite(Number(questionPaper.marks)) ? Number(questionPaper.marks) : existing.marks || 0)
      setIfChanged('duration', questionPaper.duration ?? existing.duration ?? null)
      setIfChanged('sections', Number.isFinite(Number(questionPaper.sections)) ? Number(questionPaper.sections) : existing.sections || 1)
      setIfChanged('questionTypes', Array.isArray(questionPaper.questionTypes) ? questionPaper.questionTypes : existing.questionTypes || [])

      // Source/scoring metadata must also be repaired on old records.
      setIfChanged('sourceId', incomingSourceId || existing.sourceId || null)
      setIfChanged('identityStatus', incomingIdentityStatus)
      setIfChanged('answerKeyStatus', incomingAnswerKeyStatus)
      setIfChanged('scoringReady', incomingScoringReady)
      setIfChanged('qpId', questionPaper.qpId || existing.qpId || null)
      setIfChanged('sourceFileName', questionPaper.sourceFileName || existing.sourceFileName || '')
      setIfChanged('questionFingerprints', Array.isArray(questionPaper.questionFingerprints) ? questionPaper.questionFingerprints : existing.questionFingerprints || [])

      if (changed) {
        existing.updatedAt = new Date().toISOString()
        saveDB(db)
      }

      return {
        success: true,
        duplicate: true,
        reconciled: true,
        questionPaper: clone(existing),
        message: 'This question paper was already in your library and has been reconciled with the latest import.'
      }
    }
  }

  const qp = {
    id: `qp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id,
    name: questionPaper.name || 'Imported Question Paper',
    category: questionPaper.category || 'Imported',
    year: questionPaper.year || null,
    paperNumber: questionPaper.paperNumber || 1,
    questions: questionPaper.questions || 0,
    marks: questionPaper.marks || 0,
    duration: questionPaper.duration ?? null,
    sections: questionPaper.sections || 1,
    questionTypes: Array.isArray(questionPaper.questionTypes) ? questionPaper.questionTypes : [],
    fingerprint: fingerprint || `local-${Date.now()}`,
    questionFingerprints: Array.isArray(questionPaper.questionFingerprints) ? questionPaper.questionFingerprints : [],
    sourceId: incomingSourceId,
    identityStatus: incomingIdentityStatus,
    answerKeyStatus: incomingAnswerKeyStatus,
    scoringReady: incomingScoringReady,
    qpId: questionPaper.qpId || null,
    sourceFileName: questionPaper.sourceFileName || '',
    importedAt: new Date().toISOString(),
    status: 'active',
  }

  db.questionPapers.push(qp)
  saveDB(db)

  return {
    success: true,
    duplicate: false,
    questionPaper: clone(qp),
  }
}

/* -----------------------------------------------------------------------
   PURCHASE HISTORY
------------------------------------------------------------------------ */

async function getPurchaseHistory() {
  await ensureStorageReady()
  const user = requireStudent()

  const db = getDB()

  return clone(
    db.purchases.filter(
      item =>
        item.userId === user.id
    )
  )
}


/* -----------------------------------------------------------------------
   ADMIN
------------------------------------------------------------------------ */

async function getAdminDashboard() {
  await ensureStorageReady()
  const admin = requireAdmin()
  const db = getDB()

  const students = db.users.filter(user => getUserRole(user) === 'student')
  const users = db.users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: getUserRole(user),
    createdAt: user.createdAt,
  }))

  const activePacks = db.packs.filter(pack => pack.status === 'active')
  const activeQuestionPapers = db.questionPapers.filter(qp => qp.status !== 'deleted')
  const usageEvents = Array.isArray(db.usageEvents) ? db.usageEvents : []

  const totalUsed = db.slots.reduce(
    (sum, slot) => sum + Number(slot.used || 0),
    0
  )

  return {
    success: true,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: getUserRole(admin),
    },
    summary: {
      totalUsers: db.users.length,
      totalStudents: students.length,
      totalAdmins: db.users.length - students.length,
      activePacks: activePacks.length,
      totalQuestionPapers: activeQuestionPapers.length,
      totalSlots: db.slots.length,
      totalGenerations: totalUsed,
      totalUsageEvents: usageEvents.length,
    },
    users,
    packs: clone(db.packs),
    questionPapers: clone(activeQuestionPapers),
    slots: clone(db.slots),
    usageEvents: clone(usageEvents),
  }
}

async function adminListUsers() {
  await ensureStorageReady()
  await getAdminDashboard()
  const db = getDB()
  return clone(db.users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: getUserRole(user),
    createdAt: user.createdAt,
  })))
}

/* -----------------------------------------------------------------------
   DEV / TEST HELPERS
------------------------------------------------------------------------ */

async function resetMockDatabase() {
  await ensureStorageReady()
  await clearResultsFromIndexedDB()

  localStorage.setItem(
    DB_KEY,
    JSON.stringify(
      clone(DEFAULT_DB)
    )
  )

  return {
    success: true,
  }
}


/* -----------------------------------------------------------------------
   PUBLIC API
------------------------------------------------------------------------ */

export const cbtgenApi = {

  auth: {
    login,
    logout,
    getCurrentUser:
      getCurrentUserApi,
  },

  account: {
    get:
      getAccount,

    getPurchaseHistory:
      getPurchaseHistory,
  },

  questionPapers: {
    list:
      getQuestionPapers,

    get:
      getQuestionPaper,

    import:
      importQuestionPaper,

    previewPractice:
      getPracticeEligibility,

    authorizePractice:
      authorizePractice,

    getResumableSession:
      getResumableExamSession,

    getLifecycle:
      getQuestionPaperLifecycle,

    remove:
      removeQuestionPaper,

    updateSessionStatus:
      updateExamSessionStatus,

    // Legacy alias retained temporarily. New UI flows must use
    // previewPractice() and authorizePractice() explicitly.
    practice:
      authorizePractice,
  },

  results: {
    save: saveExamResult,
    list: getExamResults,
    get: getExamResult,
  },

  admin: {
    dashboard:
      getAdminDashboard,

    users:
      adminListUsers,
  },

  dev: {
    resetDatabase:
      resetMockDatabase,
  },
}

export default cbtgenApi