const STORAGE_KEY = 'cbtgen_conversion_recovery_v1'
function safeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

export function createConversionRecoveryRecord({ fileName, result, createdAt = new Date().toISOString() }) {
  const errors = Array.isArray(result?.errors) ? result.errors : []
  const warnings = Array.isArray(result?.warnings) ? result.warnings : []
  const summary = result?.summary || {}

  return {
    version: 1,
    fileName: safeString(fileName, 'Unknown CBTGen file'),
    createdAt,
    valid: result?.valid === true,
    status: safeString(result?.status, result?.valid ? 'VALID' : 'REJECTED'),
    summary: {
      examName: safeString(summary.examName),
      totalQuestions: Number.isFinite(summary.totalQuestions) ? summary.totalQuestions : null,
      sections: Number.isFinite(summary.sections) ? summary.sections : null,
      scoringReady: summary.scoringReady === true,
    },
    errorCount: errors.length,
    warningCount: warnings.length,
    errors: errors.map((item) => ({
      code: safeString(item?.code, 'VALIDATION_ERROR'),
      message: safeString(item?.message, 'No validation details were supplied.'),
    })),
    warnings: warnings.map((item) => ({
      code: safeString(item?.code, 'VALIDATION_WARNING'),
      message: safeString(item?.message, 'No warning details were supplied.'),
    })),
    truncated: false,
  }
}

export function formatConversionCorrectionHandoff(record) {
  if (!record || typeof record !== 'object') return ''

  const lines = [
    'CBTGen CONVERSION CORRECTION REPORT',
    `File: ${record.fileName || 'Unknown CBTGen file'}`,
    `Last validation: ${record.createdAt || 'unknown'}`,
    `Status: ${record.valid ? 'VALID' : 'REJECTED'}`,
    `Errors: ${Number(record.errorCount) || 0}; warnings: ${Number(record.warningCount) || 0}`,
    '',
    'TASK FOR THE EXTERNAL CONVERSION TOOL:',
    'Correct only the listed source-backed issues in the existing conversion. Preserve every question, option, original order, section, image, language, marking rule, and source-faithful content.',
    'Do not invent answers, values, equations, missing text, image contents, or metadata. If the source is ambiguous or information is absent, retain it as unresolved/source-only and explain that limitation.',
    'For math errors, use structured <math> only when the exact expression is source-supported; otherwise preserve a tight math-only crop. Do not leave the same mathematical notation flattened in ordinary text.',
    'For visual errors, use tight question-owned or option-owned semantic crops. Never reuse a whole-page screenshot as a normal question asset; use a full-page fallback only when segmentation is genuinely impossible and the XML explicitly declares that fallback.',
    'Resolve question-level reviewStatus notes as well as the listed error codes. A note such as crop boundary should be checked or not fully certified is not a completed conversion.',
    'Return the complete corrected CBTGen output in the required original packaging format, not a patch or partial XML. Do not claim success until all validation errors are resolved.',
    '',
    'VALIDATION SCOPE LIMIT:',
    'CBTGen validates the XML and machine-checkable semantic/asset contracts. Passing these checks does not by itself prove pixel-level crop fidelity or successful live import/rendering against the original PDF. Do not describe the conversion as source-certified unless source reconciliation has actually been completed.',
    '',
    'VALIDATION ERRORS:',
  ]

  if (!record.errors?.length) lines.push('None recorded.')
  else record.errors.forEach((item, index) => lines.push(`${index + 1}. [${item.code}] ${item.message}`))

  lines.push('', 'VALIDATION WARNINGS:')
  if (!record.warnings?.length) lines.push('None recorded.')
  else record.warnings.forEach((item, index) => lines.push(`${index + 1}. [${item.code}] ${item.message}`))


  lines.push('', 'CBTGen reminder: validation reports describe detected problems; they do not authorize guessing or changing source facts.')
  return lines.join('\n')
}

export function saveConversionRecoveryRecord(record, storage = globalThis.localStorage) {
  try {
    if (!storage) return false
    storage.setItem(STORAGE_KEY, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export function loadConversionRecoveryRecord(storage = globalThis.localStorage) {
  try {
    if (!storage) return null
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw)
    return record?.version === 1 && typeof record.fileName === 'string' ? record : null
  } catch {
    return null
  }
}

export function clearConversionRecoveryRecord(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
