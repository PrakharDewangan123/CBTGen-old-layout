import {
  QUESTION_TYPES,
  getQuestionType,
} from './questionTypes'

/**
 * CBTGen Semantic Validator
 *
 * Responsibilities:
 * - validate CBTGen XML structure
 * - validate supported question types
 * - validate response modes
 * - validate references
 * - validate answers
 * - validate marking
 * - validate type-specific structures
 * - detect inconsistent question/section counts
 *
 * This validator does NOT:
 * - generate answers
 * - infer missing answers
 * - randomize questions
 * - randomize options
 * - calculate session state
 * - consume slots
 * - modify QP identity
 */

const SUPPORTED_TYPES = new Set(
  Object.keys(QUESTION_TYPES)
)

const RESPONSE_MODES = new Set(
  Object.values(QUESTION_TYPES).map(
    (definition) =>
      definition.responseMode
  )
)

const CHOICE_TYPES = new Set([
  'MCQ',
  'MSQ',
  'ASSERTION_REASON',
  'TRUE_FALSE',
  'YES_NO',
  'DROPDOWN',
  'IMAGE_CHOICE',
  'IMAGE_MULTI_CHOICE',
])

const SINGLE_CHOICE_TYPES = new Set([
  'MCQ',
  'ASSERTION_REASON',
  'TRUE_FALSE',
  'YES_NO',
  'DROPDOWN',
  'IMAGE_CHOICE',
])

const MULTI_CHOICE_TYPES = new Set([
  'MSQ',
  'IMAGE_MULTI_CHOICE',
])

const NUMERIC_TYPES = new Set([
  'NAT',
  'NUMERIC_RANGE',
  'SLIDER',
])

const TEXT_TYPES = new Set([
  'TEXT_SHORT',
  'TEXT_LONG',
  'FILL_BLANK',
  'ESSAY',
])

const MATCH_TYPES = new Set([
  'MATCH',
  'MATCH_MULTIPLE',
])

const MATRIX_TYPES = new Set([
  'MATRIX_SINGLE',
  'MATRIX_MULTI',
  'MATRIX_TEXT',
])

const GROUP_TYPES = new Set([
  'PASSAGE',
  'CASE_STUDY',
  'GROUPED_QUESTIONS',
])

const TECHNICAL_TYPES = new Set([
  'CODE_OUTPUT',
  'CODE_TRACE',
  'CODE_COMPLETION',
  'CODE_EDITOR',
  'EQUATION_INPUT',
  'GRAPH_RESPONSE',
])

const MEDIA_TYPES = new Set([
  'AUDIO_RESPONSE',
  'AUDIO_RECORDING',
  'VIDEO_RESPONSE',
])



function addError(
  errors,
  code,
  message
) {
  errors.push({
    severity: 'error',
    code,
    message,
  })
}

function addWarning(
  warnings,
  code,
  message
) {
  warnings.push({
    severity: 'warning',
    code,
    message,
  })
}

function getDirectChildren(
  parent,
  tagName
) {
  if (!parent) return []

  return Array.from(
    parent.children
  ).filter(
    (child) =>
      child.tagName === tagName
  )
}

function getDirectChild(
  parent,
  tagName
) {
  return (
    getDirectChildren(
      parent,
      tagName
    )[0] || null
  )
}

function getText(
  parent,
  tagName
) {
  const element =
    getDirectChild(
      parent,
      tagName
    )

  return (
    element?.textContent?.trim() ||
    ''
  )
}

function getIds(elements) {
  return elements
    .map((element) =>
      element.getAttribute('id')
    )
    .filter(Boolean)
}

function validateUniqueIds(
  elements,
  type,
  errors
) {
  const seen = new Set()

  for (const element of elements) {
    const id =
      element.getAttribute('id')

    if (!id) {
      addError(
        errors,
        'MISSING_ID',
        `${type} is missing its required id.`
      )

      continue
    }

    if (seen.has(id)) {
      addError(
        errors,
        'DUPLICATE_ID',
        `Duplicate ${type} id "${id}".`
      )
    }

    seen.add(id)
  }
}

/* ─────────────────────────────────────────────
   MARKING
───────────────────────────────────────────── */

function validateMarking(
  question,
  errors,
  warnings
) {
  const marking =
    getDirectChild(
      question,
      'marking'
    )

  if (!marking) {
    return
  }

  const values = [
    'correct',
    'incorrect',
    'unattempted',
  ]

  for (const field of values) {
    const value =
      getText(
        marking,
        field
      )

    if (value === '') {
      addError(
        errors,
        'MARKING_FIELD_MISSING',
        `Question ${question.getAttribute(
          'id'
        )} has marking but is missing "${field}".`
      )

      continue
    }

    if (
      !Number.isFinite(
        Number(value)
      )
    ) {
      addError(
        errors,
        'INVALID_MARKING',
        `Question ${question.getAttribute(
          'id'
        )} has a non-numeric "${field}" marking value.`
      )
    }
  }

  const partialMarking =
    getDirectChild(
      marking,
      'partialMarking'
    )

  /*
   * Backward compatibility:
   *
   * Some earlier CBTGen XML examples placed
   * partialMarking directly under question.
   */
  const legacyPartialMarking =
    getDirectChild(
      question,
      'partialMarking'
    )

  const partial =
    partialMarking ||
    legacyPartialMarking

  if (!partial) {
    return
  }

  const enabled =
    getText(
      partial,
      'enabled'
    )

  if (
    enabled === 'unknown'
  ) {
    addWarning(
      warnings,
      'PARTIAL_MARKING_UNKNOWN',
      `Question ${question.getAttribute(
        'id'
      )} requires review because its partial-marking scheme is unknown.`
    )
  }

  if (
    enabled &&
    ![
      'true',
      'false',
      'yes',
      'no',
      'unknown',
    ].includes(
      enabled.toLowerCase()
    )
  ) {
    addWarning(
      warnings,
      'PARTIAL_MARKING_ENABLED_INVALID',
      `Question ${question.getAttribute(
        'id'
      )} uses an unrecognized partial-marking enabled value "${enabled}".`
    )
  }
}

/* ─────────────────────────────────────────────
   CHOICE QUESTIONS
───────────────────────────────────────────── */

function validateChoiceOptions(
  question,
  type,
  errors,
  warnings
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const optionsContainer =
    getDirectChild(
      response,
      'options'
    )

  const options =
    optionsContainer
      ? getDirectChildren(
          optionsContainer,
          'option'
        )
      : []

  if (
    !optionsContainer ||
    options.length < 2
  ) {
    addError(
      errors,
      'OPTIONS_MISSING',
      `Question ${question.getAttribute(
        'id'
      )} requires at least two options.`
    )

    return
  }

  validateUniqueIds(
    options,
    'Option',
    errors
  )

  const optionIds =
    new Set(
      getIds(options)
    )

  const answer =
    getDirectChild(
      response,
      'answer'
    )

  if (!answer) {
    addWarning(
      warnings,
      'ANSWER_MISSING',
      `Question ${question.getAttribute(
        'id'
      )} has no answer-key data. It can be stored as source-only.`
    )

    return
  }

  const correctRefs =
    getDirectChildren(
      answer,
      'correctOptionRef'
    )

  const hasAnswerKeyContent =
    answer.children.length > 0 ||
    answer.textContent.trim().length > 0

  if (
    correctRefs.length === 0 &&
    !hasAnswerKeyContent
  ) {
    addWarning(
      warnings,
      'ANSWER_KEY_MISSING',
      `Question ${question.getAttribute(
        'id'
      )} of type ${type} has no correctOptionRef answer-key data. It can be stored as source-only.`
    )

    return
  }

  if (
    SINGLE_CHOICE_TYPES.has(type)
  ) {
    if (
      correctRefs.length !== 1
    ) {
      addError(
        errors,
        'SINGLE_CHOICE_ANSWER_COUNT',
        `Question ${question.getAttribute(
          'id'
        )} of type ${type} must have exactly one correctOptionRef.`
      )
    }
  }

  if (
    MULTI_CHOICE_TYPES.has(type)
  ) {
    if (
      correctRefs.length < 1
    ) {
      addError(
        errors,
        'MULTI_CHOICE_ANSWER_COUNT',
        `Question ${question.getAttribute(
          'id'
        )} of type ${type} must have at least one correctOptionRef.`
      )
    }
  }

  if (
    type === 'TRUE_FALSE' ||
    type === 'YES_NO'
  ) {
    if (
      options.length !== 2
    ) {
      addError(
        errors,
        'BINARY_OPTION_COUNT',
        `${type} question ${question.getAttribute(
          'id'
        )} must contain exactly two options.`
      )
    }
  }

  const seenRefs =
    new Set()

  for (const ref of correctRefs) {
    const optionId =
      ref.textContent.trim()

    if (!optionId) {
      addError(
        errors,
        'EMPTY_OPTION_REFERENCE',
        `Question ${question.getAttribute(
          'id'
        )} contains an empty correctOptionRef.`
      )

      continue
    }

    if (
      !optionIds.has(optionId)
    ) {
      addError(
        errors,
        'INVALID_OPTION_REFERENCE',
        `Question ${question.getAttribute(
          'id'
        )} references missing option "${optionId}".`
      )
    }

    if (
      seenRefs.has(optionId)
    ) {
      addError(
        errors,
        'DUPLICATE_CORRECT_OPTION',
        `Question ${question.getAttribute(
          'id'
        )} references option "${optionId}" more than once.`
      )
    }

    seenRefs.add(optionId)
  }
}

/* ─────────────────────────────────────────────
   NUMERIC QUESTIONS
───────────────────────────────────────────── */

function validateNumeric(
  question,
  type,
  errors,
  warnings
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const answer =
    getDirectChild(
      response,
      'answer'
    )

  if (!answer) {
    addWarning(
      warnings,
      'NUMERIC_ANSWER_MISSING',
      `${type} ${question.getAttribute(
        'id'
      )} is missing answer-key data. It can be stored as source-only.`
    )

    return
  }

  const value =
    getDirectChild(
      answer,
      'value'
    )

  const range =
    getDirectChild(
      answer,
      'range'
    )

  const tolerance =
    getDirectChild(
      answer,
      'tolerance'
    )

  const hasAnswerKeyContent =
    answer.children.length > 0 ||
    answer.textContent.trim().length > 0

  if (!value && !range && !hasAnswerKeyContent) {
    addWarning(
      warnings,
      'ANSWER_KEY_MISSING',
      `${type} ${question.getAttribute(
        'id'
      )} has no answer value or range. It can be stored as source-only.`
    )

    return
  }

  if (
    type === 'NAT'
  ) {
    if (!value && !range) {
      addError(
        errors,
        'NAT_VALUE_MISSING',
        `NAT ${question.getAttribute(
          'id'
        )} must contain either a value or a range.`
      )
    }

    if (
      value &&
      range
    ) {
      addError(
        errors,
        'NAT_MULTIPLE_REPRESENTATIONS',
        `NAT ${question.getAttribute(
          'id'
        )} contains both value and range.`
      )
    }
  }

  if (
    value
  ) {
    const number =
      Number(
        value.textContent.trim()
      )

    if (
      !Number.isFinite(
        number
      )
    ) {
      addError(
        errors,
        'NUMERIC_VALUE_INVALID',
        `${type} ${question.getAttribute(
          'id'
        )} contains a non-numeric value.`
      )
    }
  }

  if (
    range
  ) {
    const min =
      Number(
        getText(
          range,
          'min'
        )
      )

    const max =
      Number(
        getText(
          range,
          'max'
        )
      )

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max)
    ) {
      addError(
        errors,
        'NUMERIC_RANGE_INVALID',
        `${type} ${question.getAttribute(
          'id'
        )} contains an invalid numeric range.`
      )
    } else if (
      min > max
    ) {
      addError(
        errors,
        'NUMERIC_RANGE_ORDER',
        `${type} ${question.getAttribute(
          'id'
        )} has min greater than max.`
      )
    }
  }

  if (
    tolerance
  ) {
    const toleranceValue =
      Number(
        tolerance.textContent.trim()
      )

    if (
      !Number.isFinite(
        toleranceValue
      ) ||
      toleranceValue < 0
    ) {
      addError(
        errors,
        'NUMERIC_TOLERANCE_INVALID',
        `${type} ${question.getAttribute(
          'id'
        )} has an invalid tolerance.`
      )
    }
  }

  if (
    type === 'NUMERIC_RANGE' &&
    !range
  ) {
    addError(
      errors,
      'NUMERIC_RANGE_MISSING',
      `NUMERIC_RANGE question ${question.getAttribute(
        'id'
      )} requires an answer range.`
    )
  }

  if (
    type === 'SLIDER' &&
    !range
  ) {
    addWarning(
      warnings,
      'SLIDER_RANGE_MISSING',
      `SLIDER question ${question.getAttribute(
        'id'
      )} does not define an answer range.`
    )
  }
}

/* ─────────────────────────────────────────────
   MATCHING
───────────────────────────────────────────── */

function validateMatch(
  question,
  type,
  errors,
  warnings
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const leftItems =
    getDirectChild(
      response,
      'leftItems'
    )

  const rightItems =
    getDirectChild(
      response,
      'rightItems'
    )

  const answer =
    getDirectChild(
      response,
      'answer'
    )

  if (
    !leftItems ||
    !rightItems
  ) {
    addError(
      errors,
      'MATCH_STRUCTURE',
      `${type} question ${question.getAttribute(
        'id'
      )} is missing leftItems or rightItems.`
    )

    return
  }

  if (!answer) {
    return
  }

  const left =
    getDirectChildren(
      leftItems,
      'item'
    )

  const right =
    getDirectChildren(
      rightItems,
      'item'
    )

  if (
    left.length === 0 ||
    right.length === 0
  ) {
    addError(
      errors,
      'MATCH_ITEMS_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} must contain left and right items.`
    )
  }

  validateUniqueIds(
    left,
    'MATCH left item',
    errors
  )

  validateUniqueIds(
    right,
    'MATCH right item',
    errors
  )

  const leftIds =
    new Set(
      getIds(left)
    )

  const rightIds =
    new Set(
      getIds(right)
    )

  const mapping =
    getDirectChild(
      answer,
      'mapping'
    )

  const hasAnswerKeyContent =
    answer.children.length > 0 ||
    answer.textContent.trim().length > 0

  if (!mapping && !hasAnswerKeyContent) {
    addWarning(
      warnings,
      'ANSWER_KEY_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} has no answer mapping. It can be stored as source-only.`
    )

    return
  }

  if (!mapping) {
    addError(
      errors,
      'MATCH_MAPPING_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} contains answer-key data but is missing its mapping.`
    )

    return
  }

  const pairs =
    getDirectChildren(
      mapping,
      'pair'
    )

  const mappedLeft =
    new Set()

  for (const pair of pairs) {
    const leftId =
      pair.getAttribute('left')

    const rightId =
      pair.getAttribute('right')

    if (
      !leftIds.has(leftId)
    ) {
      addError(
        errors,
        'MATCH_LEFT_REFERENCE',
        `${type} question ${question.getAttribute(
          'id'
        )} references missing left item "${leftId}".`
      )
    }

    if (
      !rightIds.has(rightId)
    ) {
      addError(
        errors,
        'MATCH_RIGHT_REFERENCE',
        `${type} question ${question.getAttribute(
          'id'
        )} references missing right item "${rightId}".`
      )
    }

    /*
     * MATCH:
     * one left item → one right item
     *
     * MATCH_MULTIPLE:
     * one left item may have multiple right mappings.
     */
    if (
      type === 'MATCH' &&
      mappedLeft.has(leftId)
    ) {
      addError(
        errors,
        'MATCH_DUPLICATE_LEFT',
        `MATCH question ${question.getAttribute(
          'id'
        )} maps left item "${leftId}" more than once.`
      )
    }

    if (
      type === 'MATCH'
    ) {
      mappedLeft.add(leftId)
    }
  }
}

/* ─────────────────────────────────────────────
   ORDERING / RANKING
───────────────────────────────────────────── */

function validateOrdering(
  question,
  type,
  errors
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const itemsContainer =
    getDirectChild(
      response,
      'items'
    )

  const answer =
    getDirectChild(
      response,
      'answer'
    )

  if (
    !itemsContainer
  ) {
    addError(
      errors,
      'ORDERING_ITEMS_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} is missing its items container.`
    )

    return
  }

  const items =
    getDirectChildren(
      itemsContainer,
      'item'
    )

  if (
    items.length < 2
  ) {
    addError(
      errors,
      'ORDERING_ITEMS_INVALID',
      `${type} question ${question.getAttribute(
        'id'
      )} requires at least two items.`
    )
  }

  validateUniqueIds(
    items,
    `${type} item`,
    errors
  )

  if (!answer) {
    addError(
      errors,
      'ORDERING_ANSWER_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} is missing its answer.`
    )
  }
}

/* ─────────────────────────────────────────────
   MATRIX
───────────────────────────────────────────── */

function validateMatrix(
  question,
  type,
  errors
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const rows =
    getDirectChild(
      response,
      'rows'
    )

  const columns =
    getDirectChild(
      response,
      'columns'
    )

  if (
    !rows ||
    !columns
  ) {
    addError(
      errors,
      'MATRIX_STRUCTURE',
      `${type} question ${question.getAttribute(
        'id'
      )} must contain rows and columns.`
    )

    return
  }

  const rowItems =
    getDirectChildren(
      rows,
      'item'
    )

  const columnItems =
    getDirectChildren(
      columns,
      'item'
    )

  if (
    rowItems.length === 0
  ) {
    addError(
      errors,
      'MATRIX_ROWS_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} has no rows.`
    )
  }

  if (
    columnItems.length === 0
  ) {
    addError(
      errors,
      'MATRIX_COLUMNS_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} has no columns.`
    )
  }

  validateUniqueIds(
    rowItems,
    'Matrix row',
    errors
  )

  validateUniqueIds(
    columnItems,
    'Matrix column',
    errors
  )
}

/* ─────────────────────────────────────────────
   HOTSPOT
───────────────────────────────────────────── */

function validateHotspot(
  question,
  type,
  errors
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const imageRef =
    getDirectChild(
      response,
      'imageRef'
    )

  const hotspots =
    getDirectChild(
      response,
      'hotspots'
    )

  if (
    !imageRef
  ) {
    addError(
      errors,
      'HOTSPOT_IMAGE_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} is missing imageRef.`
    )
  }

  if (
    !hotspots
  ) {
    addError(
      errors,
      'HOTSPOT_TARGETS_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} is missing hotspots.`
    )
  }
}

/* ─────────────────────────────────────────────
   DRAG / DROP
───────────────────────────────────────────── */

function validateDragDrop(
  question,
  errors
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const draggable =
    getDirectChild(
      response,
      'draggableItems'
    )

  const targets =
    getDirectChild(
      response,
      'targets'
    )

  if (!draggable) {
    addError(
      errors,
      'DRAG_ITEMS_MISSING',
      `DRAG_DROP question ${question.getAttribute(
        'id'
      )} is missing draggableItems.`
    )
  }

  if (!targets) {
    addError(
      errors,
      'DROP_TARGETS_MISSING',
      `DRAG_DROP question ${question.getAttribute(
        'id'
      )} is missing targets.`
    )
  }
}

/* ─────────────────────────────────────────────
   TEXT
───────────────────────────────────────────── */

function validateTextQuestion(
  question,
  type,
  errors,
  warnings
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  /*
   * Text questions intentionally do not require
   * an automatic answer. Evaluation may be manual.
   */
  if (
    type === 'FILL_BLANK'
  ) {
    const blanks =
      getDirectChild(
        response,
        'blanks'
      )

    if (!blanks) {
      addWarning(
        warnings,
        'FILL_BLANK_DEFINITION_MISSING',
        `FILL_BLANK question ${question.getAttribute(
          'id'
        )} does not explicitly define blanks.`
      )
    }
  }
}

/* ─────────────────────────────────────────────
   TECHNICAL / CODE
───────────────────────────────────────────── */

function validateTechnical(
  question,
  type,
  errors,
  warnings
) {
  const response =
    getDirectChild(
      question,
      'response'
    )

  if (!response) {
    return
  }

  const content =
    getDirectChild(
      question,
      'content'
    )

  const code =
    content
      ? getDirectChild(
          content,
          'code'
        )
      : null

  if (
    TECHNICAL_TYPES.has(type) &&
    type !== 'EQUATION_INPUT' &&
    type !== 'GRAPH_RESPONSE' &&
    !code
  ) {
    addWarning(
      warnings,
      'TECHNICAL_CODE_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} does not contain a code block in content.`
    )
  }
}

/* ─────────────────────────────────────────────
   MEDIA
───────────────────────────────────────────── */

function validateMedia(
  question,
  type,
  errors,
  warnings
) {
  const content =
    getDirectChild(
      question,
      'content'
    )

  const response =
    getDirectChild(
      question,
      'response'
    )

  if (
    !content &&
    !response
  ) {
    return
  }

  const media =
    content
      ? Array.from(
          content.children
        ).filter(
          (child) =>
            child.tagName ===
              'audio' ||
            child.tagName ===
              'video' ||
            child.tagName ===
              'media'
        )
      : []

  if (
    media.length === 0
  ) {
    addWarning(
      warnings,
      'MEDIA_CONTENT_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} does not contain explicit media content.`
    )
  }
}

/* ─────────────────────────────────────────────
   GROUP / STIMULUS
───────────────────────────────────────────── */

function validateGroupQuestion(
  question,
  type,
  errors
) {
  const content =
    getDirectChild(
      question,
      'content'
    )

  if (
    !content
  ) {
    addError(
      errors,
      'GROUP_CONTENT_MISSING',
      `${type} question ${question.getAttribute(
        'id'
      )} is missing content.`
    )
  }

  /*
   * Child-question representation is intentionally
   * flexible at this stage. The semantic validator
   * only confirms that the group has a usable body.
   */
}

/* ─────────────────────────────────────────────
   ASSERTION / REASON
───────────────────────────────────────────── */

function validateAssertionReason(
  question,
  errors
) {
  const content =
    getDirectChild(
      question,
      'content'
    )

  if (!content) {
    return
  }

  const assertion =
    getDirectChild(
      content,
      'assertion'
    )

  const reason =
    getDirectChild(
      content,
      'reason'
    )

  if (!assertion) {
    addError(
      errors,
      'ASSERTION_MISSING',
      `Assertion–Reason question ${question.getAttribute(
        'id'
      )} is missing assertion.`
    )
  }

  if (!reason) {
    addError(
      errors,
      'REASON_MISSING',
      `Assertion–Reason question ${question.getAttribute(
        'id'
      )} is missing reason.`
    )
  }
}

/* ─────────────────────────────────────────────
   TYPE-SPECIFIC DISPATCH
───────────────────────────────────────────── */

function validateQuestionByType(
  question,
  type,
  errors,
  warnings
) {
  if (
    CHOICE_TYPES.has(type)
  ) {
    validateChoiceOptions(
      question,
      type,
      errors,
      warnings
    )
  }

  if (
    NUMERIC_TYPES.has(type)
  ) {
    validateNumeric(
      question,
      type,
      errors,
      warnings
    )
  }

  if (
    MATCH_TYPES.has(type)
  ) {
    validateMatch(
      question,
      type,
      errors,
      warnings
    )
  }

  if (
    type === 'ORDERING' ||
    type === 'RANKING'
  ) {
    validateOrdering(
      question,
      type,
      errors
    )
  }

  if (
    MATRIX_TYPES.has(type)
  ) {
    validateMatrix(
      question,
      type,
      errors
    )
  }

  if (
    type === 'HOTSPOT' ||
    type === 'HOTSPOT_MULTI'
  ) {
    validateHotspot(
      question,
      type,
      errors
    )
  }

  if (
    type === 'DRAG_DROP'
  ) {
    validateDragDrop(
      question,
      errors
    )
  }

  if (
    TEXT_TYPES.has(type)
  ) {
    validateTextQuestion(
      question,
      type,
      errors,
      warnings
    )
  }

  if (
    TECHNICAL_TYPES.has(type)
  ) {
    validateTechnical(
      question,
      type,
      warnings
    )
  }

  if (
    MEDIA_TYPES.has(type)
  ) {
    validateMedia(
      question,
      type,
      warnings
    )
  }

  if (
    GROUP_TYPES.has(type)
  ) {
    validateGroupQuestion(
      question,
      type,
      errors
    )
  }

  if (
    type === 'ASSERTION_REASON'
  ) {
    validateAssertionReason(
      question,
      errors
    )
  }
}

/* ─────────────────────────────────────────────
   IMAGE / ASSET CONTENT
───────────────────────────────────────────── */

function collectEmbeddedImageIds(root, errors) {
  const embeddedIds = new Set()

  for (const image of Array.from(root.querySelectorAll('image[encoding="base64"]'))) {
    const imageId = image.getAttribute('id')?.trim() || ''
    const assetRef = image.getAttribute('assetRef')?.trim() || ''

    if (!imageId) {
      addError(
        errors,
        'EMBEDDED_IMAGE_ID_MISSING',
        'Every Base64 image definition must have an id. Use assetRef only for later references.'
      )
      continue
    }

    if (assetRef) {
      addError(
        errors,
        'EMBEDDED_IMAGE_ASSETREF_INVALID',
        `Base64 image asset "${imageId}" must use id for its single embedded definition, not assetRef.`
      )
    }

    if (embeddedIds.has(imageId)) {
      addError(
        errors,
        'DUPLICATE_EMBEDDED_ASSET_ID',
        `Duplicate embedded asset id "${imageId}".`
      )
      continue
    }

    embeddedIds.add(imageId)
  }

  return embeddedIds
}

function collectEmbeddedImageScopes(root) {
  const scopes = new Map()

  for (const image of Array.from(root.querySelectorAll('image[encoding="base64"]'))) {
    const id = image.getAttribute('id')?.trim() || ''
    const scope = image.getAttribute('scope')?.trim() || ''
    if (id && scope) scopes.set(id, scope)
  }

  return scopes
}

function validateContentAssets(content, questionId, assetIds, assetScopes, errors, warnings) {
  if (!content) return

  for (const image of getDirectChildren(content, 'image')) {
    const encoding = (image.getAttribute('encoding') || '').toLowerCase()
    const assetRef = image.getAttribute('assetRef')?.trim() || ''
    const imageId = image.getAttribute('id')?.trim() || ''
    const mime = image.getAttribute('mimeType') || image.getAttribute('mime') || ''
    const src = image.getAttribute('src')?.trim() || ''
    const allowFullPage = (image.getAttribute('allowFullPage') || '').toLowerCase() === 'true'

    if (src) {
      addError(
        errors,
        'EXTERNAL_ASSET_SOURCE_UNSUPPORTED',
        `Question ${questionId} image "${imageId || assetRef || '(unknown)'}" uses an external src. Use a package-internal asset or Base64 XML.`
      )
    }

    if (encoding === 'base64') {
      if (!imageId && !assetRef) {
        addError(
          errors,
          'EMBEDDED_IMAGE_ID_MISSING',
          `Question ${questionId} contains a Base64 image without an id or assetRef.`
        )
      }

      if (!/^image\//i.test(mime)) {
        addError(
          errors,
          'EMBEDDED_IMAGE_MIME_INVALID',
          `Question ${questionId} contains a Base64 image without a valid image mimeType.`
        )
      }

      const embeddedScope = image.getAttribute('scope')?.trim() || ''
      if (embeddedScope === 'source-page' && !allowFullPage) {
        addError(
          errors,
          'SOURCE_PAGE_ASSET_IN_QUESTION',
          `Question ${questionId} contains a source-page Base64 image without allowFullPage="true". Use a question-specific visual asset instead, or explicitly document the unavoidable full-page fallback.`
        )
      } else if (embeddedScope === 'source-page' && allowFullPage) {
        addWarning(
          warnings,
          'FULL_PAGE_VISUAL_FALLBACK',
          `Question ${questionId} uses a source-page Base64 image as an explicit full-page fallback.`
        )
      } else if (allowFullPage) {
        addError(
          errors,
          'FULL_PAGE_FLAG_SCOPE_INVALID',
          `Question ${questionId} uses allowFullPage="true" without scope="source-page".`
        )
      }

      continue
    }

    if (!assetRef && !imageId) {
      addError(
        errors,
        'IMAGE_REFERENCE_MISSING',
        `Question ${questionId} contains an image without assetRef or id.`
      )
      continue
    }

    const resolvedId = assetRef || imageId
    const resolvedScope = assetScopes.get(resolvedId) || image.getAttribute('scope')?.trim() || ''
    const pageLikeAsset = /^asset-page-\d+$/i.test(resolvedId) || /^page-\d+$/i.test(resolvedId)

    if (pageLikeAsset && !(resolvedScope === 'source-page' && allowFullPage)) {
      addError(
        errors,
        'PAGE_IMAGE_AS_QUESTION_ASSET',
        `Question ${questionId} references page-level image asset "${resolvedId}" as normal question/option content. Rendered source pages are audit assets only; segment the exact question, option, or MATCH visual instead.`
      )
    }

    if (!assetIds.has(resolvedId)) {
      addError(
        errors,
        'ASSET_REFERENCE_INVALID',
        `Question ${questionId} references missing image asset "${resolvedId}".`
      )
    } else {
      const scope = resolvedScope
      if (scope === 'source-page' && !allowFullPage) {
        addError(
          errors,
          'SOURCE_PAGE_ASSET_IN_QUESTION',
          `Question ${questionId} references source-page image asset "${resolvedId}" without allowFullPage="true". Use a question-specific visual asset instead, or explicitly document the unavoidable full-page fallback.`
        )
      } else if (scope === 'source-page' && allowFullPage) {
        addWarning(
          warnings,
          'FULL_PAGE_VISUAL_FALLBACK',
          `Question ${questionId} uses source-page image asset "${resolvedId}" as an explicit full-page fallback.`
        )
      }
    }
  }
}

/* ─────────────────────────────────────────────
   VISUAL ASSET OWNERSHIP / ATTACHMENT GATE
───────────────────────────────────────────── */

function collectVisualAssetUsages(questions) {
  const usages = new Map()

  const addUsage = (assetId, usage) => {
    if (!assetId) return
    if (!usages.has(assetId)) usages.set(assetId, [])
    usages.get(assetId).push(usage)
  }

  for (const question of questions) {
    const questionId = question.getAttribute('id') || ''
    if (!questionId) continue

    for (const element of Array.from(question.querySelectorAll('[assetRef]'))) {
      const assetId = element.getAttribute('assetRef')?.trim() || ''
      if (!assetId) continue

      const option = element.closest('option')
      const matchItem = element.closest('leftItem, rightItem, item')

      if (option) {
        addUsage(assetId, {
          questionId,
          context: 'option',
          ownerId: option.getAttribute('id')?.trim() || '',
        })
      } else if (matchItem) {
        addUsage(assetId, {
          questionId,
          context: 'match-item',
          ownerId: matchItem.getAttribute('id')?.trim() || '',
        })
      } else {
        addUsage(assetId, {
          questionId,
          context: 'question',
          ownerId: questionId,
        })
      }
    }
  }

  return usages
}

function validateVisualAssetOwnership(
  questions,
  assets,
  assetScopes,
  errors,
  warnings
) {
  const usages = collectVisualAssetUsages(questions)
  const declaredIds = new Set(assets.map((asset) => asset.getAttribute('id')?.trim()).filter(Boolean))

  for (const [assetId, assetUsages] of usages.entries()) {
    const distinctQuestionIds = new Set(assetUsages.map((usage) => usage.questionId))
    const distinctOwners = new Set(
      assetUsages.map((usage) => `${usage.questionId}:${usage.context}:${usage.ownerId}`)
    )
    const scope = assetScopes.get(assetId) || ''

    if (distinctQuestionIds.size > 1) {
      addError(
        errors,
        'VISUAL_ASSET_MULTIPLE_QUESTION_OWNERS',
        `Visual asset "${assetId}" is referenced by multiple questions (${Array.from(distinctQuestionIds).join(', ')}). Each normal visual asset must have one semantic owner unless an explicit source-backed shared visual is established.`
      )
      continue
    }

    if (distinctOwners.size > 1) {
      addError(
        errors,
        'VISUAL_ASSET_MULTIPLE_SEMANTIC_OWNERS',
        `Visual asset "${assetId}" is attached to multiple semantic owners. Create owner-specific assets unless the source explicitly establishes one shared visual.`
      )
    }

    for (const usage of assetUsages) {
      if (scope === 'option-visual' && usage.context !== 'option') {
        addError(
          errors,
          'VISUAL_ASSET_SCOPE_CONTEXT_MISMATCH',
          `Option-visual asset "${assetId}" is attached outside an option in question ${usage.questionId}.`
        )
      }

      if (scope === 'question-visual' && usage.context === 'option') {
        addError(
          errors,
          'VISUAL_ASSET_SCOPE_CONTEXT_MISMATCH',
          `Question-visual asset "${assetId}" is attached to an option in question ${usage.questionId}.`
        )
      }

      if (scope === 'source-page') {
        addError(
          errors,
          'SOURCE_PAGE_ASSET_NORMAL_REFERENCE',
          `Source-page asset "${assetId}" is referenced as normal ${usage.context} content in question ${usage.questionId}.`
        )
      }
    }
  }

  for (const asset of assets) {
    const assetId = asset.getAttribute('id')?.trim() || ''
    const scope = asset.getAttribute('scope')?.trim() || ''
    if (!assetId || !scope || scope === 'source-page') continue

    if (!usages.has(assetId)) continue

    // The validator intentionally does not infer pixel contamination from an image
    // binary. It enforces the machine-checkable ownership/attachment contract and
    // leaves pixel-level visual sign-off to the conversion preflight.
    if (!declaredIds.has(assetId)) {
      addError(
        errors,
        'VISUAL_ASSET_DECLARATION_INVALID',
        `Visual asset "${assetId}" is referenced but is not declared in the asset manifest.`
      )
    }
  }

  for (const [assetId, assetUsages] of usages.entries()) {
    const scope = assetScopes.get(assetId) || ''
    if (!scope) {
      addWarning(
        warnings,
        'VISUAL_ASSET_SCOPE_MISSING',
        `Visual asset "${assetId}" has no declared visual scope. Declare question-visual or option-visual so ownership can be checked.`
      )
    }

    if (assetUsages.length > 1) {
      const contexts = new Set(assetUsages.map((usage) => `${usage.questionId}:${usage.context}:${usage.ownerId}`))
      if (contexts.size === 1) {
        addWarning(
          warnings,
          'VISUAL_ASSET_REUSED_WITHIN_OWNER',
          `Visual asset "${assetId}" is referenced more than once by the same semantic owner. Verify that this duplication is intentional.`
        )
      }
    }
  }
}


const MATH_LIKE_TEXT_PATTERN = /[√∫∑∏∞≤≥≠≈±×÷→↔∈∉∩∪⊂⊃∆αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΠΣΦΨΩ²³⁴⁵⁶⁷⁸⁹]|\b(?:sin|cos|tan|cot|sec|cosec|log|ln|lim)\s*(?:\(|[a-zA-Z])|\b[A-Za-z](?:[A-Za-z0-9_']*)\s*=\s*|\b\d+\s*\/\s*\d+\b|\b[A-Za-z](?:[A-Za-z0-9_']*)\s*\^\s*[{(]?\s*[-+]?\d/



function validateMathematicalRepresentation(question, errors) {
  const questionId =
    question.getAttribute('id') ||
    getText(question, 'originalNumber') ||
    '(unknown)'

  // Inspect both question content and option-owned content. In real conversions,
  // equation options are frequently represented as direct <option><text> nodes,
  // not nested inside <content>; the previous content-only scan missed them.
  const contentElements = Array.from(
    question.querySelectorAll('content, option, leftItem, rightItem, item')
  )
  const reportedOwners = new Set()

  for (const content of contentElements) {
    const textElements = Array.from(content.children)
      .filter((child) => child.tagName === 'text')

    for (const textElement of textElements) {
      const text = (textElement.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()

      if (!text || !MATH_LIKE_TEXT_PATTERN.test(text)) {
        continue
      }

      const option = content.tagName === 'option' ? content : content.closest('option')
      const ownerId = option?.getAttribute('id') || content.getAttribute('id') || 'question-stem'
      const ownerKey = `${content.tagName}:${ownerId}`
      if (reportedOwners.has(ownerKey)) break
      reportedOwners.add(ownerKey)

      const ownerDescription = option
        ? `option ${option.getAttribute('label') || option.getAttribute('id') || '(unlabelled)'}`
        : content.tagName === 'content'
          ? 'question content'
          : `${content.tagName} ${ownerId}`

      addError(
        errors,
        'MATH_FLATTENED_INTO_TEXT',
        `Question ${questionId} ${ownerDescription} contains math-like source content inside <text> without structured <math> content. Recover exact structured math or use a tight math-only visual fallback; do not ship flattened mathematical notation.`
      )
      break
    }
  }
}

function normalizeQuestionContentForValidation(question) {
  const content = getDirectChild(question, 'content')
  return (content?.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Conversion review notes are evidence that the source has not yet been
 * completely resolved. They must never silently pass the production gate
 * when they describe an unresolved fidelity risk. Benign provenance notes
 * (for example, an explicitly preserved source ambiguity) are allowed.
 */
function validateUnresolvedReviewFlags(root, errors) {
  const reviewFlags = Array.from(root.querySelectorAll('reviewFlags flag'))

  for (const flag of reviewFlags) {
    const text = (flag.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) continue

    if (/\b(?:unresolved|remaining|delicate|needs? review|verify|verification|high[- ]risk|corrupt(?:ed|ion)?|not resolved|not successfully converted)\b/i.test(text)) {
      addError(
        errors,
        'UNRESOLVED_REVIEW_FLAG',
        `Conversion contains an unresolved review flag: ${text}`
      )
    }
  }

  // Conversion prompts often put review notes directly on individual questions
  // instead of in the root reviewFlags container. These notes must not be ignored.
  // This is a machine-readable source-fidelity gate, not pixel-level source review.
  const questionReviewStatuses = Array.from(root.querySelectorAll('questions question reviewStatus'))
  for (const statusNode of questionReviewStatuses) {
    const text = (statusNode.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) continue

    if (/\b(?:unresolved|needs? review|requires? review|should be checked|verify|verification|not fully certified|not reconciled|reconciliation not|corrupt(?:ed|ion)?|not successfully converted|boundary should be checked)\b/i.test(text)) {
      const question = statusNode.closest('question')
      const questionId = question?.getAttribute('id') || getText(question, 'originalNumber') || '(unknown)'
      addError(
        errors,
        'QUESTION_SOURCE_RECONCILIATION_REQUIRED',
        `Question ${questionId} has an unresolved source-fidelity review status: ${text}. Reconcile it against the original source before importing as a certified conversion.`
      )
    }
  }
}

/* ─────────────────────────────────────────────
   QUESTION
───────────────────────────────────────────── */

function validateQuestion(
  question,
  sectionIds,
  passageIds,
  assetIds,
  assetScopes,
  errors,
  warnings
) {
  const questionId =
    question.getAttribute('id')

  const type =
    getText(
      question,
      'type'
    ).toUpperCase()

  const originalNumber =
    getText(
      question,
      'originalNumber'
    )

  const sectionRef =
    getText(
      question,
      'sectionRef'
    )

  const content =
    getDirectChild(
      question,
      'content'
    )

  const response =
    getDirectChild(
      question,
      'response'
    )

  /* ─────────────────────────────────────────
     SOURCE QUESTION NUMBER
  ───────────────────────────────────────── */

  if (!originalNumber) {
    addError(
      errors,
      'QUESTION_NUMBER_MISSING',
      `Question ${
        questionId || '(unknown)'
      } is missing originalNumber.`
    )
  } else if (
    !/^\d+$/.test(
      originalNumber
    )
  ) {
    addError(
      errors,
      'QUESTION_NUMBER_INVALID',
      `Question ${
        questionId || '(unknown)'
      } has invalid originalNumber "${originalNumber}".`
    )
  }

  /* ─────────────────────────────────────────
     SECTION
  ───────────────────────────────────────── */

  if (!sectionRef) {
    addError(
      errors,
      'SECTION_REFERENCE_MISSING',
      `Question ${questionId} is missing sectionRef.`
    )
  } else if (
    !sectionIds.has(
      sectionRef
    )
  ) {
    addError(
      errors,
      'SECTION_REFERENCE_INVALID',
      `Question ${questionId} references missing section "${sectionRef}".`
    )
  }

  /* ─────────────────────────────────────────
     TYPE
  ───────────────────────────────────────── */

  if (!type) {
    addError(
      errors,
      'QUESTION_TYPE_MISSING',
      `Question ${questionId} is missing type.`
    )
  } else if (
    !SUPPORTED_TYPES.has(
      type
    )
  ) {
    addError(
      errors,
      'QUESTION_TYPE_INVALID',
      `Question ${questionId} uses unsupported type "${type}".`
    )
  }

  /* ─────────────────────────────────────────
     CONTENT
  ───────────────────────────────────────── */

  if (!content) {
    addError(
      errors,
      'CONTENT_MISSING',
      `Question ${questionId} is missing content.`
    )
  }

  /* ─────────────────────────────────────────
     RESPONSE
  ───────────────────────────────────────── */

  /*
   * Group/stimulus questions may use a group response
   * and still require the response container.
   *
   * All source questions retain an explicit response
   * element so the normalized model remains predictable.
   */
  if (!response) {
    const definition =
      getQuestionType(type)

    if (definition?.autoGradable) {
      addWarning(
        warnings,
        'RESPONSE_MISSING',
        `Question ${questionId} is missing response/answer-key data. It can be stored as source-only.`
      )
    } else {
      addError(
        errors,
        'RESPONSE_MISSING',
        `Question ${questionId} is missing response.`
      )
    }

    return
  }

  const mode =
    getText(
      response,
      'mode'
    )

  if (
    !RESPONSE_MODES.has(
      mode
    )
  ) {
    addError(
      errors,
      'RESPONSE_MODE_INVALID',
      `Question ${questionId} uses unsupported response mode "${mode}".`
    )
  }

  /* ─────────────────────────────────────────
     TYPE ↔ RESPONSE MODE
  ───────────────────────────────────────── */

  const definition =
    getQuestionType(
      type
    )

  const expectedMode =
    definition?.responseMode ||
    null

  if (
    expectedMode &&
    mode !== expectedMode
  ) {
    addError(
      errors,
      'RESPONSE_MODE_MISMATCH',
      `Question ${questionId} of type ${type} should use response mode "${expectedMode}".`
    )
  }

  /* ─────────────────────────────────────────
     MATHEMATICAL REPRESENTATION
  ───────────────────────────────────────── */

  validateMathematicalRepresentation(
    question,
    errors
  )

  /* ─────────────────────────────────────────
     TYPE-SPECIFIC VALIDATION
  ───────────────────────────────────────── */

  if (
    definition
  ) {
    validateQuestionByType(
      question,
      type,
      errors,
      warnings
    )
  }

  /* ─────────────────────────────────────────
     PASSAGE REFERENCE
  ───────────────────────────────────────── */

  const passageRef =
    getText(
      question,
      'passageRef'
    )

  if (
    passageRef &&
    !passageIds.has(
      passageRef
    )
  ) {
    addError(
      errors,
      'PASSAGE_REFERENCE_INVALID',
      `Question ${questionId} references missing passage "${passageRef}".`
    )
  }

  /* ─────────────────────────────────────────
     ASSET REFERENCES
  ───────────────────────────────────────── */

  validateContentAssets(
    content,
    questionId,
    assetIds,
    assetScopes,
    errors,
    warnings
  )

  for (const nestedContent of Array.from(question.querySelectorAll('content'))) {
    if (nestedContent === content) continue
    validateContentAssets(nestedContent, questionId, assetIds, assetScopes, errors, warnings)
  }

  if (content) {
    const referencedAssets = Array.from(content.querySelectorAll('assetRef'))

    for (const ref of referencedAssets) {
      const assetId = ref.getAttribute('assetRef')?.trim() || ref.textContent.trim()

      if (assetId && !assetIds.has(assetId)) {
        addError(
          errors,
          'ASSET_REFERENCE_INVALID',
          `Question ${questionId} references missing asset "${assetId}".`
        )
      }
    }
  }

  /* ─────────────────────────────────────────
     MARKING
  ───────────────────────────────────────── */

  validateMarking(
    question,
    errors,
    warnings
  )
}

/* ─────────────────────────────────────────────
   MAIN VALIDATOR
───────────────────────────────────────────── */

export function validateCbtgenXml(
  xml
) {
  const errors = []
  const warnings = []

  /* ─────────────────────────────────────────
     DOCUMENT
  ───────────────────────────────────────── */

  if (
    !xml ||
    !xml.documentElement
  ) {
    return {
      valid: false,
      status: 'REJECTED',

      errors: [
        {
          severity: 'error',
          code: 'NO_DOCUMENT',
          message:
            'No XML document was provided.',
        },
      ],

      warnings: [],
      summary: {},
    }
  }

  const root =
    xml.documentElement

  /* ─────────────────────────────────────────
     ROOT
  ───────────────────────────────────────── */

  if (
    root.tagName !== 'cbtgen'
  ) {
    addError(
      errors,
      'ROOT_INVALID',
      'Root element must be <cbtgen>.'
    )

    return {
      valid: false,
      status: 'REJECTED',
      errors,
      warnings,
      summary: {},
    }
  }

  /* ─────────────────────────────────────────
     VERSION
  ───────────────────────────────────────── */

  if (
    root.getAttribute(
      'version'
    ) !== '1.0'
  ) {
    addError(
      errors,
      'VERSION_INVALID',
      'CBTGen XML version must be 1.0.'
    )
  }

  /* ─────────────────────────────────────────
     TOP-LEVEL CONTAINERS
  ───────────────────────────────────────── */

  const exam =
    getDirectChild(
      root,
      'exam'
    )

  const sectionsContainer =
    getDirectChild(
      root,
      'sections'
    )

  const passagesContainer =
    getDirectChild(
      root,
      'passages'
    )

  const questionsContainer =
    getDirectChild(
      root,
      'questions'
    )

  const assetsContainer =
    getDirectChild(
      root,
      'assets'
    )

  if (!exam) {
    addError(
      errors,
      'EXAM_MISSING',
      'Missing <exam>.'
    )
  }

  if (
    !sectionsContainer
  ) {
    addError(
      errors,
      'SECTIONS_MISSING',
      'Missing <sections>.'
    )
  }

  if (
    !questionsContainer
  ) {
    addError(
      errors,
      'QUESTIONS_MISSING',
      'Missing <questions>.'
    )
  }

  if (
    !exam ||
    !sectionsContainer ||
    !questionsContainer
  ) {
    return {
      valid: false,
      status: 'REJECTED',
      errors,
      warnings,
      summary: {},
    }
  }

  /* ─────────────────────────────────────────
     COLLECTIONS
  ───────────────────────────────────────── */

  const sections =
    getDirectChildren(
      sectionsContainer,
      'section'
    )

  const questions =
    getDirectChildren(
      questionsContainer,
      'question'
    )

  const passages =
    passagesContainer
      ? getDirectChildren(
          passagesContainer,
          'passage'
        )
      : []

  const assets =
    assetsContainer
      ? getDirectChildren(
          assetsContainer,
          'asset'
        )
      : []

  for (const asset of assets) {
    const assetId = asset.getAttribute('id') || ''
    const src = asset.getAttribute('src') || ''
    const mime = asset.getAttribute('mimeType') || ''

    if (src && (!src.startsWith('assets/') || src.includes('..') || src.startsWith('/'))) {
      addError(
        errors,
        'ASSET_PATH_INVALID',
        `Asset "${assetId || '(unknown)'}" must use a package-internal path under assets/.`
      )
    }

    if (!src && !asset.querySelector('data')) {
      addError(
        errors,
        'ASSET_SOURCE_MISSING',
        `Asset "${assetId || '(unknown)'}" has no package path or embedded data.`
      )
    }

    if (assetId && asset.getAttribute('type') === 'image' && !asset.getAttribute('mimeType')) {
      addError(
        errors,
        'ASSET_MIME_INVALID',
        `Image asset "${assetId}" must declare an image mimeType.`
      )
    } else if (assetId && asset.getAttribute('type') === 'image' && /^image\//i.test(mime) === false) {
      addError(
        errors,
        'ASSET_MIME_INVALID',
        `Image asset "${assetId}" must declare an image mime type.`
      )
    }

    const scope = asset.getAttribute('scope')?.trim() || ''
    if (asset.getAttribute('type') === 'image' && scope && !['question-visual', 'option-visual', 'source-page'].includes(scope)) {
      addError(
        errors,
        'ASSET_SCOPE_INVALID',
        `Image asset "${assetId || '(unknown)'}" uses unsupported scope "${scope}".`
      )
    }
  }

  /* ─────────────────────────────────────────
     UNIQUE IDS
  ───────────────────────────────────────── */

  validateUniqueIds(
    sections,
    'Section',
    errors
  )

  validateUniqueIds(
    passages,
    'Passage',
    errors
  )

  validateUniqueIds(
    questions,
    'Question',
    errors
  )

  validateUniqueIds(
    assets,
    'Asset',
    errors
  )

  const sectionIds =
    new Set(
      getIds(sections)
    )

  const passageIds =
    new Set(
      getIds(passages)
    )

  const assetIds =
    new Set(
      getIds(assets)
    )

  const embeddedImageIds = collectEmbeddedImageIds(root, errors)
  for (const embeddedImageId of embeddedImageIds) {
    assetIds.add(embeddedImageId)
  }

  const assetScopes = new Map()
  for (const asset of assets) {
    const id = asset.getAttribute('id')?.trim() || ''
    const scope = asset.getAttribute('scope')?.trim() || ''
    if (id && scope) assetScopes.set(id, scope)
  }
  for (const [id, scope] of collectEmbeddedImageScopes(root)) {
    assetScopes.set(id, scope)
  }

  /* ─────────────────────────────────────────
     EXAM METADATA
  ───────────────────────────────────────── */

  const examName =
    getText(
      exam,
      'name'
    )

  const totalQuestionsText =
    getText(
      exam,
      'totalQuestions'
    )

  const totalMarksText =
    getText(
      exam,
      'totalMarks'
    )

  const duration =
    getDirectChild(
      exam,
      'duration'
    )

  if (!examName) {
    addError(
      errors,
      'EXAM_NAME_MISSING',
      'Exam name is missing.'
    )
  }

  /* ─────────────────────────────────────────
     TOTAL QUESTIONS
  ───────────────────────────────────────── */

  if (
    !totalQuestionsText
  ) {
    addError(
      errors,
      'TOTAL_QUESTIONS_MISSING',
      'exam.totalQuestions is missing.'
    )
  } else if (
    !/^\d+$/.test(
      totalQuestionsText
    )
  ) {
    addError(
      errors,
      'TOTAL_QUESTIONS_INVALID',
      'exam.totalQuestions must be a positive integer.'
    )
  } else if (
    Number(totalQuestionsText) <= 0
  ) {
    addError(
      errors,
      'TOTAL_QUESTIONS_INVALID',
      'exam.totalQuestions must be greater than zero.'
    )
  }

  if (
    totalQuestionsText &&
    /^\d+$/.test(
      totalQuestionsText
    ) &&
    Number(totalQuestionsText) !==
      questions.length
  ) {
    addError(
      errors,
      'QUESTION_COUNT_MISMATCH',
      `exam.totalQuestions says ${totalQuestionsText}, but ${questions.length} question elements were found.`
    )
  }

  /* ─────────────────────────────────────────
     TOTAL MARKS
  ───────────────────────────────────────── */

  if (
    totalMarksText &&
    !Number.isFinite(
      Number(totalMarksText)
    )
  ) {
    addError(
      errors,
      'TOTAL_MARKS_INVALID',
      'exam.totalMarks must be numeric.'
    )
  }

  /* ─────────────────────────────────────────
     DURATION
  ───────────────────────────────────────── */

  if (duration) {
    const durationValue =
      Number(
        duration.textContent.trim()
      )

    if (
      !Number.isInteger(
        durationValue
      ) ||
      durationValue <= 0
    ) {
      addError(
        errors,
        'DURATION_INVALID',
        'Exam duration must be a positive integer.'
      )
    }

    if (
      duration.getAttribute(
        'unit'
      ) !== 'minutes'
    ) {
      addError(
        errors,
        'DURATION_UNIT_INVALID',
        'Exam duration unit must be "minutes".'
      )
    }
  }

  /* ─────────────────────────────────────────
     QUESTION COUNTS BY SECTION
  ───────────────────────────────────────── */

  const questionsBySection =
    new Map()

  for (
    const question of questions
  ) {
    const sectionRef =
      getText(
        question,
        'sectionRef'
      )

    if (
      !questionsBySection.has(
        sectionRef
      )
    ) {
      questionsBySection.set(
        sectionRef,
        0
      )
    }

    questionsBySection.set(
      sectionRef,
      questionsBySection.get(
        sectionRef
      ) + 1
    )
  }

  for (
    const section of sections
  ) {
    const sectionId =
      section.getAttribute(
        'id'
      )

    const declaredCount =
      getText(
        section,
        'questionCount'
      )

    const actualCount =
      questionsBySection.get(
        sectionId
      ) || 0

    if (
      declaredCount &&
      /^\d+$/.test(
        declaredCount
      ) &&
      Number(declaredCount) !==
        actualCount
    ) {
      addError(
        errors,
        'SECTION_COUNT_MISMATCH',
        `Section "${sectionId}" declares ${declaredCount} questions, but ${actualCount} questions reference it.`
      )
    }
  }

  /* ─────────────────────────────────────────
     QUESTIONS
  ───────────────────────────────────────── */

  for (
    const question of questions
  ) {
    validateQuestion(
      question,
      sectionIds,
      passageIds,
      assetIds,
      assetScopes,
      errors,
      warnings
    )
  }

  validateVisualAssetOwnership(
    questions,
    assets,
    assetScopes,
    errors,
    warnings
  )

  /* ─────────────────────────────────────────
     UNRESOLVED REVIEW FLAGS
  ───────────────────────────────────────── */

  validateUnresolvedReviewFlags(
    root,
    errors
  )

  /* ─────────────────────────────────────────
     DUPLICATE QUESTION CONTENT
  ───────────────────────────────────────── */

  const duplicateQuestionContent = new Map()

  for (const question of questions) {
    const type = getText(question, 'type').toUpperCase()
    const originalNumber = getText(question, 'originalNumber')
    const content = normalizeQuestionContentForValidation(question)

    if (!content) continue

    const key = `${type}|${content}`
    const previous = duplicateQuestionContent.get(key)

    if (previous) {
      addError(
        errors,
        'DUPLICATE_QUESTION_CONTENT',
        `Questions ${previous} and ${originalNumber || question.getAttribute('id') || '(unknown)'} have identical normalized content. Verify that adjacent source questions were not merged or duplicated.`
      )
    } else {
      duplicateQuestionContent.set(key, originalNumber || question.getAttribute('id') || '(unknown)')
    }
  }

  /* ─────────────────────────────────────────
     UNREFERENCED VISUAL ASSETS
  ───────────────────────────────────────── */

  const referencedAssetIds = new Set(
    Array.from(xml.querySelectorAll('[assetRef]'))
      .map((element) => element.getAttribute('assetRef')?.trim() || '')
      .filter(Boolean)
  )

  for (const [assetId, scope] of assetScopes.entries()) {
    if (!scope || scope === 'source-page') continue
    if (referencedAssetIds.has(assetId)) continue

    addWarning(
      warnings,
      'VISUAL_ASSET_UNREFERENCED',
      `Visual asset "${assetId}" (${scope}) is declared but not referenced by question/option content. The conversion is incomplete until the asset is attached where it belongs.`
    )
  }

  /* ─────────────────────────────────────────
     ANSWER-KEY READINESS
  ───────────────────────────────────────── */

  const isAnswerPresent = (question) => {
    const type = getText(question, 'type').toUpperCase()
    const definition = getQuestionType(type)

    if (!definition?.autoGradable) {
      return true
    }

    const response = getDirectChild(question, 'response')
    if (!response) return false

    const answer = getDirectChild(response, 'answer')
    if (!answer) return false

    if (CHOICE_TYPES.has(type)) {
      return getDirectChildren(answer, 'correctOptionRef').length > 0
    }

    if (NUMERIC_TYPES.has(type)) {
      return Boolean(
        getDirectChild(answer, 'value') ||
        getDirectChild(answer, 'range')
      )
    }

    if (MATCH_TYPES.has(type)) {
      return Boolean(getDirectChild(answer, 'mapping'))
    }

    if (type === 'ORDERING' || type === 'RANKING') {
      return answer.children.length > 0 || Boolean(answer.textContent.trim())
    }

    return answer.children.length > 0 || Boolean(answer.textContent.trim())
  }

  const autoGradableQuestions = questions.filter((question) => {
    const type = getText(question, 'type').toUpperCase()
    return getQuestionType(type)?.autoGradable === true
  })

  const missingAnswerQuestions = autoGradableQuestions.filter(
    (question) => !isAnswerPresent(question)
  )

  if (missingAnswerQuestions.length > 0) {
    addWarning(
      warnings,
      'ANSWER_KEY_MISSING',
      `${missingAnswerQuestions.length} auto-gradable question${missingAnswerQuestions.length === 1 ? '' : 's'} do not contain answer-key data. The paper can be stored as source-only, but it is not ready for automatic scoring.`
    )
  }

  const answerKeyStatus =
    autoGradableQuestions.length === 0
      ? 'NOT_REQUIRED'
      : missingAnswerQuestions.length === 0
        ? 'COMPLETE'
        : 'MISSING'

  const scoringReady =
    errors.length === 0 &&
    missingAnswerQuestions.length === 0

  /* ─────────────────────────────────────────
     TYPE COUNTS
  ───────────────────────────────────────── */

  const typeCounts = {}

  for (
    const question of questions
  ) {
    const type =
      getText(
        question,
        'type'
      ).toUpperCase()

    if (type) {
      typeCounts[type] =
        (typeCounts[type] || 0) +
        1
    }
  }

  /* ─────────────────────────────────────────
     SUMMARY
  ───────────────────────────────────────── */

  const summary = {
    examName,

    year:
      getText(
        exam,
        'year'
      ) || null,

    paperNumber:
      getText(
        exam,
        'paperNumber'
      ) || null,

    durationMinutes:
      duration
        ? Number(
            duration.textContent.trim()
          )
        : null,

    totalQuestions:
      questions.length,

    declaredTotalQuestions:
      totalQuestionsText
        ? Number(
            totalQuestionsText
          )
        : null,

    totalMarks:
      totalMarksText
        ? Number(
            totalMarksText
          )
        : null,

    sections:
      sections.length,

    passages:
      passages.length,

    assets:
      assets.length,

    questionTypes:
      typeCounts,

    answerKeyStatus,

    answerKeyMissingCount:
      missingAnswerQuestions.length,

    answerKeyMissingQuestionIds:
      missingAnswerQuestions.map((question) =>
        question.getAttribute('id')
      ),

    scoringReady,
  }

  /* ─────────────────────────────────────────
     FINAL STATUS
  ───────────────────────────────────────── */

  let status =
    'VALID'

  if (
    errors.length > 0
  ) {
    status =
      'REJECTED'
  } else if (
    warnings.length > 0
  ) {
    status =
      'VALID_WITH_WARNINGS'
  }

  return {
    valid:
      errors.length === 0,

    status,

    errors,

    warnings,

    summary,
  }
}