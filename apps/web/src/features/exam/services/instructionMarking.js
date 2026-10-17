function firstNumber(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value)
    }
  }

  return 0
}

export function findConfiguredSection(configSections, sectionLike) {
  if (!sectionLike) return null

  return (Array.isArray(configSections) ? configSections : []).find((candidate) =>
    String(candidate?.id || '') === String(sectionLike?.id || sectionLike?.sectionId || '') ||
    String(candidate?.name || '').trim() === String(sectionLike?.name || sectionLike?.title || '').trim(),
  ) || null
}

export function findConfiguredType(configSection, type) {
  if (!configSection) return null

  return (configSection.types || []).find(
    (row) => String(row?.type || '') === String(type || ''),
  ) || null
}

export function resolveInstructionMarking(questionMarking = {}, configuredType = null, xmlPartialRule = '') {
  const marking = questionMarking || {}

  const hasExplicitCorrect =
    (marking.correct !== undefined && marking.correct !== null && marking.correct !== '') ||
    (marking.correctMarks !== undefined && marking.correctMarks !== null && marking.correctMarks !== '')
  const hasExplicitWrong =
    (marking.incorrect !== undefined && marking.incorrect !== null && marking.incorrect !== '') ||
    (marking.wrong !== undefined && marking.wrong !== null && marking.wrong !== '') ||
    (marking.incorrectMarks !== undefined && marking.incorrectMarks !== null && marking.incorrectMarks !== '')
  const hasExplicitPartial =
    (marking.partial !== undefined && marking.partial !== null && marking.partial !== '') ||
    (marking.partialMarks !== undefined && marking.partialMarks !== null && marking.partialMarks !== '')

  return {
    correct: hasExplicitCorrect
      ? firstNumber(marking.correct, marking.correctMarks)
      : firstNumber(configuredType?.correct),
    wrong: hasExplicitWrong
      ? firstNumber(marking.incorrect, marking.wrong, marking.incorrectMarks)
      : firstNumber(configuredType?.wrong),
    partial: hasExplicitPartial
      ? firstNumber(marking.partial, marking.partialMarks)
      : firstNumber(configuredType?.partial),
    partialRule:
      marking.partialRules ||
      marking.partialMarking ||
      marking.partial?.rule ||
      xmlPartialRule ||
      configuredType?.partialRules ||
      configuredType?.partialRule ||
      '',
  }
}
