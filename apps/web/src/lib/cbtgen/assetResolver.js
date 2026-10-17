function cloneContentWithAssetUrls(content, urlMap) {
  if (!content) return content

  const next = { ...content }

  const resolveImages = (images = []) => images.map((image) => ({
    ...image,
    assetUrl: urlMap.get(image.assetRef) || image.assetUrl || '',
  }))

  next.images = resolveImages(content.images)
  next.blocks = Array.isArray(content.blocks)
    ? content.blocks.map((block) => (
        block.type === 'image'
          ? { ...block, assetUrl: urlMap.get(block.assetRef) || block.assetUrl || '' }
          : block
      ))
    : content.blocks

  return next
}

function cloneQuestion(question, urlMap) {
  const next = { ...question }
  next.content = cloneContentWithAssetUrls(question.content, urlMap)

  if (question.response) {
    next.response = { ...question.response }
    if (Array.isArray(question.response.options)) {
      next.response.options = question.response.options.map((option) => ({
        ...option,
        content: cloneContentWithAssetUrls(option.content, urlMap),
      }))
    }

    if (question.response.match) {
      next.response.match = {
        ...question.response.match,
        leftItems: (question.response.match.leftItems || []).map((item) => ({
          ...item,
          content: cloneContentWithAssetUrls(item.content, urlMap),
        })),
        rightItems: (question.response.match.rightItems || []).map((item) => ({
          ...item,
          content: cloneContentWithAssetUrls(item.content, urlMap),
        })),
      }
    }
  }

  return next
}

export function resolvePaperAssetUrls(paper, assets = []) {
  if (!paper || !Array.isArray(assets) || assets.length === 0) {
    return { paper, objectUrls: [] }
  }

  const urlMap = new Map()
  const objectUrls = []

  for (const asset of assets) {
    if (!asset?.id || !asset?.blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') continue
    const url = URL.createObjectURL(asset.blob)
    urlMap.set(asset.id, url)
    objectUrls.push(url)
  }

  if (!urlMap.size) return { paper, objectUrls }

  return {
    paper: {
      ...paper,
      questions: (paper.questions || []).map((question) => cloneQuestion(question, urlMap)),
    },
    objectUrls,
  }
}

export function revokePaperAssetUrls(objectUrls = []) {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
  for (const url of objectUrls) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Best-effort cleanup only.
    }
  }
}
