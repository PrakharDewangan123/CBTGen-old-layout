import {
  getQuestionType,
  isSupportedQuestionType,
} from './questionTypes'

function getDirectChild(
  parent,
  tagName
) {
  if (!parent) {
    return null
  }

  return (
    Array.from(
      parent.children
    ).find(
      (child) =>
        child.tagName === tagName
    ) || null
  )
}

function getDirectChildren(
  parent,
  tagName
) {
  if (!parent) {
    return []
  }

  return Array.from(
    parent.children
  ).filter(
    (child) =>
      child.tagName === tagName
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

function getNumber(
  parent,
  tagName,
  fallback = null
) {
  const value =
    getText(
      parent,
      tagName
    )

  if (value === '') {
    return fallback
  }

  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : fallback
}

/* ─────────────────────────────────────────────
   CONTENT
───────────────────────────────────────────── */

function parseContent(
  contentElement
) {
  const content = {
    text: '',
    math: [],
    code: [],
    images: [],
    tables: [],
    media: [],
    raw: [],
    assertion: null,
    reason: null,
    blocks: [],
  }

  if (!contentElement) {
    return content
  }

  for (const child of contentElement.children) {
    switch (child.tagName) {
      case 'text': {
        const value = child.textContent || ''
        content.text += value
        content.blocks.push({ type: 'text', value })
        break
      }

      case 'assertion': {
        const value = child.textContent || ''
        content.assertion = { text: value }
        content.blocks.push({ type: 'assertion', value })
        break
      }

      case 'reason': {
        const value = child.textContent || ''
        content.reason = { text: value }
        content.blocks.push({ type: 'reason', value })
        break
      }

      case 'math': {
        const value = child.textContent || ''
        const item = {
          format: child.getAttribute('format') || 'latex',
          display: child.getAttribute('display') || 'block',
          value,
        }
        content.math.push(item)
        content.blocks.push({ type: 'math', ...item })
        break
      }

      case 'code': {
        const value = child.textContent || ''
        const item = {
          language: child.getAttribute('language') || '',
          value,
        }
        content.code.push(item)
        content.blocks.push({ type: 'code', ...item })
        break
      }

      case 'image': {
        const item = {
          assetRef:
            child.getAttribute('assetRef') ||
            child.getAttribute('id') ||
            child.textContent?.trim() ||
            '',
          alt: child.getAttribute('alt') || '',
        }
        content.images.push(item)
        content.blocks.push({ type: 'image', ...item })
        break
      }

      case 'assetRef': {
        const item = {
          assetRef:
            child.getAttribute('assetRef') ||
            child.textContent?.trim() ||
            '',
          alt: child.getAttribute('alt') || '',
        }
        content.images.push(item)
        content.blocks.push({ type: 'image', ...item })
        break
      }

      case 'table': {
        const item = parseTable(child)
        content.tables.push(item)
        content.blocks.push({ type: 'table', ...item })
        break
      }

      case 'audio': {
        const item = {
          type: 'audio',
          assetRef:
            child.getAttribute('assetRef') ||
            child.textContent?.trim() ||
            '',
        }
        content.media.push(item)
        content.blocks.push({ type: 'media', ...item })
        break
      }

      case 'video': {
        const item = {
          type: 'video',
          assetRef:
            child.getAttribute('assetRef') ||
            child.textContent?.trim() ||
            '',
        }
        content.media.push(item)
        content.blocks.push({ type: 'media', ...item })
        break
      }

      default:
        content.raw.push({
          type: child.tagName,
          text: child.textContent || '',
        })
        content.blocks.push({
          type: 'raw',
          tagName: child.tagName,
          value: child.textContent || '',
        })
        break
    }
  }

  content.text = content.text.trim()
  return content
}

/* ─────────────────────────────────────────────
   TABLE
───────────────────────────────────────────── */

function parseTable(
  tableElement
) {
  return {
    headers:
      getDirectChildren(
        tableElement,
        'header'
      ).map(
        (header) =>
          header.textContent.trim()
      ),

    rows:
      getDirectChildren(
        tableElement,
        'row'
      ).map(
        (row) =>
          getDirectChildren(
            row,
            'cell'
          ).map(
            (cell) =>
              cell.textContent.trim()
          )
      ),
  }
}

/* ─────────────────────────────────────────────
   OPTIONS
───────────────────────────────────────────── */

function parseOptions(
  responseElement
) {
  const optionsElement =
    getDirectChild(
      responseElement,
      'options'
    )

  if (!optionsElement) {
    return []
  }

  return getDirectChildren(
    optionsElement,
    'option'
  ).map(
    (option) => ({
      id:
        option.getAttribute(
          'id'
        ) || '',

      sourceLabel:
        option.getAttribute(
          'label'
        ) || null,

      content:
        parseContent(
          getDirectChild(
            option,
            'content'
          )
        ),
    })
  )
}

/* ─────────────────────────────────────────────
   ANSWER
───────────────────────────────────────────── */

function parseAnswer(
  responseElement
) {
  const answer =
    getDirectChild(
      responseElement,
      'answer'
    )

  if (!answer) {
    return {
      correctOptionIds: [],
      value: null,
      range: null,
      tolerance: null,
      mappings: [],
    }
  }

  const correctOptionIds =
    getDirectChildren(
      answer,
      'correctOptionRef'
    ).map(
      (element) =>
        element.textContent.trim()
    )

  const valueElement =
    getDirectChild(
      answer,
      'value'
    )

  const toleranceElement =
    getDirectChild(
      answer,
      'tolerance'
    )

  const rangeElement =
    getDirectChild(
      answer,
      'range'
    )

  const range =
    rangeElement
      ? {
          min:
            getNumber(
              rangeElement,
              'min'
            ),

          max:
            getNumber(
              rangeElement,
              'max'
            ),
        }
      : null

  const mappingsElement =
    getDirectChild(
      answer,
      'mapping'
    )

  const mappings =
    mappingsElement
      ? getDirectChildren(
          mappingsElement,
          'pair'
        ).map(
          (pair) => ({
            left:
              pair.getAttribute(
                'left'
              ) || '',

            right:
              pair.getAttribute(
                'right'
              ) || '',
          })
        )
      : []

  let tolerance = null

  if (toleranceElement) {
    const parsed =
      Number(
        toleranceElement.textContent
      )

    tolerance =
      Number.isFinite(parsed)
        ? parsed
        : null
  }

  return {
    correctOptionIds,

    value:
      valueElement?.textContent?.trim() ||
      null,

    range,

    tolerance,

    mappings,
  }
}

/* ─────────────────────────────────────────────
   MATCH
───────────────────────────────────────────── */

function parseMatch(
  responseElement
) {
  if (!responseElement) {
    return null
  }

  const leftContainer =
    getDirectChild(
      responseElement,
      'leftItems'
    )

  const rightContainer =
    getDirectChild(
      responseElement,
      'rightItems'
    )

  const leftItems =
    getDirectChildren(
      leftContainer,
      'item'
    ).map(
      (item) => ({
        id:
          item.getAttribute(
            'id'
          ) || '',

        content:
          parseContent(
            getDirectChild(
              item,
              'content'
            )
          ),
      })
    )

  const rightItems =
    getDirectChildren(
      rightContainer,
      'item'
    ).map(
      (item) => ({
        id:
          item.getAttribute(
            'id'
          ) || '',

        content:
          parseContent(
            getDirectChild(
              item,
              'content'
            )
          ),
      })
    )

  return {
    leftItems,
    rightItems,
  }
}

/* ─────────────────────────────────────────────
   MARKING
───────────────────────────────────────────── */

function parseMarking(
  questionElement
) {
  const marking =
    getDirectChild(
      questionElement,
      'marking'
    )

  if (!marking) {
    return {
      correct: null,
      incorrect: null,
      unattempted: null,
      partial: null,
      partialMarking: null,
    }
  }

  // CBTGen XML v1.0 places <partialMarking> as a sibling of
  // <marking>, not inside <marking>. Keep both forms supported
  // for backward compatibility.
  const partialMarking =
    getDirectChild(
      questionElement,
      'partialMarking'
    ) ||
    getDirectChild(
      marking,
      'partialMarking'
    )

  let partial = null

  if (getText(
    marking,
    'partial'
  ) !== '') {
    partial =
      getNumber(
        marking,
        'partial'
      )
  }

  return {
    correct:
      getNumber(
        marking,
        'correct'
      ),

    incorrect:
      getNumber(
        marking,
        'incorrect'
      ),

    unattempted:
      getNumber(
        marking,
        'unattempted'
      ),

    partial,

    partialMarking:
      partialMarking
        ? {
            enabled:
              getText(
                partialMarking,
                'enabled'
              ) || 'unknown',

            formula:
              getText(
                partialMarking,
                'formula'
              ) || null,

            scheme:
              getText(
                partialMarking,
                'scheme'
              ) || null,
          }
        : null,

    // Flat alias used by the examination/scoring layers.
    partialRules:
      partialMarking
        ? getText(
            partialMarking,
            'scheme'
          ) ||
          getText(
            partialMarking,
            'formula'
          ) ||
          null
        : null,
  }
}

/* ─────────────────────────────────────────────
   QUESTION
───────────────────────────────────────────── */

export function parseQuestion(
  questionElement
) {
  const type =
    getText(
      questionElement,
      'type'
    ).toUpperCase()

  if (!isSupportedQuestionType(type)) {
    throw new Error(
      `Unsupported CBTGen question type: ${type}`
    )
  }

  const definition =
    getQuestionType(type)

  const response =
    getDirectChild(
      questionElement,
      'response'
    )

  const isMatch =
    type === 'MATCH' ||
    type === 'MATCH_MULTIPLE'

  return {
    sourceQuestionId:
      questionElement.getAttribute(
        'id'
      ) || '',

    originalNumber:
      getNumber(
        questionElement,
        'originalNumber'
      ),

    sessionNumber:
      null,

    sectionRef:
      getText(
        questionElement,
        'sectionRef'
      ),

    subjectRef:
      getText(
        questionElement,
        'subjectRef'
      ) ||
      questionElement.getAttribute('subjectRef') ||
      '',

    subjectName:
      getText(
        questionElement,
        'subject'
      ) ||
      questionElement.getAttribute('subject') ||
      '',

    type,

    family:
      definition.family,

    responseMode:
      getText(
        response,
        'mode'
      ) ||
      definition.responseMode,

    content:
      parseContent(
        getDirectChild(
          questionElement,
          'content'
        )
      ),

    response: {
      options:
        parseOptions(
          response
        ),

      match:
        isMatch
          ? parseMatch(
              response
            )
          : null,

      rawMode:
        getText(
          response,
          'mode'
        ),
    },

    answer:
      parseAnswer(
        response
      ),

    marking:
      parseMarking(
        questionElement
      ),
  }
}

/* ─────────────────────────────────────────────
   SECTIONS
───────────────────────────────────────────── */

function parseSections(
  xml
) {
  const sections =
    getDirectChild(
      xml.documentElement,
      'sections'
    )

  if (!sections) {
    return []
  }

  return getDirectChildren(
    sections,
    'section'
  ).map(
    (section) => ({
      id:
        section.getAttribute(
          'id'
        ) || '',

      name:
        getText(
          section,
          'name'
        ),

      subjectRef:
        getText(
          section,
          'subjectRef'
        ) ||
        section.getAttribute('subjectRef') ||
        '',

      subjectName:
        getText(
          section,
          'subject'
        ) ||
        section.getAttribute('subject') ||
        '',

      questionCount:
        getNumber(
          section,
          'questionCount'
        ),

      totalMarks:
        getNumber(
          section,
          'totalMarks'
        ),
    })
  )
}

/* ─────────────────────────────────────────────
   EXAM
───────────────────────────────────────────── */

function parseExam(
  xml
) {
  const exam =
    getDirectChild(
      xml.documentElement,
      'exam'
    )

  if (!exam) {
    return {
      name: '',
      year: null,
      paperNumber: '',
      durationMinutes: null,
      totalQuestions: null,
      totalMarks: null,
      qpId: '',
    }
  }

  return {
    name:
      getText(
        exam,
        'name'
      ),

    year:
      getNumber(
        exam,
        'year'
      ),

    paperNumber:
      getText(
        exam,
        'paperNumber'
      ),

    durationMinutes:
      getNumber(
        exam,
        'duration'
      ),

    totalQuestions:
      getNumber(
        exam,
        'totalQuestions'
      ),

    totalMarks:
      getNumber(
        exam,
        'totalMarks'
      ),

    /*
     * Descriptive/source metadata only.
     *
     * This is NOT the authoritative QP identity.
     */
    qpId:
      getText(
        exam,
        'qpId'
      ),
  }
}

/* ─────────────────────────────────────────────
   ASSETS
───────────────────────────────────────────── */

function parseAssets(
  xml
) {
  const assets =
    getDirectChild(
      xml.documentElement,
      'assets'
    )

  if (!assets) {
    return []
  }

  return getDirectChildren(
    assets,
    'asset'
  ).map(
    (asset) => ({
      id:
        asset.getAttribute(
          'id'
        ) || '',

      type:
        asset.getAttribute(
          'type'
        ) || '',

      src:
        asset.getAttribute(
          'src'
        ) || '',

      mime:
        asset.getAttribute(
          'mimeType'
        ) || '',
    })
  )
}

/* ─────────────────────────────────────────────
   OPTIONAL SUBJECTS / INSTRUCTIONS
───────────────────────────────────────────── */

function parseSubjects(xml) {
  const container = getDirectChild(xml.documentElement, 'subjects')

  if (!container) {
    return []
  }

  return getDirectChildren(container, 'subject').map((subject) => ({
    id:
      subject.getAttribute('id') ||
      getText(subject, 'id') ||
      '',

    name:
      getText(subject, 'name') ||
      subject.getAttribute('name') ||
      '',
  })).filter((subject) => subject.name)
}

function parseInstructions(xml) {
  const root = xml.documentElement
  const result = {
    general: '',
    additional: '',
    paperSpecific: '',
  }

  const directText = (tagNames) => {
    for (const tagName of tagNames) {
      const element = getDirectChild(root, tagName)
      if (element?.textContent?.trim()) {
        return element.textContent.trim()
      }
    }
    return ''
  }

  result.general = directText(['generalInstructions', 'instructions'])
  result.additional = directText(['additionalInstructions', 'additional'])
  result.paperSpecific = directText(['paperSpecificInstructions', 'paperInstructions'])

  const container = getDirectChild(root, 'instructions')
  if (container) {
    result.general = getText(container, 'general') || getText(container, 'generalInstructions') || result.general
    result.additional = getText(container, 'additional') || getText(container, 'additionalInstructions') || result.additional
    result.paperSpecific = getText(container, 'paperSpecific') || getText(container, 'paperSpecificInstructions') || result.paperSpecific
  }

  return result
}

/* ─────────────────────────────────────────────
   PAPER
───────────────────────────────────────────── */

export function parsePaper(
  xml
) {
  if (
    !xml ||
    !xml.documentElement
  ) {
    throw new Error(
      'A valid CBTGen XML document is required.'
    )
  }

  const root =
    xml.documentElement

  if (
    root.tagName !==
    'cbtgen'
  ) {
    throw new Error(
      'The XML root element must be <cbtgen>.'
    )
  }

  const questionsContainer =
    getDirectChild(
      root,
      'questions'
    )

  const questionElements =
    getDirectChildren(
      questionsContainer,
      'question'
    )

  const questions =
    questionElements.map(
      parseQuestion
    )

  const exam =
    parseExam(xml)

  const sections =
    parseSections(xml)

  const assets =
    parseAssets(xml)

  const subjects =
    parseSubjects(xml)

  const instructions =
    parseInstructions(xml)

  return {
    version:
      root.getAttribute(
        'version'
      ) || '1.0',

    exam,

    sections,

    subjects,

    questions,

    instructions,

    assets,

    /*
     * Useful normalized totals.
     * These are derived from the XML and
     * do not replace the authoritative
     * fingerprint.
     */
    totals: {
      questions:
        questions.length,

      sections:
        sections.length,

      marks:
        exam.totalMarks,

      durationMinutes:
        exam.durationMinutes,
    },
  }
}

/* ─────────────────────────────────────────────
   LOOKUPS
───────────────────────────────────────────── */

export function getSection(
  paper,
  sectionId
) {
  if (!paper) {
    return null
  }

  return (
    paper.sections?.find(
      (section) =>
        section.id ===
        sectionId
    ) || null
  )
}

export function getQuestion(
  paper,
  sourceQuestionId
) {
  if (!paper) {
    return null
  }

  return (
    paper.questions?.find(
      (question) =>
        question.sourceQuestionId ===
        sourceQuestionId
    ) || null
  )
}