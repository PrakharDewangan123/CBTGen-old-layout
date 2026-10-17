import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'


export default function QuestionPaperDetails() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [paper, setPaper] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPracticeConfirmation, setShowPracticeConfirmation] = useState(false)


  useEffect(() => {
    let active = true

    async function loadPaper() {
      try {
        const result = await cbtgenApi.questionPapers.get(id)

        if (!result?.success || !result.questionPaper) {
          throw new Error(
            result?.message || 'Question paper not found.'
          )
        }

        if (!active) return

        setPaper(result.questionPaper)
        setUsage(result.usage || null)
      } catch (loadError) {
        if (!active) return

        console.error(
          'Failed to load question paper analysis:',
          loadError
        )

        setError(
          loadError?.message ||
          'Unable to load scoring and analysis.'
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (id) {
      loadPaper()
    }

    return () => {
      active = false
    }
  }, [id])


  function goBack() {
    navigate('/question-papers')
  }


  function startPractice() {
    if (!paper) return
    setShowPracticeConfirmation(true)
  }

  function cancelPractice() {
    setShowPracticeConfirmation(false)
  }

  function confirmPractice() {
    if (!paper) return

    sessionStorage.setItem(
      'cbtgen_pending_practice',
      JSON.stringify({
        qpId: paper.id,
        qpName: paper.name,
        createdAt: new Date().toISOString(),
      }),
    )

    sessionStorage.removeItem('cbtgen_active_session')
    sessionStorage.removeItem('cbtgen_active_usage')
    sessionStorage.removeItem('cbtgen_test_configuration')
    sessionStorage.removeItem('cbtgen_exam_login')
    sessionStorage.removeItem('cbtgen_exam_state')
    sessionStorage.removeItem('cbtgen_test_started_at')

    setShowPracticeConfirmation(false)
    navigate('/test-configuration')
  }



  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 pb-24 pt-28">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-600">
            Loading scoring and analysis...
          </p>
        </div>
      </main>
    )
  }


  if (error || !paper) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 pb-24 pt-28">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
          <h1 className="text-xl font-bold text-red-800">
            Unable to open this question paper
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {!id ? 'Question paper ID is missing.' : error || 'Question paper not found.'}
          </p>

          <button
            type="button"
            onClick={goBack}
            className="mt-6 rounded-xl bg-[#080d1d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#11182d]"
          >
            Back to Question Papers
          </button>
        </div>
      </main>
    )
  }


  const slotCount = Number(usage?.slotCount || 0)
  const used = Number(usage?.used || 0)
  const limit = Number(usage?.limit || 0)
  const usageText = usage?.unlimited
    ? 'Unlimited development access'
    : limit > 0
      ? `${used}/${limit} generations used`
      : slotCount > 0
        ? `${used} generations used`
        : 'No practice generation used yet'


  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 pb-24 pt-28">
      <div className="mx-auto max-w-7xl">

        <button
          type="button"
          onClick={goBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#0b1020]"
        >
          <span aria-hidden="true">←</span>
          Back to Question Papers
        </button>


        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600">
                  {paper.category}
                </span>

                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {paper.year}
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-[#0b1020] sm:text-4xl">
                Scoring &amp; Analysis
              </h1>

              <p className="mt-2 text-lg font-semibold text-slate-700">
                {paper.name}
              </p>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review your performance for this question paper. Scoring is based on the question-level marking rules defined by the CBTGen source paper.
              </p>
            </div>

            <button
              type="button"
              onClick={startPractice}
              className="shrink-0 rounded-xl bg-[#080d1d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#11182d]"
            >
              Practice Question Paper →
            </button>
          </div>
        </section>


        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Best Score"
            value="—"
            description="No completed attempt recorded"
          />

          <SummaryCard
            label="Attempts"
            value="—"
            description="Attempt history is not available yet"
          />

          <SummaryCard
            label="Accuracy"
            value="—"
            description="Calculated from completed attempts"
          />

          <SummaryCard
            label="Practice Usage"
            value={usageText}
            description={
              slotCount > 1
                ? `${slotCount} slots assigned to this paper`
                : 'Usage for this question paper'
            }
          />
        </section>


        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2 sm:p-8">
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Performance
              </div>

              <h2 className="mt-2 text-xl font-bold text-[#0b1020]">
                Scoring history
              </h2>
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl font-bold text-slate-400 shadow-sm">
                —
              </div>

              <h3 className="mt-4 text-base font-bold text-[#0b1020]">
                No completed scoring result yet
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Complete a CBT practice attempt for this paper. Once result history is available, this area will show score trends, accuracy, correct/incorrect/unattempted counts, and section performance.
              </p>
            </div>
          </div>


          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Question paper
            </div>

            <h2 className="mt-2 text-xl font-bold text-[#0b1020]">
              Paper summary
            </h2>

            <div className="mt-6 space-y-3">
              <DetailRow label="Questions" value={paper.questions} />
              <DetailRow label="Maximum marks" value={paper.marks} />
              <DetailRow
                label="Duration"
                value={
                  paper.duration == null || paper.duration === ''
                    ? '-'
                    : `${paper.duration} min`
                }
              />
              <DetailRow label="Sections" value={paper.sections} />
              <DetailRow
                label="Question types"
                value={(paper.questionTypes || []).join(', ') || '-'}
              />
            </div>
          </div>
        </section>

      </div>

      <ConfirmDialog
        open={showPracticeConfirmation}
        title="Practice Question Paper"
        message={`Do you want to practice ‘${paper?.name || ''}’?`}
        onCancel={cancelPractice}
        onConfirm={confirmPractice}
      />

    </main>
  )
}


function SummaryCard({ label, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-3 break-words text-2xl font-bold text-[#0b1020]">
        {value}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </div>
    </div>
  )
}


function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="text-right text-sm font-semibold text-slate-700">
        {value}
      </span>
    </div>
  )
}
