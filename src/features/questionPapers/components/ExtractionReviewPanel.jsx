import { useMemo, useRef, useState } from 'react'
import PdfVisualCropReview from './PdfVisualCropReview'
import { cropPdfRegions } from '../services/documentProcessingApi'

/**
 * Human review surface for an extraction/segmentation report.
 * This component does not save papers or generate CBTGen packages. A trusted parent
 * must supply the report and perform authenticated persistence after approval.
 */
function ExtractionReviewPanel({ report, sourceFile, onApprove, onCancel, busy = false }) {
  const initialQuestions = useMemo(() => (report?.segmentation?.questions || []).map((question) => ({
    ...question,
    include: true,
    reviewed: false,
    type: String(question.type || question.questionType || '').toUpperCase(),
    textCandidate: String(question.textCandidate || ''),
    imageAsset: question.imageAsset || null,
    options: (question.options || []).map((option) => ({
      ...option,
      include: true,
      reviewed: false,
      textCandidate: String(option.textCandidate || ''),
      imageAsset: option.imageAsset || null,
    })),
  })), [report])
  const [questions, setQuestions] = useState(initialQuestions)
  const reviewItemRefs = useRef(new Map())
  const lastReviewElementRef = useRef(null)
  const [lastReviewTarget, setLastReviewTarget] = useState('')
  const [batchPending, setBatchPending] = useState(false)
  const [batchMessage, setBatchMessage] = useState('')
  const [batchCandidates, setBatchCandidates] = useState({})

  const warnings = report?.warnings || report?.segmentation?.warnings || []
  const includedQuestions = questions.filter((question) => question.include)
  const cropNeedsReview = (asset) => !asset ||
    asset.reviewStatus !== 'human-reviewed' ||
    asset.labelExclusionConfirmed !== true
  const cropPendingCount = includedQuestions.reduce((count, question) =>
    count + (cropNeedsReview(question.imageAsset) ? 1 : 0) +
    question.options.filter((option) => option.include && cropNeedsReview(option.imageAsset)).length, 0)
  const pendingCount = includedQuestions.reduce((count, question) => {
    const pendingOptions = question.options.filter((option) => option.include && !option.reviewed).length
    const missingType = !['MCQ', 'MSQ'].includes(question.type) ? 1 : 0
    return count + (!question.reviewed ? 1 : 0) + pendingOptions + missingType
  }, 0)

  function updateQuestion(questionId, patch) {
    setQuestions((current) => current.map((question) => question.questionId === questionId ? { ...question, ...patch } : question))
  }

  function updateOption(questionId, optionId, patch) {
    setQuestions((current) => current.map((question) => question.questionId !== questionId ? question : {
      ...question,
      options: question.options.map((option) => option.optionId === optionId ? { ...option, ...patch } : option),
    }))
  }

  async function generateCropPreviews() {
    if (batchPending || busy || !sourceFile || !/\.pdf$/i.test(sourceFile.name)) {
      setBatchMessage('Choose the original PDF before generating crop previews.')
      return
    }

    const proposals = report?.cropProposals?.proposals
    const sourceSha256 = report?.source?.sha256
    if (!Array.isArray(proposals) || !/^[a-f0-9]{64}$/i.test(sourceSha256 || '')) {
      setBatchMessage('This report has no valid PDF crop proposals or source fingerprint.')
      return
    }

    const targets = []
    for (const proposal of proposals) {
      if (!proposal || !Number.isInteger(proposal.pageNumber) ||
          !['question-content', 'option-content'].includes(proposal.role) ||
          !proposal.regionBounds || !proposal.contentBounds) continue

      const question = questions.find((item) =>
        item.questionId === proposal.questionId && item.include
      )
      if (!question) continue

      if (proposal.role === 'question-content') {
        if (question.imageAsset) continue
        targets.push({
          key: `question:${question.questionId}`,
          proposal,
        })
        continue
      }

      if (!proposal.optionId ||
          (proposal.uncertaintyCodes || []).includes('MULTIPLE_OPTIONS_SHARE_SOURCE_ELEMENT')) {
        continue
      }
      const option = question.options.find((item) =>
        item.optionId === proposal.optionId && item.include
      )
      if (!option || option.imageAsset) continue
      targets.push({
        key: `option:${question.questionId}:${option.optionId}`,
        proposal,
      })
    }

    if (!targets.length) {
      setBatchMessage('No eligible missing crops were found. Ambiguous shared-option proposals are skipped.')
      return
    }

    setBatchPending(true)
    setBatchMessage(`Generating ${targets.length} crop candidate(s). They will still require human review.`)
    let succeeded = 0
    let failed = 0
    const generated = {}

    try {
      for (let offset = 0; offset < targets.length; offset += 100) {
        const batch = targets.slice(offset, offset + 100)
        const crops = batch.map(({ proposal }) => ({
          pageNumber: proposal.pageNumber,
          role: proposal.role,
          regionBounds: proposal.regionBounds,
          contentBounds: proposal.contentBounds,
          paddingPoints: 0,
          dpi: 180,
        }))

        try {
          const payload = await cropPdfRegions(sourceFile, {
            sourceSha256,
            crops,
          })
          payload.results.forEach((entry, index) => {
            if (!entry.ok) {
              failed += 1
              return
            }
            const target = batch[index]
            const proposal = target.proposal
            generated[target.key] = {
              ...entry.result,
              bounds: proposal.regionBounds,
              pageNumber: proposal.pageNumber,
              role: proposal.role,
              sourceSha256,
              proposalId: proposal.proposalId,
              uncertaintyCodes: proposal.uncertaintyCodes || [],
              reviewStatus: 'needs-review',
              labelExclusionConfirmed: false,
            }
            succeeded += 1
          })
        } catch (error) {
          failed += batch.length
          setBatchMessage(error?.message || 'A crop batch failed. Other batches will continue.')
        }
      }

      if (Object.keys(generated).length) {
        setBatchCandidates((current) => ({ ...current, ...generated }))
      }
      setBatchMessage(
        `Generated ${succeeded} candidate crop(s); ${failed} failed. Inspect every image and confirm printed-label exclusion yourself. Generated candidates are not approved.`
      )
    } finally {
      setBatchPending(false)
    }
  }

  function reviewNext() {
    // Build a stable logical order independent of changing DOM positions:
    // question, its options, next question, its options, and so on.
    const orderedItems = []
    const unresolvedKeys = new Set()

    questions.forEach((question, questionIndex) => {
      if (!question.include) return

      const questionKey = `question:${question.questionId || questionIndex}`
      const questionElement = reviewItemRefs.current.get(questionKey)

      orderedItems.push({ key: questionKey, element: questionElement })

      if (
        cropNeedsReview(question.imageAsset) ||
        !question.reviewed ||
        !['MCQ', 'MSQ'].includes(question.type)
      ) {
        unresolvedKeys.add(questionKey)
      }

      question.options.forEach((option, optionIndex) => {
        if (!option.include) return

        const optionKey =
          `option:${question.questionId || questionIndex}:` +
          `${option.optionId || optionIndex}`
        const optionElement = reviewItemRefs.current.get(optionKey)

        orderedItems.push({ key: optionKey, element: optionElement })

        if (cropNeedsReview(option.imageAsset) || !option.reviewed) {
          unresolvedKeys.add(optionKey)
        }
      })
    })

    const targets = orderedItems.filter(
      ({ key, element }) => unresolvedKeys.has(key) && element?.isConnected
    )

    if (!targets.length) {
      lastReviewElementRef.current = null
      setLastReviewTarget('')
      return
    }

    // Use the last key's position in the complete ordered list, not its
    // position in the changing unresolved list. This prevents backward jumps
    // when an item becomes resolved and disappears from the targets.
    const previousElement = lastReviewElementRef.current
    const previousKey = lastReviewTarget
    const previousOrderIndex = orderedItems.findIndex(
      ({ key }) => key === previousKey
    )

    let nextTarget = null

    if (previousElement?.isConnected && previousOrderIndex >= 0) {
      nextTarget = targets.find(({ key }) => (
        orderedItems.findIndex((item) => item.key === key) > previousOrderIndex
      ))
    }

    // Start at the first unresolved item initially. Wrap only after reaching
    // the bottom of the ordered review list.
    if (!nextTarget) {
      nextTarget = targets[0]
    }

    lastReviewElementRef.current = nextTarget.element
    setLastReviewTarget(nextTarget.key)
    nextTarget.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    nextTarget.element.focus({ preventScroll: true })
  }

  function handleApprove() {
    if (pendingCount > 0 || cropPendingCount > 0 || !includedQuestions.length || typeof onApprove !== 'function') return
    onApprove({
      report,
      reviewedQuestions: includedQuestions.map((question) => {
        const reviewedQuestion = { ...question }
        delete reviewedQuestion.include

        reviewedQuestion.options = question.options
          .filter((option) => option.include)
          .map((option) => {
            const reviewedOption = { ...option }
            delete reviewedOption.include
            return reviewedOption
          })

        return reviewedQuestion
      }),
      reviewStatus: 'human-reviewed',
      cropAssets: includedQuestions.flatMap((question) => [question.imageAsset, ...question.options.filter((option) => option.include).map((option) => option.imageAsset)]).filter(Boolean),
    })
  }

  if (!report || typeof report !== 'object') {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5" role="status">No extraction report is available to review.</section>
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="extraction-review-title">
      <div className="relative">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Source review</p>
          <h2 id="extraction-review-title" className="mt-1 text-xl font-semibold text-slate-900">Review extracted questions</h2>
          <p className="mt-1 break-all text-sm text-slate-500">{report.source?.fileName || 'Source document'} · {questions.length} question candidates</p>
        </div>
      </header>

      <div className="sticky top-[90px] z-40 -mx-1 flex items-center justify-end gap-2 rounded-xl border border-blue-100 bg-white p-2 shadow-md">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
          {pendingCount} review item{pendingCount === 1 ? '' : 's'} remaining
        </div>
        <button
          type="button"
          onClick={reviewNext}
          disabled={!includedQuestions.length || (pendingCount === 0 && cropPendingCount === 0)}
          className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review Next →
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Detection is a candidate, not a verified interpretation. Check question boundaries, options, equations, diagrams and answer evidence against the original source. This screen never invents a correct answer.
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generateCropPreviews}
            disabled={batchPending || busy || !sourceFile || !/\.pdf$/i.test(sourceFile.name)}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {batchPending ? 'Generating previews…' : 'Generate Crop Previews'}
          </button>
          <p className="text-sm text-blue-900" role="status" aria-live="polite">
            {batchMessage || 'Generate candidate crops in batches. Every crop still needs visual inspection and explicit approval.'}
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <section className="rounded-xl border border-amber-200 p-4" aria-label="Extraction warnings">
          <h3 className="font-semibold text-slate-900">Items needing attention ({warnings.length})</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {warnings.map((warning, index) => <li key={`${warning.code || 'warning'}-${index}`}>{warning.message || warning.code || 'Review required'}</li>)}
          </ul>
        </section>
      )}

      {questions.length === 0 ? (
        <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">No question candidates were detected. Do not approve an empty review; inspect the source extraction first.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <article
              key={question.questionId || `question-${index}`}
              ref={(element) => {
                const key = `question:${question.questionId || index}`
                if (element) reviewItemRefs.current.set(key, element)
                else reviewItemRefs.current.delete(key)
              }}
              tabIndex={-1}
              className={`rounded-xl border p-4 ${question.include ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-70'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Question candidate {question.printedNumber ?? index + 1}</h3>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={question.include} onChange={(event) => updateQuestion(question.questionId, { include: event.target.checked })} />
                  Include
                </label>
              </div>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Question type
                <select
                  aria-label={`Question ${question.printedNumber ?? index + 1} type`}
                  value={question.type}
                  disabled={!question.include}
                  onChange={(event) => updateQuestion(question.questionId, {
                    type: event.target.value,
                    reviewed: false,
                  })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
                >
                  <option value="">Select type after checking the source</option>
                  <option value="MCQ">MCQ — Single correct option</option>
                  <option value="MSQ">MSQ — Multiple correct options</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Question text
                <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" value={question.textCandidate} onChange={(event) => updateQuestion(question.questionId, { textCandidate: event.target.value, reviewed: false })} disabled={!question.include} />
              <PdfVisualCropReview key={`question:${question.questionId}:${sourceFile?.name || ""}:${sourceFile?.size || 0}:${sourceFile?.lastModified || 0}:${Number(question.source?.pageNumber || question.pageNumber || 1)}`} file={sourceFile} pageNumber={Number(question.source?.pageNumber || question.pageNumber || 1)} role="question-content" initialCandidate={batchCandidates[`question:${question.questionId}`]} label={`Question ${question.printedNumber || question.questionNumber || index + 1}`} disabled={!question.include || busy} onApproved={(imageAsset) => updateQuestion(question.questionId, { imageAsset, reviewed: false })} />
              </label>
              <p className="mt-2 text-xs text-slate-500">Source page: {question.source?.pageNumber ?? 'not available'} · Candidate confidence: {question.confidence || 'not supplied'}</p>

              {question.options.length > 0 && <div className="mt-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-800">Detected options</h4>
                {question.options.map((option, optionIndex) => (
                  <div
                    key={option.optionId || `${question.questionId}-option-${optionIndex}`}
                    ref={(element) => {
                      const key =
                        `option:${question.questionId || index}:` +
                        `${option.optionId || optionIndex}`
                      if (element) reviewItemRefs.current.set(key, element)
                      else reviewItemRefs.current.delete(key)
                    }}
                    tabIndex={-1}
                    className="rounded-lg bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">Option {option.printedLabel || optionIndex + 1}</span>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={option.include} disabled={!question.include} onChange={(event) => updateOption(question.questionId, option.optionId, { include: event.target.checked })} /> Include</label>
                    </div>
                    <textarea aria-label={`Option ${option.printedLabel || optionIndex + 1} text`} className="mt-2 min-h-16 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none" value={option.textCandidate} disabled={!question.include || !option.include} onChange={(event) => updateOption(question.questionId, option.optionId, { textCandidate: event.target.value, reviewed: false })} />
                    <PdfVisualCropReview key={`option:${question.questionId}:${option.optionId}:${sourceFile?.name || ""}:${sourceFile?.size || 0}:${sourceFile?.lastModified || 0}:${Number(option.source?.pageNumber || question.source?.pageNumber || question.pageNumber || 1)}`} file={sourceFile} pageNumber={Number(option.source?.pageNumber || question.source?.pageNumber || question.pageNumber || 1)} role="option-content" initialCandidate={batchCandidates[`option:${question.questionId}:${option.optionId}`]} label={`Option ${option.printedLabel || optionIndex + 1}`} disabled={!question.include || !option.include || busy} onApproved={(imageAsset) => updateOption(question.questionId, option.optionId, { imageAsset, reviewed: false })} />
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={option.reviewed} disabled={!question.include || !option.include} onChange={(event) => updateOption(question.questionId, option.optionId, { reviewed: event.target.checked })} /> I checked this option against the source</label>
                  </div>
                ))}
              </div>}

              {!['MCQ', 'MSQ'].includes(question.type) && question.include && (
                <p className="mt-2 text-sm text-amber-700">
                  Select MCQ or MSQ after checking the original question.
                </p>
              )}

              <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={question.reviewed} disabled={!question.include} onChange={(event) => updateQuestion(question.questionId, { reviewed: event.target.checked })} />
                I checked this question against the original source
              </label>
            </article>
          ))}
        </div>
      )}

      </div>
      <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Back</button>}
        <button type="button" onClick={handleApprove} disabled={busy || pendingCount > 0 || cropPendingCount > 0 || !includedQuestions.length || typeof onApprove !== 'function'} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Approving…' : cropPendingCount ? `Review or create ${cropPendingCount} required image crop(s)` : 'Approve reviewed extraction'}</button>
      </footer>
      <p className="text-xs leading-5 text-slate-500">Every included question and option requires its own reviewed image crop. Approval returns candidate and crop payloads to the parent component. Authenticated saving, asset authorization, package generation and final CBTGen validation must still run in the processing service.</p>
    </section>
  )
}

export default ExtractionReviewPanel
