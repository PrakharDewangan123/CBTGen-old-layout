/**
 * CBTGen question-paper lifecycle model.
 *
 * This module is intentionally pure: it derives a QP's lifecycle state from
 * the library record, practice sessions, and completed result records. It
 * does not mutate storage and does not authorize usage.
 */

export const QUESTION_PAPER_LIFECYCLE = Object.freeze({
  LIBRARY: 'LIBRARY',
  AUTHORIZED: 'AUTHORIZED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
})

export const PRACTICE_SESSION_STATUS = Object.freeze({
  CREATED: 'created',
  READY: 'ready',
  PAUSED: 'paused',
  COMPLETED: 'completed',
})

const UNFINISHED_SESSION_STATUSES = new Set([
  PRACTICE_SESSION_STATUS.CREATED,
  PRACTICE_SESSION_STATUS.READY,
  PRACTICE_SESSION_STATUS.PAUSED,
])

function timestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function sortNewestFirst(records) {
  return [...records].sort((a, b) =>
    timestamp(b?.updatedAt || b?.completedAt || b?.createdAt || b?.recordedAt) -
    timestamp(a?.updatedAt || a?.completedAt || a?.createdAt || a?.recordedAt)
  )
}

/**
 * Derive the current lifecycle of one question paper.
 *
 * Priority is deliberately based on the latest unfinished session first:
 * a paused/in-progress attempt must remain resumable even when older
 * completed results already exist for the same QP.
 */
export function deriveQuestionPaperLifecycle({
  questionPaper,
  sessions = [],
  results = [],
}) {
  if (!questionPaper || questionPaper.status === 'deleted') {
    return {
      state: null,
      libraryState: 'deleted',
      hasAttempt: false,
      attemptCount: 0,
      completedAttemptCount: 0,
      activeAttemptId: null,
      latestCompletedAttemptId: null,
      canResume: false,
      canRemove: false,
    }
  }

  const paperSessions = sessions.filter(
    session => session?.qpId === questionPaper.id
  )

  const paperResults = results.filter(
    result => result?.qpId === questionPaper.id
  )

  const unfinishedSessions = sortNewestFirst(
    paperSessions.filter(session =>
      UNFINISHED_SESSION_STATUSES.has(session?.status)
    )
  )

  const latestUnfinished = unfinishedSessions[0] || null
  const completedSessions = paperSessions.filter(
    session => session?.status === PRACTICE_SESSION_STATUS.COMPLETED
  )

  const completedAttemptCount = Math.max(
    completedSessions.length,
    paperResults.length
  )

  const hasAttempt = paperSessions.length > 0 || paperResults.length > 0

  let state = QUESTION_PAPER_LIFECYCLE.LIBRARY

  if (latestUnfinished?.status === PRACTICE_SESSION_STATUS.PAUSED) {
    state = QUESTION_PAPER_LIFECYCLE.PAUSED
  } else if (
    latestUnfinished?.status === PRACTICE_SESSION_STATUS.READY
  ) {
    state = QUESTION_PAPER_LIFECYCLE.IN_PROGRESS
  } else if (
    latestUnfinished?.status === PRACTICE_SESSION_STATUS.CREATED
  ) {
    state = QUESTION_PAPER_LIFECYCLE.AUTHORIZED
  } else if (completedAttemptCount > 0) {
    state = QUESTION_PAPER_LIFECYCLE.COMPLETED
  }

  const latestCompleted = sortNewestFirst([
    ...completedSessions,
    ...paperResults,
  ])[0] || null

  return {
    state,
    libraryState: 'active',
    hasAttempt,
    attemptCount: Math.max(paperSessions.length, paperResults.length),
    completedAttemptCount,
    activeAttemptId: latestUnfinished?.id || null,
    activeAttemptStatus: latestUnfinished?.status || null,
    latestCompletedAttemptId:
      latestCompleted?.id || latestCompleted?.sessionId || null,
    canResume: Boolean(latestUnfinished),
    // Removal is locked once any attempt or result exists. The API remains
    // authoritative for the final mutation decision.
    canRemove: !hasAttempt,
  }
}
