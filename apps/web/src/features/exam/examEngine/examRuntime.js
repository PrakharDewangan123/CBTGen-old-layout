export const EXAM_MODE_KEY = 'cbtgen_exam_mode'
export const EXAM_RUNTIME_KEY = 'cbtgen_exam_runtime'
export const MAX_PAUSES_PER_ATTEMPT = 5

export function readJson(key) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeJson(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

export function getExamMode() {
  return sessionStorage.getItem(EXAM_MODE_KEY) || ''
}

export function setExamMode(mode) {
  if (!mode) {
    sessionStorage.removeItem(EXAM_MODE_KEY)
    return
  }
  sessionStorage.setItem(EXAM_MODE_KEY, mode)
}

export function getRuntime(sessionId) {
  const runtime = readJson(EXAM_RUNTIME_KEY)
  if (!runtime || runtime.sessionId !== sessionId) return null
  return runtime
}

export function saveRuntime(runtime) {
  if (!runtime?.sessionId) return
  writeJson(EXAM_RUNTIME_KEY, runtime)
}

export function clearRuntime() {
  sessionStorage.removeItem(EXAM_RUNTIME_KEY)
}

export function getPauseState(session) {
  const legacyPausedAttempt = session?.status === 'paused' && session?.pauseCount == null
  const rawPauseCount = legacyPausedAttempt ? 1 : Number(session?.pauseCount || 0)
  const pauseCount = Math.max(0, Math.min(MAX_PAUSES_PER_ATTEMPT, rawPauseCount))
  const resumeCount = Math.max(0, Math.min(pauseCount, Number(session?.resumeCount || 0)))
  return {
    pauseCount,
    resumeCount,
    pausesRemaining: Math.max(0, MAX_PAUSES_PER_ATTEMPT - pauseCount),
  }
}

export function buildPausedSession(session, reason = 'manual') {
  const now = Date.now()
  const previousPausedAt = session?.pausedAt ? Date.parse(session.pausedAt) : NaN
  const alreadyPaused = session?.status === 'paused' && Number.isFinite(previousPausedAt)
  const pauseState = getPauseState(session)

  if (!alreadyPaused && pauseState.pauseCount >= MAX_PAUSES_PER_ATTEMPT) {
    throw new Error(`The maximum of ${MAX_PAUSES_PER_ATTEMPT} pauses has been used for this attempt.`)
  }

  const pauseCount = alreadyPaused ? pauseState.pauseCount : pauseState.pauseCount + 1

  return {
    ...session,
    sessionId: session.sessionId || session.id,
    status: 'paused',
    pausedAt: alreadyPaused ? session.pausedAt : new Date(now).toISOString(),
    pauseReason: alreadyPaused ? session.pauseReason || reason : reason,
    totalPausedSeconds: Number(session.totalPausedSeconds || 0),
    pauseCount,
    resumeCount: pauseState.resumeCount,
    pausesRemaining: Math.max(0, MAX_PAUSES_PER_ATTEMPT - pauseCount),
  }
}

export function buildResumedSession(session) {
  const now = Date.now()
  const pausedAt = session?.pausedAt ? Date.parse(session.pausedAt) : NaN
  const extraPaused = Number.isFinite(pausedAt)
    ? Math.max(0, Math.floor((now - pausedAt) / 1000))
    : 0

  return {
    ...session,
    sessionId: session.sessionId || session.id,
    status: 'ready',
    totalPausedSeconds: Number(session.totalPausedSeconds || 0) + extraPaused,
    pausedAt: null,
    pauseReason: null,
    resumedAt: new Date(now).toISOString(),
    pauseCount: getPauseState(session).pauseCount,
    resumeCount: getPauseState(session).resumeCount + 1,
    pausesRemaining: getPauseState(session).pausesRemaining,
  }
}

export async function requestExamFullscreen() {
  try {
    if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
      await document.documentElement.requestFullscreen()
      return true
    }
  } catch {
    // Browser policy may require a user gesture or deny fullscreen.
  }
  return false
}
