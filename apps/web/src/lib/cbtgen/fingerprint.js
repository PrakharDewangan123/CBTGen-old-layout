import {
  normalizeQuestion,
  normalizePaper,
} from './questionNormalizer.js'

async function sha256(value) {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Bytes(bytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getAssetBytes(asset) {
  if (!asset) return null
  if (asset.bytes instanceof Uint8Array) return asset.bytes
  if (asset.blob?.arrayBuffer) return new Uint8Array(await asset.blob.arrayBuffer())
  if (asset.data instanceof Uint8Array) return asset.data
  return null
}

export async function buildAssetFingerprintContext(assets = []) {
  const assetDigests = new Map()

  for (const asset of assets) {
    if (!asset?.id) continue
    const bytes = await getAssetBytes(asset)
    if (!bytes) continue
    assetDigests.set(asset.id, await sha256Bytes(bytes))
  }

  return { assetDigests }
}

function getQuestions(xml) {
  const root = xml.documentElement
  const questionsContainer = Array.from(root.children).find(
    (child) => child.tagName === 'questions'
  )

  if (!questionsContainer) return []

  return Array.from(questionsContainer.children).filter(
    (child) => child.tagName === 'question'
  )
}

export async function fingerprintQuestion(question, assetsOrContext = null) {
  const assetContext = Array.isArray(assetsOrContext)
    ? await buildAssetFingerprintContext(assetsOrContext)
    : assetsOrContext
  const normalized = normalizeQuestion(question, assetContext)
  const fingerprint = await sha256(normalized)
  return { fingerprint, normalized }
}

export async function fingerprintPaper(xml, assets = []) {
  const questions = getQuestions(xml)
  const assetContext = assets?.assetDigests
    ? assets
    : await buildAssetFingerprintContext(assets)

  const questionResults = []

  for (const question of questions) {
    const result = await fingerprintQuestion(question, assetContext)
    questionResults.push({
      id: question.getAttribute('id'),
      originalNumber:
        question.querySelector(':scope > originalNumber')?.textContent?.trim() || null,
      type:
        question.querySelector(':scope > type')?.textContent?.trim() || null,
      fingerprint: result.fingerprint,
      normalized: result.normalized,
    })
  }

  const normalizedQuestions = normalizePaper(questions, assetContext)
  const paperCanonical = normalizedQuestions.join('\n---QUESTION---\n')
  const paperFingerprint = await sha256(paperCanonical)

  return {
    paperFingerprint,
    questionCount: questions.length,
    questions: questionResults,
    assetDigests: Object.fromEntries(assetContext.assetDigests || new Map()),
  }
}
