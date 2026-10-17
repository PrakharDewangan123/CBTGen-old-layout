/*
 * CBTGen Scoring Engine
 *
 * Responsibilities:
 * - Resolve the effective marking rule
 * - Classify a candidate response
 * - Score individual questions
 * - Support MCQ / MSQ / NAT / MATCH
 * - Support:
 *      PARTIAL       (+ / - / partial / 0)
 *      NEGATIVE      (+ / - / 0)
 *      POSITIVE_ONLY (+ / 0)
 * - Build section / category / subject / exam results
 *
 * IMPORTANT:
 * Scoring is driven by the source paper's marking rules.
 * The engine does NOT assume a universal exam formula.
 *
 * Marking hierarchy:
 *
 * Question
 *    ↓
 * Category
 *    ↓
 * Section
 *    ↓
 * Paper/default
 *
 * The most specific explicitly defined rule wins.
 */

/* -------------------------------------------------------------------------- */
/* STATUS CONSTANTS                                                           */
/* -------------------------------------------------------------------------- */

const QUESTION_STATUS = Object.freeze({
  CORRECT: 'CORRECT',
  INCORRECT: 'INCORRECT',
  UNATTEMPTED: 'UNATTEMPTED',
  PARTIAL: 'PARTIAL',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
})

const RESPONSE_CLASSIFICATION = Object.freeze({
  PERFECT: 'PERFECT',
  IMPERFECT: 'IMPERFECT',
  WRONG: 'WRONG',
  UNATTEMPTED: 'UNATTEMPTED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
})

const MARKING_MODE = Object.freeze({
  PARTIAL: 'PARTIAL',
  NEGATIVE: 'NEGATIVE',
  POSITIVE_ONLY: 'POSITIVE_ONLY',
})

/* -------------------------------------------------------------------------- */
/* GENERIC HELPERS                                                            */
/* -------------------------------------------------------------------------- */

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}


function isDefined(value) {
  return (
    value !== undefined &&
    value !== null
  )
}


function roundNumber(value, decimals = 10) {
  const factor = 10 ** decimals

  return (
    Math.round(
      (Number(value) + Number.EPSILON) *
        factor
    ) / factor
  )
}

function normalizeString(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
}

function normalizeId(value) {
  if (!isDefined(value)) {
    return null
  }

  return String(value)
}

/* -------------------------------------------------------------------------- */
/* SET HELPERS                                                                */
/* -------------------------------------------------------------------------- */

function normalizeIdSet(value) {
  if (!Array.isArray(value)) {
    return new Set()
  }

  return new Set(
    value
      .filter(isDefined)
      .map(normalizeId)
      .filter(Boolean)
  )
}

function setsEqual(first, second) {
  if (first.size !== second.size) {
    return false
  }

  for (const value of first) {
    if (!second.has(value)) {
      return false
    }
  }

  return true
}


function setContainsAny(set, values) {
  for (const value of values) {
    if (set.has(value)) {
      return true
    }
  }

  return false
}

/* -------------------------------------------------------------------------- */
/* RESPONSE EXTRACTION                                                        */
/* -------------------------------------------------------------------------- */

/*
 * Candidate answers are intentionally allowed to come in several shapes.
 *
 * Examples:
 *
 * MCQ:
 *   { selectedOptionId: 'opt-1' }
 *
 * or:
 *
 *   { selectedOptionIds: ['opt-1'] }
 *
 * MSQ:
 *   { selectedOptionIds: ['opt-1', 'opt-3'] }
 *
 * NAT:
 *   { numericValue: 42 }
 *
 * MATCH:
 *   {
 *     matchMappings: [
 *       { left: 'L1', right: 'R2' }
 *     ]
 *   }
 */

function getSelectedOptionIds(response) {
  if (!isObject(response)) {
    return []
  }

  if (
    Array.isArray(
      response.selectedOptionIds
    )
  ) {
    return response.selectedOptionIds
      .filter(isDefined)
      .map(normalizeId)
      .filter(Boolean)
  }

  if (
    Array.isArray(response.optionIds)
  ) {
    return response.optionIds
      .filter(isDefined)
      .map(normalizeId)
      .filter(Boolean)
  }

  if (
    isDefined(response.selectedOptionId)
  ) {
    return [normalizeId(
      response.selectedOptionId
    )]
  }

  if (
    isDefined(response.optionId)
  ) {
    return [normalizeId(
      response.optionId
    )]
  }

  return []
}

function getNumericResponse(response) {
  if (!isObject(response)) {
    return null
  }

  const candidates = [
    response.numericValue,
    response.value,
    response.rawValue,
  ]

  for (const candidate of candidates) {
    if (
      isDefined(candidate) &&
      String(candidate).trim() !== ''
    ) {
      const number = Number(candidate)

      if (Number.isFinite(number)) {
        return number
      }
    }
  }

  return null
}

function getMatchMappings(response) {
  if (!isObject(response)) {
    return []
  }

  const mappings =
    response.matchMappings ||
    response.mappings ||
    response.mapping

  if (Array.isArray(mappings)) {
    return mappings
      .map((pair) => ({
        left: normalizeId(
          pair?.left ??
            pair?.leftId
        ),
        right: normalizeId(
          pair?.right ??
            pair?.rightId
        ),
      }))
      .filter(
        (pair) =>
          pair.left &&
          pair.right
      )
  }

  if (isObject(mappings)) {
    return Object.entries(mappings)
      .map(([left, right]) => ({
        left: normalizeId(left),
        right: normalizeId(right),
      }))
      .filter(
        (pair) =>
          pair.left &&
          pair.right
      )
  }

  return []
}

function hasCandidateResponse(response) {
  if (!isObject(response)) {
    return false
  }

  const optionIds =
    getSelectedOptionIds(response)

  if (optionIds.length > 0) {
    return true
  }

  const numericValue =
    getNumericResponse(response)

  if (numericValue !== null) {
    return true
  }

  const mappings =
    getMatchMappings(response)

  if (mappings.length > 0) {
    return true
  }

  if (
    isDefined(response.rawValue) &&
    String(response.rawValue).trim() !== ''
  ) {
    return true
  }

  if (
    isDefined(response.text) &&
    String(response.text).trim() !== ''
  ) {
    return true
  }

  return false
}

/* -------------------------------------------------------------------------- */
/* MARKING RULE                                                               */
/* -------------------------------------------------------------------------- */

/*
 * Supported source marking representation:
 *
 * {
 *   correct: 4,
 *   incorrect: -2,
 *   partial: 1,
 *   unattempted: 0,
 *   partialMarking: true
 * }
 *
 * or:
 *
 * {
 *   correct: 4,
 *   incorrect: -1,
 *   unattempted: 0
 * }
 *
 * or:
 *
 * {
 *   correct: 4,
 *   unattempted: 0
 * }
 *
 * The engine determines the mode from explicit
 * source information where possible.
 *
 * It never invents a partial value.
 */

function hasNumericMark(marking, key) {
  return (
    isObject(marking) &&
    isDefined(marking[key]) &&
    Number.isFinite(
      Number(marking[key])
    )
  )
}

function inferMarkingMode(marking) {
  if (!isObject(marking)) {
    return null
  }

  /*
   * Explicit mode has highest priority.
   */
  const explicitMode =
    marking.mode ||
    marking.markingMode

  if (explicitMode) {
    const normalized =
      normalizeString(explicitMode)

    if (
      normalized === 'partial' ||
      normalized === 'partial_marking'
    ) {
      return MARKING_MODE.PARTIAL
    }

    if (
      normalized === 'negative' ||
      normalized === 'negative_marking'
    ) {
      return MARKING_MODE.NEGATIVE
    }

    if (
      normalized === 'positive_only' ||
      normalized === 'positive-only' ||
      normalized === 'positive'
    ) {
      return MARKING_MODE.POSITIVE_ONLY
    }
  }

  /*
   * Explicit partialMarking flag.
   */
  if (
    marking.partialMarking === true ||
    marking.partialMarking === 'true' ||
    marking.partialMarking?.enabled === true ||
    marking.partialMarking?.enabled === 'true' ||
    Boolean(getPartialScheme(marking))
  ) {
    return MARKING_MODE.PARTIAL
  }

  /*
   * A numeric partial mark is enough to
   * establish that a partial scheme exists.
   *
   * We do NOT assume partial marking merely
   * because the property exists with null.
   */
  if (
    hasNumericMark(
      marking,
      'partial'
    )
  ) {
    return MARKING_MODE.PARTIAL
  }

  /*
   * Negative mark exists.
   */
  if (
    hasNumericMark(
      marking,
      'incorrect'
    )
  ) {
    const incorrect =
      Number(marking.incorrect)

    /*
     * A zero incorrect mark is still a valid
     * source rule. It is effectively positive-only.
     */
    if (incorrect < 0) {
      return MARKING_MODE.NEGATIVE
    }

    return MARKING_MODE.POSITIVE_ONLY
  }

  /*
   * If only correct/unattempted exists,
   * it is positive-only.
   */
  if (
    hasNumericMark(
      marking,
      'correct'
    )
  ) {
    return MARKING_MODE.POSITIVE_ONLY
  }

  return null
}

function getPartialScheme(marking) {
  if (!isObject(marking)) return ''

  const candidates = [
    marking.partialRules,
    marking.partialMarking?.scheme,
    marking.partialMarking?.formula,
    marking.partial?.scheme,
  ]

  return candidates
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim() || ''
}

const NUMBER_WORDS = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
})

function extractPartialMarksFromScheme(marking) {
  const scheme = getPartialScheme(marking)
  if (!scheme) return []

  const normalized = scheme.replace(/\s+/g, ' ').trim()
  const results = []

  // Handles phrases such as:
  // "+3 if three correct options are selected"
  // "+2 for two correct options"
  const pattern = /([+-]\d+(?:\.\d+)?)\s*(?:if|for)\s+(?:(\d+)\s+|([a-z]+)\s+)?correct\s+options?/gi
  let match
  while ((match = pattern.exec(normalized))) {
    const count = match[2] != null
      ? Number(match[2])
      : NUMBER_WORDS[String(match[3] || '').toLowerCase()]
    const mark = Number(match[1])
    if (Number.isFinite(count) && Number.isFinite(mark)) {
      results.push({ count, mark })
    }
  }

  const allMatch = normalized.match(/([+-]\d+(?:\.\d+)?)\s*(?:for|if)\s+all\s+correct\s+options?/i)
  if (allMatch) {
    results.push({ count: 'all', mark: Number(allMatch[1]) })
  }

  return results
}

function getPartialMarkFromScheme(marking, selectedCount, correctCount) {
  const entries = extractPartialMarksFromScheme(marking)
  if (!entries.length) return null

  const exact = entries.find((entry) => entry.count === selectedCount)
  if (exact) return exact.mark

  if (selectedCount === correctCount) {
    const all = entries.find((entry) => entry.count === 'all')
    if (all) return all.mark
  }

  return null
}

/*
 * Returns a normalized marking rule.
 *
 * If required source information is missing,
 * values remain null instead of being invented.
 */
function normalizeMarkingRule(marking) {
  if (!isObject(marking)) {
    return {
      mode: null,
      correct: null,
      incorrect: null,
      partial: null,
      partialScheme: null,
      unattempted: null,
      defined: false,
    }
  }

  const mode =
    inferMarkingMode(marking)

  return {
    mode,

    correct: hasNumericMark(
      marking,
      'correct'
    )
      ? Number(marking.correct)
      : null,

    incorrect: hasNumericMark(
      marking,
      'incorrect'
    )
      ? Number(marking.incorrect)
      : null,

    partial: hasNumericMark(
      marking,
      'partial'
    )
      ? Number(marking.partial)
      : null,

    partialScheme: getPartialScheme(marking) || null,

    unattempted: hasNumericMark(
      marking,
      'unattempted'
    )
      ? Number(marking.unattempted)
      : null,

    defined:
      Boolean(mode) ||
      hasNumericMark(
        marking,
        'correct'
      ) ||
      hasNumericMark(
        marking,
        'incorrect'
      ) ||
      hasNumericMark(
        marking,
        'partial'
      ) ||
      hasNumericMark(
        marking,
        'unattempted'
      ),
  }
}

/* -------------------------------------------------------------------------- */
/* MARKING RESOLUTION                                                         */
/* -------------------------------------------------------------------------- */

/*
 * Resolve marking from:
 *
 * question
 * category
 * section
 * paper
 * defaults
 *
 * Most-specific explicitly defined marking wins.
 */


function getCategoryMarking(
  question,
  category,
  paper
) {
  if (category?.marking) {
    return category.marking
  }

  const categoryRef =
    question?.categoryRef

  if (
    categoryRef &&
    Array.isArray(
      paper?.categories
    )
  ) {
    const found =
      paper.categories.find(
        (item) =>
          normalizeId(item.id) ===
          normalizeId(categoryRef)
      )

    if (found?.marking) {
      return found.marking
    }
  }

  return null
}

function getSectionMarking(
  question,
  section,
  paper
) {
  if (section?.marking) {
    return section.marking
  }

  const sectionRef =
    question?.sectionRef

  if (
    sectionRef &&
    Array.isArray(
      paper?.sections
    )
  ) {
    const found =
      paper.sections.find(
        (item) =>
          normalizeId(item.id) ===
          normalizeId(sectionRef)
      )

    if (found?.marking) {
      return found.marking
    }
  }

  return null
}

function getPaperMarking(paper) {
  return (
    paper?.marking ||
    paper?.defaultMarking ||
    null
  )
}

function resolveMarkingRule({
  question,
  category = null,
  section = null,
  paper = null,
} = {}) {
  /*
   * Question-level marking.
   */
  if (question?.marking) {
    const rule =
      normalizeMarkingRule(
        question.marking
      )

    if (rule.defined) {
      return {
        ...rule,
        source: 'question',
      }
    }
  }

  /*
   * Category-level marking.
   */
  const categoryMarking =
    getCategoryMarking(
      question,
      category,
      paper
    )

  if (categoryMarking) {
    const rule =
      normalizeMarkingRule(
        categoryMarking
      )

    if (rule.defined) {
      return {
        ...rule,
        source: 'category',
      }
    }
  }

  /*
   * Section-level marking.
   */
  const sectionMarking =
    getSectionMarking(
      question,
      section,
      paper
    )

  if (sectionMarking) {
    const rule =
      normalizeMarkingRule(
        sectionMarking
      )

    if (rule.defined) {
      return {
        ...rule,
        source: 'section',
      }
    }
  }

  /*
   * Paper-level/default marking.
   */
  const paperMarking =
    getPaperMarking(paper)

  if (paperMarking) {
    const rule =
      normalizeMarkingRule(
        paperMarking
      )

    if (rule.defined) {
      return {
        ...rule,
        source: 'paper',
      }
    }
  }

  /*
   * No source marking found.
   */
  return {
    ...normalizeMarkingRule(null),
    source: null,
  }
}

/* -------------------------------------------------------------------------- */
/* QUESTION TYPE HELPERS                                                      */
/* -------------------------------------------------------------------------- */

function getQuestionType(question) {
  return normalizeString(
    question?.type ||
      question?.family ||
      ''
  )
}

function isChoiceQuestion(question) {
  const type =
    getQuestionType(question)

  return (
    type === 'mcq' ||
    type === 'msq' ||
    type ===
      'assertion_reason' ||
    type ===
      'assertion-reason'
  )
}


function isNumericQuestion(question) {
  const type =
    getQuestionType(question)

  return (
    type === 'nat' ||
    type === 'numeric' ||
    type ===
      'numeric_range'
  )
}

function isMatchQuestion(question) {
  const type =
    getQuestionType(question)

  return (
    type === 'match' ||
    type ===
      'match_multiple'
  )
}

/* -------------------------------------------------------------------------- */
/* MCQ / MSQ CLASSIFICATION                                                   */
/* -------------------------------------------------------------------------- */

/*
 * Obtain correct option IDs from the normalized
 * question model.
 *
 * The normalizer uses correct OPTION CONTENT for
 * fingerprinting, but scoring must use stable
 * option IDs because options may be randomized.
 */
function getCorrectOptionIds(question) {
  const ids =
    question?.answer
      ?.correctOptionIds

  if (Array.isArray(ids)) {
    return ids
      .filter(isDefined)
      .map(normalizeId)
      .filter(Boolean)
  }

  /*
   * Some older representations may place
   * answer information under response.answer.
   */
  const responseAnswer =
    question?.response
      ?.answer

  if (
    Array.isArray(
      responseAnswer
        ?.correctOptionIds
    )
  ) {
    return responseAnswer.correctOptionIds
      .filter(isDefined)
      .map(normalizeId)
      .filter(Boolean)
  }

  return []
}

/*
 * MCQ/MSQ response classification.
 *
 * PARTIAL mode:
 *
 * exact set
 *    → PERFECT
 *
 * non-empty subset of correct answers
 *    → IMPERFECT
 *
 * contains any wrong option
 *    → WRONG
 *
 * blank
 *    → UNATTEMPTED
 *
 * This implements the generic partial-marking
 * structure agreed for CBTGen.
 */
function classifyChoiceResponse(
  question,
  response,
  marking
) {
  const selected =
    normalizeIdSet(
      getSelectedOptionIds(response)
    )

  if (selected.size === 0) {
    return RESPONSE_CLASSIFICATION.UNATTEMPTED
  }

  const correct =
    normalizeIdSet(
      getCorrectOptionIds(question)
    )

  /*
   * Missing answer key means automatic scoring
   * cannot safely continue.
   */
  if (correct.size === 0) {
    return RESPONSE_CLASSIFICATION.REVIEW_REQUIRED
  }

  const hasWrongOption =
    setContainsAny(
      selected,
      [...selected].filter(
        (id) => !correct.has(id)
      )
    )

  if (hasWrongOption) {
    return RESPONSE_CLASSIFICATION.WRONG
  }

  if (
    setsEqual(
      selected,
      correct
    )
  ) {
    return RESPONSE_CLASSIFICATION.PERFECT
  }

  /*
   * At this point selected is a non-empty
   * subset of correct.
   *
   * For PARTIAL mode this is imperfect.
   */
  if (
    marking.mode ===
    MARKING_MODE.PARTIAL
  ) {
    return RESPONSE_CLASSIFICATION.IMPERFECT
  }

  /*
   * In non-partial modes there is no defined
   * partial state.
   *
   * A non-exact MSQ response is therefore wrong.
   */
  return RESPONSE_CLASSIFICATION.WRONG
}

/* -------------------------------------------------------------------------- */
/* NUMERIC CLASSIFICATION                                                     */
/* -------------------------------------------------------------------------- */

function getNumericAnswerDefinition(
  question
) {
  const answer =
    question?.answer || {}

  const value =
    isDefined(answer.value)
      ? Number(answer.value)
      : null

  const range =
    answer.range || null

  const min =
    isDefined(range?.min)
      ? Number(range.min)
      : null

  const max =
    isDefined(range?.max)
      ? Number(range.max)
      : null

  const tolerance =
    isDefined(answer.tolerance)
      ? Number(answer.tolerance)
      : null

  return {
    value:
      Number.isFinite(value)
        ? value
        : null,

    min:
      Number.isFinite(min)
        ? min
        : null,

    max:
      Number.isFinite(max)
        ? max
        : null,

    tolerance:
      Number.isFinite(tolerance)
        ? tolerance
        : null,
  }
}

function numericResponseIsCorrect(
  question,
  response
) {
  const candidate =
    getNumericResponse(response)

  if (candidate === null) {
    return null
  }

  const answer =
    getNumericAnswerDefinition(
      question
    )

  /*
   * Range answer.
   */
  if (
    answer.min !== null &&
    answer.max !== null
  ) {
    const tolerance =
      answer.tolerance ?? 0

    return (
      candidate >=
        answer.min - tolerance &&
      candidate <=
        answer.max + tolerance
    )
  }

  /*
   * Exact numeric value.
   */
  if (answer.value !== null) {
    const tolerance =
      answer.tolerance ?? 0

    return (
      Math.abs(
        candidate - answer.value
      ) <= tolerance
    )
  }

  /*
   * Source answer is incomplete.
   */
  return null
}

function classifyNumericResponse(
  question,
  response
) {
  const candidate =
    getNumericResponse(response)

  if (candidate === null) {
    return RESPONSE_CLASSIFICATION.UNATTEMPTED
  }

  const correct =
    numericResponseIsCorrect(
      question,
      response
    )

  if (correct === null) {
    return RESPONSE_CLASSIFICATION.REVIEW_REQUIRED
  }

  return correct
    ? RESPONSE_CLASSIFICATION.PERFECT
    : RESPONSE_CLASSIFICATION.WRONG
}

/* -------------------------------------------------------------------------- */
/* MATCH CLASSIFICATION                                                       */
/* -------------------------------------------------------------------------- */

function normalizeMappingPairs(
  mappings
) {
  return mappings
    .map((pair) => ({
      left: normalizeId(
        pair?.left ??
          pair?.leftId
      ),
      right: normalizeId(
        pair?.right ??
          pair?.rightId
      ),
    }))
    .filter(
      (pair) =>
        pair.left &&
        pair.right
    )
    .sort((a, b) => {
      const left =
        a.left.localeCompare(
          b.left
        )

      if (left !== 0) {
        return left
      }

      return a.right.localeCompare(
        b.right
      )
    })
}

function mappingsEqual(
  first,
  second
) {
  const a =
    normalizeMappingPairs(first)

  const b =
    normalizeMappingPairs(second)

  if (a.length !== b.length) {
    return false
  }

  return a.every(
    (pair, index) =>
      pair.left === b[index].left &&
      pair.right === b[index].right
  )
}

function getCorrectMappings(question) {
  const mappings =
    question?.answer
      ?.mappings

  if (Array.isArray(mappings)) {
    return mappings
  }

  if (isObject(mappings)) {
    return Object.entries(
      mappings
    ).map(([left, right]) => ({
      left,
      right,
    }))
  }

  return []
}

function classifyMatchResponse(
  question,
  response
) {
  const candidate =
    getMatchMappings(response)

  if (candidate.length === 0) {
    return RESPONSE_CLASSIFICATION.UNATTEMPTED
  }

  const correct =
    getCorrectMappings(question)

  if (correct.length === 0) {
    return RESPONSE_CLASSIFICATION.REVIEW_REQUIRED
  }

  return mappingsEqual(
    candidate,
    correct
  )
    ? RESPONSE_CLASSIFICATION.PERFECT
    : RESPONSE_CLASSIFICATION.WRONG
}

/* -------------------------------------------------------------------------- */
/* RESPONSE CLASSIFICATION                                                    */
/* -------------------------------------------------------------------------- */

function classifyResponse({
  question,
  response,
  marking,
} = {}) {
  if (!question) {
    return RESPONSE_CLASSIFICATION.REVIEW_REQUIRED
  }

  if (!hasCandidateResponse(response)) {
    return RESPONSE_CLASSIFICATION.UNATTEMPTED
  }

  if (isChoiceQuestion(question)) {
    return classifyChoiceResponse(
      question,
      response,
      marking
    )
  }

  if (isNumericQuestion(question)) {
    return classifyNumericResponse(
      question,
      response
    )
  }

  if (isMatchQuestion(question)) {
    return classifyMatchResponse(
      question,
      response
    )
  }

  /*
   * Unsupported automatic response type.
   *
   * Do not invent grading.
   */
  return RESPONSE_CLASSIFICATION.REVIEW_REQUIRED
}

/* -------------------------------------------------------------------------- */
/* STATUS MAPPING                                                             */
/* -------------------------------------------------------------------------- */

function classificationToStatus(
  classification
) {
  switch (classification) {
    case RESPONSE_CLASSIFICATION.PERFECT:
      return QUESTION_STATUS.CORRECT

    case RESPONSE_CLASSIFICATION.IMPERFECT:
      return QUESTION_STATUS.PARTIAL

    case RESPONSE_CLASSIFICATION.WRONG:
      return QUESTION_STATUS.INCORRECT

    case RESPONSE_CLASSIFICATION.UNATTEMPTED:
      return QUESTION_STATUS.UNATTEMPTED

    default:
      return QUESTION_STATUS.REVIEW_REQUIRED
  }
}

/* -------------------------------------------------------------------------- */
/* MARK APPLICATION                                                           */
/* -------------------------------------------------------------------------- */

function getMarksForClassification(
  classification,
  marking,
  question = null,
  response = null
) {
  if (!marking?.defined) {
    return {
      marksAwarded: null,
      scoringAvailable: false,
    }
  }

  switch (classification) {
    case RESPONSE_CLASSIFICATION.PERFECT:
      if (
        !Number.isFinite(
          marking.correct
        )
      ) {
        return {
          marksAwarded: null,
          scoringAvailable: false,
        }
      }

      return {
        marksAwarded: marking.correct,
        scoringAvailable: true,
      }

    case RESPONSE_CLASSIFICATION.IMPERFECT:
      {

      /*
       * Partial marks are only valid when
       * the source explicitly provides them.
       */
      if (
        marking.mode !==
        MARKING_MODE.PARTIAL
      ) {
        return {
          marksAwarded: null,
          scoringAvailable: false,
        }
      }

      let partialMark = Number.isFinite(marking.partial)
        ? marking.partial
        : null

      if (partialMark === null && marking.partialScheme) {
        const selectedCount = getSelectedOptionIds(response).length
        const correctCount = getCorrectOptionIds(question).length
        partialMark = getPartialMarkFromScheme(
          marking,
          selectedCount,
          correctCount
        )
      }

      if (!Number.isFinite(partialMark)) {
        return {
          marksAwarded: null,
          scoringAvailable: false,
        }
      }

      return {
        marksAwarded: partialMark,
        scoringAvailable: true,
      }

      }

    case RESPONSE_CLASSIFICATION.WRONG:
      /*
       * NEGATIVE:
       * use source incorrect value.
       *
       * POSITIVE_ONLY:
       * source may explicitly provide 0.
       *
       * If no incorrect mark exists, do NOT
       * invent zero.
       */
      if (
        Number.isFinite(
          marking.incorrect
        )
      ) {
        return {
          marksAwarded:
            marking.incorrect,
          scoringAvailable: true,
        }
      }

      if (
        marking.mode ===
        MARKING_MODE.POSITIVE_ONLY
      ) {
        return {
          marksAwarded: 0,
          scoringAvailable: true,
        }
      }

      return {
        marksAwarded: null,
        scoringAvailable: false,
      }

    case RESPONSE_CLASSIFICATION.UNATTEMPTED:
      if (
        Number.isFinite(
          marking.unattempted
        )
      ) {
        return {
          marksAwarded:
            marking.unattempted,
          scoringAvailable: true,
        }
      }

      /*
       * A source with no explicit unattempted
       * value is incomplete.
       */
      return {
        marksAwarded: null,
        scoringAvailable: false,
      }

    default:
      return {
        marksAwarded: null,
        scoringAvailable: false,
      }
  }
}

/* -------------------------------------------------------------------------- */
/* SINGLE QUESTION SCORING                                                    */
/* -------------------------------------------------------------------------- */

function scoreQuestion({
  question,
  response = null,
  category = null,
  section = null,
  paper = null,
} = {}) {
  const marking =
    resolveMarkingRule({
      question,
      category,
      section,
      paper,
    })

  const classification =
    classifyResponse({
      question,
      response,
      marking,
    })

  const status =
    classificationToStatus(
      classification
    )

  const marks =
    getMarksForClassification(
      classification,
      marking,
      question,
      response
    )

  const selectedOptionIds =
    getSelectedOptionIds(response)

  const numericValue =
    getNumericResponse(response)

  const matchMappings =
    getMatchMappings(response)

  return {
    sourceQuestionId:
      question?.sourceQuestionId ??
      question?.id ??
      null,

    questionFingerprint:
      question?.questionFingerprint ??
      question?.fingerprint ??
      null,

    sectionId:
      question?.sectionRef ??
      section?.id ??
      null,

    sectionName:
      section?.name ??
      null,

    categoryId:
      question?.categoryRef ??
      category?.id ??
      null,

    categoryName:
      category?.name ??
      null,

    subject:
      question?.subject ??
      null,

    topic:
      question?.topic ??
      null,

    type:
      question?.type ??
      null,

    family:
      question?.family ??
      null,

    responseMode:
      question?.responseMode ??
      question?.response?.mode ??
      null,

    status,

    classification,

    marksAwarded:
      marks.marksAwarded,

    scoringAvailable:
      marks.scoringAvailable,

    marking: {
      mode: marking.mode,
      source: marking.source,

      correct: marking.correct,
      incorrect: marking.incorrect,
      partial: marking.partial,
      partialScheme: marking.partialScheme,
      unattempted:
        marking.unattempted,
    },

    response: {
      selectedOptionIds,
      numericValue,
      matchMappings,
      attempted:
        classification !==
        RESPONSE_CLASSIFICATION.UNATTEMPTED,
    },

    visited:
      response?.visited === true ||
      hasCandidateResponse(response),

    markedForReview:
      response?.markedForReview === true,

    timing: {
      firstViewedAt:
        response?.firstViewedAt ??
        null,

      answeredAt:
        response?.answeredAt ??
        null,

      totalTimeSeconds:
        Number.isFinite(
          Number(
            response?.totalTimeSeconds
          )
        )
          ? Number(
              response.totalTimeSeconds
            )
          : 0,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* QUESTION LIST SCORING                                                      */
/* -------------------------------------------------------------------------- */

function findCategory(
  question,
  paper
) {
  const categoryRef =
    question?.categoryRef

  if (!categoryRef) {
    return null
  }

  const categories =
    paper?.categories || []

  return (
    categories.find(
      (category) =>
        normalizeId(category.id) ===
        normalizeId(categoryRef)
    ) || null
  )
}

function findSection(
  question,
  paper
) {
  const sectionRef =
    question?.sectionRef

  if (!sectionRef) {
    return null
  }

  const sections =
    paper?.sections || []

  return (
    sections.find(
      (section) =>
        normalizeId(section.id) ===
        normalizeId(sectionRef)
    ) || null
  )
}

function getResponseForQuestion(
  responses,
  question
) {
  if (!responses) {
    return null
  }

  const questionId =
    question?.sourceQuestionId ??
    question?.id

  if (Array.isArray(responses)) {
    return (
      responses.find(
        (item) =>
          normalizeId(
            item?.sourceQuestionId ??
              item?.questionId ??
              item?.id
          ) ===
          normalizeId(questionId)
      ) || null
    )
  }

  if (isObject(responses)) {
    return (
      responses[questionId] ??
      responses[
        String(questionId)
      ] ??
      null
    )
  }

  return null
}

function scoreQuestions({
  questions = [],
  responses = null,
  paper = null,
} = {}) {
  return questions.map(
    (question) => {
      const section =
        findSection(
          question,
          paper
        )

      const category =
        findCategory(
          question,
          paper
        )

      const response =
        getResponseForQuestion(
          responses,
          question
        )

      return scoreQuestion({
        question,
        response,
        category,
        section,
        paper,
      })
    }
  )
}

/* -------------------------------------------------------------------------- */
/* AGGREGATION                                                                */
/* -------------------------------------------------------------------------- */

function createEmptyAggregate() {
  return {
    score: 0,
    maximumScore: 0,

    correct: 0,
    incorrect: 0,
    partial: 0,
    unattempted: 0,
    attempted: 0,

    questionCount: 0,

    scoringAvailable: true,

    timeSeconds: 0,
  }
}

function addQuestionToAggregate(
  aggregate,
  result
) {
  aggregate.questionCount += 1

  if (
    Number.isFinite(
      result.marksAwarded
    )
  ) {
    aggregate.score +=
      result.marksAwarded
  } else {
    aggregate.scoringAvailable =
      false
  }

  if (
    Number.isFinite(
      result.marking.correct
    )
  ) {
    /*
     * Maximum score is the sum of
     * correct marks for scored questions.
     *
     * This is appropriate for the source
     * question-level maximum.
     */
    aggregate.maximumScore +=
      result.marking.correct
  } else {
    aggregate.scoringAvailable =
      false
  }

  switch (result.status) {
    case QUESTION_STATUS.CORRECT:
      aggregate.correct += 1
      aggregate.attempted += 1
      break

    case QUESTION_STATUS.INCORRECT:
      aggregate.incorrect += 1
      aggregate.attempted += 1
      break

    case QUESTION_STATUS.PARTIAL:
      aggregate.partial += 1
      aggregate.attempted += 1
      break

    case QUESTION_STATUS.UNATTEMPTED:
      aggregate.unattempted += 1
      break

    case QUESTION_STATUS.REVIEW_REQUIRED:
      /*
       * A response exists but automatic scoring
       * is not available.
       *
       * It is not counted as correct/incorrect.
       */
      if (
        result.response?.attempted
      ) {
        aggregate.attempted += 1
      }
      break

    default:
      break
  }

  aggregate.timeSeconds +=
    Number.isFinite(
      Number(
        result.timing
          ?.totalTimeSeconds
      )
    )
      ? Number(
          result.timing
            .totalTimeSeconds
        )
      : 0
}

function finalizeAggregate(
  aggregate
) {
  const attempted =
    aggregate.attempted

  aggregate.score =
    roundNumber(
      aggregate.score
    )

  aggregate.maximumScore =
    roundNumber(
      aggregate.maximumScore
    )

  aggregate.timeSeconds =
    roundNumber(
      aggregate.timeSeconds
    )

  aggregate.accuracy =
    attempted > 0
      ? roundNumber(
          (
            (
              aggregate.correct +
              aggregate.partial
            ) /
            attempted
          ) *
            100,
          4
        )
      : 0

  return aggregate
}

/* -------------------------------------------------------------------------- */
/* SECTION RESULTS                                                            */
/* -------------------------------------------------------------------------- */

function buildGroupedResults(
  questionResults,
  getKey,
  createMetadata = () => ({})
) {
  const groups = new Map()

  for (const result of questionResults) {
    const key = getKey(result)

    if (!key) {
      continue
    }

    if (!groups.has(key)) {
      groups.set(key, {
        ...createEmptyAggregate(),
        ...createMetadata(
          result
        ),
      })
    }

    addQuestionToAggregate(
      groups.get(key),
      result
    )
  }

  return [...groups.values()].map(
    finalizeAggregate
  )
}

function buildCategoryResults(
  questionResults
) {
  return buildGroupedResults(
    questionResults,

    (result) =>
      result.categoryId,

    (result) => ({
      categoryId:
        result.categoryId,

      categoryName:
        result.categoryName,
    })
  )
}

function buildSectionResults(
  questionResults
) {
  return buildGroupedResults(
    questionResults,

    (result) =>
      result.sectionId,

    (result) => ({
      sectionId:
        result.sectionId,

      sectionName:
        result.sectionName,
    })
  )
}

function buildSubjectResults(
  questionResults
) {
  return buildGroupedResults(
    questionResults,

    (result) =>
      result.subject,

    (result) => ({
      subject:
        result.subject,
    })
  )
}

function buildTopicResults(
  questionResults
) {
  return buildGroupedResults(
    questionResults,

    (result) =>
      result.topic,

    (result) => ({
      topic:
        result.topic,
    })
  )
}

/* -------------------------------------------------------------------------- */
/* EXAM RESULT                                                                */
/* -------------------------------------------------------------------------- */

function buildExamResult({
  questions = [],
  responses = null,
  paper = null,

  session = null,

  questionResults = null,
} = {}) {
  const scoredQuestions =
    questionResults ||
    scoreQuestions({
      questions,
      responses,
      paper,
    })

  const aggregate =
    createEmptyAggregate()

  for (const result of scoredQuestions) {
    addQuestionToAggregate(
      aggregate,
      result
    )
  }

  finalizeAggregate(
    aggregate
  )

  const sections =
    buildSectionResults(
      scoredQuestions
    )

  const categories =
    buildCategoryResults(
      scoredQuestions
    )

  const subjects =
    buildSubjectResults(
      scoredQuestions
    )

  const topics =
    buildTopicResults(
      scoredQuestions
    )

  return {
    resultId:
      session?.resultId ??
      null,

    sessionId:
      session?.sessionId ??
      session?.id ??
      null,

    userId:
      session?.userId ??
      null,

    qpFingerprint:
      session?.qpFingerprint ??
      null,

    examType:
      session?.examType ??
      paper?.exam?.type ??
      null,

    examSubtype:
      session?.examSubtype ??
      paper?.exam?.subtype ??
      null,

    totalScore:
      aggregate.score,

    maximumScore:
      aggregate.maximumScore,

    correctCount:
      aggregate.correct,

    incorrectCount:
      aggregate.incorrect,

    partialCount:
      aggregate.partial,

    unattemptedCount:
      aggregate.unattempted,

    attemptedCount:
      aggregate.attempted,

    questionCount:
      aggregate.questionCount,

    accuracy:
      aggregate.accuracy,

    totalTimeSeconds:
      aggregate.timeSeconds,

    scoringAvailable:
      aggregate.scoringAvailable,

    sections,

    categories,

    subjects,

    topics,

    questions:
      scoredQuestions,
  }
}

/* -------------------------------------------------------------------------- */
/* PUBLIC API                                                                 */
/* -------------------------------------------------------------------------- */

export {
  QUESTION_STATUS,
  RESPONSE_CLASSIFICATION,
  MARKING_MODE,

  normalizeMarkingRule,
  inferMarkingMode,
  resolveMarkingRule,

  classifyResponse,

  scoreQuestion,
  scoreQuestions,

  buildCategoryResults,
  buildSectionResults,
  buildSubjectResults,
  buildTopicResults,

  buildExamResult,
}