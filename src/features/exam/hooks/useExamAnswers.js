import { useCallback, useEffect, useRef } from 'react'

/** Owns candidate response and review-state transitions. */
export function useExamAnswers({
  current,
  submittedRef,
  setAnswers,
  setReview,
  goNext,
}) {
  const goNextRef = useRef(goNext)

  useEffect(() => {
    goNextRef.current = goNext
  }, [goNext])

  const setAnswer = useCallback((value) => {
    if (!current || submittedRef.current) return

    setAnswers(previous => ({
      ...previous,
      [current.sourceQuestionId]: value,
    }))
  }, [current, submittedRef, setAnswers])

  const toggleReviewAndNext = useCallback(() => {
    if (!current || submittedRef.current) return

    setReview(previous => ({
      ...previous,
      [current.sourceQuestionId]: !previous[current.sourceQuestionId],
    }))

    goNextRef.current()
  }, [current, submittedRef, setReview])

  const clearResponse = useCallback(() => {
    if (!current || submittedRef.current) return

    setAnswers(previous => {
      const next = { ...previous }
      delete next[current.sourceQuestionId]
      return next
    })
  }, [current, submittedRef, setAnswers])

  return { setAnswer, toggleReviewAndNext, clearResponse }
}
