/**
 * CBTGen Phase 27D — Regression-Safe Best-Version Comparator
 *
 * Conservative XML-level gate: candidate structural/source-fidelity regressions
 * cannot replace the previously approved/best version. Pixel-level visual
 * quality remains a rendered-source review responsibility.
 */

function directChildren(parent, tagName) {
  if (!parent) return []
  return Array.from(parent.children || []).filter((child) => child.tagName === tagName)
}

function directChild(parent, tagName) {
  return directChildren(parent, tagName)[0] || null
}

function text(parent, tagName) {
  return (directChild(parent, tagName)?.textContent || '').trim()
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function getQuestions(document) {
  const container = directChild(document?.documentElement, 'questions')
  return directChildren(container, 'question')
}

function getOptions(question) {
  const response = directChild(question, 'response')
  return directChildren(directChild(response, 'options'), 'option')
}

function getAnswerRefs(question) {
  const response = directChild(question, 'response')
  return directChildren(directChild(response, 'answer'), 'correctOptionRef')
    .map((ref) => normalizeText(ref.textContent))
}

function getAssetRefs(question) {
  return Array.from(question.querySelectorAll?.('[assetRef]') || [])
    .map((node) => normalizeText(node.getAttribute('assetRef')))
    .filter(Boolean)
}

function scriptSet(value) {
  const source = String(value || '')
  const scripts = new Set()
  if (/[A-Za-z]/.test(source)) scripts.add('latin')
  if (/[\u0900-\u097F]/.test(source)) scripts.add('devanagari')
  if (/[\u4E00-\u9FFF]/.test(source)) scripts.add('han')
  if (/[\u3040-\u30FF]/.test(source)) scripts.add('japanese')
  if (/[\uAC00-\uD7AF]/.test(source)) scripts.add('korean')
  if (/[\u0600-\u06FF]/.test(source)) scripts.add('arabic')
  return Array.from(scripts).sort()
}

function questionFingerprint(question) {
  const content = directChild(question, 'content')
  const options = getOptions(question).map((option) => ({
    id: option.getAttribute('id') || '',
    label: text(option, 'label'),
    text: normalizeText(option.textContent || ''),
  }))
  const questionText = normalizeText(content?.textContent || '')

  return {
    id: question.getAttribute('id') || '',
    originalNumber: text(question, 'originalNumber'),
    type: text(question, 'type').toUpperCase(),
    sectionRef: text(question, 'sectionRef'),
    content: questionText,
    options,
    answerRefs: getAnswerRefs(question),
    assetRefs: getAssetRefs(question),
    scripts: scriptSet(`${questionText} ${options.map((item) => item.text).join(' ')}`),
  }
}

function makeQuestionMap(document) {
  const map = new Map()
  for (const question of getQuestions(document)) {
    const fingerprint = questionFingerprint(question)
    if (fingerprint.originalNumber) map.set(fingerprint.originalNumber, fingerprint)
  }
  return map
}

function addRegression(result, code, message) {
  result.regressions.push({ severity: 'error', code, message })
}

function addImprovement(result, code, message) {
  result.improvements.push({ code, message })
}

function compareOptions(base, candidate, result, number) {
  if (candidate.length < base.length) {
    addRegression(result, 'OPTION_LOSS', `Question ${number} lost ${base.length - candidate.length} option(s).`)
  }

  const count = Math.min(base.length, candidate.length)
  for (let index = 0; index < count; index += 1) {
    const baseLabel = base[index].label || base[index].id
    const candidateLabel = candidate[index].label || candidate[index].id
    if (baseLabel && candidateLabel && baseLabel !== candidateLabel) {
      addRegression(result, 'OPTION_ORDER_CHANGED', `Question ${number} changed option order at position ${index + 1} (${baseLabel} → ${candidateLabel}).`)
    }
    if (base[index].text && candidate[index].text && base[index].text !== candidate[index].text) {
      addRegression(result, 'OPTION_CONTENT_CHANGED', `Question ${number} changed option content at position ${index + 1}.`)
    }
  }
}

function checkAnswerCardinality(question, result) {
  if (!['MCQ', 'ASSERTION_REASON'].includes(question.type)) return
  if (question.answerRefs.length === 0) return
  if (question.answerRefs.length !== 1) {
    addRegression(result, 'MCQ_ANSWER_CARDINALITY', `Question ${question.originalNumber} of type ${question.type} contains ${question.answerRefs.length} correctOptionRef values; exactly one is required.`)
  }
}

function checkDuplicateContent(questions, result) {
  const seen = new Map()
  for (const question of questions) {
    if (!question.content) continue
    const key = `${question.type}|${question.content}`
    const previous = seen.get(key)
    if (previous) {
      addRegression(result, 'DUPLICATE_QUESTION_CONTENT', `Questions ${previous.originalNumber} and ${question.originalNumber} have identical normalized question content.`)
    } else {
      seen.set(key, question)
    }
  }
}

function compareScripts(base, candidate, result) {
  for (const script of base.scripts) {
    if (script !== 'latin' && !candidate.scripts.includes(script)) {
      addRegression(result, 'MULTILINGUAL_CONTENT_LOSS', `Question ${base.originalNumber} lost ${script} source content.`)
    }
  }
}

export function compareCbtgenRegression(baselineDocument, candidateDocument) {
  const result = {
    candidateAccepted: true,
    regressions: [],
    improvements: [],
    summary: { baselineQuestions: 0, candidateQuestions: 0, matchedQuestions: 0 },
  }

  const baselineQuestions = getQuestions(baselineDocument).map(questionFingerprint)
  const candidateQuestions = getQuestions(candidateDocument).map(questionFingerprint)
  result.summary.baselineQuestions = baselineQuestions.length
  result.summary.candidateQuestions = candidateQuestions.length

  if (candidateQuestions.length < baselineQuestions.length) {
    addRegression(result, 'QUESTION_LOSS', `Candidate contains ${candidateQuestions.length} questions; baseline contains ${baselineQuestions.length}.`)
  } else if (candidateQuestions.length > baselineQuestions.length) {
    addImprovement(result, 'QUESTION_COUNT_INCREASED', `Candidate contains ${candidateQuestions.length} questions; baseline contains ${baselineQuestions.length}. Verify additions against the source.`)
  }

  const baselineByNumber = makeQuestionMap(baselineDocument)
  const candidateByNumber = makeQuestionMap(candidateDocument)

  for (const [number, base] of baselineByNumber.entries()) {
    const candidate = candidateByNumber.get(number)
    if (!candidate) {
      addRegression(result, 'QUESTION_MISSING', `Candidate is missing source question ${number}.`)
      continue
    }

    result.summary.matchedQuestions += 1

    if (candidate.type !== base.type) {
      addRegression(result, 'QUESTION_TYPE_CHANGED', `Question ${number} changed type (${base.type} → ${candidate.type}).`)
    }
    if (candidate.sectionRef !== base.sectionRef) {
      addRegression(result, 'QUESTION_SECTION_CHANGED', `Question ${number} changed section (${base.sectionRef} → ${candidate.sectionRef}).`)
    }
    if (!candidate.content) {
      addRegression(result, 'QUESTION_CONTENT_LOST', `Question ${number} has no candidate content.`)
    } else if (base.content && candidate.content.length < base.content.length * 0.65) {
      addRegression(result, 'QUESTION_CONTENT_TRUNCATED', `Question ${number} candidate content is substantially shorter than the baseline.`)
    }

    compareOptions(base.options, candidate.options, result, number)
    compareScripts(base, candidate, result)

    if (base.answerRefs.length > 0 && candidate.answerRefs.length === 0) {
      addRegression(result, 'ANSWER_DATA_LOST', `Question ${number} lost existing answer-key data.`)
    }
    if (base.answerRefs.length > 0 && candidate.answerRefs.length > 0 && base.answerRefs.join('|') !== candidate.answerRefs.join('|')) {
      addRegression(result, 'ANSWER_MAPPING_CHANGED', `Question ${number} changed its authoritative answer mapping.`)
    }
  }

  checkDuplicateContent(candidateQuestions, result)
  for (const question of candidateQuestions) checkAnswerCardinality(question, result)

  result.candidateAccepted = result.regressions.length === 0
  return result
}

export function selectBestCbtgenVersion({ baselineDocument, candidateDocument }) {
  const comparison = compareCbtgenRegression(baselineDocument, candidateDocument)
  return {
    ...comparison,
    selected: comparison.candidateAccepted ? 'candidate' : 'baseline',
    document: comparison.candidateAccepted ? candidateDocument : baselineDocument,
  }
}
