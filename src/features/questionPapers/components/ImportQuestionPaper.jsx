import { useRef, useState } from 'react'
import { extractSourceDocument } from '../services/documentProcessingApi'
import ExtractionReviewPanel from './ExtractionReviewPanel'
import { convertReviewedCandidatesToCbtgenXml } from '../../../lib/cbtgen/extractionCandidateConverter'
import { buildCbtgenPackage } from '../../../lib/cbtgen/packageBuilder'
import { validateCbtgenXml } from '../../../lib/cbtgen/semanticValidator'

const ACCEPTED_SOURCE_TYPES = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_SOURCE_BYTES = 10_000_000


function safePackageStem(value) {
  const stem = String(value || 'question-paper')
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return stem || 'question-paper'
}

function imageDataUrlToBytes(dataUrl, description) {
  if (typeof dataUrl !== 'string') throw new Error(`${description} is missing image data.`)
  const match = dataUrl.match(/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=\r\n]+)$/i)
  if (!match) throw new Error(`${description} must be a valid base64 image data URL.`)
  const binary = atob(match[2].replace(/\s/g, ''))
  if (!binary.length) throw new Error(`${description} image data is empty.`)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return { bytes, mimeType: `image/${match[1].toLowerCase()}` }
}

function prepareReviewedCropPackageInputs(reviewedQuestions, cropAssets) {
  if (!Array.isArray(reviewedQuestions) || reviewedQuestions.length === 0) {
    throw new Error('No reviewed question candidates were provided.')
  }
  if (!Array.isArray(cropAssets) || cropAssets.length === 0) {
    throw new Error('No approved crop images were provided. Crop and review each question and option first.')
  }

  const cropById = new Map()
  for (const crop of cropAssets) {
    const id = String(crop?.assetId || '').trim()
    if (!id) throw new Error('An approved crop is missing its asset ID.')
    if (cropById.has(id)) throw new Error(`Duplicate crop asset ID "${id}".`)
    if (crop.reviewStatus !== 'human-reviewed' || crop.labelExclusionConfirmed !== true) {
      throw new Error(`Crop "${id}" has not been explicitly approved for content and label exclusion.`)
    }
    cropById.set(id, crop)
  }

  const assets = []
  const usedAssetIds = new Set()
  function bindCrop(crop, scope, description) {
    const id = String(crop?.assetId || '').trim()
    if (!id || !cropById.has(id)) throw new Error(`${description} is missing its approved image crop.`)
    if (usedAssetIds.has(id)) throw new Error(`Image asset "${id}" is reused; each question and option needs its own crop.`)
    const expectedRole = scope === 'question-visual' ? 'question-content' : 'option-content'
    if (crop.role !== expectedRole) throw new Error(`${description} has a crop with the wrong content role.`)
    const converted = imageDataUrlToBytes(crop.imageDataUrl, description)
    if (crop.mimeType && crop.mimeType.toLowerCase() !== converted.mimeType) {
      throw new Error(`${description} image MIME type does not match its image data.`)
    }
    usedAssetIds.add(id)
    const extension = converted.mimeType === 'image/jpeg' ? 'jpg' :
      converted.mimeType === 'image/svg+xml' ? 'svg' : converted.mimeType.split('/')[1]
    const packagePath = `assets/${id}.${extension}`
    assets.push({ id, src: packagePath, packagePath, mimeType: converted.mimeType, scope, bytes: converted.bytes })
    return id
  }

  const mappedQuestions = reviewedQuestions.map((question, index) => {
    if (!question?.imageAsset) throw new Error(`Question ${question?.printedNumber || index + 1} has no approved question crop.`)
    const questionImageRef = bindCrop(question.imageAsset, 'question-visual', `Question ${question.printedNumber || index + 1}`)
    const options = (Array.isArray(question.options) ? question.options : []).map((option, optionIndex) => {
      if (!option?.imageAsset) throw new Error(`Question ${question.printedNumber || index + 1}, option ${option?.printedLabel || optionIndex + 1} has no approved option crop.`)
      const optionImageRef = bindCrop(option.imageAsset, 'option-visual', `Question ${question.printedNumber || index + 1}, option ${option.printedLabel || optionIndex + 1}`)
      return { ...option, imageAssetRef: optionImageRef }
    })
    return { ...question, imageAssetRef: questionImageRef, options }
  })

  if (usedAssetIds.size !== cropById.size) {
    throw new Error('The crop list contains unused images. Reopen the review and ensure every crop belongs to an included question or option.')
  }
  return { reviewedQuestions: mappedQuestions, assets }
}

function downloadCbtgenPackage(blob, fileName) {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('The generated CBTGen package is empty.')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ImportQuestionPaper() {
  const fileInputRef = useRef(null)
  const abortRef = useRef(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [report, setReport] = useState(null)
  const [reviewApproved, setReviewApproved] = useState(false)
  const [draftResult, setDraftResult] = useState(null)

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null
    event.target.value = ''
    if (!selectedFile) return

    const name = selectedFile.name.toLowerCase()
    if (!/\.(pdf|docx)$/.test(name)) {
      setFile(null)
      setReport(null)
      setStatus('error')
      setMessage('The connected processing service currently supports PDF and DOCX only.')
      return
    }
    if (selectedFile.size <= 0) {
      setFile(null)
      setReport(null)
      setStatus('error')
      setMessage('The selected file is empty. Choose a non-empty PDF or DOCX document.')
      return
    }
    if (selectedFile.size > MAX_SOURCE_BYTES) {
      setFile(null)
      setReport(null)
      setStatus('error')
      setMessage('The selected file exceeds the 10 MB upload limit.')
      return
    }

    setFile(selectedFile)
    setReport(null)
    setDraftResult(null)
    setStatus('ready')
    setMessage('')
  }

  async function handleProcess() {
    if (!file || status === 'processing') return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('processing')
    setMessage('Uploading the source document to the internal processing service…')
    setReport(null)
    setDraftResult(null)

    try {
      const extractionReport = await extractSourceDocument(file, { signal: controller.signal })
      setReport(extractionReport)
      setReviewApproved(false)
      setStatus('processed')
      setMessage('Extraction finished. Review the detected question candidates against the original source.')
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus('error')
      setMessage(error?.message || 'The processing service could not extract this document.')
    }
  }

  function handleRemove() {
    abortRef.current?.abort()
    setFile(null)
    setReport(null)
    setDraftResult(null)
    setReviewApproved(false)
    setStatus('idle')
    setMessage('')
  }

  const isDocx = /\.docx$/i.test(report?.source?.fileName || file?.name || '')
  const pageCount = Array.isArray(report?.pages) ? report.pages.length : 0
  const elementCount = Array.isArray(report?.pages)
    ? report.pages.reduce((count, page) => count + (Array.isArray(page.elements) ? page.elements.length : 0), 0)
    : Array.isArray(report?.elements)
      ? report.elements.length
      : 0
  const warnings = Array.isArray(report?.warnings) ? report.warnings : []

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="source-import-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            <span aria-hidden="true">↥</span>
            Source paper import
          </div>
          <h3 id="source-import-title" className="mt-2 text-lg font-semibold text-slate-900">Add a Question Paper</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Upload an original PDF or DOCX (maximum 10 MB per file). CBTGen sends it to its internal document-processing service to extract text, page layout, and review warnings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'processing'}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {file ? 'Choose another file' : 'Choose source file'}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept={ACCEPTED_SOURCE_TYPES} onChange={handleFileChange} className="hidden" aria-label="Choose original question paper" />

      {file && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm" aria-hidden="true">
              {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOC'}
            </div>
            <div className="min-w-0">
              <p className="break-all text-sm font-semibold text-slate-900">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">{(file.size / 1_000_000).toFixed(2)} MB · Selected on this device (10 MB maximum)</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleRemove} disabled={status === 'processing'} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Remove</button>
            <button type="button" onClick={handleProcess} disabled={status === 'processing'} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {status === 'processing' ? 'Processing…' : 'Extract document'}
            </button>
          </div>
        </div>
      )}

      {message && <p role={status === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm ${status === 'error' ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-blue-100 bg-blue-50 text-blue-900'}`}>{message}</p>}

      {report && !reviewApproved && (
        <div className="mt-5 space-y-4" aria-label="Extraction report">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Pages processed</p><p className="mt-1 text-xl font-semibold text-slate-900">{isDocx ? "Not paginated" : pageCount}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Extracted elements</p><p className="mt-1 text-xl font-semibold text-slate-900">{elementCount}</p></div>
            <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Warnings</p><p className="mt-1 text-xl font-semibold text-slate-900">{warnings.length}</p></div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Extraction report only — not yet a saved question paper</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">Question candidates and the human-review panel are available, but source-page visual review, final CBTGen package generation, final validation, and saving to My Question Papers are not yet connected. This extraction does not save a paper to your library. Do not use this report as a verified exam paper.</p>
          </div>
          {warnings.length > 0 && <div className="rounded-xl border border-slate-200 p-4"><h4 className="font-semibold text-slate-900">Processing warnings</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{warnings.map((warning, index) => <li key={`${warning.code || 'warning'}-${index}`}>{warning.message || warning.code || 'Review required'}{warning.pageNumber ? ` (page ${warning.pageNumber})` : ''}</li>)}</ul></div>}
          {Array.isArray(report.pages) && report.pages.map((page) => (
            <details key={page.pageNumber} className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Page {page.pageNumber} — {(page.elements || []).length} extracted elements</summary>
              <div className="mt-3 space-y-3">
                {(page.elements || []).map((element) => <div key={element.elementId} className="rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{element.kind || 'Extracted element'} · {element.extractionMethod || 'method unavailable'}</span><span>{element.confidence == null ? 'Confidence unavailable' : `Confidence: ${Math.round(element.confidence * 100)}%`}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{element.text || '[No text content]'}</p></div>)}
                {(!page.elements || page.elements.length === 0) && <p className="text-sm text-slate-500">No text elements were extracted from this page.</p>}
              </div>
            </details>
          ))}
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setReport(null)
                setReviewApproved(false)
                setStatus('ready')
                setMessage('Extraction report cleared. You can process the selected source again.')
              }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear report
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftResult(null)
                setReviewApproved(true)
              }}
              disabled={!Array.isArray(report.segmentation?.questions) || report.segmentation.questions.length === 0}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Review question candidates
            </button>
          </div>
        </div>
      )}

      {report && reviewApproved && (
        <ExtractionReviewPanel
          key={report.jobId || report.source?.sha256}
          report={report}
          sourceFile={file}
          onCancel={() => setReviewApproved(false)}
          onApprove={async ({ reviewedQuestions, reviewStatus, cropAssets }) => {
            setDraftResult(null)
            try {
              const examName = (report.source?.fileName || file?.name || 'Imported Question Paper')
                .replace(/\.[^.]+$/, '')
                .trim() || 'Imported Question Paper'

              const prepared = prepareReviewedCropPackageInputs(reviewedQuestions, cropAssets)
              const xmlText = convertReviewedCandidatesToCbtgenXml({
                reviewedQuestions: prepared.reviewedQuestions,
                reviewStatus,
                examName,
                sectionName: 'General',
                assets: prepared.assets.map(({ id, src, packagePath, mimeType, scope }) => ({
                  id, src, packagePath, mimeType, scope,
                })),
              })

              const xmlDocument = new DOMParser().parseFromString(xmlText, 'application/xml')
              if (xmlDocument.querySelector('parsererror')) throw new Error('The generated XML could not be parsed safely.')
              const validation = validateCbtgenXml(xmlDocument)
              if (!validation.valid) {
                setDraftResult({ xmlText, validation, packageReady: false })
                setStatus('error')
                setMessage('XML draft generated, but semantic validation rejected it. No package was created or downloaded.')
                setReviewApproved(false)
                return
              }

              const packageAssets = prepared.assets.map(({ id, packagePath, bytes }) => ({ id, packagePath, bytes }))
              const packageBlob = await buildCbtgenPackage({ xmlText, assets: packageAssets })
              const packageFileName = `${safePackageStem(examName)}.cbtgen`
              setDraftResult({ xmlText, validation, packageReady: true, packageFileName, packageBlob })
              setReviewApproved(false)
              setStatus('processed')
              setMessage('Image-only CBTGen package generated and validated. It has not been saved to My Question Papers.')
              downloadCbtgenPackage(packageBlob, packageFileName)
            } catch (error) {
              setStatus('error')
              setMessage(error?.message || 'Unable to generate or validate the CBTGen package. Review the candidates and try again.')
            }
          }}
        />
      )}

      {report && draftResult && (
        <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Generated XML draft and validation">
          <div>
            <h4 className="text-base font-semibold text-slate-900">{draftResult.packageReady ? 'CBTGen package ready' : 'CBTGen XML draft — not saved'}</h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {draftResult.packageReady ? 'The image-only .cbtgen package was generated with its referenced crop images. It has not been saved to your library.' : 'This XML draft is not a final CBTGen package and has not been saved to your library.'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">
              Semantic validation: {draftResult.validation.status || (draftResult.validation.valid ? 'VALID' : 'REJECTED')}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Scoring readiness: {draftResult.validation.summary?.scoringReady === true ? 'Ready according to semantic validation' : 'Not scoring-ready'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Answer key: {draftResult.validation.summary?.answerKeyStatus || 'Not confirmed'}
            </p>
          </div>

          {Array.isArray(draftResult.validation.errors) && draftResult.validation.errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
              <h5 className="font-semibold text-red-900">Validation errors</h5>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
                {draftResult.validation.errors.map((item, index) => (
                  <li key={`${item.code || 'error'}-${index}`}>{item.message || item.code || String(item)}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(draftResult.validation.warnings) && draftResult.validation.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h5 className="font-semibold text-amber-900">Validation warnings</h5>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {draftResult.validation.warnings.map((item, index) => (
                  <li key={`${item.code || 'warning'}-${index}`}>{item.message || item.code || String(item)}</li>
                ))}
              </ul>
            </div>
          )}

          {draftResult.packageReady && draftResult.packageBlob && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Package generated successfully</p>
                <p className="mt-1 text-xs text-emerald-800">{draftResult.packageFileName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    downloadCbtgenPackage(draftResult.packageBlob, draftResult.packageFileName)
                  } catch (error) {
                    setStatus('error')
                    setMessage(error?.message || 'Unable to download the CBTGen package.')
                  }
                }}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Download .cbtgen again
              </button>
            </div>
          )}

          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Inspect generated XML</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{draftResult.xmlText}</pre>
          </details>

          <p className="text-xs leading-5 text-slate-500">
            Correct answers are not inferred. Source visual verification, asset checks, authenticated finalization, package generation, and saving remain separate steps.
          </p>
        </div>
      )}
    </section>
  )
}

export default ImportQuestionPaper
