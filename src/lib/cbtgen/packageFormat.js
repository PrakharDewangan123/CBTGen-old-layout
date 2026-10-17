const PACKAGE_XML_NAME = 'paper.xml'
const PACKAGE_ASSET_PREFIX = 'assets/'

const SUPPORTED_EXTENSIONS = new Set(['.xml', '.zip', '.cbtgen'])

function extensionOf(name = '') {
  const lower = String(name).toLowerCase()
  const index = lower.lastIndexOf('.')
  return index >= 0 ? lower.slice(index) : ''
}

export function detectCbtgenFormat(fileName = '') {
  const extension = extensionOf(fileName)
  if (extension === '.cbtgen') return 'CBTGEN_PACKAGE'
  if (extension === '.zip') return 'ZIP_PACKAGE'
  if (extension === '.xml') return 'XML'
  return 'UNSUPPORTED'
}

export function isSupportedCbtgenFile(fileName = '') {
  return SUPPORTED_EXTENSIONS.has(extensionOf(fileName))
}

function safePackagePath(path) {
  const normalized = String(path || '').replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new Error(`Unsafe package path "${path}".`)
  }

  const parts = normalized.split('/')
  if (parts.some((part) => part === '..')) {
    throw new Error(`Unsafe package path "${path}".`)
  }

  return normalized
}

function readUint16(view, offset) {
  return view.getUint16(offset, true)
}

function readUint32(view, offset) {
  return view.getUint32(offset, true)
}

function findEndOfCentralDirectory(bytes) {
  const minimum = 22
  const maximumComment = 0xffff
  const start = Math.max(0, bytes.length - minimum - maximumComment)

  for (let offset = bytes.length - minimum; offset >= start; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset
    }
  }

  return -1
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support ZIP deflate decompression.')
  }

  const stream = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream('deflate-raw')
  )

  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unzipEntries(buffer) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(bytes)

  if (eocd < 0) {
    throw new Error('The selected package is not a valid ZIP archive.')
  }

  const entryCount = readUint16(view, eocd + 10)
  const centralDirectorySize = readUint32(view, eocd + 12)
  const centralDirectoryOffset = readUint32(view, eocd + 16)

  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error('ZIP64 packages are not supported by CBTGen yet.')
  }

  const decoder = new TextDecoder()
  const entries = new Map()
  let offset = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, offset) !== 0x02014b50) {
      throw new Error('The ZIP central directory is invalid.')
    }

    const flags = readUint16(view, offset + 8)
    const compression = readUint16(view, offset + 10)
    const compressedSize = readUint32(view, offset + 20)
    const uncompressedSize = readUint32(view, offset + 24)
    const nameLength = readUint16(view, offset + 28)
    const extraLength = readUint16(view, offset + 30)
    const commentLength = readUint16(view, offset + 32)
    const localHeaderOffset = readUint32(view, offset + 42)

    if (flags & 0x0001) {
      throw new Error('Encrypted ZIP entries are not supported by CBTGen.')
    }

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new Error('ZIP64 entries are not supported by CBTGen yet.')
    }

    const nameStart = offset + 46
    const rawName = decoder.decode(bytes.slice(nameStart, nameStart + nameLength))
    const name = safePackagePath(rawName)

    const localOffset = localHeaderOffset
    if (readUint32(view, localOffset) !== 0x04034b50) {
      throw new Error(`ZIP local header for "${name}" is invalid.`)
    }

    const localNameLength = readUint16(view, localOffset + 26)
    const localExtraLength = readUint16(view, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize)

    let data
    if (compression === 0) {
      data = new Uint8Array(compressedData)
    } else if (compression === 8) {
      data = await inflateRaw(compressedData)
    } else {
      throw new Error(`ZIP compression method ${compression} is not supported.`)
    }

    if (uncompressedSize !== 0 && data.byteLength !== uncompressedSize) {
      throw new Error(`ZIP entry "${name}" has an invalid uncompressed size.`)
    }

    entries.set(name, data)
    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  const normalized = String(value || '').replace(/\s+/g, '')
  if (!normalized) return new Uint8Array()

  try {
    if (typeof atob === 'function') {
      const binary = atob(normalized)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return bytes
    }

  } catch {
    throw new Error('Embedded Base64 image data is invalid.')
  }

  throw new Error('This environment cannot decode Base64 image data.')
}

function mimeFromPath(path = '') {
  const extension = extensionOf(path)
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  }
  return map[extension] || 'application/octet-stream'
}

function isImageMime(mime = '') {
  return String(mime).toLowerCase().startsWith('image/')
}

function getDirectChild(parent, tagName) {
  return Array.from(parent?.children || []).find((child) => child.tagName === tagName) || null
}

function getDirectChildren(parent, tagName) {
  return Array.from(parent?.children || []).filter((child) => child.tagName === tagName)
}

function collectInlineAssets(xml) {
  const result = []
  const seen = new Set()

  for (const image of Array.from(xml.querySelectorAll('image[encoding="base64"]'))) {
    const id = image.getAttribute('id') || ''
    const mime = image.getAttribute('mimeType') || ''
    const dataNode = getDirectChild(image, 'data')
    const encoded = dataNode?.textContent?.trim() || image.textContent?.trim() || ''

    if (!id) {
      throw new Error('A Base64 <image> asset definition must have an id. Use assetRef only on later references.')
    }

    if (image.getAttribute('assetRef')) {
      throw new Error(`Base64 image asset "${id}" cannot use assetRef; use id for the single embedded definition.`)
    }

    if (seen.has(id)) {
      throw new Error(`Duplicate embedded asset id "${id}".`)
    }

    if (!isImageMime(mime)) {
      throw new Error(`Embedded Base64 asset "${id}" must declare an image mimeType.`)
    }

    const bytes = base64ToBytes(encoded)
    if (!bytes.length) {
      throw new Error(`Embedded Base64 asset "${id}" is empty.`)
    }

    seen.add(id)
    result.push({
      id,
      type: 'image',
      mime,
      blob: new Blob([bytes], { type: mime }),
      size: bytes.byteLength,
      source: 'embedded',
      scope: image.getAttribute('scope') || '',
    })
  }

  return result
}

function collectPackageAssets(xml, entries) {
  const assetsElement = getDirectChild(xml.documentElement, 'assets')
  if (!assetsElement) return []

  const result = []
  const seen = new Set()

  for (const asset of getDirectChildren(assetsElement, 'asset')) {
    const id = asset.getAttribute('id') || ''
    const src = asset.getAttribute('src') || ''
    const mime = asset.getAttribute('mimeType') || mimeFromPath(src)

    if (!id) continue
    if (seen.has(id)) throw new Error(`Duplicate package asset id "${id}".`)
    seen.add(id)

    const encoding = (asset.getAttribute('encoding') || '').toLowerCase()
    if (encoding === 'base64') {
      throw new Error(`Package asset "${id}" must use an internal src file; Base64 belongs in standalone <image> definitions.`)
    }

    if (!src) {
      throw new Error(`Package asset "${id}" is missing its internal src.`)
    }

    const safeSrc = safePackagePath(src)
    if (!safeSrc.startsWith(PACKAGE_ASSET_PREFIX)) {
      throw new Error(`Package asset "${id}" must be stored under assets/.`)
    }

    const bytes = entries.get(safeSrc)
    if (!bytes) {
      throw new Error(`Package asset "${id}" is missing from the package: ${safeSrc}`)
    }

    result.push({
      id,
      type: asset.getAttribute('type') || (isImageMime(mime) ? 'image' : 'binary'),
      mime,
      blob: new Blob([bytes], { type: mime }),
      size: bytes.byteLength,
      source: 'package',
      packagePath: safeSrc,
      scope: asset.getAttribute('scope') || '',
    })
  }

  return result
}

function inferPackageAssetScope(xml, assetId) {
  const escaped = String(assetId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reference = xml.querySelector(`[assetRef="${escaped}"]`)
  if (!reference) return ''
  return reference.closest('option') ? 'option-visual' : 'question-visual'
}

function canonicalizeLegacyResponseModes(xml) {
  for (const question of Array.from(xml.querySelectorAll('question'))) {
    const type = question.querySelector(':scope > type')?.textContent?.trim() || ''
    const response = question.querySelector(':scope > response')
    const mode = response?.querySelector(':scope > mode')
    if (!mode) continue

    const current = mode.textContent.trim()
    if (type === 'MSQ' && current === 'multiple-choice') {
      mode.textContent = 'multiple-select'
    } else if (type === 'IMAGE_MULTI_CHOICE' && current === 'multiple-choice') {
      mode.textContent = 'multiple-select'
    }
  }
}

function repairPackageAssetManifest(xml, entries) {
  const referencedIds = Array.from(xml.querySelectorAll('[assetRef]'))
    .map((node) => node.getAttribute('assetRef')?.trim() || '')
    .filter(Boolean)

  if (!referencedIds.length) return

  let manifest = getDirectChild(xml.documentElement, 'assets')
  if (!manifest) {
    manifest = xml.createElement('assets')
    xml.documentElement.appendChild(manifest)
  }

  const declaredIds = new Set(
    getDirectChildren(manifest, 'asset')
      .map((asset) => asset.getAttribute('id')?.trim() || '')
      .filter(Boolean)
  )

  for (const assetId of new Set(referencedIds)) {
    if (declaredIds.has(assetId)) continue

    const candidates = Array.from(entries.keys()).filter((path) => {
      if (!path.startsWith(PACKAGE_ASSET_PREFIX)) return false
      const base = path.slice(PACKAGE_ASSET_PREFIX.length).split('/').pop() || ''
      const dot = base.lastIndexOf('.')
      const stem = dot > 0 ? base.slice(0, dot) : base
      return stem === assetId
    })

    if (candidates.length === 0) {
      throw new Error(`XML references missing asset "${assetId}".`)
    }
    if (candidates.length > 1) {
      throw new Error(`Asset "${assetId}" has multiple package files; the manifest cannot be repaired unambiguously.`)
    }

    const src = safePackagePath(candidates[0])
    const declaration = xml.createElement('asset')
    declaration.setAttribute('id', assetId)
    declaration.setAttribute('type', 'image')
    declaration.setAttribute('mimeType', mimeFromPath(src))
    declaration.setAttribute('scope', inferPackageAssetScope(xml, assetId))
    declaration.setAttribute('src', src)
    manifest.appendChild(declaration)
    declaredIds.add(assetId)
  }
}

function canonicalizeImportedPackageXml(xml, entries) {
  canonicalizeLegacyResponseModes(xml)
  repairPackageAssetManifest(xml, entries)
  return xml
}

function serializeXml(xml) {
  return new XMLSerializer().serializeToString(xml)
}

function validateNoExternalImageSources(xml, packageMode) {
  for (const image of Array.from(xml.querySelectorAll('image'))) {
    const encoding = (image.getAttribute('encoding') || '').toLowerCase()
    const assetRef = image.getAttribute('assetRef') || ''
    const src = image.getAttribute('src') || ''

    if (encoding === 'base64') continue

    if (src) {
      if (!packageMode) {
        throw new Error(`External image source "${src}" is not supported. Use Base64 XML or a .cbtgen/.zip package.`)
      }

      throw new Error(`Image "${assetRef || image.getAttribute('id') || '(unknown)'}" must use assetRef; external image src is not allowed.`)
    }
  }
}

function validateAssetReferences(xml, assets) {
  const assetIds = new Set(assets.map((asset) => asset.id))

  for (const ref of Array.from(xml.querySelectorAll('[assetRef]'))) {
    const value = ref.getAttribute('assetRef')?.trim()
    if (!value) continue
    if (!assetIds.has(value)) {
      throw new Error(`XML references missing asset "${value}".`)
    }
  }
}

export async function readCbtgenFile(file) {
  const format = detectCbtgenFormat(file?.name || '')
  if (format === 'UNSUPPORTED') {
    throw new Error('Unsupported CBTGen file. Use standalone .xml with embedded Base64 assets, or a .zip/.cbtgen package containing paper.xml and assets/.')
  }

  if (format === 'XML' || format === 'XML_BASE64') {
    const xmlText = await file.text()
    if (!xmlText.trim()) throw new Error('The selected XML file is empty.')

    const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
    if (xml.querySelector('parsererror')) throw new Error('The XML file is not well-formed.')
    validateNoExternalImageSources(xml, false)

    const manifestAssets = Array.from(xml.querySelectorAll(':scope > assets > asset'))
    if (manifestAssets.length) {
      throw new Error('Standalone XML files (.xml) cannot use package-style <assets><asset> definitions. Embed each unique image as <image id="..." encoding="base64" mimeType="...">.')
    }

    const assets = collectInlineAssets(xml)
    validateAssetReferences(xml, assets)

    return { format, xml, xmlText, assets, packageEntries: new Map() }
  }

  const buffer = await file.arrayBuffer()
  const entries = await unzipEntries(buffer)
  const xmlBytes = entries.get(PACKAGE_XML_NAME)
  if (!xmlBytes) {
    throw new Error('CBTGen package must contain a root-level paper.xml file.')
  }

  const xmlText = new TextDecoder().decode(xmlBytes)
  if (!xmlText.trim()) throw new Error('The package paper.xml file is empty.')

  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('The package paper.xml is not well-formed.')

  validateNoExternalImageSources(xml, true)
  canonicalizeImportedPackageXml(xml, entries)

  const packageAssets = collectPackageAssets(xml, entries)
  const inlineAssets = collectInlineAssets(xml)
  const ids = new Set(packageAssets.map((asset) => asset.id))
  for (const asset of inlineAssets) {
    if (ids.has(asset.id)) throw new Error(`Asset id "${asset.id}" is defined both in the package and inline.`)
    ids.add(asset.id)
  }

  const assets = [...packageAssets, ...inlineAssets]
  validateAssetReferences(xml, assets)

  return {
    format,
    xml,
    xmlText: serializeXml(xml),
    assets,
    packageEntries: entries,
  }
}

export function createAssetContext(assets = []) {
  const byId = new Map()
  for (const asset of assets) {
    if (!asset?.id) continue
    byId.set(asset.id, asset)
  }
  return { assets: byId }
}

export function assetToHashInput(asset) {
  if (!asset) return ''
  return `${asset.id}|${asset.mime || ''}|${asset.size || 0}`
}

export function assetPreviewUrl(asset) {
  if (!asset?.blob) return ''
  return URL.createObjectURL(asset.blob)
}

export { bytesToBase64 }
