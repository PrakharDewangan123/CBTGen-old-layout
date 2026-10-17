const WHITESPACE_REGEX = /\s+/g
const PUNCTUATION_REGEX = /[“”‘’`]/g

function normalizeText(value = '') {
  return String(value)
    .normalize('NFKC')
    .replace(PUNCTUATION_REGEX, (char) => {
      const replacements = {
        '“': '"',
        '”': '"',
        '‘': "'",
        '’': "'",
        '`': "'",
      }

      return replacements[char] || char
    })
    .replace(WHITESPACE_REGEX, ' ')
    .trim()
}

function normalizeNumber(value = '') {
  const normalized = normalizeText(value)

  const number = Number(normalized)

  if (Number.isFinite(number)) {
    return String(number)
  }

  return normalized
}

function getDirectChild(parent, tagName) {
  return (
    Array.from(parent?.children || []).find(
      (child) => child.tagName === tagName
    ) || null
  )
}

function getDirectChildren(parent, tagName) {
  return Array.from(parent?.children || []).filter(
    (child) => child.tagName === tagName
  )
}

function getText(parent, tagName) {
  const element = getDirectChild(parent, tagName)

  return normalizeText(element?.textContent || '')
}

/*
 * Normalize the meaningful content of a question,
 * option, math expression, code block, table,
 * assertion, reason, or referenced asset.
 *
 * Structural XML metadata such as IDs and labels
 * are deliberately not included here.
 */
function normalizeContent(contentElement, assetContext = null) {
  if (!contentElement) {
    return ''
  }

  const parts = []

  for (const child of contentElement.children) {
    if (child.tagName === 'text') {
      parts.push(
        `TEXT:${normalizeText(child.textContent)}`
      )
    }

    if (child.tagName === 'math') {
      parts.push(
        `MATH:${normalizeText(
          child.getAttribute('format') || ''
        )}:${normalizeText(child.textContent)}`
      )
    }

    if (child.tagName === 'code') {
      parts.push(
        `CODE:${normalizeText(
          child.getAttribute('language') || ''
        )}:${normalizeText(child.textContent)}`
      )
    }

    if (child.tagName === 'image') {
      const assetId = normalizeText(
        child.getAttribute('assetRef') ||
        child.getAttribute('id') ||
        child.textContent ||
        ''
      )
      const digest = assetContext?.assetDigests?.get(assetId) || ''
      parts.push(digest ? `IMAGE:${digest}` : `IMAGE:${assetId}`)
    }

    if (child.tagName === 'assetRef') {
      const assetId = normalizeText(child.getAttribute('assetRef') || child.textContent)
      const digest = assetContext?.assetDigests?.get(assetId) || ''
      parts.push(digest ? `ASSET:${digest}` : `ASSET:${assetId}`)
    }

    if (child.tagName === 'table') {
      parts.push(
        `TABLE:${normalizeText(child.textContent)}`
      )
    }

    if (child.tagName === 'assertion') {
      parts.push(
        `ASSERTION:${normalizeText(child.textContent)}`
      )
    }

    if (child.tagName === 'reason') {
      parts.push(
        `REASON:${normalizeText(child.textContent)}`
      )
    }
  }

  return parts.join('|')
}

/*
 * Read all options.
 *
 * Option ID is retained temporarily only so that
 * correctOptionRef can be resolved.
 *
 * Option ID itself NEVER becomes part of the
 * question fingerprint.
 */
function getOptions(response, assetContext = null) {
  const optionsElement = getDirectChild(
    response,
    'options'
  )

  if (!optionsElement) {
    return []
  }

  return getDirectChildren(
    optionsElement,
    'option'
  ).map((option) => ({
    id: option.getAttribute('id'),
    content: normalizeContent(
      getDirectChild(option, 'content'),
      assetContext
    ),
  }))
}

/*
 * Read the source's correct option references.
 *
 * The references are only used to find the actual
 * correct option content.
 */
function getCorrectOptionIds(response) {
  const answer = getDirectChild(
    response,
    'answer'
  )

  if (!answer) {
    return []
  }

  return getDirectChildren(
    answer,
    'correctOptionRef'
  ).map((element) =>
    normalizeText(element.textContent)
  )
}

/*
 * MCQ / MSQ / Assertion-Reason identity
 *
 * IMPORTANT:
 *
 * Identity uses:
 *
 *     correct option CONTENT
 *
 * Identity does NOT use:
 *
 *     option ID
 *     option label
 *     option position
 *     distractor content
 *
 * Therefore:
 *
 * A/B/C/D -> B/C/D/A
 *
 * does not change identity.
 *
 * Changing a wrong option also does not change
 * identity.
 *
 * Changing the correct answer does change identity.
 */
function normalizeCorrectOptions(response, assetContext = null) {
  const options = getOptions(response, assetContext)

  const optionMap = new Map(
    options.map((option) => [
      option.id,
      option.content,
    ])
  )

  return getCorrectOptionIds(response)
    .map((id) => optionMap.get(id) || '')
    .filter(Boolean)
    .sort()
    .map(
      (content) => `CORRECT:${content}`
    )
    .join('|')
}

/*
 * Numeric answer identity.
 *
 * Supports:
 *
 *     <value>
 *
 * and:
 *
 *     <range>
 *       <min>
 *       <max>
 *     </range>
 *
 * with optional:
 *
 *     <tolerance>
 *
 * Only information explicitly present in the
 * source is included.
 */
function normalizeNumericAnswer(response) {
  const answer = getDirectChild(
    response,
    'answer'
  )

  if (!answer) {
    return 'NUMERIC'
  }

  const value = getDirectChild(
    answer,
    'value'
  )

  const range = getDirectChild(
    answer,
    'range'
  )

  const tolerance = getDirectChild(
    answer,
    'tolerance'
  )

  if (range) {
    return [
      'RANGE',

      `MIN:${normalizeNumber(
        getText(range, 'min')
      )}`,

      `MAX:${normalizeNumber(
        getText(range, 'max')
      )}`,

      tolerance
        ? `TOLERANCE:${normalizeNumber(
            tolerance.textContent
          )}`
        : '',
    ]
      .filter(Boolean)
      .join('|')
  }

  return [
    'VALUE',

    value
      ? `VALUE:${normalizeNumber(
          value.textContent
        )}`
      : '',

    tolerance
      ? `TOLERANCE:${normalizeNumber(
          tolerance.textContent
        )}`
      : '',
  ]
    .filter(Boolean)
    .join('|')
}

/*
 * MATCH / MATCH_MULTIPLE identity.
 *
 * Identity is based on the actual normalized
 * left-content -> right-content mapping.
 *
 * Item IDs and item order are ignored.
 */
function normalizeMatchAnswer(response, assetContext = null) {
  const leftItems = getDirectChild(
    response,
    'leftItems'
  )

  const rightItems = getDirectChild(
    response,
    'rightItems'
  )

  const answer = getDirectChild(
    response,
    'answer'
  )

  if (
    !leftItems ||
    !rightItems ||
    !answer
  ) {
    return 'MATCH'
  }

  const leftMap = new Map(
    getDirectChildren(
      leftItems,
      'item'
    ).map((item) => [
      item.getAttribute('id'),
      normalizeContent(
        getDirectChild(
          item,
          'content'
        ),
        assetContext
      ),
    ])
  )

  const rightMap = new Map(
    getDirectChildren(
      rightItems,
      'item'
    ).map((item) => [
      item.getAttribute('id'),
      normalizeContent(
        getDirectChild(
          item,
          'content'
        ),
        assetContext
      ),
    ])
  )

  const mapping = getDirectChild(
    answer,
    'mapping'
  )

  if (!mapping) {
    return 'MATCH'
  }

  const pairs = getDirectChildren(
    mapping,
    'pair'
  )
    .map((pair) => ({
      left:
        leftMap.get(
          pair.getAttribute('left')
        ) || '',

      right:
        rightMap.get(
          pair.getAttribute('right')
        ) || '',
    }))
    .sort((a, b) => {
      const leftCompare =
        a.left.localeCompare(b.left)

      if (leftCompare !== 0) {
        return leftCompare
      }

      return a.right.localeCompare(
        b.right
      )
    })

  return pairs
    .map(
      (pair) =>
        `PAIR:${pair.left}=>${pair.right}`
    )
    .join('|')
}

/*
 * Normalize one question.
 *
 * QUESTION IDENTITY:
 *
 *     question type
 *     +
 *     normalized question content
 *     +
 *     normalized correct answer
 *
 * Explicitly excluded from identity:
 *
 *     question ID
 *     question number
 *     section
 *     category
 *     QP name
 *     year
 *     paper number
 *     marking scheme
 *     option IDs
 *     option labels
 *     option order
 *     distractors
 */
function normalizeQuestion(question, assetContext = null) {
  const type = getText(
    question,
    'type'
  )

  const content = normalizeContent(
    getDirectChild(
      question,
      'content'
    ),
    assetContext
  )

  const response = getDirectChild(
    question,
    'response'
  )

  const parts = [
    `TYPE:${type}`,
    `CONTENT:${content}`,
  ]

  /*
   * Choice-based questions.
   *
   * Only the correct option content is included.
   */
  if (
    type === 'MCQ' ||
    type === 'MSQ' ||
    type === 'ASSERTION_REASON'
  ) {
    parts.push(
      `CORRECT_OPTIONS:${normalizeCorrectOptions(
        response,
        assetContext
      )}`
    )
  }

  /*
   * Numeric-answer questions.
   */
  if (
    type === 'NAT' &&
    response
  ) {
    parts.push(
      normalizeNumericAnswer(
        response
      )
    )
  }

  /*
   * Matching questions.
   */
  if (
    type === 'MATCH' ||
    type === 'MATCH_MULTIPLE'
  ) {
    parts.push(
      normalizeMatchAnswer(
        response,
        assetContext
      )
    )
  }

  return parts.join('###')
}

/*
 * Normalize an entire question paper.
 *
 * Question order is deliberately ignored.
 *
 * Therefore:
 *
 * Q1 Q2 Q3 Q4
 *
 * and
 *
 * Q4 Q2 Q1 Q3
 *
 * produce the same normalized paper identity
 * when the underlying questions are identical.
 */
export function normalizePaper(
  questions = [],
  assetContext = null
) {
  return questions
    .map((question) => normalizeQuestion(question, assetContext))
    .sort()
}

export {
  normalizeQuestion,
  normalizeContent,
}