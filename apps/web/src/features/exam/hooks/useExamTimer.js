import { useEffect, useRef } from 'react'

/** Owns the examination countdown and time-expiry trigger. */
export function useExamTimer({
  status,
  activeSession,
  durationMinutes,
  submittedRef,
  submitExam,
  setRemainingSeconds,
}) {
  const submitExamRef = useRef(submitExam)

  useEffect(() => {
    submitExamRef.current = submitExam
  }, [submitExam])

  useEffect(() => {
    if (status !== 'ready' || !activeSession || submittedRef.current) return undefined

    const startedAt = Number(
      new Date(activeSession.startedAt || activeSession.createdAt).getTime(),
    )
    const duration = Math.max(0, Math.floor(durationMinutes * 60))

    // Never treat the initial React state value (0) as an expired exam.
    if (!Number.isFinite(startedAt) || duration <= 0) {
      setRemainingSeconds(duration)
      return undefined
    }

    const tick = () => {
      const pausedSeconds = Number(activeSession.totalPausedSeconds || 0)
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000) - pausedSeconds)
      const nextRemaining = Math.max(0, duration - elapsed)
      setRemainingSeconds(nextRemaining)

      if (nextRemaining === 0 && !submittedRef.current) {
        submitExamRef.current('time-expired')
      }
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [status, activeSession, durationMinutes, submittedRef, setRemainingSeconds])
}
