import { QUESTION_TYPES } from './questionTypes.js'

// Mirrors the explicit renderer registry in questionTypeRegistry.jsx. Kept as
// plain JS here so the selector can be exercised by Node integration tests.
const RENDERED_TYPES = new Set([
  'MCQ', 'MSQ', 'ASSERTION_REASON', 'IMAGE_CHOICE', 'IMAGE_MULTI_CHOICE',
  'NAT', 'TRUE_FALSE', 'YES_NO', 'NUMERIC_RANGE', 'SLIDER',
  'EQUATION_INPUT', 'DROPDOWN', 'MATCH', 'MATCH_MULTIPLE', 'ORDERING',
  'RANKING', 'TEXT_SHORT', 'TEXT_LONG', 'FILL_BLANK', 'ESSAY',
  'SUBJECTIVE', 'MATRIX_TEXT',
])

/**
 * Select a diversity-first subset of an imported paper for a Free Demo.
 *
 * The selector is deliberately non-destructive: selected entries are the
 * original question objects, so content, marking metadata and asset refs are
 * preserved. It never manufactures a replacement for an unsupported type.
 *
 * Selection is global across the demo, not reset at subject/section boundaries.
 * A question is selected when it introduces either a new semantic type or a
 * new renderer/content variation. Repeated candidates are skipped.
 */

function normalize(value) {
  return String(value ?? '').trim().toUpperCase()
}

function getSubjectKey(question) {
  // Subject identifiers and names must come from the imported paper model.
  // Do not map to a fixed list of subject names.
  const value = question?.subjectRef ?? question?.subjectName ?? question?.subject
  return value == null || String(value).trim() === '' ? '__unassigned_subject__' : String(value).trim()
}

function getSectionKey(question) {
  // Section identity is source-driven too. A missing section is grouped into
  // one explicit unassigned bucket rather than inventing section names.
  const value = question?.sectionRef ?? question?.sectionId ?? question?.sectionName ?? question?.section
  return value == null || String(value).trim() === '' ? '__unassigned_section__' : String(value).trim()
}

function stableValue(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(stableValue).join(',')
  if (typeof value === 'object') {
    return Object.keys(value).sort().map(key => `${key}:${stableValue(value[key])}`).join('|')
  }
  return String(value)
}

/**
 * Capture renderer-relevant differences without hashing or rewriting the
 * question itself. Content and asset references are included so visual
 * variations are not collapsed into an identical type signature.
 */
export function getDemoRendererSignature(question) {
  const content = question.content || {}
  const blocks = Array.isArray(content.blocks) ? content.blocks : []
  const blockTypes = blocks.map(block => normalize(block?.type)).filter(Boolean)
  const assetRefs = [
    ...(Array.isArray(content.images) ? content.images : []),
    ...(Array.isArray(content.media) ? content.media : []),
    ...(Array.isArray(question.assets) ? question.assets : []),
  ].map(asset => {
    if (typeof asset === 'string') return asset
    return asset?.id || asset?.src || asset?.ref || asset?.assetRef || stableValue(asset)
  }).sort()

  const responseOptions = Array.isArray(question.response?.options)
    ? question.response.options.map(option => ({
      hasImage: Boolean(option?.image || option?.imageRef || option?.assetRef || option?.src),
      hasMath: Boolean(option?.math || option?.latex || option?.formula),
      hasContentBlocks: Array.isArray(option?.content?.blocks) && option.content.blocks.length > 0,
    }))
    : []

  return [
    normalize(question.type),
    normalize(question.responseMode || question.response?.rawMode),
    [...new Set(blockTypes)].sort().join(','),
    assetRefs.length ? 'HAS_ASSETS' : 'NO_ASSETS',
    stableValue(responseOptions),
    question.response?.match ? 'MATCH_RESPONSE' : '',
    content.assertion ? 'ASSERTION' : '',
    content.reason ? 'REASON' : '',
  ].join('::')
}

function isRenderableType(type) {
  const normalizedType = normalize(type)
  return Boolean(QUESTION_TYPES[normalizedType] && RENDERED_TYPES.has(normalizedType))
}

/**
 * @param {{questions: object[], maxSubjects?: number, maxSectionsPerSubject?: number}} options
 * @returns {{questions: object[], report: {selectedCount: number, skippedDuplicates: number, unsupported: object[], omittedByLimits: object[], selectedTypes: string[], selectedRendererVariations: number}}}
 */
export function selectDiverseDemoQuestions({
  questions = [],
  maxSubjects = 3,
  maxSectionsPerSubject = 3,
} = {}) {
  const sourceQuestions = Array.isArray(questions) ? questions : []
  const selected = []
  const seenTypes = new Set()
  const seenRendererSignatures = new Set()
  const seenSubjects = new Set()
  const unsupported = []
  const omittedByLimits = []
  let skippedDuplicates = 0

  // Keep source order stable, but make two passes: first prefer questions
  // introducing a new canonical type; only after no more unique types can be
  // selected do we spend remaining diversity opportunities on new renderer
  // variations of already-seen types. Subject/section identity always comes
  // from each imported question's parsed metadata.
  const candidates = sourceQuestions.map((question, index) => ({ question, index, type: normalize(question?.type), subjectKey: getSubjectKey(question), sectionKey: getSectionKey(question) }))
  const accepted = new Set()
  const includedSections = new Map()
  const canIncludeByLimits = (candidate) => {
    const normalizedSubject = candidate.subjectKey.toLowerCase()
    const knownSubject = seenSubjects.has(normalizedSubject)
    if (!knownSubject && seenSubjects.size >= maxSubjects) {
      omittedByLimits.push({ questionId: candidate.question?.sourceQuestionId || candidate.question?.id || null, subject: candidate.subjectKey, section: candidate.sectionKey, reason: `Subject limit (${maxSubjects}) reached.` })
      return false
    }
    const sectionSetKey = `${normalizedSubject}::${candidate.sectionKey.toLowerCase()}`
    const sectionsForSubject = includedSections.get(normalizedSubject) || new Set()
    if (!sectionsForSubject.has(candidate.sectionKey.toLowerCase()) && sectionsForSubject.size >= maxSectionsPerSubject) {
      omittedByLimits.push({ questionId: candidate.question?.sourceQuestionId || candidate.question?.id || null, subject: candidate.subjectKey, section: candidate.sectionKey, reason: `Section limit (${maxSectionsPerSubject} per subject) reached.` })
      return false
    }
    candidate.normalizedSubject = normalizedSubject
    candidate.sectionSetKey = sectionSetKey
    return true
  }
  const selectCandidate = (candidate) => {
    if (!canIncludeByLimits(candidate)) return false
    const signature = getDemoRendererSignature(candidate.question)
    const addsNewType = !seenTypes.has(candidate.type)
    const addsNewRendererVariation = !seenRendererSignatures.has(signature)
    if (!addsNewType && !addsNewRendererVariation) {
      skippedDuplicates += 1
      return false
    }
    selected.push(candidate.question)
    accepted.add(candidate.index)
    seenSubjects.add(candidate.normalizedSubject)
    const sections = includedSections.get(candidate.normalizedSubject) || new Set()
    sections.add(candidate.sectionKey.toLowerCase())
    includedSections.set(candidate.normalizedSubject, sections)
    seenTypes.add(candidate.type)
    seenRendererSignatures.add(signature)
    return true
  }

  // Pass 1: globally prioritize new canonical types.
  for (const candidate of candidates) {
    if (!candidate.type || !isRenderableType(candidate.type)) {
      unsupported.push({ questionId: candidate.question?.sourceQuestionId || candidate.question?.id || null, type: candidate.type || '(missing type)', subject: candidate.subjectKey, section: candidate.sectionKey, reason: !candidate.type ? 'Question type is missing.' : 'No registered renderer is available for this question type.' })
      continue
    }
    if (!seenTypes.has(candidate.type)) selectCandidate(candidate)
  }

  // Pass 2: after unique types have had priority, add distinct renderer
  // variations where available, without repeating identical type+renderer pairs.
  for (const candidate of candidates) {
    if (accepted.has(candidate.index) || !candidate.type || !isRenderableType(candidate.type)) continue
    const signature = getDemoRendererSignature(candidate.question)
    if (!seenRendererSignatures.has(signature)) selectCandidate(candidate)
    else skippedDuplicates += 1
  }

  return {
    questions: selected,
    report: {
      selectedCount: selected.length,
      skippedDuplicates,
      unsupported,
      omittedByLimits,
      selectedTypes: [...seenTypes],
      selectedRendererVariations: seenRendererSignatures.size,
    },
  }
}

export default selectDiverseDemoQuestions
