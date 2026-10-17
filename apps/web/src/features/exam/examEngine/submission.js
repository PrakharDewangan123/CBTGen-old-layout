import { buildExamResult } from './scoring'
import { CHOICE_TYPES, MULTI_TYPES } from '../components/examConstants'
import { answerIsPresent } from './examUtils'

/**
 * Builds the immutable result payload for a completed CBTGen examination.
 *
 * This module owns result construction only. Saving the result and updating
 * React/session UI state remain in the examination page/API layer.
 */
export function buildSubmissionResult({
  reason = 'manual',
  questions,
  answers,
  review,
  visited,
  paper,
  sections,
  activeSession,
  questionPaperMeta,
  user,
  questionTiming,
  submittedAt = new Date().toISOString(),
}) {
  const startedAt = activeSession?.startedAt || activeSession?.createdAt || submittedAt
  const responseMap = {}

  questions.forEach(question => {
    const value = answers[question.sourceQuestionId]
    const timing = questionTiming[question.sourceQuestionId] || {
      firstViewedAt: null,
      totalTimeSeconds: 0,
    }

    const response = {
      visited: visited.has(question.sourceQuestionId),
      markedForReview: !!review[question.sourceQuestionId],
      firstViewedAt: timing.firstViewedAt || null,
      answeredAt: answerIsPresent(question, value) ? submittedAt : null,
      totalTimeSeconds: Number(timing.totalTimeSeconds || 0),
    }

    if (MULTI_TYPES.has(question.type)) {
      response.selectedOptionIds = Array.isArray(value) ? value : []
    } else if (CHOICE_TYPES.has(question.type)) {
      response.selectedOptionId = value ?? null
    } else if (question.type === 'NAT' || question.type === 'NUMERIC_RANGE' || question.type === 'SLIDER' || question.type === 'EQUATION_INPUT') {
      response.numericValue = value == null || value === '' ? null : Number(value)
      response.rawValue = value ?? ''
    } else if (question.type === 'MATCH' || question.type === 'MATCH_MULTIPLE') {
      response.matchMappings = value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value).map(([left, right]) => ({ left, right })).filter(pair => pair.right)
        : []
    } else if (Array.isArray(value)) {
      response.rawValue = value
    } else {
      response.text = value == null ? '' : String(value)
      response.rawValue = value == null ? '' : value
    }

    responseMap[question.sourceQuestionId] = response
  })

  const resultId = `result-${activeSession?.sessionId || Date.now()}-${Date.now()}`
  const result = buildExamResult({
    questions: questions.map(question => {
      if (question.subject) return question
      const section = sections.find(item => item.id === question.sectionRef)
      return {
        ...question,
        subject: section?.subject || section?.category || null,
      }
    }),
    responses: responseMap,
    paper,
    session: {
      ...activeSession,
      resultId,
      sessionId: activeSession?.sessionId || activeSession?.id || null,
      userId: user?.id || activeSession?.userId || null,
      qpFingerprint: questionPaperMeta?.fingerprint || activeSession?.qpFingerprint || null,
    },
  })

  const questionRecords = result.questions.map((questionResult, index) => {
    const sourceQuestion = questions[index]
    const timing = questionTiming[sourceQuestion.sourceQuestionId] || {}

    return {
      ...questionResult,
      originalNumber: sourceQuestion.originalNumber ?? null,
      sessionNumber: sourceQuestion.sessionNumber ?? index + 1,
      type: sourceQuestion.type || questionResult.type || null,
      timeSpentSeconds: Number(questionResult.timing?.totalTimeSeconds || 0),
      selectedResponse: responseMap[sourceQuestion.sourceQuestionId] || null,
      correctResponse: {
        correctOptionIds: Array.isArray(sourceQuestion.answer?.correctOptionIds)
          ? sourceQuestion.answer.correctOptionIds
          : Array.isArray(sourceQuestion.response?.answer?.correctOptionIds)
            ? sourceQuestion.response.answer.correctOptionIds
            : [],
        numericValue: sourceQuestion.answer?.value ?? null,
        numericRange: sourceQuestion.answer?.range ?? null,
        tolerance: sourceQuestion.answer?.tolerance ?? null,
        matchMappings: Array.isArray(sourceQuestion.answer?.mappings)
          ? sourceQuestion.answer.mappings
          : sourceQuestion.answer?.mappings && typeof sourceQuestion.answer.mappings === 'object'
            ? Object.entries(sourceQuestion.answer.mappings).map(([left, right]) => ({ left, right }))
            : [],
      },
      firstViewedAt: timing.firstViewedAt || null,
    }
  })

  const sectionTiming = new Map()
  const subjectTiming = new Map()

  questionRecords.forEach(question => {
    const seconds = Number(question.timeSpentSeconds || 0)
    const sectionKey = question.sectionId || '__unassigned__'
    const sectionName = question.sectionName || sectionKey
    const subjectName = question.subject || 'Unassigned'

    const section = sectionTiming.get(sectionKey) || {
      sectionId: question.sectionId || null,
      sectionName,
      timeSpentSeconds: 0,
    }
    section.timeSpentSeconds += seconds
    sectionTiming.set(sectionKey, section)

    const subject = subjectTiming.get(subjectName) || {
      subject: subjectName,
      timeSpentSeconds: 0,
    }
    subject.timeSpentSeconds += seconds
    subjectTiming.set(subjectName, subject)
  })

  return {
    ...result,
    resultId,
    qpId: activeSession?.qpId || questionPaperMeta?.id || null,
    slotId: activeSession?.slotId || null,
    qpFingerprint: questionPaperMeta?.fingerprint || activeSession?.qpFingerprint || null,
    userId: user?.id || activeSession?.userId || null,
    submittedAt,
    startedAt,
    completionReason: reason,
    // Use the sum of recorded question timings as the attempt's active exam time.
    // Wall-clock time from startedAt to submittedAt can include time spent before
    // answering or away from the exam, which inflated Score and Analysis totals.
    totalTimeSeconds: questionRecords.reduce((sum, item) => sum + Number(item.timeSpentSeconds || 0), 0),
    questionTimeSeconds: questionRecords.reduce((sum, item) => sum + Number(item.timeSpentSeconds || 0), 0),
    sectionTiming: [...sectionTiming.values()],
    subjectTiming: [...subjectTiming.values()],
    questions: questionRecords,
    schemaVersion: '1.0',
  }
}
