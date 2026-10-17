export function parseSectionMarkingComment(commentText) {
  const text = String(commentText || '').trim()
  if (!text || !/SOURCE MARKING SCHEME/i.test(text)) return null

  const plusValues = [...text.matchAll(/\+(\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value))

  const minusValues = [...text.matchAll(/[−-](\d+(?:\.\d+)?)/g)]
    .map((match) => -Number(match[1]))
    .filter((value) => Number.isFinite(value))

  const correct = plusValues.length > 0 ? plusValues[0] : ''
  const wrong = minusValues.length > 0
    ? minusValues[minusValues.length - 1]
    : /\b0\s+in\s+all\s+other\s+cases\b/i.test(text)
      ? 0
      : ''

  const partialValues = plusValues.slice(1)
  const firstPlusIndex = text.search(/\+\d+(?:\.\d+)?/)
  const firstRuleSeparator = firstPlusIndex >= 0 ? text.indexOf(';', firstPlusIndex) : -1
  const partialRules = partialValues.length > 0 && firstRuleSeparator >= 0
    ? text.slice(firstRuleSeparator + 1).trim()
    : ''

  return {
    correct,
    wrong,
    partial: '',
    partialRules,
    source: text,
  }
}
