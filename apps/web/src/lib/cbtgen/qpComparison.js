function countFingerprints(questions) {
  const counts = new Map()

  for (const question of questions) {
    const fingerprint = question.fingerprint

    counts.set(
      fingerprint,
      (counts.get(fingerprint) || 0) + 1
    )
  }

  return counts
}

/**
 * Compare two already-fingerprinted question papers.
 *
 * Important:
 * - question order is ignored
 * - duplicate questions are counted correctly
 * - paper fingerprint equality means exact canonical equality
 * - overlap percentages are reported in both directions
 * - no arbitrary "same QP" threshold is imposed here
 */
export function compareQuestionPapers(first, second) {
  const firstCounts = countFingerprints(
    first.questions
  )

  const secondCounts = countFingerprints(
    second.questions
  )

  let commonQuestions = 0

  for (const [fingerprint, firstCount] of firstCounts) {
    const secondCount =
      secondCounts.get(fingerprint) || 0

    commonQuestions += Math.min(
      firstCount,
      secondCount
    )
  }

  const firstQuestionCount =
    first.questions.length

  const secondQuestionCount =
    second.questions.length

  const firstCoverage =
    firstQuestionCount === 0
      ? 0
      : commonQuestions / firstQuestionCount

  const secondCoverage =
    secondQuestionCount === 0
      ? 0
      : commonQuestions / secondQuestionCount

  const exactPaperMatch =
    first.paperFingerprint ===
    second.paperFingerprint

  let relationship = 'DISTINCT'

  if (exactPaperMatch) {
    relationship = 'EXACT_DUPLICATE'
  } else if (commonQuestions > 0) {
    relationship = 'OVERLAP_REQUIRES_REVIEW'
  }

  return {
    relationship,

    exactPaperMatch,

    commonQuestions,

    firstQuestionCount,
    secondQuestionCount,

    firstCoverage,
    secondCoverage,

    firstOnlyQuestions:
      firstQuestionCount -
      commonQuestions,

    secondOnlyQuestions:
      secondQuestionCount -
      commonQuestions,
  }
}

export function formatCoverage(value) {
  return `${(value * 100).toFixed(1)}%`
}