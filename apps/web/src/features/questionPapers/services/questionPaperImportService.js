import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import { validateCbtgenXml } from '../../../lib/cbtgen/semanticValidator'
import { buildAssetFingerprintContext, fingerprintPaper } from '../../../lib/cbtgen/fingerprint'
import { compareQuestionPapers } from '../../../lib/cbtgen/qpComparison'
import { selectBestCbtgenVersion } from '../../../lib/cbtgen/regressionComparator'
import { parsePaper } from '../../../lib/cbtgen/paperModel'
import { savePaper, saveSourcePaper } from '../../../lib/cbtgen/paperStorage'
import { readCbtgenFile } from '../../../lib/cbtgen/packageFormat'

export async function readQuestionPaperFile(file) {
  return readCbtgenFile(file)
}

export async function validateQuestionPaperFile(file) {
  const source = await readCbtgenFile(file)
  const validationResult = validateCbtgenXml(source.xml)

  if (!validationResult.valid) {
    return {
      ...validationResult,
      format: source.format,
      assetCount: source.assets.length,
    }
  }

  let fingerprintResult = null

  if (validationResult.summary?.scoringReady) {
    fingerprintResult = await fingerprintPaper(source.xml, source.assets)
  }

  return {
    ...validationResult,
    format: source.format,
    assetCount: source.assets.length,
    fingerprint: fingerprintResult,
  }
}

export async function importQuestionPaperFile(file, result) {
  const source = await readCbtgenFile(file)
  const normalizedPaper = parsePaper(source.xml)
  const summary = result.summary || {}
  const exam = source.xml.querySelector('exam')
  const yearText = exam?.querySelector('year')?.textContent?.trim() || ''
  const paperNumber = exam?.querySelector('paperNumber')?.textContent?.trim() || '1'
  const qpId = exam?.querySelector('qpId')?.textContent?.trim() || ''

  const fingerprint = result.fingerprint?.paperFingerprint || ''

  const importResult = await cbtgenApi.questionPapers.import({
    name: summary.examName || 'Untitled Question Paper',
    category: summary.category || 'Imported',
    year: yearText || '',
    paperNumber,
    questions: summary.totalQuestions ?? 0,
    marks: summary.totalMarks ?? 0,
    duration: Number.isFinite(Number(summary.durationMinutes)) && Number(summary.durationMinutes) > 0
      ? `${Number(summary.durationMinutes)} min`
      : null,
    sections: summary.sections ?? 0,
    questionTypes: Object.keys(summary.questionTypes || {}),
    fingerprint,
    questionFingerprints: result.fingerprint?.questions?.map((question) => question.fingerprint) || [],
    sourceId: summary.scoringReady
      ? ''
      : `source-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    identityStatus: summary.scoringReady ? 'READY' : 'PENDING_ANSWER_KEY',
    answerKeyStatus: summary.answerKeyStatus || (summary.scoringReady ? 'COMPLETE' : 'MISSING'),
    scoringReady: summary.scoringReady === true,
    qpId,
    sourceFileName: file.name,
  })

  if (!importResult?.success) {
    throw new Error(
      importResult?.message ||
        'The question paper could not be added to your library.'
    )
  }

  if (summary.scoringReady) {
    await savePaper({
      userId: importResult.questionPaper.userId,
      fingerprint:
        importResult?.questionPaper?.fingerprint ||
        fingerprint,
      xmlText: source.xmlText,
      paper: normalizedPaper,
      sourceFileName: file.name,
      assets: source.assets,
    })
  } else {
    const sourceId = importResult?.questionPaper?.sourceId

    if (!sourceId) {
      throw new Error(
        'The source-only paper was registered without a source storage id.'
      )
    }

    await saveSourcePaper({
      userId: importResult.questionPaper.userId,
      sourceId,
      xmlText: source.xmlText,
      paper: normalizedPaper,
      sourceFileName: file.name,
      assets: source.assets,
    })
  }

  return importResult
}

export async function compareQuestionPaperFile(file, referenceFingerprint) {
  const source = await readCbtgenFile(file)
  const validation = validateCbtgenXml(source.xml)

  if (!validation.valid) {
    return {
      error: 'The comparison CBTGen paper failed semantic validation.',
      validation,
    }
  }

  const fingerprint = await fingerprintPaper(source.xml, source.assets)
  const comparison = compareQuestionPapers(referenceFingerprint, fingerprint)

  return {
    comparison,
    paper: validation.summary,
    format: source.format,
    assetCount: source.assets.length,
  }
}

export async function buildAssetContextFromStoredAssets(assets = []) {
  return buildAssetFingerprintContext(assets)
}


/**
 * Phase 27D: compare a new conversion with the previously approved/best
 * conversion before allowing replacement. The caller remains responsible for
 * persisting the selected document; this function never mutates either file.
 */
export async function compareQuestionPaperRegressionFiles(baselineFile, candidateFile) {
  const baseline = await readCbtgenFile(baselineFile)
  const candidate = await readCbtgenFile(candidateFile)

  const baselineValidation = validateCbtgenXml(baseline.xml)
  const candidateValidation = validateCbtgenXml(candidate.xml)

  if (!baselineValidation.valid) {
    return {
      selected: 'baseline',
      error: 'The previously approved/best paper failed semantic validation.',
      baselineValidation,
      candidateValidation,
    }
  }

  if (!candidateValidation.valid) {
    return {
      selected: 'baseline',
      comparison: {
        candidateAccepted: false,
        regressions: [{
          severity: 'error',
          code: 'CANDIDATE_SEMANTIC_VALIDATION_FAILED',
          message: 'Candidate conversion failed semantic validation and cannot replace the baseline.',
        }],
        improvements: [],
      },
      baselineValidation,
      candidateValidation,
    }
  }

  const selection = selectBestCbtgenVersion({
    baselineDocument: baseline.xml,
    candidateDocument: candidate.xml,
  })

  return {
    ...selection,
    baselineValidation,
    candidateValidation,
    baselineFormat: baseline.format,
    candidateFormat: candidate.format,
    baselineAssetCount: baseline.assets.length,
    candidateAssetCount: candidate.assets.length,
  }
}
