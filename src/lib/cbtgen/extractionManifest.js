/**
 * Internal manifest contract for source-PDF extraction and crop provenance.
 *
 * This manifest is an internal processing artifact, not a replacement for
 * CBTGen XML v1.0. Owner identity is retained here for authorization and audit;
 * it must not be copied into portable source-paper XML.
 */

export const EXTRACTION_MANIFEST_VERSION = '1.0'

const REGION_KINDS = new Set([
  'paper-metadata',
  'section-heading',
  'instruction',
  'question-identifier',
  'question-content',
  'option-identifier',
  'option-content',
  'passage-content',
  'equation',
  'diagram',
  'chart',
  'table',
  'image',
  'answer-key-entry',
  'marking-instruction',
  'footer',
  'header',
  'unknown',
])

const OWNER_SCOPES = new Set(['paper', 'section', 'passage', 'question', 'option'])
const EXTRACTION_METHODS = new Set(['native-pdf-text', 'ocr', 'layout-model', 'manual-review', 'docx-ooxml'])
const REVIEW_STATES = new Set(['not-reviewed', 'accepted', 'needs-review', 'rejected'])
const CROP_KINDS = new Set(['question-content', 'option-content', 'passage-content', 'equation', 'diagram', 'chart', 'table', 'image'])
const SHA256_RE = /^[a-f0-9]{64}$/i
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0
}

function inferSourceType(source) {
  if (source?.fileType != null) return String(source.fileType).toLowerCase()
  const mime = String(source?.mimeType || '').toLowerCase()
  const name = String(source?.fileName || '').toLowerCase()

  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) return 'docx'

  return ''
}

function makeId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (!uuid) throw new Error('Secure random ID generation is unavailable in this environment.')
  return `${prefix}-${uuid}`
}

function normalizeOwner(owner) {
  if (!owner || typeof owner !== 'object') return null
  const scope = String(owner.scope || '')
  const normalized = { scope }
  if (owner.paperId != null) normalized.paperId = String(owner.paperId)
  if (owner.sectionId != null) normalized.sectionId = String(owner.sectionId)
  if (owner.passageId != null) normalized.passageId = String(owner.passageId)
  if (owner.questionId != null) normalized.questionId = String(owner.questionId)
  if (owner.optionId != null) normalized.optionId = String(owner.optionId)
  return normalized
}

/** Create a fresh, internal extraction manifest with secure opaque IDs. */
export function createExtractionManifest({
  ownerId,
  paperId,
  source,
  createdAt = new Date().toISOString(),
  jobId = makeId('extract'),
} = {}) {
  if (!nonEmpty(ownerId)) throw new Error('An authenticated owner ID is required for an extraction job.')
  if (!nonEmpty(paperId)) throw new Error('A paper ID is required for an extraction job.')
  if (!source || !nonEmpty(source.fileName)) throw new Error('The source file name is required.')
  const fileType = inferSourceType(source)
  if (!['pdf', 'docx'].includes(fileType)) throw new Error('Source fileType must be pdf or docx.')
  if (fileType === 'pdf' && (!Number.isInteger(source.pageCount) || source.pageCount < 1)) {
    throw new Error('Source pageCount must be a positive integer.')
  }
  if (fileType === 'docx' && source.pageCount != null) {
    throw new Error('DOCX source provenance must not invent a pageCount.')
  }
  if (!SHA256_RE.test(String(source.sha256 || ''))) throw new Error('A source SHA-256 digest is required before extraction can begin.')

  const expectedMime = fileType === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (source.mimeType && String(source.mimeType).toLowerCase() !== expectedMime) {
    throw new Error('Source MIME type does not match source fileType.')
  }

  return {
    manifestVersion: EXTRACTION_MANIFEST_VERSION,
    jobId,
    createdAt,
    owner: { userId: String(ownerId), paperId: String(paperId) },
    source: {
      fileName: String(source.fileName),
      fileType,
      mimeType: String(source.mimeType || expectedMime),
      sha256: String(source.sha256).toLowerCase(),
      ...(fileType === 'pdf' ? { pageCount: source.pageCount } : {}),
    },
    pages: [],
    elements: [],
    regions: [],
    assets: [],
    warnings: [],
    status: 'in-progress',
  }
}

/**
 * Validate the manifest's structural invariants. This function deliberately
 * does not infer visual correctness from pixels; crop QA belongs to the
 * renderer/review stage.
 */
export function validateExtractionManifest(manifest) {
  const errors = []
  const warnings = []
  const add = (code, message, path = '') => errors.push({ code, message, path })

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: [{ code: 'MANIFEST_INVALID', message: 'Manifest must be an object.', path: '' }], warnings }
  }

  if (manifest.manifestVersion !== EXTRACTION_MANIFEST_VERSION) add('MANIFEST_VERSION_UNSUPPORTED', `Expected manifest version ${EXTRACTION_MANIFEST_VERSION}.`, 'manifestVersion')
  if (!nonEmpty(manifest.jobId) || !ID_RE.test(manifest.jobId)) add('JOB_ID_INVALID', 'jobId must be a non-empty safe identifier.', 'jobId')
  if (!nonEmpty(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt))) add('CREATED_AT_INVALID', 'createdAt must be a valid date-time string.', 'createdAt')
  if (!nonEmpty(manifest.owner?.userId)) add('OWNER_MISSING', 'An owner userId is required in the internal manifest.', 'owner.userId')
  if (!nonEmpty(manifest.owner?.paperId)) add('PAPER_ID_MISSING', 'An owner paperId is required in the internal manifest.', 'owner.paperId')
  if (!nonEmpty(manifest.source?.fileName)) add('SOURCE_FILENAME_MISSING', 'Source fileName is required.', 'source.fileName')
  const sourceType = inferSourceType(manifest.source)
  if (!['pdf', 'docx'].includes(sourceType)) {
    add('SOURCE_FILE_TYPE_INVALID', 'Source fileType must be pdf or docx.', 'source.fileType')
  }
  if (sourceType === 'pdf' && (!Number.isInteger(manifest.source?.pageCount) || manifest.source.pageCount < 1)) {
    add('SOURCE_PAGE_COUNT_INVALID', 'Source PDF pageCount must be a positive integer.', 'source.pageCount')
  }
  if (sourceType === 'docx' && manifest.source?.pageCount != null) {
    add('DOCX_PAGE_COUNT_FORBIDDEN', 'DOCX provenance must not contain a fabricated pageCount.', 'source.pageCount')
  }
  if (!SHA256_RE.test(String(manifest.source?.sha256 || ''))) add('SOURCE_SHA256_INVALID', 'A source SHA-256 digest is required.', 'source.sha256')

  const expectedMime = sourceType === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (manifest.source?.mimeType && sourceType && String(manifest.source.mimeType).toLowerCase() !== expectedMime) {
    add('SOURCE_MIME_TYPE_MISMATCH', 'Source MIME type does not match source fileType.', 'source.mimeType')
  }

  for (const collectionName of ['pages', 'regions', 'assets', 'warnings']) {
    if (!Array.isArray(manifest[collectionName])) add('COLLECTION_INVALID', `${collectionName} must be an array.`, collectionName)
  }
  if (!Array.isArray(manifest.pages) || !Array.isArray(manifest.regions) || !Array.isArray(manifest.assets) || !Array.isArray(manifest.warnings)) {
    return { valid: false, errors, warnings }
  }

  if (sourceType === 'docx' && manifest.pages.length !== 0) {
    add('DOCX_PAGE_GEOMETRY_FORBIDDEN', 'DOCX provenance cannot use PDF-style page geometry.', 'pages')
  }
  if (sourceType === 'docx' && manifest.assets.length !== 0) {
    add('DOCX_CROP_ASSETS_UNSUPPORTED', 'DOCX crop assets are unsupported until a real DOCX crop model exists.', 'assets')
  }

  const elements = manifest.elements
  if (sourceType === 'docx' && !Array.isArray(elements)) {
    add('DOCX_ELEMENTS_REQUIRED', 'DOCX provenance requires an elements array.', 'elements')
  }
  const elementById = new Map()
  const documentOrders = new Set()
  if (Array.isArray(elements)) {
    for (const [index, element] of elements.entries()) {
      const path = `elements[${index}]`
      if (!nonEmpty(element?.elementId) || !ID_RE.test(element.elementId)) {
        add('ELEMENT_ID_INVALID', 'Element requires a safe elementId.', `${path}.elementId`)
      } else if (elementById.has(element.elementId)) {
        add('ELEMENT_ID_DUPLICATE', `Duplicate elementId "${element.elementId}".`, `${path}.elementId`)
      } else {
        elementById.set(element.elementId, element)
      }
      if (!Number.isInteger(element?.documentOrder) || element.documentOrder < 1) {
        add('ELEMENT_DOCUMENT_ORDER_INVALID', 'documentOrder must be a positive integer.', `${path}.documentOrder`)
      } else if (documentOrders.has(element.documentOrder)) {
        add('ELEMENT_DOCUMENT_ORDER_DUPLICATE', `Duplicate documentOrder ${element.documentOrder}.`, `${path}.documentOrder`)
      } else {
        documentOrders.add(element.documentOrder)
      }
      if (element?.kind != null && !nonEmpty(element.kind)) {
        add('ELEMENT_KIND_INVALID', 'Element kind must be a non-empty string when provided.', `${path}.kind`)
      }
      if (element?.extractionMethod != null && !EXTRACTION_METHODS.has(element.extractionMethod)) {
        add('EXTRACTION_METHOD_INVALID', 'Element extractionMethod is unsupported.', `${path}.extractionMethod`)
      }
      if (element?.reviewStatus != null && !REVIEW_STATES.has(element.reviewStatus)) {
        add('REVIEW_STATUS_INVALID', 'Element reviewStatus is unsupported.', `${path}.reviewStatus`)
      }
    }
  }

  const pageIds = new Set()
  const pageNumbers = new Set()
  const pageByNumber = new Map()
  for (const [index, page] of manifest.pages.entries()) {
    const path = `pages[${index}]`
    if (!nonEmpty(page?.pageId) || !ID_RE.test(page.pageId)) add('PAGE_ID_INVALID', 'Page requires a safe pageId.', `${path}.pageId`)
    else if (pageIds.has(page.pageId)) add('PAGE_ID_DUPLICATE', `Duplicate pageId "${page.pageId}".`, `${path}.pageId`)
    else pageIds.add(page.pageId)
    if (!Number.isInteger(page?.pageNumber) || page.pageNumber < 1 || page.pageNumber > (manifest.source.pageCount || Infinity)) add('PAGE_NUMBER_INVALID', 'pageNumber must be within the source PDF page range.', `${path}.pageNumber`)
    else if (pageNumbers.has(page.pageNumber)) add('PAGE_NUMBER_DUPLICATE', `Duplicate source page number ${page.pageNumber}.`, `${path}.pageNumber`)
    else { pageNumbers.add(page.pageNumber); pageByNumber.set(page.pageNumber, page) }
    if (!finitePositive(page?.width) || !finitePositive(page?.height)) add('PAGE_DIMENSIONS_INVALID', 'Page width and height must be positive finite numbers.', path)
    if (!['pdf-points', 'pixels'].includes(page?.coordinateUnit)) add('PAGE_COORDINATE_UNIT_INVALID', 'coordinateUnit must be pdf-points or pixels.', `${path}.coordinateUnit`)
  }

  const regionIds = new Set()
  const regionById = new Map()
  for (const [index, region] of manifest.regions.entries()) {
    const path = `regions[${index}]`
    if (!nonEmpty(region?.regionId) || !ID_RE.test(region.regionId)) add('REGION_ID_INVALID', 'Region requires a safe regionId.', `${path}.regionId`)
    else if (regionIds.has(region.regionId)) add('REGION_ID_DUPLICATE', `Duplicate regionId "${region.regionId}".`, `${path}.regionId`)
    else {
      regionIds.add(region.regionId)
      regionById.set(region.regionId, region)
    }
    if (sourceType === 'pdf') {
      if (!Number.isInteger(region?.pageNumber) || region.pageNumber < 1 || region.pageNumber > (manifest.source.pageCount || Infinity)) {
        add('REGION_PAGE_INVALID', 'Region pageNumber is outside the source PDF.', `${path}.pageNumber`)
      } else if (manifest.pages.length && !pageByNumber.has(region.pageNumber)) {
        add('REGION_PAGE_NOT_IN_MANIFEST', 'Region page must exist in the manifest page inventory.', `${path}.pageNumber`)
      }
    } else if (sourceType === 'docx') {
      if (region?.pageNumber != null || region?.bounds != null) {
        add('DOCX_PAGE_COORDINATES_FORBIDDEN', 'DOCX regions must use element provenance, not page numbers or coordinate bounds.', path)
      }
      if (!nonEmpty(region?.elementId) || !elementById.has(region.elementId)) {
        add('REGION_ELEMENT_MISSING', 'DOCX region must reference an existing source elementId.', `${path}.elementId`)
      } else {
        const element = elementById.get(region.elementId)
        if (region.documentOrder !== element.documentOrder) {
          add('REGION_DOCUMENT_ORDER_MISMATCH', 'Region documentOrder must match its referenced source element.', `${path}.documentOrder`)
        }
      }
      if (!Number.isInteger(region?.documentOrder) || region.documentOrder < 1) {
        add('REGION_DOCUMENT_ORDER_INVALID', 'DOCX region requires a positive documentOrder.', `${path}.documentOrder`)
      }
      if (region?.cropAssetId) {
        add('DOCX_CROP_ASSETS_UNSUPPORTED', 'DOCX crop assets are unsupported.', `${path}.cropAssetId`)
      }
    }
    if (!REGION_KINDS.has(region?.kind)) add('REGION_KIND_INVALID', `Unsupported region kind "${region?.kind}".`, `${path}.kind`)
    if (!EXTRACTION_METHODS.has(region?.extractionMethod)) add('EXTRACTION_METHOD_INVALID', 'Region extractionMethod is unsupported.', `${path}.extractionMethod`)
    if (!REVIEW_STATES.has(region?.reviewStatus)) add('REVIEW_STATUS_INVALID', 'Region reviewStatus is unsupported.', `${path}.reviewStatus`)
    if (!Number.isFinite(region?.confidence) || region.confidence < 0 || region.confidence > 1) add('REGION_CONFIDENCE_INVALID', 'confidence must be between 0 and 1.', `${path}.confidence`)
    const box = region?.bounds
    if (sourceType === 'pdf') {
      if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || !finitePositive(box.width) || !finitePositive(box.height)) {
        add('REGION_BOUNDS_INVALID', 'Region bounds require finite x/y and positive width/height.', `${path}.bounds`)
      } else {
        const page = pageByNumber.get(region.pageNumber)
        if (page && (box.x < 0 || box.y < 0 || box.x + box.width > page.width || box.y + box.height > page.height)) {
          add('REGION_BOUNDS_OUTSIDE_PAGE', 'Region bounds extend outside the declared source page.', `${path}.bounds`)
        }
      }
    }
    const owner = normalizeOwner(region?.owner)
    if (!owner || !OWNER_SCOPES.has(owner.scope)) add('REGION_OWNER_INVALID', 'Region requires a supported semantic owner scope.', `${path}.owner`)
    else {
      const requiredField = { paper: 'paperId', section: 'sectionId', passage: 'passageId', question: 'questionId', option: 'optionId' }[owner.scope]
      if (!nonEmpty(owner[requiredField])) add('REGION_OWNER_REFERENCE_MISSING', `Owner scope "${owner.scope}" requires ${requiredField}.`, `${path}.owner.${requiredField}`)
      if (owner.scope === 'option' && !nonEmpty(owner.questionId)) add('REGION_OPTION_QUESTION_MISSING', 'Option-owned regions must also identify their parent questionId.', `${path}.owner.questionId`)
      if (owner.paperId && owner.paperId !== String(manifest.owner?.paperId || '')) add('REGION_OWNER_PAPER_MISMATCH', 'Region owner paperId does not match manifest paperId.', `${path}.owner.paperId`)
    }
    if (region.kind === 'question-identifier' || region.kind === 'option-identifier') {
      if (region.cropAssetId) add('IDENTIFIER_MUST_NOT_BE_CROPPED', 'Printed question/option identifiers must not become content crop assets.', `${path}.cropAssetId`)
    }
    if (region.cropAssetId && !CROP_KINDS.has(region.kind)) add('NON_CONTENT_REGION_CROP_FORBIDDEN', `Region kind "${region.kind}" is not eligible for a content crop.`, `${path}.cropAssetId`)
  }

  const assetIds = new Set()
  const assetPaths = new Set()
  for (const [index, asset] of manifest.assets.entries()) {
    const path = `assets[${index}]`
    if (!nonEmpty(asset?.assetId) || !ID_RE.test(asset.assetId)) add('ASSET_ID_INVALID', 'Asset requires a safe assetId.', `${path}.assetId`)
    else if (assetIds.has(asset.assetId)) add('ASSET_ID_DUPLICATE', `Duplicate assetId "${asset.assetId}".`, `${path}.assetId`)
    else assetIds.add(asset.assetId)
    if (!nonEmpty(asset?.sourceRegionId) || !regionById.has(asset.sourceRegionId)) add('ASSET_SOURCE_REGION_MISSING', 'Asset must reference an existing source region.', `${path}.sourceRegionId`)
    if (!nonEmpty(asset?.mimeType) || !/^image\/(png|jpeg|webp)$/i.test(asset.mimeType)) add('ASSET_MIME_UNSUPPORTED', 'Crop assets must be raster PNG, JPEG, or WebP images.', `${path}.mimeType`)
    if (!SHA256_RE.test(String(asset?.sha256 || ''))) add('ASSET_SHA256_INVALID', 'Asset requires a SHA-256 digest.', `${path}.sha256`)
    if (!nonEmpty(asset?.relativePath) || asset.relativePath.startsWith('/') || asset.relativePath.includes('\\') || asset.relativePath.split('/').some(part => part === '..' || part === '.' || part === '')) add('ASSET_PATH_UNSAFE', 'Asset relativePath must be a safe normalized package-relative path.', `${path}.relativePath`)
    else if (assetPaths.has(asset.relativePath)) add('ASSET_PATH_DUPLICATE', `Duplicate asset path "${asset.relativePath}".`, `${path}.relativePath`)
    else assetPaths.add(asset.relativePath)
    const sourceRegion = regionById.get(asset?.sourceRegionId)
    if (sourceRegion) {
      if (!CROP_KINDS.has(sourceRegion.kind)) add('ASSET_SOURCE_NOT_CROPPABLE', 'Asset source region is not eligible for a content crop.', `${path}.sourceRegionId`)
      if (sourceRegion.kind === 'question-identifier' || sourceRegion.kind === 'option-identifier') add('ASSET_CONTAINS_STRUCTURAL_IDENTIFIER', 'Printed identifiers cannot be the source region for a content crop.', `${path}.sourceRegionId`)
      if (sourceRegion.cropAssetId && sourceRegion.cropAssetId !== asset.assetId) add('REGION_ASSET_LINK_MISMATCH', 'Region cropAssetId does not match this asset.', `${path}.assetId`)
    }
  }

  for (const [index, region] of manifest.regions.entries()) {
    if (region?.cropAssetId && !assetIds.has(region.cropAssetId)) add('REGION_ASSET_MISSING', `Region references missing crop asset "${region.cropAssetId}".`, `regions[${index}].cropAssetId`)
  }

  if (manifest.status === 'complete' && manifest.regions.some(region => region?.reviewStatus === 'needs-review')) {
    warnings.push({ code: 'MANIFEST_HAS_UNRESOLVED_REVIEW', message: 'Manifest is marked complete but contains regions requiring review.' })
  }
  if (!['in-progress', 'review-required', 'complete', 'failed'].includes(manifest.status)) add('MANIFEST_STATUS_INVALID', 'Unsupported manifest status.', 'status')

  return { valid: errors.length === 0, errors, warnings }
}

/** Compute SHA-256 for source files/assets without requiring a paid service. */
export async function sha256Hex(data) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable in this environment.')
  let bytes
  if (data instanceof ArrayBuffer) bytes = data
  else if (ArrayBuffer.isView(data)) bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  else if (typeof Blob !== 'undefined' && data instanceof Blob) bytes = await data.arrayBuffer()
  else throw new Error('sha256Hex expects a Blob, ArrayBuffer, or typed-array view.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
