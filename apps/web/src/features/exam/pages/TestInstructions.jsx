import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CollapseArrow } from '../components/ExamReferenceControls'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import { readJson } from '../examEngine/examRuntime'
import { getPaperForQuestionPaper, getSourcePaper } from '../../../lib/cbtgen/paperStorage'
import { loadTestConfiguration } from '../services/testConfigurationService'
import {
  findConfiguredSection,
  findConfiguredType,
  resolveInstructionMarking,
} from '../services/instructionMarking'
import '../styles/TestInstructions.css'

function TestInstructions() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [session, setSession] = useState(null)
  const [paper, setPaper] = useState(null)
  const [xmlText, setXmlText] = useState('')
  const [questionPaperMeta, setQuestionPaperMeta] = useState(null)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInstructions() {
      try {
        const rawConfig = sessionStorage.getItem('cbtgen_test_configuration')
        const rawSession = sessionStorage.getItem('cbtgen_active_session')
        const rawLogin = sessionStorage.getItem('cbtgen_exam_login')
        const runtime = readJson('cbtgen_exam_runtime')

        let parsedSession = rawSession
          ? JSON.parse(rawSession)
          : null

        // A paused/resumed attempt can outlive the transient sessionStorage
        // object. Recover the authoritative unfinished session before failing.
        if (!parsedSession?.id && runtime?.qpId) {
          const resumable = await cbtgenApi.questionPapers.getResumableSession(runtime.qpId)
          if (resumable?.success && resumable.session) {
            parsedSession = resumable.session
          }
        }

        if (!parsedSession) {
          throw new Error('No active practice session was found.')
        }

        let parsedConfig = rawConfig
          ? JSON.parse(rawConfig)
          : parsedSession?.testConfiguration || runtime?.config || null

        // A stale active-session object from an older build may have the same
        // attempt ID but lack the newer persisted configuration. Refresh the
        // authoritative unfinished session before attempting QP reconstruction.
        if (!parsedConfig && parsedSession?.qpId) {
          try {
            const resumable = await cbtgenApi.questionPapers.getResumableSession(parsedSession.qpId)
            if (resumable?.success && resumable.session) {
              parsedSession = resumable.session
              parsedConfig = parsedSession.testConfiguration || null
            }
          } catch (resumeLookupError) {
            console.warn('Unable to refresh the authoritative resumable session:', resumeLookupError)
          }
        }

        // Repair the transient browser key when configuration was recovered
        // from the authoritative session/runtime. This makes the Login ->
        // Instructions flow resilient to refreshes and stale sessionStorage.
        if (!rawConfig) {
          sessionStorage.setItem(
            'cbtgen_test_configuration',
            JSON.stringify(parsedConfig),
          )
        }

        if (!rawLogin) {
          navigate('/exam-login', { replace: true })
          return
        }

        const parsedLogin = JSON.parse(rawLogin)

        if (parsedLogin?.loggedIn !== true) {
          navigate('/exam-login', { replace: true })
          return
        }

        if (!parsedSession?.id || !parsedSession?.qpId) {
          throw new Error('The active practice session is invalid.')
        }

        const qpResult = await cbtgenApi.questionPapers.get(
          parsedSession.qpId,
        )

        if (!qpResult?.success || !qpResult.questionPaper) {
          throw new Error('The question paper could not be loaded.')
        }

        sessionStorage.setItem(
          'cbtgen_active_qp_meta',
          JSON.stringify(qpResult.questionPaper),
        )

        // Legacy recovery: attempts created before Phase 26C configuration
        // persistence may have neither session.testConfiguration nor runtime
        // configuration. Rebuild the configuration from the authoritative QP
        // instead of trapping the candidate in Login -> Instructions -> Login.
        if (!parsedConfig) {
          const recovered = await loadTestConfiguration(qpResult.questionPaper)
          parsedConfig = recovered?.config || null
        }

        if (!parsedConfig) {
          throw new Error('Test configuration could not be recovered for this practice session.')
        }

        // Persist the recovered configuration back onto the existing attempt.
        // This is repair/resume only: it does not authorize another attempt or
        // consume usage.
        if (!parsedSession.testConfiguration || !rawConfig) {
          const sessionId = parsedSession.id || parsedSession.sessionId
          if (sessionId) {
            try {
              const status = parsedSession.status || 'ready'
              const repaired = await cbtgenApi.questionPapers.updateSessionStatus(
                sessionId,
                status,
                {
                  testConfiguration: parsedConfig,
                  configurationSavedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              )
              if (repaired?.session) {
                parsedSession = repaired.session
              }
            } catch (repairError) {
              console.warn('Unable to persist recovered test configuration:', repairError)
            }
          }
        }

        sessionStorage.setItem(
          'cbtgen_active_session',
          JSON.stringify({ ...parsedSession, testConfiguration: parsedConfig }),
        )
        sessionStorage.setItem(
          'cbtgen_test_configuration',
          JSON.stringify(parsedConfig),
        )

        let localPaper = await getPaperForQuestionPaper(
          qpResult.questionPaper,
        )

        // Source-only papers (for example the stress-test without an answer key)
        // live in the sourcePapers store. Resolve them here as well.
        if (!localPaper?.paper && qpResult.questionPaper?.sourceId) {

          localPaper = await getSourcePaper(qpResult.questionPaper.sourceId, qpResult.questionPaper.userId)
        }

        if (cancelled) return

        setConfig(parsedConfig)
        setSession({
          ...parsedSession,
          testConfiguration: parsedConfig,
        })
        setQuestionPaperMeta(qpResult.questionPaper)
        setPaper(localPaper?.paper || null)
        setXmlText(localPaper?.xmlText || '')
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError(
            err?.message ||
            'Unable to load test instructions.',
          )
        }
      }
    }

    loadInstructions()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const summary = useMemo(
    () => buildInstructionSummary(config, paper, questionPaperMeta, xmlText),
    [config, paper, questionPaperMeta, xmlText],
  )

  function startTest() {
    if (!config || !session) return

    const startedAt = new Date().toISOString()

    sessionStorage.setItem(
      'cbtgen_test_started_at',
      startedAt,
    )

    const examState = {
      ...session,
      sessionId: session.sessionId || session.id,
      qpId: session.qpId,
      qpFingerprint:
        session.qpFingerprint ||
        questionPaperMeta?.fingerprint ||
        null,
      slotId: session.slotId ?? null,
      // A newly started attempt must get a fresh start timestamp. Reusing the
      // session's creation/start timestamp can make time-taken include hours or
      // days spent on the instructions page or between visits. Preserve the
      // original start only when continuing an explicitly paused session.
      startedAt: session.status === 'paused' && session.startedAt
        ? session.startedAt
        : startedAt,
      status: session.status === 'paused' ? 'paused' : 'ready',
      totalPausedSeconds: Number(session.totalPausedSeconds || 0),
      pauseCount: Number(session.pauseCount || 0),
      resumeCount: Number(session.resumeCount || 0),
      pausesRemaining: Math.max(0, 5 - Number(session.pauseCount || 0)),
      pausedAt: session.pausedAt || null,
    }

    sessionStorage.setItem(
      'cbtgen_exam_state',
      JSON.stringify(examState),
    )

    navigate('/examination')
  }

  if (error) {
    return (
      <div className="reference-instructions-page">
        <div className="reference-error">
          {error}
        </div>

        <button
          type="button"
          className="reference-error-button"
          onClick={() => navigate('/exam-login', { replace: true })}
        >
          Return to Exam Login
        </button>
      </div>
    )
  }

  if (!config || !session) {
    return (
      <div className="reference-instructions-page">
        <div className="reference-loading">
          Loading instructions...
        </div>
      </div>
    )
  }

  const testName =
    questionPaperMeta?.name ||
    config.testName ||
    paper?.exam?.name ||
    'Computer Science and Information Technology'

  const subject =
    questionPaperMeta?.category ||
    config.subject ||
    paper?.exam?.name ||
    testName

  const paperCode =
    config.paperCode ||
    questionPaperMeta?.paperNumber ||
    'CS2'

  const duration =
    Number(config.duration) > 0
      ? Number(config.duration)
      : Number(questionPaperMeta?.duration) > 0
        ? Number(questionPaperMeta.duration)
        : 100

  const hasPaperData =
    Boolean(paper?.questions?.length) ||
    Boolean(summary.questionCount)

  return (
    <div className="reference-instructions-page">
      <header className="reference-instructions-header">
        <strong>{testName}</strong>
        <span>Paper Code: {paperCode}</span>
      </header>

      <div className="reference-instructions-layout">
        <main
          className={`reference-instructions-main ${
            collapsed ? 'is-collapsed' : ''
          }`}
        >
          <div className="reference-instructions-title">
            Instructions
          </div>

          <div className="reference-instructions-scroll">
            <section className="instruction-section">
              <h2>General Instructions</h2>

              <p>
                <strong>
                  Please read the following carefully.
                </strong>
              </p>

              <ol
                className="instruction-numbered-list"
                style={{
                  listStyleType: 'decimal',
                  listStylePosition: 'outside',
                  paddingLeft: '28px',
                  marginTop: '8px',
                }}
              >
                <li>
                  The duration of the examination is{' '}
                  <strong>{duration} minutes</strong>.
                  The countdown timer at the top-right displays
                  the time available to complete the examination.
                </li>

                <li>
                  When the timer reaches zero, the examination
                  will end automatically.
                </li>

                <li>
                  This question paper contains{' '}
                  <strong>
                    {summary.sections.length} section(s)
                  </strong>{' '}
                  and{' '}
                  <strong>
                    {summary.questionCount} question(s)
                  </strong>.
                </li>

                <li>
                  The <strong>Question Palette</strong> shows
                  the status of each question using one of the
                  following symbols.

                  <div className="instruction-legend-table">
                    <div>
                      <LegendBadge state="nv" number="1" />
                      <span>
                        You have NOT visited the question yet.
                      </span>
                    </div>

                    <div>
                      <LegendBadge state="na" number="2" />
                      <span>
                        You have NOT answered the question.
                      </span>
                    </div>

                    <div>
                      <LegendBadge state="a" number="3" />
                      <span>
                        You have answered the question.{' '}
                        <strong>
                          This will be evaluated.
                        </strong>
                      </span>
                    </div>

                    <div>
                      <LegendBadge state="r" number="4" />
                      <span>
                        You have NOT answered the question but
                        marked it for review.
                      </span>
                    </div>

                    <div>
                      <LegendBadge state="ar" number="5" />
                      <span>
                        You have answered the question and marked
                        it for review.{' '}
                        <strong>
                          This will also be evaluated.
                        </strong>
                      </span>
                    </div>
                  </div>
                </li>

                <li>
                  Click on{' '}
                  <span className="reference-inline-arrow">
                    ›
                  </span>{' '}
                  to collapse the Question No. panel and maximize
                  the question window. To undo, click on{' '}
                  <span className="reference-inline-arrow">
                    ‹
                  </span>.
                </li>

                <li>
                  A <strong>scientific calculator</strong> is
                  available on the left of your image.
                </li>

                <li>
                  <strong>Marking:</strong> Marking is determined
                  from the question-paper configuration shown
                  below. Different question categories may use
                  different marking schemes.
                </li>

                <li>
                  <strong>Scribble Pad:</strong> You may use the
                  scribble pad provided in the examination hall
                  for rough work. Write your name and registration
                  number on the scribble pad before using it. You
                  can possess ONLY one scribble pad at any point
                  of time. You may ask for a second scribble pad
                  only after returning the first one to the
                  invigilator. Return the scribble pad in your
                  possession to the invigilator at the end of the
                  examination.
                </li>
              </ol>

              <h3>Question Paper Overview</h3>

              <table className="reference-paper-table reference-overview-table">
                <colgroup>
                  <col className="overview-col-subject" />
                  <col className="overview-col-sections" />
                  <col className="overview-col-questions" />
                  <col className="overview-col-section-names" />
                  <col className="overview-col-marks" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>No. of Sections</th>
                    <th>No. of Questions</th>
                    <th>Sections</th>
                    <th>Maximum Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.subjects.length > 0 ? (
                    summary.subjects.map((item, index) => (
                      <tr key={`${item.name}-${index}`}>
                        <td>{item.name}</td>
                        <td>{item.sectionCount}</td>
                        <td>{item.questionCount}</td>
                        <td>
                          <div className="overview-section-list">
                            {item.sectionNames.map((name, sectionIndex) => (
                              <span key={`${name}-${sectionIndex}`}>{name}</span>
                            ))}
                          </div>
                        </td>
                        <td>{item.maxMarks}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        No subject/section structure is available in the loaded question paper.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="reference-note">
                <strong>Paper total:</strong>{' '}
                {summary.subjects.length} subject(s),{' '}
                {summary.sections.length} section(s),{' '}
                {summary.questionCount} question(s),{' '}
                {summary.maxMarks} maximum mark(s).
              </div>

              <h3>Marking</h3>

              <p>
                Marking is configured independently for every
                question category. If the same question type has
                different marking schemes,{' '}
                <strong>
                  each scheme is shown separately
                </strong>.
              </p>

              <table className="reference-paper-table">
                <thead>
                  <tr>
                    <th>Question Type</th>
                    <th>No. of Questions</th>
                    <th>Marking Scheme</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.grouped.length > 0 ? (
                    summary.grouped.map((row, index) => (
                      <tr key={`${row.key}-${index}`}>
                        <td>
                          {typeLabel(row.type)}
                          {row.schemeIndex > 1 && (
                            <> <strong>(Category {row.schemeIndex})</strong></>
                          )}
                        </td>
                        <td>{row.count}</td>
                        <td>{markingText(row)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3">
                        No question-level marking information is
                        available for this paper.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="reference-note">
                <strong>
                  Maximum configured marks:
                </strong>{' '}
                {summary.maxMarks}
              </div>

              <h3>Question Types</h3>

              {summary.questionTypes.length > 0 ? (
                summary.questionTypes.map((type) => (
                  <p key={type}>
                    <strong>{typeLabel(type)}:</strong>{' '}
                    {typeHelp(type)}
                  </p>
                ))
              ) : (
                <p>
                  Question-type information is not available in
                  the loaded question paper.
                </p>
              )}

              <h3>Paper Specific Instructions</h3>

              {summary.sections.length > 0 ? (
                summary.sections.map((section, index) => (
                  <div
                    className="reference-section-card"
                    key={`${section.id || section.name}-${index}`}
                  >
                    <div className="reference-section-heading">
                      {section.name || `Section ${index + 1}`} —{' '}
                      {sectionQuestionCount(section)} question(s)
                    </div>

                    <table className="reference-paper-table compact">
                      <thead>
                        <tr>
                          <th>Question Type</th>
                          <th>No. of Questions</th>
                          <th>Marking Scheme</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(section.types || []).length > 0 ? (
                          section.types.map((row, rowIndex) => (
                            <tr
                              key={`${row.type}-${rowIndex}`}
                            >
                              <td>{typeLabel(row.type)}</td>
                              <td>{row.count || 0}</td>
                              <td>{markingText(row)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3">
                              No question-type breakdown is
                              available for this section.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (
                <div className="reference-note">
                  No section structure was found in the loaded
                  question paper.
                </div>
              )}

              {!hasPaperData && (
                <div className="reference-note">
                  The question paper content is not available
                  locally. Metadata from the test configuration is
                  being used where possible.
                </div>
              )}

              {String(config.additional ?? '').trim() && (
                <>
                  <h3>Additional Instructions</h3>
                  <div className="reference-additional">
                    {config.additional}
                  </div>
                </>
              )}

              <h3>Navigating and Answering</h3>

              <ol
                className="instruction-numbered-list"
                style={{
                  listStyleType: 'decimal',
                  listStylePosition: 'outside',
                  paddingLeft: '28px',
                  marginTop: '8px',
                }}
              >
                <li>
                  Use the <strong>Save &amp; Next</strong> button to save the current response
                  and move to the next question when available.
                </li>
                <li>
                  Use the <strong>Mark for Review &amp; Next</strong> button to mark a question
                  for review when available.
                </li>
                <li>
                  Use the question number/palette to navigate
                  directly to a question.
                </li>
                <li>
                  Use the appropriate answer control for the
                  question type.
                </li>
              </ol>
            </section>
          </div>

          <div className="reference-bottom-actions">
            <button type="button" onClick={startTest}>
              I am ready to begin
            </button>
          </div>
        </main>

        <aside className="reference-summary">
          <h2>Test Summary</h2>
          <SummaryRow label="Test" value={testName} />
          <SummaryRow label="Subject" value={subject} />
          <SummaryRow label="Duration" value={`${duration} min`} />
          <SummaryRow
            label="Sections"
            value={summary.sections.length}
          />
          <SummaryRow
            label="Questions"
            value={summary.questionCount}
          />
          <SummaryRow
            label="Max Marks"
            value={summary.maxMarks}
          />
        </aside>

        <CollapseArrow
          collapsed={collapsed}
          onClick={() => setCollapsed((value) => !value)}
        />
      </div>

      <footer className="reference-instructions-footer">
        CBTGen
      </footer>
    </div>
  )
}

function buildInstructionSummary(config, paper, questionPaperMeta, xmlText = '') {
  const configSections = Array.isArray(config?.sections)
    ? config.sections
    : []

  const questions = Array.isArray(paper?.questions)
    ? paper.questions
    : []

  const paperSections = Array.isArray(paper?.sections)
    ? paper.sections
    : []

  const questionCount =
    questions.length > 0
      ? questions.length
      : Number(config?.totalQuestions || questionPaperMeta?.questions || 0)

  const sectionDefinitions = []

  if (paperSections.length > 0) {
    paperSections.forEach((section, index) => {
      sectionDefinitions.push({
        id:
          section.id ||
          section.sectionId ||
          `section-${index + 1}`,
        name:
          section.name ||
          section.title ||
          `Section ${index + 1}`,
        subject:
          section.subject ||
          section.subjectName ||
          null,
        questionCount: 0,
        declaredMarks: Number(section.totalMarks || 0),
        types: [],
      })
    })
  } else if (configSections.length > 0) {
    configSections.forEach((section, index) => {
      sectionDefinitions.push({
        id:
          section.id ||
          section.sectionId ||
          `section-${index + 1}`,
        name:
          section.name ||
          `Section ${index + 1}`,
        subject:
          section.subject ||
          section.subjectName ||
          null,
        questionCount: 0,
        declaredMarks: Number(section.totalMarks || section.declaredMarks || 0),
        types: [],
      })
    })
  } else if (questions.length > 0) {
    const ids = [
      ...new Set(
        questions.map(
          (question) =>
            question.sectionRef ||
            question.sectionId ||
            '__default__',
        ),
      ),
    ]

    ids.forEach((id, index) => {
      sectionDefinitions.push({
        id,
        name:
          id === '__default__'
            ? `Section ${index + 1}`
            : String(id),
        subject: null,
        questionCount: 0,
        declaredMarks: 0,
        types: [],
      })
    })
  }

  // The normalized section model may not carry a separate subject field.
  // The source XML names these sections as e.g. "Mathematics — SECTION 1".
  // Recover the subject from that authoritative section name instead of collapsing
  // all 225 sections into one synthetic subject.
  sectionDefinitions.forEach((section) => {
    if (!section.subject) {
      section.subject = extractSubjectFromSectionName(section.name)
    }

    const configuredSection = findConfiguredSection(section)
    if (Number(section.declaredMarks || 0) <= 0 && configuredSection) {
      section.declaredMarks = Number(configuredSection.declaredMarks || 0)
    }
  })

  // Preserve partial-marking rules from the original XML. The normalized paper
  // model stores numeric marking, but partial rules are textual XML metadata.
  const xmlPartialRules = parsePartialRulesFromXml(xmlText)

  function getSection(question) {
    const id =
      question.sectionRef ||
      question.sectionId ||
      '__default__'

    let section = sectionDefinitions.find(
      (item) =>
        item.id === id ||
        item.name === id,
    )

    if (!section && id === '__default__' && sectionDefinitions.length === 1) {
      section = sectionDefinitions[0]
    }

    if (!section) {
      section = {
        id,
        name:
          id === '__default__'
            ? `Section ${sectionDefinitions.length + 1}`
            : String(id),
        subject:
          question.subject ||
          question.subjectName ||
          null,
        questionCount: 0,
        declaredMarks: 0,
        types: [],
      }

      sectionDefinitions.push(section)
    }

    return section
  }

  if (questions.length > 0) {
    questions.forEach((question) => {
      const section = getSection(question)
      const questionSubject =
        question.subject ||
        question.subjectName ||
        null

      if (!section.subject && questionSubject) {
        section.subject = questionSubject
      }

      section.questionCount = Number(section.questionCount || 0) + 1

      const type = question.type || 'QUESTION'
      const marking = question.marking || {}
      const configuredSection = findConfiguredSection(configSections, section)
      const configuredType = findConfiguredType(configuredSection, type)
      const resolvedMarking = resolveInstructionMarking(
        marking,
        configuredType,
        xmlPartialRules.get(question.sourceQuestionId || question.id) || '',
      )

      const correct = resolvedMarking.correct
      const wrong = resolvedMarking.wrong
      const partial = resolvedMarking.partial
      const partialRule = resolvedMarking.partialRule

      const existing = section.types.find(
        (row) =>
          row.type === type &&
          sameNumber(row.correct, correct) &&
          sameNumber(row.wrong, wrong) &&
          sameNumber(row.partial, partial) &&
          String(row.partialRule || '') === String(partialRule || ''),
      )

      if (existing) {
        existing.count += 1
      } else {
        section.types.push({
          type,
          count: 1,
          correct,
          wrong,
          partial,
          partialRule,
        })
      }
    })
  }

  /*
   * If question-level marking is unavailable, preserve the configured
   * section/type information instead of inventing values.
   */
  if (questions.length === 0) {
    configSections.forEach((configSection, index) => {
      const target =
        sectionDefinitions[index] ||
        sectionDefinitions.find(
          (section) =>
            section.name === configSection.name,
        )

      if (!target) return

      target.types = (configSection.types || []).map(
        (row) => ({
          type: row.type || 'QUESTION',
          count: Number(row.count || 0),
          correct: row.correct,
          wrong: row.wrong,
          partial: row.partial,
          partialRule: row.partialRule || row.partialRules || '',
        }),
      )

      target.questionCount = target.types.reduce(
        (sum, row) => sum + Number(row.count || 0),
        0,
      )

      if (!target.subject) {
        target.subject =
          configSection.subject ||
          configSection.subjectName ||
          null
      }
    })
  }

  const fallbackTypes = configSections.flatMap(
    (section) => section.types || [],
  )

  const grouped = []

  sectionDefinitions.forEach((section) => {
    section.types.forEach((row) => {
      const key = `${row.type}|${row.correct}|${row.wrong}|${row.partial}|${row.partialRule || ''}`
      const existing = grouped.find(
        (item) => item.key === key,
      )

      if (existing) {
        existing.count += Number(row.count || 0)
      } else {
        grouped.push({
          ...row,
          count: Number(row.count || 0),
          key,
          schemeIndex: 1,
        })
      }
    })
  })

  grouped.forEach((row) => {
    const sameTypeRows = grouped.filter(
      (item) => item.type === row.type,
    )

    row.schemeIndex =
      sameTypeRows.findIndex(
        (item) => item.key === row.key,
      ) + 1
  })

  const fallbackGrouped = grouped.length > 0
    ? grouped
    : fallbackTypes.map((row, index) => ({
        ...row,
        count: Number(row.count || 0),
        key: `${row.type}-${index}`,
        schemeIndex: 1,
      }))

  const calculatedMarks = fallbackGrouped.reduce(
    (sum, row) =>
      sum +
      Number(row.count || 0) *
      Number(row.correct || 0),
    0,
  )

  const maxMarks = firstNumber(
    config?.maxMarks,
    paper?.totals?.maximumMarks,
    paper?.totals?.maxMarks,
    questionPaperMeta?.marks,
    calculatedMarks,
  )

  const questionTypes = [
    ...new Set(
      fallbackGrouped
        .map((row) => row.type)
        .filter(Boolean),
    ),
  ]

  const explicitSubjects = Array.isArray(paper?.subjects)
    ? paper.subjects
    : Array.isArray(config?.subjects)
      ? config.subjects
      : []

  const fallbackSubjectName =
    config?.subject ||
    questionPaperMeta?.category ||
    paper?.exam?.subject ||
    paper?.exam?.name ||
    questionPaperMeta?.name ||
    'Imported'

  const subjects = []

  // Prefer the subject recovered from the authoritative section names.
  // This prevents a single generic category such as "Imported" from
  // collapsing a 15-subject paper into one row.
  const namedSubjects = [
    ...new Set(
      sectionDefinitions
        .map((section) => section.subject)
        .filter(Boolean),
    ),
  ]

  if (namedSubjects.length > 0) {
    namedSubjects.forEach((name) => {
      const subjectSections = sectionDefinitions.filter(
        (section) => section.subject === name,
      )
      subjects.push(buildSubjectOverview(name, subjectSections, maxMarks))
    })
  } else if (explicitSubjects.length > 0) {
    explicitSubjects.forEach((subject, index) => {
      const name =
        typeof subject === 'string'
          ? subject
          : subject?.name ||
            subject?.title ||
            `Subject ${index + 1}`

      const subjectSections = sectionDefinitions.filter(
        (section) =>
          !section.subject ||
          section.subject === name ||
          section.subjectId === subject?.id,
      )

      subjects.push(buildSubjectOverview(name, subjectSections, maxMarks))
    })
  } else {
    subjects.push(
      buildSubjectOverview(
        fallbackSubjectName,
        sectionDefinitions,
        maxMarks,
      ),
    )
  }

  return {
    sections: sectionDefinitions,
    questionCount,
    grouped: fallbackGrouped,
    maxMarks,
    questionTypes,
    subjects,
  }
}

function extractSubjectFromSectionName(name) {
  const text = String(name || '').trim()
  const match = text.match(/^(.+?)\s*[—–-]\s*SECTION\s+\d+\s*$/i)
  return match ? match[1].trim() : null
}

function parsePartialRulesFromXml(xmlText) {
  const rules = new Map()
  if (typeof xmlText !== 'string' || !xmlText.trim()) return rules

  try {
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
    if (xml.querySelector('parsererror')) return rules

    Array.from(xml.querySelectorAll('questions > question')).forEach((question) => {
      const id = question.getAttribute('id')
      if (!id) return

      const rule =
        question.querySelector('partialMarking > scheme')?.textContent?.trim() ||
        question.querySelector('partialMarking > rule')?.textContent?.trim() ||
        question.querySelector('marking > partialMarking > scheme')?.textContent?.trim() ||
        question.querySelector('marking > partialMarking > rule')?.textContent?.trim() ||
        question.querySelector('marking > partialMarking')?.textContent?.trim() ||
        ''

      if (rule) rules.set(id, rule.replace(/\s+/g, ' ').trim())
    })
  } catch {
    // Keep the display conservative when the source XML cannot be parsed.
  }

  return rules
}

function buildSubjectOverview(name, sections, overallMaxMarks) {
  const questionCount = sections.reduce(
    (sum, section) => sum + sectionQuestionCount(section),
    0,
  )

  const calculatedMarks = sections.reduce(
    (sum, section) =>
      sum +
      (section.types || []).reduce(
        (sectionSum, row) =>
          sectionSum +
          Number(row.count || 0) * Number(row.correct || 0),
        0,
      ),
    0,
  )

  const declaredMarks = sections.reduce(
    (sum, section) => sum + Number(section.declaredMarks || 0),
    0,
  )

  return {
    name,
    sectionCount: sections.length,
    questionCount,
    sectionNames: sections.map(
      (section) => section.name || 'Unnamed Section',
    ),
    maxMarks: declaredMarks > 0
      ? declaredMarks
      : sections.length === 1
        ? Number(overallMaxMarks || calculatedMarks || 0)
        : calculatedMarks,
  }
}


function firstNumber(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value)
    }
  }

  return 0
}

function sameNumber(a, b) {
  return Number(a || 0) === Number(b || 0)
}

function SummaryRow({ label, value }) {
  return (
    <div className="reference-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function sectionQuestionCount(section) {
  if (Number.isFinite(Number(section?.questionCount)) && Number(section.questionCount) > 0) {
    return Number(section.questionCount)
  }

  return (section.types || []).reduce(
    (sum, item) =>
      sum + (Number(item.count) || 0),
    0,
  )
}

function typeLabel(type) {
  const labels = {
    MCQ: 'Multiple Choice Question (MCQ)',
    MSQ: 'Multiple Select Question (MSQ)',
    NAT: 'Numerical Answer Type (NAT)',
    MATCH: 'Match the Following',
    MATCH_MULTIPLE: 'Match the Following',
    MATRIX: 'Matrix Match',
    MATRIX_MULTI: 'Matrix Match',
    ORDERING: 'Ordering',
    RANKING: 'Ranking',
    TRUE_FALSE: 'True / False',
    YES_NO: 'Yes / No',
    TEXT_INPUT: 'Text Input',
    TEXT_SHORT: 'Short Text',
    TEXT_LONG: 'Long Text',
    ESSAY: 'Essay',
    SUBJECTIVE: 'Subjective',
  }

  return labels[type] || type || 'Question'
}

function typeHelp(type) {
  if (type === 'MCQ') {
    return 'MCQ has one correct answer. Select one option. Any configured negative marking is deducted for an incorrect response.'
  }

  if (type === 'MSQ') {
    return 'MSQ may have one or more correct options. Select the applicable options. Partial or negative marking is applied only when configured.'
  }

  if (type === 'NAT') {
    return 'Enter the numerical answer in the answer field/keypad. Any configured partial or negative marking applies.'
  }

  if (type === 'MATCH' || type === 'MATCH_MULTIPLE') {
    return 'Match the applicable items using the response controls provided. The configured marking scheme applies.'
  }

  if (type === 'TRUE_FALSE') {
    return 'Select either True or False. The configured marking scheme applies.'
  }

  if (type === 'YES_NO') {
    return 'Select either Yes or No. The configured marking scheme applies.'
  }

  if (type === 'SUBJECTIVE') {
    return 'Enter the subjective/text response. Evaluation follows the configured marking scheme.'
  }

  return 'Answer using the controls provided. The marking scheme configured for this question category applies.'
}

function markingText(row) {
  const correct = Number(row.correct || 0)
  const wrong = Number(row.wrong || 0)
  const partial = Number(row.partial || 0)

  const wrongText =
    wrong > 0
      ? `-${wrong}`
      : String(wrong)

  const partialRule = String(row.partialRule || '').replace(/\s+/g, ' ').trim()
  const partialText =
    partial !== 0
      ? `${partial > 0 ? '+' : ''}${partial}`
      : partialRule
        ? formatPartialRuleForDisplay(partialRule)
        : '-'

  return `Correct: +${correct} | Wrong: ${wrongText} | Partial: ${partialText}`
}

function formatPartialRuleForDisplay(rule) {
  const text = String(rule || '').replace(/\s+/g, ' ').trim()
  if (!text) return '-'

  // Keep the source-established rule visible instead of reducing it to a
  // single numeric value. This is especially important for MSQ.
  return text
}

function LegendBadge({ state, number }) {
  return (
    <span className={`instruction-status-badge instruction-status-${state || 'nv'}`} aria-hidden="true">
      <span>{number}</span>
    </span>
  )
}

export default TestInstructions
