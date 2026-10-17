import { validateExtractionManifest } from './extractionManifest.js'

/**
 * Fail-closed preflight for the finalization boundary.
 * This does not replace server authorization or the XML semantic validator;
 * callers must still perform those authoritative checks before persistence.
 */
export function validatePaperFinalization({ authenticatedOwnerId, manifest, reviewedXmlText, reviewedByOwnerId, sourceFileSizeBytes }) {
  const errors = []
  const warnings = []
  const ownerId = String(authenticatedOwnerId || '').trim()

  if (!ownerId) errors.push({ code: 'AUTH_REQUIRED', message: 'An authenticated owner is required before finalization.' })
  if (String(reviewedByOwnerId || '').trim() !== ownerId || !ownerId) {
    errors.push({ code: 'REVIEW_OWNER_MISMATCH', message: 'The review approval does not belong to the authenticated owner.' })
  }
  if (!Number.isFinite(sourceFileSizeBytes) || sourceFileSizeBytes < 0) {
    errors.push({ code: 'SOURCE_SIZE_INVALID', message: 'The source file size must be a non-negative byte count.' })
  } else if (sourceFileSizeBytes > 10_000_000) {
    errors.push({ code: 'SOURCE_FILE_TOO_LARGE', message: 'Source files must not exceed 10,000,000 bytes.' })
  }
  if (typeof reviewedXmlText !== 'string' || !reviewedXmlText.trim()) {
    errors.push({ code: 'REVIEWED_XML_MISSING', message: 'Reviewed canonical CBTGen XML is required.' })
  } else {
    if (!/^\s*<cbtgen\b/.test(reviewedXmlText) || !/<\/cbtgen>\s*$/.test(reviewedXmlText)) {
      errors.push({ code: 'XML_ROOT_INVALID', message: 'Finalized XML must have a CBTGen root element.' })
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(reviewedXmlText)) {
      errors.push({ code: 'XML_DTD_FORBIDDEN', message: 'DTD and entity declarations are forbidden.' })
    }
    if (/\b(?:userId|sessionId|billing|usageSlots)\s*=/.test(reviewedXmlText)) {
      errors.push({ code: 'RUNTIME_METADATA_IN_XML', message: 'Owner, session, and billing metadata must remain outside portable paper XML.' })
    }
  }

  const manifestResult = validateExtractionManifest(manifest)
  if (!manifestResult.valid) {
    for (const issue of manifestResult.errors) errors.push({ code: `MANIFEST_${issue.code}`, message: issue.message, path: issue.path })
  }
  warnings.push(...manifestResult.warnings)
  if (manifest?.owner?.userId && ownerId && String(manifest.owner.userId) !== ownerId) {
    errors.push({ code: 'MANIFEST_OWNER_MISMATCH', message: 'Extraction manifest owner does not match the authenticated owner.' })
  }
  if (manifest?.status !== 'complete') {
    errors.push({ code: 'EXTRACTION_NOT_COMPLETE', message: 'Extraction must be complete before finalization.' })
  }
  if (Array.isArray(manifest?.regions)) {
    const unresolved = manifest.regions.filter(region => region?.reviewStatus === 'needs-review' || region?.reviewStatus === 'not-reviewed')
    if (unresolved.length) errors.push({ code: 'REVIEW_INCOMPLETE', message: `${unresolved.length} extraction region(s) still require review.` })
    const rejected = manifest.regions.filter(region => region?.reviewStatus === 'rejected')
    if (rejected.length) errors.push({ code: 'REJECTED_REGION_PRESENT', message: `${rejected.length} extraction region(s) were rejected and must be resolved before finalization.` })
  }

  return { ready: errors.length === 0, errors, warnings }
}
