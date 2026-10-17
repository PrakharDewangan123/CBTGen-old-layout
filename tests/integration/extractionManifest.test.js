import assert from 'node:assert/strict'
import { createExtractionManifest, sha256Hex, validateExtractionManifest } from '../../src/lib/cbtgen/extractionManifest.js'

const manifest = createExtractionManifest({
  ownerId: 'user-a',
  paperId: 'paper-a',
  source: { fileName: 'paper.pdf', pageCount: 1, sha256: 'a'.repeat(64) },
  jobId: 'extract-test-001',
})
manifest.pages.push({ pageId: 'page-1', pageNumber: 1, width: 595, height: 842, coordinateUnit: 'pdf-points' })
manifest.regions.push(
  {
    regionId: 'region-question', pageNumber: 1, kind: 'question-content',
    owner: { scope: 'question', paperId: 'paper-a', questionId: 'q-internal-1' },
    bounds: { x: 30, y: 100, width: 400, height: 120 }, extractionMethod: 'native-pdf-text',
    confidence: 0.99, reviewStatus: 'accepted', cropAssetId: 'asset-question-content',
  },
  {
    regionId: 'region-option-label', pageNumber: 1, kind: 'option-identifier',
    owner: { scope: 'option', paperId: 'paper-a', questionId: 'q-internal-1', optionId: 'opt-internal-a' },
    bounds: { x: 30, y: 240, width: 20, height: 15 }, extractionMethod: 'native-pdf-text',
    confidence: 1, reviewStatus: 'accepted',
  },
)
manifest.assets.push({
  assetId: 'asset-question-content', sourceRegionId: 'region-question',
  mimeType: 'image/png', sha256: 'b'.repeat(64), relativePath: 'assets/crops/asset-question-content.png',
})
manifest.status = 'complete'

assert.equal(validateExtractionManifest(manifest).valid, true)

const duplicateAsset = structuredClone(manifest)
duplicateAsset.assets.push({ ...duplicateAsset.assets[0] })
assert.ok(validateExtractionManifest(duplicateAsset).errors.some(error => error.code === 'ASSET_ID_DUPLICATE'))

const wrongOwner = structuredClone(manifest)
wrongOwner.regions[0].owner.paperId = 'paper-b'
assert.ok(validateExtractionManifest(wrongOwner).errors.some(error => error.code === 'REGION_OWNER_PAPER_MISMATCH'))

const labelCrop = structuredClone(manifest)
labelCrop.regions[1].cropAssetId = 'asset-question-content'
assert.ok(validateExtractionManifest(labelCrop).errors.some(error => error.code === 'IDENTIFIER_MUST_NOT_BE_CROPPED'))

const unsafePath = structuredClone(manifest)
unsafePath.assets[0].relativePath = 'assets/../../other-user/private.png'
assert.ok(validateExtractionManifest(unsafePath).errors.some(error => error.code === 'ASSET_PATH_UNSAFE'))

const missingRegion = structuredClone(manifest)
missingRegion.assets[0].sourceRegionId = 'region-missing'
assert.ok(validateExtractionManifest(missingRegion).errors.some(error => error.code === 'ASSET_SOURCE_REGION_MISSING'))

const missingAsset = structuredClone(manifest)
missingAsset.regions[0].cropAssetId = 'asset-does-not-exist'
assert.ok(validateExtractionManifest(missingAsset).errors.some(error => error.code === 'REGION_ASSET_MISSING'))

const outOfBounds = structuredClone(manifest)
outOfBounds.regions[0].bounds = { x: 590, y: 100, width: 20, height: 20 }
assert.ok(validateExtractionManifest(outOfBounds).errors.some(error => error.code === 'REGION_BOUNDS_OUTSIDE_PAGE'))

const unsupportedVector = structuredClone(manifest)
unsupportedVector.assets[0].mimeType = 'image/svg+xml'
assert.ok(validateExtractionManifest(unsupportedVector).errors.some(error => error.code === 'ASSET_MIME_UNSUPPORTED'))

assert.throws(() => createExtractionManifest({ paperId: 'paper-a', source: { fileName: 'paper.pdf', pageCount: 1 } }), /authenticated owner ID/i)
assert.throws(() => createExtractionManifest({ ownerId: 'user-a', paperId: 'paper-a', source: { fileName: 'paper.pdf', pageCount: 0, sha256: 'a'.repeat(64) } }), /positive integer/i)
assert.throws(() => createExtractionManifest({ ownerId: 'user-a', paperId: 'paper-a', source: { fileName: 'paper.pdf', pageCount: 1 } }), /SHA-256 digest is required/i)
assert.equal(await sha256Hex(new Uint8Array([97, 98, 99])), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')


const docxManifest = createExtractionManifest({
  ownerId: 'user-a',
  paperId: 'paper-docx',
  source: {
    fileName: 'paper.docx',
    fileType: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sha256: 'c'.repeat(64),
  },
  jobId: 'extract-docx-test-001',
})

docxManifest.elements.push(
  { elementId: 'paragraph-1', documentOrder: 1, kind: 'paragraph', extractionMethod: 'docx-ooxml', reviewStatus: 'accepted' },
  { elementId: 'table-1', documentOrder: 2, kind: 'table', extractionMethod: 'docx-ooxml', reviewStatus: 'accepted' },
)

docxManifest.regions.push({
  regionId: 'docx-question-1',
  elementId: 'paragraph-1',
  documentOrder: 1,
  kind: 'question-content',
  owner: { scope: 'question', paperId: 'paper-docx', questionId: 'q-docx-1' },
  extractionMethod: 'docx-ooxml',
  confidence: 1,
  reviewStatus: 'accepted',
})
docxManifest.status = 'complete'

assert.equal(
  validateExtractionManifest(docxManifest).valid,
  true,
  JSON.stringify(validateExtractionManifest(docxManifest).errors),
)

const docxFakePageCount = structuredClone(docxManifest)
docxFakePageCount.source.pageCount = 1
assert.ok(validateExtractionManifest(docxFakePageCount).errors.some(error => error.code === 'DOCX_PAGE_COUNT_FORBIDDEN'))

const docxFakePage = structuredClone(docxManifest)
docxFakePage.pages.push({ pageId: 'page-1', pageNumber: 1, width: 595, height: 842, coordinateUnit: 'pdf-points' })
assert.ok(validateExtractionManifest(docxFakePage).errors.some(error => error.code === 'DOCX_PAGE_GEOMETRY_FORBIDDEN'))

const docxMissingElement = structuredClone(docxManifest)
docxMissingElement.regions[0].elementId = 'paragraph-missing'
assert.ok(validateExtractionManifest(docxMissingElement).errors.some(error => error.code === 'REGION_ELEMENT_MISSING'))

const docxWrongOrder = structuredClone(docxManifest)
docxWrongOrder.regions[0].documentOrder = 2
assert.ok(validateExtractionManifest(docxWrongOrder).errors.some(error => error.code === 'REGION_DOCUMENT_ORDER_MISMATCH'))

const docxFakeCoordinates = structuredClone(docxManifest)
docxFakeCoordinates.regions[0].bounds = { x: 1, y: 1, width: 10, height: 10 }
assert.ok(validateExtractionManifest(docxFakeCoordinates).errors.some(error => error.code === 'DOCX_PAGE_COORDINATES_FORBIDDEN'))

const docxFakeCrop = structuredClone(docxManifest)
docxFakeCrop.regions[0].cropAssetId = 'docx-crop-1'
assert.ok(validateExtractionManifest(docxFakeCrop).errors.some(error => error.code === 'DOCX_CROP_ASSETS_UNSUPPORTED'))

const docxDuplicateOrder = structuredClone(docxManifest)
docxDuplicateOrder.elements[1].documentOrder = 1
assert.ok(validateExtractionManifest(docxDuplicateOrder).errors.some(error => error.code === 'ELEMENT_DOCUMENT_ORDER_DUPLICATE'))

const invalidType = structuredClone(docxManifest)
invalidType.source.fileType = 'html'
assert.ok(validateExtractionManifest(invalidType).errors.some(error => error.code === 'SOURCE_FILE_TYPE_INVALID'))

assert.throws(() => createExtractionManifest({
  ownerId: 'user-a',
  paperId: 'paper-docx',
  source: { fileName: 'paper.docx', fileType: 'docx', pageCount: 1, sha256: 'c'.repeat(64) },
}), /must not invent a pageCount/i)

console.log('  DOCX element provenance, document order, fabricated-page rejection, and crop restrictions are validated.')

console.log('Extraction manifest contract tests passed.')
console.log('  Owner, source coordinates, semantic regions, asset references, identifier exclusion, and safe package paths are validated.')
