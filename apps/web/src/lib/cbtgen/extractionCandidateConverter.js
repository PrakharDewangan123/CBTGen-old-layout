const RESPONSE_MODE_BY_TYPE = Object.freeze({
  MCQ: 'single-choice',
  MSQ: 'multiple-select',
})

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function requiredText(value, description) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${description} is required.`)
  return value.trim()
}

function numericQuestionNumber(value, index) {
  const number = String(value ?? '').trim()
  if (!/^\d+$/.test(number) || Number(number) < 1) {
    throw new Error(`Question candidate ${index + 1} must have a positive numeric printed number.`)
  }
  return number
}

function stableId(value, description) {
  const id = requiredText(value, description)
  if (!/^[A-Za-z_][A-Za-z0-9._-]*$/.test(id)) {
    throw new Error(`${description} must be a stable XML-safe identifier.`)
  }
  return id
}

function requiredImageRef(value, description) {
  return stableId(value, `${description} imageAssetRef`)
}

/**
 * Converts human-reviewed image-crop candidates into canonical CBTGen XML.
 * OCR/textCandidate values are deliberately never emitted as question or
 * option content. Asset binaries must be supplied separately to the package
 * builder. This function does not save papers or infer answer keys.
 */
export function convertReviewedCandidatesToCbtgenXml({
  reviewedQuestions,
  reviewStatus,
  examName = 'Imported Question Paper',
  sectionName = 'General',
  assets = [],
} = {}) {
  if (reviewStatus !== 'human-reviewed') throw new Error('Candidates must complete human review before conversion.')
  if (!Array.isArray(reviewedQuestions) || reviewedQuestions.length === 0) {
    throw new Error('At least one reviewed question candidate is required.')
  }
  if (!Array.isArray(assets)) throw new Error('A reviewed image asset manifest is required.')

  const safeExamName = requiredText(examName, 'Exam name')
  const safeSectionName = requiredText(sectionName, 'Section name')
  const seenNumbers = new Set()
  const seenQuestionIds = new Set()
  const seenOptionIds = new Set()
  const assetById = new Map()

  for (const asset of assets) {
    const id = stableId(asset?.id, 'Asset id')
    if (assetById.has(id)) throw new Error(`Duplicate asset id "${id}".`)
    const src = requiredText(asset?.src || asset?.packagePath, `Asset "${id}" package path`)
    if (!src.startsWith('assets/') || src.split('/').some(part => part === '..' || part === '.' || !part)) {
      throw new Error(`Asset "${id}" must use a safe package path under assets/.`)
    }
    const mimeType = requiredText(asset?.mimeType, `Asset "${id}" mimeType`)
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/i.test(mimeType)) {
      throw new Error(`Asset "${id}" must declare a supported image mimeType.`)
    }
    assetById.set(id, { id, src, mimeType, scope: asset.scope || '' })
  }

  function assertImageAsset(ref, scope, description) {
    const asset = assetById.get(ref)
    if (!asset) throw new Error(`${description} references missing image asset "${ref}".`)
    if (asset.scope && asset.scope !== scope) {
      throw new Error(`${description} image asset "${ref}" must have scope "${scope}".`)
    }
  }

  const referencedAssetIds = new Set()
  const questionImageIds = new Set()
  const questionsXml = reviewedQuestions.map((question, index) => {
    if (!question || typeof question !== 'object') throw new Error(`Question candidate ${index + 1} is invalid.`)
    const type = String(question.type ?? question.questionType ?? '').trim().toUpperCase()
    const responseMode = RESPONSE_MODE_BY_TYPE[type]
    if (!responseMode) throw new Error(`Question candidate ${index + 1} requires an explicit MCQ or MSQ type.`)

    const originalNumber = numericQuestionNumber(question.printedNumber, index)
    if (seenNumbers.has(originalNumber)) throw new Error(`Duplicate printed question number "${originalNumber}".`)
    seenNumbers.add(originalNumber)
    if (question.reviewed !== true) {
      throw new Error(`Question ${originalNumber} must be explicitly reviewed against the source.`)
    }

    const questionId = stableId(question.questionId || question.id, `Question ${originalNumber} stable questionId`)
    if (seenQuestionIds.has(questionId)) throw new Error(`Duplicate stable question id "${questionId}".`)
    seenQuestionIds.add(questionId)
    const questionImageRef = requiredImageRef(question.imageAssetRef, `Question ${originalNumber}`)
    assertImageAsset(questionImageRef, 'question-visual', `Question ${originalNumber}`)
    referencedAssetIds.add(questionImageRef)
    questionImageIds.add(questionImageRef)

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`Question ${originalNumber} requires at least two options.`)
    }
    const seenLabels = new Set()
    const optionsXml = question.options.map((option, optionIndex) => {
      if (!option || typeof option !== 'object') {
        throw new Error(`Question ${originalNumber}, option ${optionIndex + 1} is invalid.`)
      }
      const label = requiredText(option.printedLabel, `Question ${originalNumber}, option ${optionIndex + 1} label`)
      if (seenLabels.has(label)) throw new Error(`Question ${originalNumber} contains duplicate option label "${label}".`)
      seenLabels.add(label)
      if (option.reviewed !== true) {
        throw new Error(`Question ${originalNumber}, option ${label} must be explicitly reviewed against the source.`)
      }
      const optionId = stableId(option.optionId || option.id, `Question ${originalNumber}, option ${label} stable optionId`)
      if (seenOptionIds.has(optionId)) throw new Error(`Duplicate stable option id "${optionId}".`)
      seenOptionIds.add(optionId)
      const optionImageRef = requiredImageRef(option.imageAssetRef, `Question ${originalNumber}, option ${label}`)
      assertImageAsset(optionImageRef, 'option-visual', `Question ${originalNumber}, option ${label}`)
      referencedAssetIds.add(optionImageRef)
      return [
        `          <option id="${escapeXml(optionId)}" label="${escapeXml(label)}">`,
        '            <content>',
        `              <image assetRef="${escapeXml(optionImageRef)}" mimeType="${escapeXml(assetById.get(optionImageRef).mimeType)}" scope="option-visual"/>`,
        '            </content>',
        '          </option>',
      ].join('\n')
    }).join('\n')

    return [
      `    <question id="${escapeXml(questionId)}">`,
      `      <originalNumber>${originalNumber}</originalNumber>`,
      '      <sectionRef>section-1</sectionRef>',
      `      <type>${type}</type>`,
      '      <content>',
      `        <assetRef>${escapeXml(questionImageRef)}</assetRef>`,
      '      </content>',
      '      <response>',
      `        <mode>${responseMode}</mode>`,
      '        <options>',
      optionsXml,
      '        </options>',
      '        <answer/>',
      '      </response>',
      '    </question>',
    ].join('\n')
  }).join('\n')

  const manifestXml = [...referencedAssetIds].sort().map(id => {
    const asset = assetById.get(id)
    const scope = asset.scope || (questionImageIds.has(id) ? 'question-visual' : 'option-visual')
    return `    <asset id="${escapeXml(asset.id)}" type="image" src="${escapeXml(asset.src)}" mimeType="${escapeXml(asset.mimeType)}" scope="${escapeXml(scope)}"/>`
  }).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<cbtgen version="1.0">',
    '  <exam>',
    `    <name>${escapeXml(safeExamName)}</name>`,
    `    <totalQuestions>${reviewedQuestions.length}</totalQuestions>`,
    '  </exam>',
    '  <sections>',
    '    <section id="section-1">',
    `      <name>${escapeXml(safeSectionName)}</name>`,
    `      <questionCount>${reviewedQuestions.length}</questionCount>`,
    '    </section>',
    '  </sections>',
    '  <questions>',
    questionsXml,
    '  </questions>',
    '  <assets>',
    manifestXml,
    '  </assets>',
    '</cbtgen>',
    '',
  ].join('\n')
}
