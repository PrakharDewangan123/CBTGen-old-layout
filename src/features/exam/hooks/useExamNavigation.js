import { useCallback, useEffect, useRef } from 'react'
import { getSectionIdForQuestion } from '../examEngine/examUtils'

/**
 * Owns examination navigation and per-question timing state.
 * Rendering remains in the examination page/components.
 */
export function useExamNavigation({
  questions,
  sections,
  curIndex,
  current,
  setCurIndex,
  setActiveSection,
  setVisited,
  setModal,
}) {
  const questionTimingRef = useRef({})
  const currentQuestionIdRef = useRef(null)

  const recordCurrentQuestionTime = useCallback(() => {
    const currentQuestionId = currentQuestionIdRef.current
    if (!currentQuestionId) return

    const timing = questionTimingRef.current[currentQuestionId]
    if (!timing) return

    const now = Date.now()
    const started = timing.lastViewedAtMs || now
    const elapsed = Math.max(0, Math.floor((now - started) / 1000))

    timing.totalTimeSeconds = Number(timing.totalTimeSeconds || 0) + elapsed
    timing.lastViewedAtMs = now
  }, [])

  const beginQuestionTiming = useCallback((question) => {
    if (!question) return

    const questionId = question.sourceQuestionId
    const now = Date.now()
    const existing = questionTimingRef.current[questionId]

    if (existing) {
      existing.lastViewedAtMs = now
      return
    }

    questionTimingRef.current[questionId] = {
      firstViewedAt: new Date(now).toISOString(),
      totalTimeSeconds: 0,
      lastViewedAtMs: now,
    }
  }, [])

  const goToQuestion = useCallback((question) => {
    if (!question) return

    const index = questions.findIndex(
      item => item.sourceQuestionId === question.sourceQuestionId,
    )
    if (index < 0) return

    recordCurrentQuestionTime()
    beginQuestionTiming(question)
    currentQuestionIdRef.current = question.sourceQuestionId

    setCurIndex(index)
    setActiveSection(getSectionIdForQuestion(question))
    setVisited(previous => {
      const next = new Set(previous)
      next.add(question.sourceQuestionId)
      return next
    })
  }, [questions, recordCurrentQuestionTime, beginQuestionTiming, setCurIndex, setActiveSection, setVisited])

  const changeSection = useCallback((sectionId) => {
    const nextSection = sections.find(section => section.id === sectionId)
    if (!nextSection) return

    setActiveSection(sectionId)
    const first = questions.find(
      question => getSectionIdForQuestion(question) === sectionId,
    )
    if (first) goToQuestion(first)
  }, [sections, questions, setActiveSection, goToQuestion])

  useEffect(() => {
    if (!current || currentQuestionIdRef.current) return
    beginQuestionTiming(current)
    currentQuestionIdRef.current = current.sourceQuestionId
  }, [current, beginQuestionTiming])

  const goNext = useCallback(() => {
    if (!current) return

    const nextQuestion = questions[curIndex + 1]
    if (nextQuestion) goToQuestion(nextQuestion)
    else setModal('submit')
  }, [current, questions, curIndex, goToQuestion, setModal])

  return {
    questionTimingRef,
    currentQuestionIdRef,
    recordCurrentQuestionTime,
    beginQuestionTiming,
    goToQuestion,
    changeSection,
    goNext,
  }
}
