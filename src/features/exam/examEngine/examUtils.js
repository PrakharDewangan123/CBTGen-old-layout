export function parseDurationMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value ?? '').trim()
  const match = text.match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function textFromContent(content) {
  if (!content) return ''
  if (Array.isArray(content.blocks) && content.blocks.length) {
    return content.blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.value || '')
      .join('')
      .trim()
  }
  return content.text || ''
}

export function getSectionIdForQuestion(question) {
  return question?.sectionRef || '__default__'
}

export function getAnswerValue(answer, question) {
  if (answer == null) return null
  if (question.type === 'MSQ' || question.type === 'IMAGE_MULTI_CHOICE' || question.type === 'MATRIX_MULTI') {
    return Array.isArray(answer) ? answer : []
  }
  return answer
}

export function getCounts(questions, answers, review, visited) {
  let a = 0
  let r = 0
  let ar = 0
  let nv = 0
  let na = 0

  questions.forEach(question => {
    const id = question.sourceQuestionId
    const A = answers[id] != null && (!Array.isArray(answers[id]) || answers[id].length > 0)
    const R = !!review[id]
    if (!visited.has(id)) nv += 1
    else if (A && R) ar += 1
    else if (R) r += 1
    else if (A) a += 1
    else na += 1
  })

  return { a, r, ar, nv, na, total: questions.length }
}

export function answerIsPresent(question, value) {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  return String(value).trim() !== ''
}

export function getPartialMarkingRule(marking = {}) {
  const partialMarking = marking?.partialMarking
  const rule =
    marking?.partialRules ||
    (typeof partialMarking === 'string' ? partialMarking : '') ||
    partialMarking?.rule ||
    partialMarking?.scheme ||
    partialMarking?.formula ||
    marking?.partial?.rule ||
    marking?.partial?.scheme ||
    marking?.partial?.formula ||
    ''

  return String(rule).replace(/\s+/g, ' ').trim()
}

export function getPartialMarkingDisplay(marking = {}) {
  const numeric = marking?.partial
  if (numeric !== undefined && numeric !== null && numeric !== '' && Number.isFinite(Number(numeric))) {
    return String(numeric)
  }

  const rule = getPartialMarkingRule(marking)
  if (!rule) return ''

  const values = [...rule.matchAll(/\+(\d+(?:\.\d+)?)/g)]
    .map(match => match[1])
    .filter((value, index, array) => array.indexOf(value) === index)

  return values.length ? values.map(value => `+${value}`).join(' / ') : 'Configured'
}

export function shortenSectionName(sectionName = '') {
  const value = String(sectionName || '').trim()
  const match = value.match(/^(.*?)\s*(?:—|–|-)\s*(Section\s*\d+).*$/i)
  if (match) return `${match[1].trim()} - ${match[2].trim()}`
  return value
}

export function extractSubjectName(sectionName = '') {
  const value = String(sectionName || '').trim()
  if (!value) return ''
  return value.replace(/\s*(?:—|–|-)\s*Section\s*\d+.*$/i, '').trim() || value
}

export function optionLabel(option, index) {
  return option?.sourceLabel || String.fromCharCode(65 + index)
}
