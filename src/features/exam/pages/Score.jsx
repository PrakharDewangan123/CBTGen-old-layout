import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function formatPercentage(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%` : '-'
}

function responseText(response) {
  if (!response) return 'Not answered'

  const selected = response.selectedOptionIds || response.selectedOptionId
  if (Array.isArray(selected) && selected.length) return selected.join(', ')
  if (selected != null && String(selected).trim() !== '') return String(selected)

  if (response.numericValue != null && response.numericValue !== '') return String(response.numericValue)

  if (Array.isArray(response.matchMappings) && response.matchMappings.length) {
    return response.matchMappings.map(pair => `${pair.left} → ${pair.right}`).join(', ')
  }

  if (response.text != null && String(response.text).trim() !== '') return String(response.text)
  if (response.rawValue != null && String(response.rawValue).trim() !== '') return String(response.rawValue)

  return 'Not answered'
}

function correctText(question) {
  const answer = question?.correctResponse
  if (!answer) return '—'

  if (Array.isArray(answer.correctOptionIds) && answer.correctOptionIds.length) {
    return answer.correctOptionIds.join(', ')
  }

  if (answer.numericValue != null && answer.numericValue !== '') {
    return String(answer.numericValue)
  }

  if (answer.numericRange?.min != null || answer.numericRange?.max != null) {
    const min = answer.numericRange?.min ?? '−∞'
    const max = answer.numericRange?.max ?? '∞'
    return `${min} to ${max}`
  }

  if (Array.isArray(answer.matchMappings) && answer.matchMappings.length) {
    return answer.matchMappings.map(pair => `${pair.left} → ${pair.right}`).join(', ')
  }

  return '—'
}

function statusLabel(status) {
  switch (status) {
    case 'CORRECT': return 'Correct'
    case 'INCORRECT': return 'Incorrect'
    case 'PARTIAL': return 'Partial'
    case 'UNATTEMPTED': return 'Unattempted'
    case 'REVIEW_REQUIRED': return 'Review required'
    default: return status || 'Unknown'
  }
}

function statusClass(status) {
  switch (status) {
    case 'CORRECT': return 'bg-emerald-50 text-emerald-700'
    case 'INCORRECT': return 'bg-red-50 text-red-700'
    case 'PARTIAL': return 'bg-amber-50 text-amber-700'
    case 'UNATTEMPTED': return 'bg-slate-100 text-slate-600'
    default: return 'bg-violet-50 text-violet-700'
  }
}

function StatCard({ label, value, subtext }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[#0b1020]">{value}</div>
      {subtext && <div className="mt-1 text-xs text-slate-500">{subtext}</div>}
    </div>
  )
}

export default function Score() {
  const navigate = useNavigate()
  const { id: qpId } = useParams()
  const [results, setResults] = useState([])
  const [selectedResultId, setSelectedResultId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [selectedSection, setSelectedSection] = useState('')
  const [paper, setPaper] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const resultList = await cbtgenApi.results.list(qpId || null)
        if (cancelled) return

        const nextResults = Array.isArray(resultList?.results) ? resultList.results : []
        setResults(nextResults)

        const lastResultId = sessionStorage.getItem('cbtgen_last_result_id')
        const preferred = lastResultId && nextResults.some(item => item.resultId === lastResultId)
          ? lastResultId
          : nextResults[0]?.resultId || ''
        setSelectedResultId(preferred)

        if (qpId) {
          const qpResult = await cbtgenApi.questionPapers.get(qpId)
          if (!cancelled && qpResult?.success) setPaper(qpResult.questionPaper || null)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError?.message || 'Unable to load examination scores.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [qpId])

  const selected = useMemo(
    () => results.find(item => item.resultId === selectedResultId) || null,
    [results, selectedResultId],
  )

  const title = paper?.name || selected?.examName || 'CBT Examination'

  const questions = useMemo(() => Array.isArray(selected?.questions) ? selected.questions : [], [selected])
  const sections = useMemo(() => Array.isArray(selected?.sections) ? selected.sections : [], [selected])
  const subjects = useMemo(() => Array.isArray(selected?.subjects) ? selected.subjects : [], [selected])

  const subjectNames = useMemo(() => {
    const names = subjects
      .map(item => String(item.subject || '').trim())
      .filter(Boolean)
    return [...new Set(names)]
  }, [subjects])

  const effectiveSelectedSubject = selectedSubject === null
    ? subjectNames[0] || ''
    : selectedSubject

  const getSectionSubject = section => {
    if (section?.subject) return String(section.subject).trim()
    const name = String(section?.sectionName || '').trim()
    return name.includes('—') ? name.split('—')[0].trim() : name.split(' - ')[0].trim()
  }

  const filteredSections = useMemo(() => {
    return sections.filter(
      section => !effectiveSelectedSubject || getSectionSubject(section) === effectiveSelectedSubject,
    )
  }, [sections, effectiveSelectedSubject])

  const filteredQuestions = useMemo(() => {
    return questions.filter(question => {
      if (effectiveSelectedSubject && String(question.subject || '').trim() !== effectiveSelectedSubject) return false
      if (selectedSection && String(question.sectionName || '').trim() !== selectedSection) return false
      return true
    })
  }, [questions, effectiveSelectedSubject, selectedSection])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-600">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">Loading score…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#0b1020]">Unable to load score</h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button type="button" onClick={() => navigate('/question-papers')} className="mt-5 rounded-xl bg-[#080d1d] px-4 py-2.5 text-sm font-semibold text-white">
            Back to Question Papers
          </button>
        </div>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#0b1020]">No completed attempts</h1>
          <p className="mt-2 text-sm text-slate-500">Complete a practice attempt first. Its recorded result will appear here.</p>
          <button type="button" onClick={() => navigate(qpId ? '/test-configuration' : '/question-papers')} className="mt-5 rounded-xl bg-[#080d1d] px-5 py-3 text-sm font-semibold text-white">
            {qpId ? 'Start Practice' : 'Back to Question Papers'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-10 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button type="button" onClick={() => navigate('/question-papers')} className="mb-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
              ← Question Papers
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-[#0b1020]">Score</h1>
            <p className="mt-1 text-sm text-slate-500">{title}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {qpId && (
              <button type="button" onClick={() => navigate(`/question-papers/${qpId}/analysis`)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Analysis
              </button>
            )}
            <button type="button" onClick={() => navigate('/question-papers')} className="rounded-xl bg-[#080d1d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#11182d]">
              Practice Again
            </button>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recorded attempt</div>
              <div className="mt-1 text-sm font-semibold text-[#0b1020]">Select an attempt to view its individual score.</div>
            </div>
            <select value={selectedResultId} onChange={event => setSelectedResultId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500">
              {results.map(result => (
                <option key={result.resultId} value={result.resultId}>
                  Attempt {result.attemptNumber || '?'} — {formatNumber(result.totalScore)} / {formatNumber(result.maximumScore)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Score" value={`${formatNumber(selected.totalScore)} / ${formatNumber(selected.maximumScore)}`} subtext={formatPercentage(selected.maximumScore ? (selected.totalScore / selected.maximumScore) * 100 : null)} />
          <StatCard label="Accuracy" value={formatPercentage(selected.accuracy)} subtext={`${selected.correctCount || 0} correct / ${selected.attemptedCount || 0} attempted`} />
          <StatCard label="Time taken" value={formatTime(selected.totalTimeSeconds)} subtext={selected.completionReason === 'time-expired' ? 'Time expired' : 'Submitted'} />
          <StatCard label="Questions" value={formatNumber(selected.questionCount)} subtext={`${selected.incorrectCount || 0} incorrect · ${selected.partialCount || 0} partial · ${selected.unattemptedCount || 0} unattempted`} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold text-[#0b1020]">Subject score</h2>
              <p className="mt-1 text-xs text-slate-500">Select a subject to see its sections in the panel beside it.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Accuracy</th><th className="px-5 py-3">Time</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.length ? subjects.map(subject => {
                    const name = subject.subject || 'Unassigned'
                    const active = effectiveSelectedSubject === name
                    return (
                      <tr key={name} className={active ? 'bg-blue-50/60' : ''}>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubject(name)
                              setSelectedSection('')
                            }}
                            className={`text-left font-semibold ${active ? 'text-blue-700' : 'text-slate-700 hover:text-blue-700'}`}
                          >
                            {name}
                          </button>
                        </td>
                        <td className="px-5 py-3">{formatNumber(subject.score)} / {formatNumber(subject.maximumScore)}</td>
                        <td className="px-5 py-3">{formatPercentage(subject.accuracy)}</td>
                        <td className="px-5 py-3">{formatTime(selected.subjectTiming?.find(item => item.subject === subject.subject)?.timeSpentSeconds || 0)}</td>
                      </tr>
                    )
                  }) : <tr><td colSpan="4" className="px-5 py-6 text-center text-slate-400">No subject-level data recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-[#0b1020]">Section score</h2>
                  <p className="mt-1 text-xs text-slate-500">Choose a subject to keep the section list compact.</p>
                </div>
                <select
                  value={effectiveSelectedSubject}
                  onChange={event => {
                    setSelectedSubject(event.target.value)
                    setSelectedSection('')
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="">All subjects</option>
                  {subjectNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-5 py-3">Section</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Accuracy</th><th className="px-5 py-3">Time</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSections.length ? filteredSections.map(section => (
                    <tr key={section.sectionId || section.sectionName || 'section'}>
                      <td className="px-5 py-3 font-semibold text-slate-700">{section.sectionName || 'Unassigned'}</td>
                      <td className="px-5 py-3">{formatNumber(section.score)} / {formatNumber(section.maximumScore)}</td>
                      <td className="px-5 py-3">{formatPercentage(section.accuracy)}</td>
                      <td className="px-5 py-3">{formatTime(selected.sectionTiming?.find(item => item.sectionId === section.sectionId)?.timeSpentSeconds || 0)}</td>
                    </tr>
                  )) : <tr><td colSpan="4" className="px-5 py-6 text-center text-slate-400">No section-level data recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-[#0b1020]">Question-wise result</h2>
                <p className="text-xs text-slate-500">Source question identity is preserved separately from session question numbering.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={effectiveSelectedSubject}
                  onChange={event => {
                    setSelectedSubject(event.target.value)
                    setSelectedSection('')
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="">All subjects</option>
                  {subjectNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select
                  value={selectedSection}
                  onChange={event => setSelectedSection(event.target.value)}
                  disabled={!effectiveSelectedSubject}
                  className="max-w-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">All sections</option>
                  {filteredSections.map(section => <option key={section.sectionId || section.sectionName} value={section.sectionName}>{section.sectionName}</option>)}
                </select>
                <span className="text-xs font-semibold text-slate-400">{filteredQuestions.length} of {questions.length} recorded questions</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Q.</th>
                  <th className="px-4 py-3">Subject / Section</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Selected</th>
                  <th className="px-4 py-3">Correct</th>
                  <th className="px-4 py-3">Marks</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuestions.map(question => (
                  <tr key={`${selected.resultId}-${question.sourceQuestionId}`}>
                    <td className="px-4 py-3 font-bold text-slate-700">{question.sessionNumber || question.originalNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700">{question.subject || 'Unassigned'}</div>
                      <div className="text-xs text-slate-400">{question.sectionName || 'Unassigned section'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{question.type || '-'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(question.status)}`}>{statusLabel(question.status)}</span></td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-600">{responseText(question.selectedResponse || question.response)}</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-600">{correctText(question)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{question.marksAwarded == null ? '—' : formatNumber(question.marksAwarded)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTime(question.timeSpentSeconds || question.timing?.totalTimeSeconds || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
