import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import ImportQuestionPaper from '../components/ImportQuestionPaper'
import { setExamMode, readJson, writeJson, buildResumedSession, requestExamFullscreen } from '../../exam/examEngine/examRuntime'
import { deletePaper, deleteSourcePaper } from '../../../lib/cbtgen/paperStorage'
import { loadTestConfiguration } from '../../exam/services/testConfigurationService'


function QuestionPapers() {
  const navigate = useNavigate()

  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [paperSearch, setPaperSearch] = useState('')
  const [usesPerSlot, setUsesPerSlot] = useState(0)
  const [unlimitedPractice, setUnlimitedPractice] = useState(false)
  const [resultCounts, setResultCounts] = useState({})
  const [practicePaper, setPracticePaper] = useState(null)
  const [resumePaper, setResumePaper] = useState(null)
  const [resumeSessions, setResumeSessions] = useState({})
  const [lifecycleStates, setLifecycleStates] = useState({})
  const [removePaper, setRemovePaper] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const importSectionRef = useRef(null)

  const [demoAllowance, setDemoAllowance] = useState(null)
  const [packSummary, setPackSummary] = useState({
    practiceUsed: 0,
    remaining: 0,
    totalCapacity: 0,
    usedGenerations: 0,
    remainingGenerations: 0,
    totalSlots: 0,
    maxSlots: 0,
  })


  async function loadQuestionPapers() {
    setLoading(true)
    setError('')

    try {
      const [data, account, resultData] = await Promise.all([
        cbtgenApi.questionPapers.list(),
        cbtgenApi.account.get(),
        cbtgenApi.results.list(),
      ])

      const nextPapers = data || []
      const counts = {}
      ;(resultData?.results || []).forEach((result) => {
        if (!result?.qpId) return
        counts[result.qpId] = (counts[result.qpId] || 0) + 1
      })
      setResultCounts(counts)

      const pack = account?.pack || null
      const slots = account?.slots || []
      const summary = account?.summary || {}
      setDemoAllowance(account?.demoAllowance || null)
      const isUnlimited =
        account?.unlimitedPractice === true ||
        account?.user?.unlimitedPractice === true ||
        summary.unlimitedPractice === true

      const lifecycleEntries = await Promise.all(
        nextPapers.map(async (paper) => {
          try {
            const result = await cbtgenApi.questionPapers.getLifecycle(paper.id)
            return [paper.id, result?.lifecycle || null]
          } catch {
            return [paper.id, null]
          }
        }),
      )

      const lifecycleMap = Object.fromEntries(lifecycleEntries)
      setLifecycleStates(lifecycleMap)


      const resumableResults = await Promise.all(
        nextPapers.map(async (paper) => {
          try {
            const result = await cbtgenApi.questionPapers.getResumableSession(paper.id)
            return [paper.id, result?.session || null]
          } catch {
            return [paper.id, null]
          }
        }),
      )

      setResumeSessions(Object.fromEntries(resumableResults))
      setPapers(nextPapers)
      setUnlimitedPractice(isUnlimited)

      setUsesPerSlot(
        account?.pack?.usesPerSlot ?? 0
      )

      setPackSummary({
        practiceUsed:
          summary.practiceUsed ??
          summary.usedGenerations ??
          0,

        remaining: isUnlimited
          ? 'Unlimited'
          : summary.remaining ??
            summary.remainingGenerations ??
            0,

        totalCapacity:
          summary.totalCapacity ??
          0,

        usedGenerations:
          summary.usedGenerations ??
          0,

        remainingGenerations:
          summary.remainingGenerations ??
          0,

        totalSlots:
          slots.filter(
            (slot) => slot.packId === pack?.id
          ).length,

        maxSlots:
          pack?.maxSlots ??
          0,
      })

    } catch (error) {
      console.error(
        'Failed to load question papers:',
        error
      )

      setError(
        'Unable to load your question papers.'
      )

    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuestionPapers()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])


  function addQuestionPaper() {
    setShowImport(true)
  }


  useEffect(() => {
    if (!showImport || !importSectionRef.current) return

    window.requestAnimationFrame(() => {
      importSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [showImport])


  async function handleImported() {
    await loadQuestionPapers()
    setShowImport(false)
  }


  /* =========================================================
     QUESTION PAPER ANALYSIS
  ========================================================= */

  function openPaperDetails(id) {
    navigate(`/question-papers/${id}/analysis`)
  }


  /* =========================================================
     PRACTICE — CONFIRMATION #2
  ========================================================= */

  function openPaper(id) {
    const paper = papers.find((item) => item.id === id)

    if (!paper) {
      alert('Question paper not found.')
      return
    }

    setPracticePaper(paper)
  }

  function cancelPracticeConfirmation() {
    setPracticePaper(null)
  }

  async function confirmPractice() {
    if (!practicePaper) return

    const pendingPractice = {
      qpId: practicePaper.id,
      qpName: practicePaper.name,
      createdAt: new Date().toISOString(),
    }

    sessionStorage.setItem(
      'cbtgen_pending_practice',
      JSON.stringify(pendingPractice),
    )

    // Any stale authorized/session state must never be reused for a new
    // confirmation chain.
    sessionStorage.removeItem('cbtgen_active_session')
    sessionStorage.removeItem('cbtgen_active_usage')
    sessionStorage.removeItem('cbtgen_test_configuration')
    sessionStorage.removeItem('cbtgen_exam_login')
    sessionStorage.removeItem('cbtgen_exam_state')
    sessionStorage.removeItem('cbtgen_test_started_at')

    setPracticePaper(null)
    navigate('/test-configuration')
  }


  function openResumeConfirmation(id) {
    const paper = papers.find((item) => item.id === id)
    const session = resumeSessions[id]
    if (!paper || !session) return
    setResumePaper({ paper, session })
  }

  function cancelResumeConfirmation() {
    setResumePaper(null)
  }

  function openRemoveConfirmation(paper) {
    const lifecycle = lifecycleStates[paper.id]
    if (!lifecycle?.canRemove) return
    setRemovePaper(paper)
  }

  function cancelRemoveConfirmation() {
    if (removeBusy) return
    setRemovePaper(null)
  }

  async function confirmRemove() {
    if (!removePaper || removeBusy) return

    setRemoveBusy(true)
    setError('')

    try {
      const result = await cbtgenApi.questionPapers.remove(removePaper.id)

      if (!result?.success) {
        throw new Error(result?.message || 'The question paper could not be removed.')
      }

      if (removePaper.fingerprint) {
        await deletePaper(removePaper.fingerprint, removePaper.userId).catch(() => {})
      }
      if (removePaper.sourceId) {
        await deleteSourcePaper(removePaper.sourceId, removePaper.userId).catch(() => {})
      }

      setRemovePaper(null)
      await loadQuestionPapers()
    } catch (error) {
      setError(error?.message || 'The question paper could not be removed.')
    } finally {
      setRemoveBusy(false)
    }
  }


  async function confirmResume() {
    if (!resumePaper?.session) return

    const session = resumePaper.session
    const sessionId = session.id || session.sessionId
    const runtime = readJson('cbtgen_exam_runtime')

    if (runtime?.sessionId && runtime.sessionId !== sessionId) {
      // A different session's runtime cannot be reused.
      sessionStorage.removeItem('cbtgen_exam_runtime')
    }

    const runtimeForSession = runtime?.sessionId === sessionId ? runtime : null

    const storedConfiguration = (() => {
      try {
        const rawConfiguration = sessionStorage.getItem('cbtgen_test_configuration')
        return rawConfiguration ? JSON.parse(rawConfiguration) : null
      } catch {
        return null
      }
    })()

    const configurationMatchesSession = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return false
      const candidateFingerprint = candidate?.source?.fingerprint || candidate?.fingerprint || null
      if (!candidateFingerprint || !session?.qpFingerprint) return true
      return String(candidateFingerprint) === String(session.qpFingerprint)
    }

    let configuration =
      session.testConfiguration ||
      runtimeForSession?.config ||
      (configurationMatchesSession(storedConfiguration) ? storedConfiguration : null) ||
      null

    // Backward compatibility for attempts created/resumed by older Phase 26C
    // builds before the final configuration was persisted on the session.
    // Such an attempt is still valid and must be resumable rather than
    // trapping the user in Login -> Instructions -> Login.
    if (!configuration) {
      try {
        const paperResult = await cbtgenApi.questionPapers.get(session.qpId)
        if (paperResult?.success && paperResult.questionPaper) {
          const loaded = await loadTestConfiguration(paperResult.questionPaper)
          configuration = loaded?.config || null
        }
      } catch (error) {
        console.warn('Unable to reconstruct legacy resume configuration:', error)
      }
    }

    if (!configuration) {
      setError('This saved practice attempt is missing its test configuration. Start a new practice attempt after completing the current attempt or contact support.')
      setResumePaper(null)
      return
    }

    const resumedSession = session.status === 'paused'
      ? buildResumedSession({ ...session, sessionId, testConfiguration: configuration })
      : { ...session, sessionId, testConfiguration: configuration }

    const statusMetadata = {
      testConfiguration: configuration,
      configurationSavedAt: new Date().toISOString(),
      ...(session.status === 'paused'
        ? {
            pausedAt: null,
            pauseReason: null,
            totalPausedSeconds: resumedSession.totalPausedSeconds,
            resumedAt: resumedSession.resumedAt,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    }

    try {
      await cbtgenApi.questionPapers.updateSessionStatus(
        sessionId,
        session.status === 'paused' ? 'ready' : session.status,
        statusMetadata,
      )
    } catch (error) {
      console.warn('Unable to persist resumed practice configuration:', error)
    }

    sessionStorage.setItem('cbtgen_active_session', JSON.stringify(resumedSession))
    writeJson('cbtgen_test_configuration', configuration)
    writeJson('cbtgen_exam_runtime', {
      ...(runtimeForSession || {}),
      sessionId,
      qpId: session.qpId,
      config: configuration,
      savedAt: new Date().toISOString(),
    })
    sessionStorage.removeItem('cbtgen_exam_login')
    sessionStorage.removeItem('cbtgen_exam_state')
    sessionStorage.removeItem('cbtgen_test_started_at')

    setExamMode('active')
    await requestExamFullscreen()
    setResumePaper(null)
    navigate('/exam-login')
  }

  const canCreateAnotherSlot =
    packSummary.maxSlots >
    packSummary.totalSlots


  const activePaperCount =
    unlimitedPractice
      ? papers.length
      : papers.filter((paper) => {
          const usage = paper.usage || {}

          return (
            Number(usage.remaining || 0) > 0 ||
            canCreateAnotherSlot
          )
        }).length

  const normalizedPaperSearch = paperSearch.trim().toLowerCase()
  const filteredPapers = normalizedPaperSearch
    ? papers.filter((paper) => String(paper.name || '').toLowerCase().includes(normalizedPaperSearch))
    : papers


  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-[#f8fafc] to-[#f8fafc] px-4 pb-24 pt-28 sm:px-5">

      <div className="mx-auto max-w-7xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="relative mb-8 overflow-hidden rounded-[28px] border border-blue-100 bg-white/90 p-6 shadow-[0_18px_55px_-38px_rgba(37,99,235,0.35)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-90px] right-[24%] h-40 w-40 rounded-full bg-indigo-100/60 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Your practice workspace
              </div>
              <h1 className="text-3xl font-bold tracking-[-0.04em] text-[#0b1020] sm:text-4xl lg:text-[2.65rem]">
                Your question papers. <span className="text-blue-600">Your library.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Keep your papers organized, understand your available practice capacity, and launch a CBT session when you are ready.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5">XML · ZIP · CBTGen</span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5">Practice tracking</span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5">Paper readiness</span>
              </div>
            </div>
            <button
              type="button"
              onClick={addQuestionPaper}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#080d1d] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-blue-600/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              <span className="text-lg leading-none" aria-hidden="true">+</span>
              Add Question Paper
            </button>
          </div>
        </section>


        {demoAllowance && (
          <section className="mb-8 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50 p-5 shadow-sm sm:p-6" aria-label="Free Demo allowance">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl" aria-hidden="true">🎁</div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Your Free Demo</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{demoAllowance.remaining} demo {demoAllowance.remaining === 1 ? 'generation' : 'generations'} remaining</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Free forever for this account: ₹0, with 2 lifetime generations. Demo selection prioritizes question-type and renderer diversity. Your paid practice slots are separate.</p>
                </div>
              </div>
              <div className="shrink-0 rounded-xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Free Demo price</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">₹0</div>
                <div className="text-xs text-slate-500">{demoAllowance.used} of {demoAllowance.allowed} used</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-emerald-100">Max 3 subjects</span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-emerald-100">Max 3 sections per subject</span>
              <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-emerald-100">Paid plan unaffected</span>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-100">Demo generation setup in progress</span>
            </div>
          </section>
        )}

        {/* =================================================
            IMPORT
        ================================================= */}

        {showImport && (
          <section ref={importSectionRef} className="mb-8 scroll-mt-24">

            <div className="mb-3 flex items-center justify-between gap-4">

              <div>

                <h2 className="text-xl font-bold text-[#0b1020]">
                  Import Question Paper
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select an original question paper to begin the internal import workflow.
                </p>

              </div>


              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>

            </div>


            <ImportQuestionPaper
              onImported={handleImported}
            />

          </section>
        )}


        {/* =================================================
            OVERVIEW
        ================================================= */}

        <section className="mb-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <OverviewCard
            label="Question Papers"
            value={papers.length}
            description="Unique papers in your library"
          />

          <OverviewCard
            label="Practice Used"
            value={packSummary.practiceUsed}
            description="Generations used"
          />

          <OverviewCard
            label="Remaining"
            value={packSummary.remaining}
            description="Available generations"
          />

          <OverviewCard
            label="Active Papers"
            value={activePaperCount}
            description="Papers currently available"
          />

        </section>


        {/* =================================================
            QUESTION PAPERS
        ================================================= */}

        <section>

          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Paper collection</div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-[#0b1020] sm:text-2xl">My Question Papers</h2>
              <p className="mt-1 text-sm text-slate-500">Search and open papers in your personal library.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="relative block min-w-0 flex-1 sm:min-w-[250px]">
                <span className="sr-only">Search question papers by name</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
                <input value={paperSearch} onChange={(event) => setPaperSearch(event.target.value)} placeholder="Search papers by name…" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              </label>
              <button type="button" onClick={addQuestionPaper} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:hidden">
                + Import paper
              </button>
            </div>
          </div>


          {loading ? (

            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">

              <p className="text-sm font-semibold text-slate-600">
                Loading your question papers...
              </p>

            </div>

          ) : error ? (

            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">

              <p className="text-sm font-semibold text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={loadQuestionPapers}
                className="mt-4 rounded-lg bg-[#080d1d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#11182d]"
              >
                Try Again
              </button>

            </div>

          ) : papers.length === 0 ? (

            <EmptyLibrary
              onAdd={addQuestionPaper}
            />

          ) : filteredPapers.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">No papers match “{paperSearch}”</h3>
              <p className="mt-1 text-sm text-slate-500">Try another paper name or clear your search.</p>
              <button type="button" onClick={() => setPaperSearch('')} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear search</button>
            </div>

          ) : (

            <div className="grid gap-5 lg:grid-cols-2">

              {filteredPapers.map((paper) => (

                <QuestionPaperCard
                  key={paper.id}
                  paper={paper}
                  usesPerSlot={usesPerSlot}
                  canCreateAnotherSlot={
                    canCreateAnotherSlot
                  }
                  unlimitedPractice={unlimitedPractice}
                  maxSlots={packSummary.maxSlots}
                  onOpen={() =>
                    openPaper(paper.id)
                  }
                  onDetails={() =>
                    openPaperDetails(paper.id)
                  }
                  onScore={() =>
                    navigate(`/question-papers/${paper.id}/score`)
                  }
                  hasResults={Number(resultCounts[paper.id] || 0) > 0}
                  resumableSession={resumeSessions[paper.id] || null}
                  onResume={() => openResumeConfirmation(paper.id)}
                  lifecycle={lifecycleStates[paper.id] || null}
                  onRemove={() => openRemoveConfirmation(paper)}
                />

              ))}

            </div>

          )}

        </section>


        {/* =================================================
            WORKFLOW
        ================================================= */}

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">

          <div className="mb-7">

            <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              CBTGen workflow
            </div>

            <h2 className="mt-2 text-xl font-bold text-[#0b1020]">
              From your question paper to CBT practice
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Upload your original question paper. CBTGen will process the document internally, validate extracted content, and prepare it for practice. The source-document processing engine is still being connected.
            </p>

          </div>


          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

            <WorkflowStep
              number="01"
              title="Get the source"
              text="Use your own PDF, document, scan, image, or other question paper."
            />

            <WorkflowStep
              number="02"
              title="Extract content"
              text="CBTGen will identify questions, options, answers, equations, and diagrams internally."
            />

            <WorkflowStep
              number="03"
              title="Validate and review"
              text="Check extracted content and review uncertain text, answers, or image crops before saving."
            />

            <WorkflowStep
              number="04"
              title="Practice"
              text="Configure your CBT session and practice using the examination interface."
            />

            <WorkflowStep
              number="05"
              title="Analysis & Compare"
              text="Review completed results, explore subject-wise performance when available, and compare your attempts to track progress."
            />

          </div>

        </section>

      </div>


      <ConfirmDialog
        open={Boolean(practicePaper)}
        title="Practice Question Paper"
        message={`Do you want to practice ‘${practicePaper?.name || ''}’?`}
        onCancel={cancelPracticeConfirmation}
        onConfirm={confirmPractice}
      />

      <ConfirmDialog
        open={Boolean(removePaper)}
        title="Remove Question Paper"
        message={`Do you want to remove ‘${removePaper?.name || ''}’ from your library? This is allowed only because this paper has never been practiced. No practice usage will be consumed or refunded.`}
        confirmLabel="Remove"
        onCancel={cancelRemoveConfirmation}
        onConfirm={confirmRemove}
        busy={removeBusy}
      />

      <ConfirmDialog
        open={Boolean(resumePaper)}
        title="Resume Practice"
        message={`Do you want to resume ‘${resumePaper?.paper?.name || ''}’? Your recorded answers and exam details will be restored. This attempt has used ${Number(resumePaper?.session?.pauseCount || 0)} of 5 pause opportunities; ${Math.max(0, 5 - Number(resumePaper?.session?.pauseCount || 0))} pause${Math.max(0, 5 - Number(resumePaper?.session?.pauseCount || 0)) === 1 ? '' : 's'} will remain after you resume.`}
        onCancel={cancelResumeConfirmation}
        onConfirm={confirmResume}
      />

    </main>
  )
}


/* =========================================================
   OVERVIEW CARD
========================================================= */

function OverviewCard({
  label,
  value,
  description,
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_24px_-22px_rgba(15,23,42,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_32px_-24px_rgba(37,99,235,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white" aria-hidden="true">
          {label === 'Question Papers' ? '▤' : label === 'Practice Used' ? '↗' : label === 'Remaining' ? '◷' : '✓'}
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-[#0b1020]">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
    </div>
  )
}


/* =========================================================
   QUESTION PAPER CARD
========================================================= */

function QuestionPaperCard({
  paper,
  usesPerSlot,
  canCreateAnotherSlot,
  unlimitedPractice,
  maxSlots,
  onOpen,
  onDetails,
  onScore,
  hasResults,
  resumableSession,
  onResume,
  lifecycle,
  onRemove,
}) {
  const usage =
    paper.usage || {}

  const slotCount =
    Number(usage.slotCount || 0)

  const used =
    Number(usage.used || 0)

  const totalUsage =
    Number(usage.limit || 0)

  const remaining =
    usage.remaining == null
      ? null
      : Number(usage.remaining)


  const hasSlot =
    slotCount > 0

  const hasRemainingUse =
    Number(remaining || 0) > 0

  const hasUnfinishedAttempt = Boolean(resumableSession)

  const canPractice =
    !hasUnfinishedAttempt &&
    (unlimitedPractice ||
      hasRemainingUse ||
      canCreateAnotherSlot)


  const percentage =
    unlimitedPractice
      ? 0
      : totalUsage > 0
        ? Math.min(
            100,
            Math.round(
              (used / totalUsage) * 100
            )
          )
        : 0


  let usageLabel =
    `0/${usesPerSlot}`

  let capacityLabel =
    maxSlots > 0
      ? `QP has used: ${slotCount}/${maxSlots} slots`
      : 'No slots configured'


  if (unlimitedPractice) {
    usageLabel = 'Unlimited development access'
    capacityLabel = 'Unlimited'
  } else if (hasSlot) {
    usageLabel = `${used}/${totalUsage}`
  }


  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">

        <div>

          <div className="mb-2 flex flex-wrap gap-2">

            <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600">
              {paper.category}
            </span>

            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
              {paper.year}
            </span>

          </div>

          <h3 className="break-words text-lg font-bold text-[#0b1020]">
            {paper.name}
          </h3>

        </div>


        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onScore}
            disabled={!hasResults}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              hasResults
                ? 'border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'cursor-not-allowed border-slate-100 text-slate-300'
            }`}
          >
            Score
          </button>
          {lifecycle?.canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              Remove
            </button>
          )}

          <button
            type="button"
            onClick={onDetails}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Analysis
          </button>
        </div>

      </div>


      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

        <MetaItem
          label="Questions"
          value={paper.questions}
        />

        <MetaItem
          label="Marks"
          value={paper.marks}
        />

        <MetaItem
          label="Duration"
          value={
            paper.duration == null || paper.duration === ''
              ? '-'
              : paper.duration
          }
        />

        <MetaItem
          label="Sections"
          value={paper.sections}
        />

      </div>


      <div className="mt-5 border-t border-slate-100 pt-5">

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Question Types
        </div>

        <div className="flex flex-wrap gap-2">

          {(paper.questionTypes || []).map(
            (type) => (
              <span
                key={type}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
              >
                {type}
              </span>
            )
          )}

        </div>

      </div>


      <div className="mt-5 rounded-xl bg-slate-50 p-4">

        <div className="flex items-center justify-between gap-4">

          <div>

            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Practice usage
            </div>

            <div className="mt-1 text-sm font-bold text-[#0b1020]">
              {usageLabel}
            </div>

            {slotCount > 1 && (
              <div className="mt-1 text-[11px] text-slate-400">
                {slotCount} slots assigned to this paper
              </div>
            )}


          </div>


          <div className="text-right text-sm font-bold text-blue-600">
            {capacityLabel}
          </div>

        </div>


        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">

          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{
              width: `${percentage}%`,
            }}
          />

        </div>

      </div>


      {resumableSession ? (
        <>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Pause / Resume: {Number(resumableSession.pauseCount || 0)} of 5 pauses used · {Math.max(0, 5 - Number(resumableSession.pauseCount || 0))} remaining
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onResume}
            className="rounded-xl bg-[#080d1d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#11182d]"
          >
            Resume →
          </button>
          <button
            type="button"
            onClick={onOpen}
            disabled={!canPractice}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              canPractice
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400'
            }`}
          >
            {hasUnfinishedAttempt ? 'Resume Required' : 'New Practice'}
          </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          disabled={!canPractice}
          className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
            canPractice
              ? 'bg-[#080d1d] text-white hover:bg-[#11182d]'
              : 'cursor-not-allowed bg-slate-100 text-slate-400'
          }`}
        >
          {canPractice
            ? 'Practice Question Paper →'
            : 'Recharge Required'}
        </button>
      )}

    </article>
  )
}


/* =========================================================
   META
========================================================= */

function MetaItem({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-slate-700">
        {value}
      </div>

    </div>
  )
}


/* =========================================================
   WORKFLOW
========================================================= */

function WorkflowStep({
  number,
  title,
  text,
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">

      <div className="text-xs font-bold text-blue-600">
        {number}
      </div>

      <h3 className="mt-3 text-sm font-bold text-[#0b1020]">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {text}
      </p>

    </div>
  )
}


/* =========================================================
   EMPTY LIBRARY
========================================================= */

function EmptyLibrary({ onAdd }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">

      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
        +
      </div>

      <h3 className="mt-5 text-lg font-bold text-[#0b1020]">
        Your question paper library is empty
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Add your original question paper. Internal extraction and conversion will prepare it for CBT practice.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-6 rounded-xl bg-[#080d1d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#11182d]"
      >
        + Add Question Paper
      </button>

    </div>
  )
}


export default QuestionPapers