const DEFAULT_BASE_URL = '/api/document-processing'

/**
 * Upload a source PDF/DOCX to the internal processing service.
 * The server must authenticate the session and derive owner identity itself.
 * This function deliberately sends no ownerId field and never stores the file.
 */
export async function extractSourceDocument(file, { signal, baseUrl = DEFAULT_BASE_URL } = {}) {
  if (!(file instanceof File)) throw new TypeError('Choose a source PDF or DOCX file first.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['pdf', 'docx'].includes(extension)) throw new Error('Only PDF and DOCX are supported by the current processing service.')
  if (file.size <= 0) throw new Error('The selected source file is empty.')
  if (file.size > 10_000_000) throw new Error('The selected source file exceeds the 10 MB upload limit.')

  const body = new FormData()
  body.append('file', file, file.name)
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/extractions`, {
    method: 'POST',
    body,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : 'The document-processing service rejected this file.'
    throw new Error(response.status === 401 ? 'Please sign in before processing a question paper.' : detail)
  }
  if (!payload || !payload.source?.sha256 || !Array.isArray(payload.warnings)) {
    throw new Error('The processing service returned an invalid extraction report.')
  }
  return payload
}

/**
 * Crop one reviewed visual region from a PDF.
 *
 * Bounds use PDF points: { x, y, width, height }. The caller is responsible
 * for having a human-reviewed boundary that excludes the printed question
 * number or option label. This helper never sends owner identity.
 */
export async function cropPdfRegion(
  file,
  {
    sourceSha256,
    pageNumber,
    regionBounds,
    contentBounds,
    role,
    paddingPoints = 0,
    dpi = 150,
    signal,
    baseUrl = DEFAULT_BASE_URL,
  } = {},
) {
  if (!(file instanceof File)) throw new TypeError('Choose the original PDF file first.')
  if (file.name.split('.').pop()?.toLowerCase() !== 'pdf') {
    throw new Error('Visual cropping currently supports PDF files only.')
  }
  if (file.size <= 0) throw new Error('The selected source PDF is empty.')
  if (file.size > 10_000_000) throw new Error('The selected source file exceeds the 10 MB upload limit.')
  if (typeof sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sourceSha256)) {
    throw new Error('A valid source PDF SHA-256 fingerprint is required.')
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error('A valid 1-based PDF page number is required.')
  }
  const validBounds = (value) =>
    value && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key])) &&
    value.width > 0 && value.height > 0;
  if (!validBounds(regionBounds)) throw new Error('Reviewed crop region bounds are invalid.')
  if (contentBounds != null && !validBounds(contentBounds)) {
    throw new Error('Reviewed content bounds are invalid.')
  }
  if (!['question-content', 'option-content'].includes(role)) {
    throw new Error('Crop role must be question-content or option-content.')
  }
  if (!Number.isFinite(paddingPoints) || paddingPoints < 0 || paddingPoints > 36) {
    throw new Error('Crop padding must be between 0 and 36 PDF points.')
  }
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 300) {
    throw new Error('Crop resolution must be between 72 and 300 DPI.')
  }

  const body = new FormData()
  body.append('file', file, file.name)
  body.append('source_sha256', sourceSha256.toLowerCase())
  body.append('page_number', String(pageNumber))
  body.append('region_bounds', JSON.stringify(regionBounds))
  if (contentBounds != null) body.append('content_bounds', JSON.stringify(contentBounds))
  body.append('role', role)
  body.append('padding_points', String(paddingPoints))
  body.append('dpi', String(dpi))

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/crops`, {
    method: 'POST',
    body,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof payload.detail === 'string'
      ? payload.detail
      : 'The document-processing service could not create this crop.'
    throw new Error(response.status === 401
      ? 'Please sign in before cropping a question paper.'
      : detail)
  }
  if (
    !payload ||
    typeof payload.imageDataUrl !== 'string' ||
    !payload.imageDataUrl.startsWith('data:image/png;base64,') ||
    typeof payload.assetId !== 'string' ||
    !payload.assetId ||
    !['question-content', 'option-content'].includes(payload.role) ||
    payload.reviewStatus !== 'needs-review'
  ) {
    throw new Error('The crop service returned an invalid or incomplete crop report.')
  }
  return payload
}


/** Render one PDF page for visual crop selection. This preview is not a saved asset. */
export async function previewPdfPage(file, { pageNumber, signal, baseUrl = DEFAULT_BASE_URL } = {}) {
  if (!(file instanceof File)) throw new TypeError('Choose the original PDF file first.')
  if (file.name.split('.').pop()?.toLowerCase() !== 'pdf') throw new Error('Visual page preview currently supports PDF files only.')
  if (file.size <= 0) throw new Error('The selected source PDF is empty.')
  if (file.size > 10_000_000) throw new Error('The selected source file exceeds the 10 MB upload limit.')
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error('A valid 1-based PDF page number is required.')
  const body = new FormData()
  body.append('file', file, file.name)
  body.append('page_number', String(pageNumber))
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/pages/preview`, {
    method: 'POST', body, credentials: 'include', signal, headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof payload.detail === 'string' ? payload.detail : 'The document-processing service could not render this PDF page.'
    throw new Error(response.status === 401 ? 'Please sign in before previewing a question paper.' : detail)
  }
  if (!payload || payload.pageNumber !== pageNumber || !Number.isInteger(payload.pageCount) || payload.pageCount < pageNumber ||
      !/^[a-f0-9]{64}$/i.test(payload.sourceSha256 || '') || !Number.isFinite(payload.pageWidthPoints) || payload.pageWidthPoints <= 0 ||
      !Number.isFinite(payload.pageHeightPoints) || payload.pageHeightPoints <= 0 || !Number.isInteger(payload.imageWidthPixels) || payload.imageWidthPixels <= 0 ||
      !Number.isInteger(payload.imageHeightPixels) || payload.imageHeightPixels <= 0 || typeof payload.imageDataUrl !== 'string' ||
      !payload.imageDataUrl.startsWith('data:image/png;base64,') || payload.persisted !== false || payload.reviewStatus !== 'preview-only') {
    throw new Error('The page preview service returned an invalid or incomplete response.')
  }
  return payload
}


/**
 * Generate multiple review-pending crops with one PDF upload.
 * Automatic crop generation never constitutes human approval.
 */
export async function cropPdfRegions(
  file,
  {
    sourceSha256,
    crops,
    signal,
    baseUrl = DEFAULT_BASE_URL,
  } = {},
) {
  if (!(file instanceof File)) throw new TypeError('Choose the original PDF file first.')
  if (file.name.split('.').pop()?.toLowerCase() !== 'pdf') {
    throw new Error('Batch visual cropping currently supports PDF files only.')
  }
  if (file.size <= 0 || file.size > 10_000_000) {
    throw new Error('The source PDF must be non-empty and no larger than 10 MB.')
  }
  if (typeof sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sourceSha256)) {
    throw new Error('A valid source PDF SHA-256 fingerprint is required.')
  }
  if (!Array.isArray(crops) || crops.length < 1 || crops.length > 100) {
    throw new Error('Batch cropping requires between 1 and 100 crop requests.')
  }

  const validBounds = (value) =>
    value &&
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(value[key])) &&
    value.width > 0 &&
    value.height > 0

  for (const crop of crops) {
    if (!crop || !Number.isInteger(crop.pageNumber) || crop.pageNumber < 1) {
      throw new Error('Every crop requires a valid 1-based page number.')
    }
    if (!['question-content', 'option-content'].includes(crop.role)) {
      throw new Error('Every crop requires a supported crop role.')
    }
    if (!validBounds(crop.regionBounds) ||
        (crop.contentBounds != null && !validBounds(crop.contentBounds))) {
      throw new Error('Every crop requires valid region and content bounds.')
    }
    if (crop.paddingPoints != null &&
        (!Number.isFinite(crop.paddingPoints) || crop.paddingPoints < 0 || crop.paddingPoints > 24)) {
      throw new Error('Crop padding must be between 0 and 24 PDF points.')
    }
    if (crop.dpi != null &&
        (!Number.isInteger(crop.dpi) || crop.dpi < 72 || crop.dpi > 300)) {
      throw new Error('Crop resolution must be between 72 and 300 DPI.')
    }
  }

  const body = new FormData()
  body.append('file', file, file.name)
  body.append('source_sha256', sourceSha256.toLowerCase())
  body.append('crops', JSON.stringify(crops))

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/crops/batch`, {
    method: 'POST',
    body,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof payload.detail === 'string'
      ? payload.detail
      : 'The document-processing service could not create the batch crops.'
    throw new Error(response.status === 401
      ? 'Please sign in before cropping a question paper.'
      : detail)
  }

  if (!payload ||
      payload.sourceSha256 !== sourceSha256.toLowerCase() ||
      payload.reviewStatus !== 'needs-review' ||
      !Array.isArray(payload.results) ||
      payload.results.length !== crops.length) {
    throw new Error('The batch crop service returned an invalid or incomplete response.')
  }

  for (let index = 0; index < payload.results.length; index += 1) {
    const entry = payload.results[index]
    if (!entry || entry.requestIndex !== index || typeof entry.ok !== 'boolean') {
      throw new Error('The batch crop service returned results in an invalid order.')
    }
    if (entry.ok) {
      const result = entry.result
      if (!result ||
          typeof result.assetId !== 'string' ||
          !result.assetId ||
          !['question-content', 'option-content'].includes(result.role) ||
          result.reviewStatus !== 'needs-review' ||
          typeof result.imageDataUrl !== 'string' ||
          !result.imageDataUrl.startsWith('data:image/png;base64,')) {
        throw new Error(`Batch crop ${index + 1} returned an invalid result.`)
      }
    }
  }

  return payload
}
