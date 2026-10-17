import assert from 'node:assert/strict'
import { buildPausedSession, buildResumedSession, getPauseState, MAX_PAUSES_PER_ATTEMPT } from '../../src/features/exam/examEngine/examRuntime.js'

const base = {
  id: 'pause-limit-session',
  sessionId: 'pause-limit-session',
  status: 'ready',
  pauseCount: 0,
  resumeCount: 0,
  totalPausedSeconds: 0,
}

assert.equal(MAX_PAUSES_PER_ATTEMPT, 5)
assert.deepEqual(getPauseState(base), {
  pauseCount: 0,
  resumeCount: 0,
  pausesRemaining: 5,
})

const legacyPaused = { id: 'legacy-paused', status: 'paused', pausedAt: new Date().toISOString() }
assert.deepEqual(getPauseState(legacyPaused), {
  pauseCount: 1,
  resumeCount: 0,
  pausesRemaining: 4,
})

let session = base
for (let i = 1; i <= 5; i += 1) {
  session = buildPausedSession(session, 'manual')
  assert.equal(session.status, 'paused')
  assert.equal(session.pauseCount, i)
  assert.equal(session.resumeCount, i - 1)
  assert.equal(session.pausesRemaining, 5 - i)

  session = buildResumedSession(session)
  assert.equal(session.status, 'ready')
  assert.equal(session.pauseCount, i)
  assert.equal(session.resumeCount, i)
  assert.equal(session.pausesRemaining, 5 - i)
}

assert.throws(
  () => buildPausedSession(session, 'manual'),
  /maximum of 5 pauses/i,
)

console.log('✓ Pause limit contract passed: max 5 pauses, max 5 corresponding resumes, no sixth pause.')
