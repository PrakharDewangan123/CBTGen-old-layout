import { parseSectionMarkingComment } from './sourceMarkingParser'
import {
  getPaperForQuestionPaper,
  getSourcePaper,
  listPapers,
} from '../../../lib/cbtgen/paperStorage'

const QUESTION_TYPES = [
  'MCQ',
  'MSQ',
  'NAT',
  'MATCH',
  'MATCH_MULTIPLE',
  'MATRIX_SINGLE',
  'MATRIX_MULTI',
  'MATRIX_TEXT',
  'ORDERING',
  'RANKING',
  'TRUE_FALSE',
  'YES_NO',
  'DROPDOWN',
  'TEXT_SHORT',
  'TEXT_LONG',
  'FILL_BLANK',
  'ESSAY',
  'SUBJECTIVE',
  'IMAGE_CHOICE',
  'IMAGE_MULTI_CHOICE',
  'HOTSPOT',
  'HOTSPOT_MULTI',
  'DRAG_DROP',
  'ANNOTATION',
  'CODE_OUTPUT',
  'CODE_TRACE',
  'CODE_COMPLETION',
  'CODE_EDITOR',
  'EQUATION_INPUT',
  'GRAPH_RESPONSE',
]

function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  const match = String(value ?? '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

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

function typeLabel(type) {
  const labels = {
    MCQ: 'Multiple Choice Question (MCQ)',
    MSQ: 'Multiple Select Question (MSQ)',
    NAT: 'Numerical Answer Type (NAT)',
    MATCH: 'Match the Following',
    MATCH_MULTIPLE: 'Match the Following',
    MATRIX_SINGLE: 'Matrix Match (Single)',
    MATRIX_MULTI: 'Matrix Match (Multiple)',
    MATRIX_TEXT: 'Matrix Text',
    ORDERING: 'Ordering',
    RANKING: 'Ranking',
    TRUE_FALSE: 'True / False',
    YES_NO: 'Yes / No',
    DROPDOWN: 'Dropdown',
    TEXT_SHORT: 'Short Text',
    TEXT_LONG: 'Long Text',
    SUBJECTIVE: 'Subjective',
    FILL_BLANK: 'Fill in the Blank',
    ESSAY: 'Essay',
    IMAGE_CHOICE: 'Image Choice',
    IMAGE_MULTI_CHOICE: 'Image Multi Choice',
    HOTSPOT: 'Hotspot',
    HOTSPOT_MULTI: 'Hotspot Multi',
    DRAG_DROP: 'Drag & Drop',
    ANNOTATION: 'Annotation',
    CODE_OUTPUT: 'Code Output',
    CODE_TRACE: 'Code Trace',
    CODE_COMPLETION: 'Code Completion',
    CODE_EDITOR: 'Code Editor',
    EQUATION_INPUT: 'Equation Input',
    GRAPH_RESPONSE: 'Graph Response',
  }

  return labels[type] || type || 'Question'
}

function normalizeTypeRow(row) {
  return {
    type: row?.type || 'QUESTION',
    ...(row?.locks ? { locks: { ...row.locks } } : {}),
    count: Number(row?.count || 0),
    correct:
      row?.correct === '' || row?.correct == null
        ? ''
        : Number(row.correct),
    wrong:
      row?.wrong === '' || row?.wrong == null
        ? ''
        : Number(row.wrong),
    partial:
      row?.partial === '' || row?.partial == null
        ? ''
        : Number(row.partial),
    partialRules: row?.partialRules || '',
  }
}

function buildTypesFromQuestions(questions) {
  const groups = []

  questions.forEach((question) => {
    const marking = question?.marking || {}
    const row = {
      type: question?.type || 'QUESTION',
      count: 1,
      correct:
        marking.correct == null || marking.correct === ''
          ? ''
          : Number(marking.correct),
      wrong:
        marking.incorrect == null || marking.incorrect === ''
          ? ''
          : Number(marking.incorrect),
      partial:
        marking.partial == null || marking.partial === ''
          ? ''
          : Number(marking.partial),
      partialRules: marking.partialRules || marking.partialMarking || '',
      locks: {
        type: Boolean(question?.type),
        count: true,
        correct: marking.correct != null && marking.correct !== '',
        wrong: marking.incorrect != null && marking.incorrect !== '',
        // Partial marking is source-defined when present; when absent, the
        // absence itself means no partial marking and must also be immutable.
        partial: true,
        partialRules: true,
      },
    }

    const existing = groups.find(
      (item) =>
        item.type === row.type &&
        Number(item.correct || 0) === Number(row.correct || 0) &&
        Number(item.wrong || 0) === Number(row.wrong || 0) &&
        Number(item.partial || 0) === Number(row.partial || 0) &&
        String(item.partialRules || '') === String(row.partialRules || ''),
    )

    if (existing) {
      existing.count += 1
      Object.keys(row.locks || {}).forEach((key) => { existing.locks[key] = Boolean(existing.locks[key] || row.locks[key]) })
    } else {
      groups.push(row)
    }
  })

  return groups
}

function sectionQuestions(localPaper, sectionId) {
  const questions = Array.isArray(localPaper?.questions)
    ? localPaper.questions
    : []

  return questions.filter(
    (question) =>
      String(question?.sectionRef || '') === String(sectionId || ''),
  )
}

function buildSections(localPaper, fallbackCount = 1) {
  const questions = Array.isArray(localPaper?.questions)
    ? localPaper.questions
    : []

  const sourceSections = Array.isArray(localPaper?.sections)
    ? localPaper.sections
    : []

  if (sourceSections.length > 0) {
    return sourceSections.map((section, index) => {
      const rows = sectionQuestions(localPaper, section.id)
      return {
        id: section.id || `section-${index + 1}`,
        name: section.name || `Section ${String.fromCharCode(65 + index)}`,
        subjectId: section.subjectRef || section.subjectId || null,
        subjectName: section.subjectName || section.subject || '',
        declaredQuestionCount: firstNumber(section.questionCount),
        declaredMarks: firstNumber(section.totalMarks),
        types: buildTypesFromQuestions(rows),
      }
    })
  }

  const groups = new Map()
  questions.forEach((question) => {
    const id = question?.sectionRef || '__default__'
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(question)
  })

  if (groups.size > 0) {
    return [...groups.entries()].map(([id, rows], index) => ({
      id,
      name: id === '__default__' ? `Section ${String.fromCharCode(65 + index)}` : String(id),
      subjectId: rows[0]?.subjectRef || rows[0]?.subjectId || null,
      subjectName: rows[0]?.subjectName || rows[0]?.subject || '',
      declaredQuestionCount: rows.length,
      declaredMarks: 0,
      types: buildTypesFromQuestions(rows),
    }))
  }

  return Array.from({ length: Math.max(1, Number(fallbackCount || 1)) }, (_, index) => ({
    id: `section-${index + 1}`,
    name: `Section ${String.fromCharCode(65 + index)}`,
    subjectId: null,
    subjectName: '',
    declaredQuestionCount: 0,
    declaredMarks: 0,
    types: [],
  }))
}

function buildSubjects(qp, paper, sections) {
  const explicitSubjects = Array.isArray(paper?.subjects)
    ? paper.subjects.filter((item) => item?.name)
    : []

  if (explicitSubjects.length > 0) {
    return explicitSubjects.map((subject, index) => ({
      id: subject.id || `subject-${index + 1}`,
      name: subject.name,
      sections: sections
        .filter(
          (section) =>
            String(section.subjectId || '') === String(subject.id || '') ||
            String(section.subjectName || '').trim() === String(subject.name).trim(),
        )
        .map((section) => section.id),
    }))
  }

  const subjectGroups = new Map()
  sections.forEach((section) => {
    const name = String(section.subjectName || '').trim()
    const id = section.subjectId || (name ? `subject-${name}` : null)
    if (!id && !name) return

    const key = String(id || name)
    if (!subjectGroups.has(key)) {
      subjectGroups.set(key, {
        id: String(id || key),
        name: name || String(id),
        sections: [],
      })
    }
    subjectGroups.get(key).sections.push(section.id)
  })

  if (subjectGroups.size > 0) {
    return [...subjectGroups.values()]
  }

  // The current CBTGen XML format does not require a subject field.
  // The QP metadata category is the only subject-like metadata available in
  // that case, so it is used as an editable fallback rather than invented.
  return [
    {
      id: 'subject-1',
      name: qp?.category || '',
      sections: sections.map((section) => section.id),
    },
  ]
}

function textOf(node, selector) {
  return node?.querySelector(selector)?.textContent?.trim() || ''
}

function numberOf(node, selector) {
  const value = textOf(node, selector)
  if (value === '') return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function deriveSubjectFromSectionName(sectionName) {
  const name = String(sectionName || '').trim()
  if (!name) return ''

  const match = name.match(/^(.*?)\s*[—-]\s*Section\s+\d+\s*$/i)
  if (match?.[1]?.trim()) return match[1].trim()

  return name
}

function partialMarksDisplay(partialRules) {
  const text = String(partialRules || '')
  if (!text.trim()) return ''

  const values = [...text.matchAll(/\+(\d+(?:\.\d+)?)/g)]
    .map((match) => match[1])
    .filter((value, index, array) => array.indexOf(value) === index)

  return values.length ? values.map((value) => `+${value}`).join(' / ') : ''
}

function getCommentText(node) {
  if (!node) return ''

  return Array.from(node.childNodes || [])
    .filter((child) => child.nodeType === 8)
    .map((child) => child.nodeValue || '')
    .join(' ')
    .trim()
}

function buildTypesFromXmlQuestions(questionNodes, fallbackMarking = null) {
  const groups = []

  questionNodes.forEach((question) => {
    const type = textOf(question, 'type') || 'QUESTION'
    const markingNode = question.querySelector('marking')
    const correctText =
      textOf(markingNode, 'correct') ||
      textOf(question, 'marking > correct')
    const wrongText =
      textOf(markingNode, 'incorrect') ||
      textOf(question, 'marking > incorrect')
    const partialText =
      textOf(markingNode, 'partial') ||
      textOf(question, 'marking > partial')
    const partialRuleText =
      textOf(question, 'partialMarking > rule') ||
      textOf(question, 'partialMarking > scheme') ||
      textOf(markingNode, 'partialMarking > rule') ||
      textOf(markingNode, 'partialMarking > scheme') ||
      textOf(markingNode, 'partialMarking') ||
      textOf(question, 'marking > partialMarking')

    const sourceMarking = fallbackMarking || {}
    const row = {
      type,
      count: 1,
      correct: correctText === ''
        ? (sourceMarking.correct ?? '')
        : Number(correctText),
      wrong: wrongText === ''
        ? (sourceMarking.wrong ?? '')
        : Number(wrongText),
      partial: partialText === ''
        ? (sourceMarking.partial ?? '')
        : Number(partialText),
      partialRules: partialRuleText || sourceMarking.partialRules || '',
      locks: {
        type: Boolean(type),
        count: true,
        correct: correctText !== '' || sourceMarking.correct != null,
        wrong: wrongText !== '' || sourceMarking.wrong != null,
        // Lock both the value and its absence. A source paper that does not
        // declare partial marking must not let users add it in configuration.
        partial: true,
        partialRules: true,
      },
    }

    const existing = groups.find(
      (item) =>
        item.type === row.type &&
        String(item.correct) === String(row.correct) &&
        String(item.wrong) === String(row.wrong) &&
        String(item.partial) === String(row.partial) &&
        String(item.partialRules || '') === String(row.partialRules || ''),
    )

    if (existing) {
      existing.count += 1
    } else {
      groups.push(row)
    }
  })

  return groups
}

function parseXmlConfiguration(xmlText) {
  if (typeof xmlText !== 'string' || !xmlText.trim()) return null

  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')
  if (xml.querySelector('parsererror')) return null

  const examNode = xml.querySelector('exam')
  const sectionNodes = Array.from(xml.querySelectorAll('sections > section'))
  const questionNodes = Array.from(xml.querySelectorAll('questions > question'))

  if (!examNode || sectionNodes.length === 0) return null

  const allQuestionsBySection = new Map()
  questionNodes.forEach((question) => {
    const sectionRef = textOf(question, 'sectionRef')
    if (!allQuestionsBySection.has(sectionRef)) {
      allQuestionsBySection.set(sectionRef, [])
    }
    allQuestionsBySection.get(sectionRef).push(question)
  })

  const sections = sectionNodes.map((sectionNode, index) => {
    const id = sectionNode.getAttribute('id') || `section-${index + 1}`
    const name = textOf(sectionNode, 'name') || `Section ${String.fromCharCode(65 + index)}`
    const rows = allQuestionsBySection.get(id) || []
    const sourceMarkingComment = getCommentText(sectionNode)
    const sourceMarking = parseSectionMarkingComment(sourceMarkingComment)
    const explicitSubject =
      textOf(sectionNode, 'subject') ||
      sectionNode.getAttribute('subject') ||
      sectionNode.getAttribute('subjectName') ||
      ''
    const subjectName = explicitSubject || deriveSubjectFromSectionName(name)

    return {
      id,
      name,
      subjectId: subjectName ? `subject-${subjectName}` : null,
      subjectName,
      declaredQuestionCount: numberOf(sectionNode, 'questionCount') || rows.length,
      declaredMarks: numberOf(sectionNode, 'totalMarks'),
      sourceMarking,
      types: buildTypesFromXmlQuestions(rows, sourceMarking),
      locks: {
        name: Boolean(textOf(sectionNode, 'name')),
        subjectName: Boolean(explicitSubject || deriveSubjectFromSectionName(name)),
        questionCount: Boolean(numberOf(sectionNode, 'questionCount') || rows.length),
        declaredMarks: Boolean(numberOf(sectionNode, 'totalMarks')),
      },
    }
  })

  const subjectMap = new Map()
  sections.forEach((section) => {
    const key = section.subjectId || `subject-${section.id}`
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        id: key,
        name: section.subjectName || '',
        sections: [],
        locks: { name: Boolean(section.locks?.subjectName) },
      })
    }
    subjectMap.get(key).sections.push(section.id)
    subjectMap.get(key).locks.name = subjectMap.get(key).locks.name || Boolean(section.locks?.subjectName)
  })

  return {
    version: xml.documentElement?.getAttribute('version') || '',
    exam: {
      name: textOf(examNode, 'name'),
      qpId: textOf(examNode, 'qpId'),
      year: numberOf(examNode, 'year'),
      paperNumber: textOf(examNode, 'paperNumber'),
      durationMinutes: numberOf(examNode, 'duration'),
      totalQuestions: numberOf(examNode, 'totalQuestions') || questionNodes.length,
      totalMarks: numberOf(examNode, 'totalMarks'),
    },
    sections,
    subjects: Array.from(subjectMap.values()),
    totals: {
      questions: questionNodes.length,
      marks: numberOf(examNode, 'totalMarks'),
    },
    questionCount: questionNodes.length,
  }
}

function findLocalPaperByMetadata(records, qp) {
  const candidates = (Array.isArray(records) ? records : []).filter((record) => {
    const exam = record?.paper?.exam || {}
    const sameName =
      qp?.name &&
      exam?.name &&
      String(qp.name).trim() === String(exam.name).trim()
    if (!sameName) return false

    const sameYear =
      qp?.year == null ||
      qp.year === '' ||
      exam.year == null ||
      String(qp.year) === String(exam.year)

    const samePaperNumber =
      qp?.paperNumber == null ||
      qp.paperNumber === '' ||
      exam.paperNumber == null ||
      String(qp.paperNumber) === String(exam.paperNumber)

    return sameYear && samePaperNumber
  })

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  // Older development data can contain multiple local copies with the same
  // visible exam metadata. Do not fail just because the library has stale
  // duplicates. The exact fingerprint lookup has already been attempted;
  // this is only a recovery path, so prefer the newest saved local copy.
  return [...candidates].sort((a, b) => {
    const aTime = Date.parse(a?.savedAt || '') || 0
    const bTime = Date.parse(b?.savedAt || '') || 0
    return bTime - aTime
  })[0]
}

function getInitialAdditionalInstructions(paper) {
  const instructions = paper?.instructions
  if (!instructions) return ''

  if (typeof instructions === 'string') return instructions

  const values = [
    instructions.general,
    instructions.additional,
    instructions.paperSpecific,
  ].filter((value) => typeof value === 'string' && value.trim())

  return values.join('\n\n')
}

function flattenSections(subjects, sections) {
  return sections.map((section) => {
    const subject = subjects.find((item) => item.sections.includes(section.id))
    return {
      ...section,
      subjectId: subject?.id || section.subjectId || null,
      subjectName: subject?.name || section.subjectName || '',
    }
  })
}


export async function loadTestConfiguration(qp) {
  let localRecord = null
  let sourceOnlyRecord = null

  if (qp?.sourceId) {
    sourceOnlyRecord = await getSourcePaper(qp.sourceId, qp.userId)
    if (sourceOnlyRecord) localRecord = sourceOnlyRecord
  }

  if (!localRecord) {
    localRecord = await getPaperForQuestionPaper(qp)
  }

  if (!localRecord) {
    const localRecords = await listPapers(qp?.userId)
    localRecord = findLocalPaperByMetadata(localRecords, qp)
  }

  const paper = localRecord?.paper || null
  const xmlConfig = parseXmlConfiguration(localRecord?.xmlText)
  const sections = xmlConfig?.sections?.length
    ? xmlConfig.sections
    : buildSections(paper, qp.sections)
  const subjects = xmlConfig?.subjects?.length
    ? xmlConfig.subjects
    : buildSubjects(qp, paper, sections)
  const flattenedSections = flattenSections(subjects, sections)
  const exam = xmlConfig?.exam || paper?.exam || {}

  return {
    config: {
      testName: exam.name || qp.name || 'Untitled Test',
      subject: subjects[0]?.name || qp.category || '',
      subjects,
      paperCode:
        exam.qpId ||
        qp.qpId ||
        exam.paperNumber ||
        qp.paperNumber ||
        '',
      year: firstNumber(exam.year, qp.year),
      paperNumber: exam.paperNumber || qp.paperNumber || '',
      formatVersion: xmlConfig?.version || paper?.version || '',
      duration:
        exam.durationMinutes > 0
          ? parseDuration(exam.durationMinutes)
          : parseDuration(qp.duration) || '',
      totalQuestions: firstNumber(
        exam.totalQuestions,
        xmlConfig?.totals?.questions,
        paper?.totals?.questions,
        qp.questions,
      ),
      maxMarks: firstNumber(
        exam.totalMarks,
        xmlConfig?.totals?.marks,
        paper?.totals?.marks,
        qp.marks,
      ),
      additional: getInitialAdditionalInstructions(paper),
      sections: flattenedSections,
      fieldLocks: {
        testName: Boolean(xmlConfig?.exam?.name),
        paperCode: Boolean(xmlConfig?.exam?.qpId || xmlConfig?.exam?.paperNumber),
        year: Boolean(xmlConfig?.exam?.year > 0),
        paperNumber: Boolean(xmlConfig?.exam?.paperNumber),
        duration: Boolean(xmlConfig?.exam?.durationMinutes > 0),
        totalQuestions: Boolean(xmlConfig?.exam?.totalQuestions > 0 || (xmlConfig?.totals?.questions > 0)),
        maxMarks: Boolean(xmlConfig?.exam?.totalMarks > 0 || (xmlConfig?.totals?.marks > 0)),
      },
      source: {
        fingerprint: qp.fingerprint || null,
        sourceFileName: localRecord?.sourceFileName || '',
        localPaperLoaded: Boolean(paper || xmlConfig || sourceOnlyRecord),
        sourceOnly: Boolean(sourceOnlyRecord),
        xmlConfigurationLoaded: Boolean(xmlConfig),
      },
    },
    localPaperAvailable: Boolean(paper || xmlConfig || sourceOnlyRecord),
  }
}

export { QUESTION_TYPES, normalizeTypeRow, typeLabel, partialMarksDisplay }
