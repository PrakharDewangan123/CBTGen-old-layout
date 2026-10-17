import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/Examination.css'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import { buildSubmissionResult } from '../examEngine/submission'
import { QuestionContent, ResponseRenderer } from '../components/ExamQuestionRenderer'
import { SubjectButtons, SectionButtons } from '../components/ExamNavigation'
import { CandidateAvatar, InfoAction, InfoModal, CalculatorModal, Legend, Badge, LoadingScreen, ErrorScreen, SubmissionScreen } from '../components/ExamUi'
import { parseDurationMinutes, formatTime, getAnswerValue, answerIsPresent, getPartialMarkingDisplay, getPartialMarkingRule } from '../examEngine/examUtils'
import { useExamSession } from '../hooks/useExamSession'
import { useExamViewModel } from '../hooks/useExamViewModel'
import { useExamNavigation } from '../hooks/useExamNavigation'
import { useExamAnswers } from '../hooks/useExamAnswers'
import { useExamTimer } from '../hooks/useExamTimer'
import { buildPausedSession, getPauseState, MAX_PAUSES_PER_ATTEMPT, getRuntime, saveRuntime, setExamMode, clearRuntime } from '../examEngine/examRuntime'

/*
 * CBTGen Examination
 * ------------------
 * The visual shell intentionally follows the user's independently-built CBT
 * interface. The data/session layer below plugs CBTGen's real QP/session model
 * into that UI without changing the visual system.
 *
 * Important identity rules:
 * - sourceQuestionId / originalNumber are source-layer identities.
 * - sessionNumber is presentation-layer numbering only.
 * - answer/review state is keyed by sourceQuestionId, never by displayed number.
 * - option labels are presentation-only; option IDs remain stable.
 * - randomization is deterministic for the current session, so reloads do not
 *   silently create a different paper order.
 */


function PausedExamScreen({ pauseCount = 0 }) {
  return (
    <div className="cbt-exam-root exam-state-screen">
      <strong>Exam Paused</strong>
      <span>Your exam has been safely paused and your recorded entries have been saved.</span>
      <span>One resume is available for this paused attempt. Resuming does not consume another pause opportunity.</span>
      <span>Pauses used: {pauseCount}/{MAX_PAUSES_PER_ATTEMPT} · Pauses remaining: {Math.max(0, MAX_PAUSES_PER_ATTEMPT - pauseCount)}</span>
      <span>Go to Question Papers to resume this attempt.</span>
    </div>
  )
}

export default function Examination() {
  const {
    status,
    setStatus,
    error,
    setError,
    paper,
    questionPaperMeta,
    activeSession,
    config,
    user,
    questions,
  } = useExamSession()

  const [curIndex, setCurIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [review, setReview] = useState({})
  const [visited, setVisited] = useState(new Set())
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [modal, setModal] = useState(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calculatorValue, setCalculatorValue] = useState('0')
  const [calculatorMemory, setCalculatorMemory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [runtimeHydrated, setRuntimeHydrated] = useState(false)
  const navigate = useNavigate()
  const submittedRef = useRef(false)
  const pauseState = getPauseState(activeSession)

  const {
    current,
    sections,
    activeSection,
    setActiveSection,
    currentSection,
    sectionQuestions,
    counts,
    countsBySection,
    subjectGroups,
    countsBySubject,
    activeSubjectName,
    activeSubjectSections,
  } = useExamViewModel({ paper, questions, answers, review, visited, questionPaperMeta, curIndex })

  const durationMinutes = parseDurationMinutes(
    config?.duration ?? questionPaperMeta?.duration ?? paper?.exam?.durationMinutes,
  )

  const {
    questionTimingRef,
    recordCurrentQuestionTime,
    goToQuestion,
    changeSection,
    goNext,
  } = useExamNavigation({
    questions,
    sections,
    curIndex,
    current,
    setCurIndex,
    setActiveSection,
    setVisited,
    setModal,
  })

  const { setAnswer, toggleReviewAndNext, clearResponse } = useExamAnswers({
    current,
    submittedRef,
    setAnswers,
    setReview,
    goNext,
  })


  useEffect(() => {
    if (!activeSession?.sessionId || !questions.length || runtimeHydrated) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return

      const runtime = getRuntime(activeSession.sessionId)
      const restoredIndex = runtime && Number.isInteger(runtime.curIndex)
        ? runtime.curIndex
        : 0
      const restoredVisited = new Set(runtime?.visited || [])
      const initialQuestion = questions[restoredIndex] || questions[0]

      // The initially displayed question counts as visited after restoration.
      if (initialQuestion?.sourceQuestionId) {
        restoredVisited.add(initialQuestion.sourceQuestionId)
      }

      if (runtime) {
        setAnswers(runtime.answers || {})
        setReview(runtime.review || {})
        setVisited(restoredVisited)
        setCurIndex(restoredIndex)
        if (runtime.navCollapsed !== undefined) {
          setNavCollapsed(Boolean(runtime.navCollapsed))
        }
        if (runtime.questionTiming) {
          questionTimingRef.current = runtime.questionTiming
        }
      } else {
        setVisited(restoredVisited)
        setCurIndex(restoredIndex)
      }

      setRuntimeHydrated(true)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeSession, questions, runtimeHydrated, questionTimingRef])

  useEffect(() => {
    if (!runtimeHydrated || !activeSession?.sessionId) return

    saveRuntime({
      sessionId: activeSession.sessionId,
      qpId: activeSession.qpId,
      config,
      answers,
      review,
      visited: [...visited],
      curIndex,
      questionTiming: questionTimingRef.current,
      navCollapsed,
      savedAt: new Date().toISOString(),
    })
  }, [
    runtimeHydrated,
    activeSession,
    config,
    answers,
    review,
    visited,
    curIndex,
    navCollapsed,
    questionTimingRef,
  ])

  function requestPauseExam() {
    if (!activeSession || submittedRef.current || submitting || pauseState.pausesRemaining <= 0) return
    setModal('pause')
  }

  const pauseExam = useCallback(async (reason = 'manual') => {
    if (!activeSession || submittedRef.current || submitting) return
    if (reason === 'manual' && pauseState.pausesRemaining <= 0) return

    recordCurrentQuestionTime()

    const pausedSession = buildPausedSession({
      ...activeSession,
      startedAt: activeSession.startedAt || sessionStorage.getItem('cbtgen_test_started_at'),
    }, reason)

    sessionStorage.setItem('cbtgen_active_session', JSON.stringify(pausedSession))
    sessionStorage.setItem('cbtgen_exam_state', JSON.stringify(pausedSession))
    saveRuntime({
      sessionId: pausedSession.sessionId || pausedSession.id,
      qpId: pausedSession.qpId,
      config,
      answers,
      review,
      visited: [...visited],
      curIndex,
      questionTiming: questionTimingRef.current,
      navCollapsed,
      savedAt: new Date().toISOString(),
    })

    setExamMode('paused')

    try {
      await cbtgenApi.questionPapers.updateSessionStatus(
        pausedSession.sessionId || pausedSession.id,
        'paused',
        {
          startedAt: pausedSession.startedAt || null,
          pausedAt: pausedSession.pausedAt,
          pauseReason: pausedSession.pauseReason,
          totalPausedSeconds: pausedSession.totalPausedSeconds,
          updatedAt: new Date().toISOString(),
        },
      )
    } catch {
      // Local session state remains authoritative for this development build.
    }

    navigate('/question-papers', { replace: true })
  }, [
    activeSession,
    submitting,
    pauseState.pausesRemaining,
    recordCurrentQuestionTime,
    config,
    answers,
    review,
    visited,
    curIndex,
    questionTimingRef,
    navCollapsed,
    navigate,
  ])

  useEffect(() => {
    if (status !== 'ready' || !activeSession || submittedRef.current) return undefined

    const onVisibilityChange = () => {
      if (document.hidden) pauseExam('interruption')
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [
    status,
    activeSession,
    pauseExam,
  ])

  async function submitExam(reason = 'manual') {
    if (submittedRef.current || submitting) return
    submittedRef.current = true
    setSubmitting(true)

    recordCurrentQuestionTime()

    try {
      const finalResult = buildSubmissionResult({
        reason,
        questions,
        answers,
        review,
        visited,
        paper,
        sections,
        activeSession,
        questionPaperMeta,
        user,
        questionTiming: questionTimingRef.current,
      })
      const saveResult = await cbtgenApi.results.save(finalResult)
      if (!saveResult?.success) {
        throw new Error(saveResult?.message || 'Unable to save the examination result.')
      }

      sessionStorage.setItem('cbtgen_exam_submission', JSON.stringify(finalResult))
      sessionStorage.setItem('cbtgen_exam_state', JSON.stringify({ ...activeSession, status: 'completed', submittedAt: finalResult.submittedAt, resultId: finalResult.resultId }))
      sessionStorage.setItem('cbtgen_last_result_id', finalResult.resultId)
      setExamMode('completed')
      clearRuntime()
      setSubmitted(true)
      setModal(null)
    } catch (submitError) {
      submittedRef.current = false
      setError(submitError?.message || 'Unable to record the examination result.')
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  useExamTimer({
    status,
    activeSession,
    durationMinutes,
    submittedRef,
    submitExam,
    setRemainingSeconds,
  })

  const state = question => {
    const value = answers[question.sourceQuestionId]
    const A = answerIsPresent(question, value)
    const R = !!review[question.sourceQuestionId]
    return A && R ? 'ar' : R ? 'r' : A ? 'a' : visited.has(question.sourceQuestionId) ? 'na' : 'nv'
  }

  if (status === 'loading') return <LoadingScreen />
  if (status === 'error') return <ErrorScreen message={error} />
  if (status === 'paused') return <PausedExamScreen pauseCount={pauseState.pauseCount} />
  if (submitted) return <SubmissionScreen questionCount={questions.length} qpId={activeSession?.qpId || questionPaperMeta?.id || paper?.id || ''} />
  if (!current) return <ErrorScreen message="No active question is available." />

  const examName = questionPaperMeta?.name || paper?.exam?.name || 'CBT Examination'
  const candidateName = user?.name || 'Candidate'
  const candidateEmail = user?.email || ''

  return (
    <div className="cbt-exam-root screen">
      <div className="frame">
        <header className="header">
          <button className="header-pause" type="button" onClick={requestPauseExam} disabled={submitting || pauseState.pausesRemaining <= 0}>Pause Exam</button>
          <span className="exam-brand-title"><img src="/cbtgen-monogram-dark.png" alt="" aria-hidden="true" className="exam-brand-mark" />CBTGen</span>
        </header>

        <div className="exam-strip">
          <span>{examName}</span>
          <div className="exam-tools">
            <InfoAction icon="ⓘ" label="Instructions" onClick={() => setModal('instructions')} />
            <InfoAction icon="▣" label="Question Paper" onClick={() => setModal('paper')} />
          </div>
        </div>

        <div className="pre-question">
          <div className="pre-left">
            <SubjectButtons
              countsBySubject={countsBySubject}
              subjects={subjectGroups}
              activeSubjectName={activeSubjectName}
              onSelectSubject={changeSection}
              onCalculator={() => setCalculatorOpen(true)}
            />

            <div className="section-strip">
              <strong>Sections</strong>
              <strong className="timer">Time Left : {formatTime(remainingSeconds)}</strong>
            </div>

            <SectionButtons
              sections={activeSubjectSections}
              activeSection={activeSection}
              countsBySection={countsBySection}
              onSelect={changeSection}
            />
          </div>

          <div className="candidate-panel">
            <CandidateAvatar photo={user?.photo || user?.avatar || user?.avatarUrl} />
            <div>
              <strong>{candidateName}</strong>
              <small>{candidateEmail}</small>
            </div>
          </div>
        </div>

        <div className={'body ' + (navCollapsed ? 'nav-is-collapsed' : '')}>
          <section className="main">
            <div className="type-row">
              <strong>Question Type : {current.type || 'QUESTION'}</strong>
              <span>
                Marks for correct answer : <em className="positive">{current.marking?.correct ?? 0}</em>
                &nbsp;|&nbsp; Negative Marks : <em className="negative">{current.marking?.incorrect ?? 0}</em>
                {getPartialMarkingDisplay(current.marking) && (
  <>&nbsp;|&nbsp; Partial Marks : <em className="partial" title={getPartialMarkingRule(current.marking)}>{getPartialMarkingDisplay(current.marking)}</em></>
)}
              </span>
            </div>

            <div className="qno"><strong>Question No. : {current.sessionNumber}</strong></div>

            <div className="question">
              <QuestionContent question={current} />
              <ResponseRenderer question={current} value={getAnswerValue(answers[current.sourceQuestionId], current)} onChange={setAnswer} />
            </div>

            <div className="actions">
              <button className="mark-action" onClick={toggleReviewAndNext} disabled={submitting}>
                Mark for Review and next
              </button>
              <button className="clear-action" onClick={clearResponse} disabled={submitting}>
                Clear Response
              </button>
              <div className="push">
                <button className="save" onClick={goNext} disabled={submitting}>Save &amp; Next</button>
              </div>
              <button className="mobile-submit" onClick={() => setModal('submit')} disabled={submitting}>Submit</button>
            </div>
          </section>

          <aside className="right-nav">
              <div className="mobile-candidate">
                <CandidateAvatar photo={user?.photo || user?.avatar || user?.avatarUrl} />
                <div>
                  <strong>{candidateName}</strong>
                  <small>{candidateEmail}</small>
                </div>
              </div>

              <div className="legend">
                <Legend cls="a" n={counts.a} t="Answered" />
                <Legend cls="na" n={counts.na} t="Not Answered" />
                <Legend cls="nv" n={counts.nv} t="Not Visited" />
                <Legend cls="r" n={counts.r} t="Marked for Review" />
                <div className="wide">
                  <Badge cls="ar" n={counts.ar} />
                  <small>Answered &amp; Marked for Review<br />(will also be evaluated)</small>
                </div>
              </div>

              <div className="palette">
                <div className="phead">{currentSection?.name || 'Questions'}</div>
                <div className="psub">Choose a Question</div>
                <div className="grid">
                  {sectionQuestions.map(question => (
                    <button
                      key={question.sourceQuestionId}
                      aria-label={`Question ${question.sessionNumber}`}
                      className={'p ' + state(question) + (question.sourceQuestionId === current.sourceQuestionId ? ' current' : '')}
                      onClick={() => goToQuestion(question)}
                    >
                      <span className="question-number">{question.sessionNumber}</span>
                    </button>
                  ))}
                </div>
              </div>
          </aside>

          <div className="right-submit-strip">
            <button onClick={() => setModal('submit')} disabled={submitting}>Submit</button>
          </div>

          <button
            type="button"
            className={'collapse ' + (navCollapsed ? 'is-collapsed' : '')}
            aria-label={navCollapsed ? 'Show question palette' : 'Collapse question palette'}
            onClick={() => setNavCollapsed(value => !value)}
          >
            <span aria-hidden="true">{navCollapsed ? '‹' : '›'}</span>
          </button>

        </div>

        <footer>CBTGen</footer>

        {modal === 'pause' && (
          <div className="modal-bg">
            <div className="modal">
              <h3>Pause Examination</h3>
              <p>Pausing will use 1 of your {MAX_PAUSES_PER_ATTEMPT} pause opportunities for this attempt.</p>
              <p><strong>{Math.max(0, pauseState.pausesRemaining - 1)} pause{pauseState.pausesRemaining - 1 === 1 ? '' : 's'} remaining after this pause.</strong></p>
              <div>
                <button onClick={() => setModal(null)} disabled={submitting}>Cancel</button>
                <button className="primary" onClick={() => { setModal(null); pauseExam('manual') }} disabled={submitting}>Pause Exam</button>
              </div>
            </div>
          </div>
        )}

        {modal === 'submit' && (
          <div className="modal-bg">
            <div className="modal">
              <h3>Submit Examination</h3>
              <p>{remainingSeconds === 0 ? 'The examination time has ended.' : 'Are you sure you want to submit the examination?'}</p>
              <div>
                {remainingSeconds > 0 && <button onClick={() => setModal(null)} disabled={submitting}>Cancel</button>}
                <button className="primary" onClick={() => submitExam(remainingSeconds === 0 ? 'time-expired' : 'manual')} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal === 'instructions' && (
          <InfoModal title="Instructions" onClose={() => setModal(null)}>
            <p>Answer questions using the controls shown in the examination area.</p>
            <p><strong>Question Palette</strong> uses the following symbols:</p>
            <div className="instruction-legend">
              <Legend cls="nv" n={1} t="You have NOT visited the question yet." />
              <Legend cls="na" n={1} t="You have NOT answered the question." />
              <Legend cls="a" n={1} t="You have answered the question. This will be evaluated." />
              <Legend cls="r" n={1} t="You have NOT answered the question but marked it for review." />
              <div className="wide"><Badge cls="ar" n={1} /><small>You have answered the question and marked it for review. This will also be evaluated.</small></div>
            </div>
            <p><strong>Save &amp; Next</strong> records the response and moves forward.</p>
            <p><strong>Mark for Review and next</strong> marks the current question and moves forward.</p>
            <p>The displayed question number is the randomized session number; source question identity remains unchanged internally.</p>
          </InfoModal>
        )}

        {modal === 'paper' && (
          <InfoModal title="Question Paper" onClose={() => setModal(null)}>
            <p><strong>{examName}</strong></p>
            <p>Questions: {questions.length}</p>
            <p>Sections: {sections.length}</p>
            <p>Duration: {durationMinutes || '—'} minutes</p>
          </InfoModal>
        )}

        {calculatorOpen && (
          <CalculatorModal
            value={calculatorValue}
            setValue={setCalculatorValue}
            memory={calculatorMemory}
            setMemory={setCalculatorMemory}
            onClose={() => setCalculatorOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
