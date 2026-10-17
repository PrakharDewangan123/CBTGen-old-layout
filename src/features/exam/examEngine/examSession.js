import { randomizePaper } from '../../../lib/cbtgen/randomizer'

export function readSessionJson(key) {
  try {
    const value = sessionStorage.getItem(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

/**
 * Backward-compatible examination import.
 *
 * Randomization is implemented centrally by the CBTGen randomization engine.
 * This module remains the examination-session boundary for sessionStorage and
 * XML-derived session enrichment; it no longer owns a second randomization
 * implementation.
 */
export { randomizePaper }

export function enrichPaperWithPartialMarking(paper, xmlText) {
  if (!paper || typeof xmlText !== 'string' || !xmlText.trim()) return paper
  try {
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
    if (xml.querySelector('parsererror')) return paper
    const rules = new Map()
    Array.from(xml.querySelectorAll('question')).forEach((question) => {
      const id = question.getAttribute('id')
      if (!id) return
      const partial =
        question.querySelector('marking > partialMarking') ||
        question.querySelector('partialMarking')
      const rule =
        question.querySelector('marking > partialMarking > rule')?.textContent?.trim() ||
        question.querySelector('marking > partialMarking > scheme')?.textContent?.trim() ||
        question.querySelector('marking > partialMarking > formula')?.textContent?.trim() ||
        question.querySelector('partialMarking > rule')?.textContent?.trim() ||
        question.querySelector('partialMarking > scheme')?.textContent?.trim() ||
        question.querySelector('partialMarking > formula')?.textContent?.trim() ||
        partial?.textContent?.trim() ||
        ''
      if (rule) rules.set(id, rule)
    })
    if (!rules.size) return paper
    return {
      ...paper,
      questions: (paper.questions || []).map((question) => {
        const rule = rules.get(question.sourceQuestionId || question.id)
        if (!rule) return question
        return {
          ...question,
          marking: {
            ...(question.marking || {}),
            partialRules: rule,
          },
        }
      }),
    }
  } catch {
    return paper
  }
}
