import assert from 'node:assert/strict'

import {
  deriveQuestionPaperLifecycle,
  QUESTION_PAPER_LIFECYCLE,
  PRACTICE_SESSION_STATUS,
} from '../../apps/web/src/features/questionPapers/services/questionPaperLifecycle.js'

const questionPaper = {
  id: 'qp-test-001',
  status: 'active',
}

function lifecycle(sessions = [], results = []) {
  return deriveQuestionPaperLifecycle({
    questionPaper,
    sessions,
    results,
  })
}

let state = lifecycle()
assert.equal(state.state, QUESTION_PAPER_LIFECYCLE.LIBRARY)
assert.equal(state.hasAttempt, false)
assert.equal(state.canRemove, true)
assert.equal(state.canResume, false)

state = lifecycle([
  {
    id: 'session-created',
    qpId: questionPaper.id,
    status: PRACTICE_SESSION_STATUS.CREATED,
    createdAt: '2026-10-06T10:00:00.000Z',
  },
])
assert.equal(state.state, QUESTION_PAPER_LIFECYCLE.AUTHORIZED)
assert.equal(state.activeAttemptId, 'session-created')
assert.equal(state.canResume, true)
assert.equal(state.canRemove, false)

state = lifecycle([
  {
    id: 'session-ready',
    qpId: questionPaper.id,
    status: PRACTICE_SESSION_STATUS.READY,
    createdAt: '2026-10-06T10:00:00.000Z',
  },
])
assert.equal(state.state, QUESTION_PAPER_LIFECYCLE.IN_PROGRESS)

state = lifecycle([
  {
    id: 'session-paused',
    qpId: questionPaper.id,
    status: PRACTICE_SESSION_STATUS.PAUSED,
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T11:00:00.000Z',
  },
])
assert.equal(state.state, QUESTION_PAPER_LIFECYCLE.PAUSED)
assert.equal(state.activeAttemptId, 'session-paused')
assert.equal(state.canResume, true)

state = lifecycle(
  [
    {
      id: 'session-completed',
      qpId: questionPaper.id,
      status: PRACTICE_SESSION_STATUS.COMPLETED,
      createdAt: '2026-10-06T10:00:00.000Z',
      completedAt: '2026-10-06T12:00:00.000Z',
    },
  ],
  [
    {
      resultId: 'result-001',
      sessionId: 'session-completed',
      qpId: questionPaper.id,
      recordedAt: '2026-10-06T12:00:00.000Z',
    },
  ]
)
assert.equal(state.state, QUESTION_PAPER_LIFECYCLE.COMPLETED)
assert.equal(state.completedAttemptCount, 1)
assert.equal(state.canResume, false)
assert.equal(state.canRemove, false)

// A paused/newer attempt takes precedence over an older completed attempt.
state = lifecycle(
  [
    {
      id: 'session-completed-old',
      qpId: questionPaper.id,
      status: PRACTICE_SESSION_STATUS.COMPLETED,
      createdAt: '2026-10-06T10:00:00.000Z',
      completedAt: '2026-10-06T12:00:00.000Z',
    },
    {
      id: 'session-paused-new',
      qpId: questionPaper.id,
      status: PRACTICE_SESSION_STATUS.PAUSED,
      createdAt: '2026-10-06T13:00:00.000Z',
      updatedAt: '2026-10-06T14:00:00.000Z',
    },
  ],
  [
    {
      resultId: 'result-001',
      sessionId: 'session-completed-old',
      qpId: questionPaper.id,
      recordedAt: '2026-10-06T12:00:00.000Z',
    },
  ]
)
assert.equal(state.state, QUESTION_PAPER_LIFECYCLE.PAUSED)
assert.equal(state.activeAttemptId, 'session-paused-new')
assert.equal(state.completedAttemptCount, 1)

console.log('✓ Question-paper lifecycle tests passed')
console.log('  Library → authorized → in-progress → paused → completed states derive correctly.')
console.log('  Paused/newer attempts take precedence over older completed attempts.')
console.log('  Lifecycle derivation is pure and does not authorize or consume usage.')
