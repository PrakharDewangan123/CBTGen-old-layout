const encoder = new TextEncoder()
const PACKAGE_XML_NAME = 'paper.xml'

function safePath(value) {
  const path = String(value || '').replaceAll('\\', '/')
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe CBTGen package path: ${value}`)
  }
  return path
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  throw new Error('Package assets must provide Blob, ArrayBuffer, or Uint8Array content.')
}

async function assetBytes(asset) {
  if (asset?.blob instanceof Blob) return new Uint8Array(await asset.blob.arrayBuffer())
  if (asset?.bytes != null) return bytesOf(asset.bytes)
  if (asset?.data instanceof ArrayBuffer || ArrayBuffer.isView(asset?.data)) return bytesOf(asset.data)
  throw new Error(`Asset "${asset?.id || '(unknown)'}" has no binary content.`)
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function u16(view, offset, value) { view.setUint16(offset, value, true) }
function u32(view, offset, value) { view.setUint32(offset, value >>> 0, true) }

function makeZip(entries) {
  const localParts = []
  const centralParts = []
  let localOffset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const data = entry.bytes
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0x0800)
    u16(lv, 8, 0); u16(lv, 10, 0); u16(lv, 12, 0)
    u32(lv, 14, crc); u32(lv, 18, data.length); u32(lv, 22, data.length)
    u16(lv, 26, name.length); u16(lv, 28, 0); local.set(name, 30)
    localParts.push(local, data)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0x0800)
    u16(cv, 10, 0); u16(cv, 12, 0); u16(cv, 14, 0)
    u32(cv, 16, crc); u32(cv, 20, data.length); u32(cv, 24, data.length)
    u16(cv, 28, name.length); u16(cv, 30, 0); u16(cv, 32, 0); u16(cv, 34, 0)
    u16(cv, 36, 0); u32(cv, 38, 0); u32(cv, 42, localOffset); central.set(name, 46)
    centralParts.push(central)
    localOffset += local.length + data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0)
  u16(ev, 8, entries.length); u16(ev, 10, entries.length)
  u32(ev, 12, centralSize); u32(ev, 16, localOffset); u16(ev, 20, 0)
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' })
}

/**
 * Builds a standards-compliant, STORE-mode .cbtgen/.zip package.
 * xmlText must already contain the canonical assets manifest with src paths.
 * This function intentionally does not include user IDs or billing/session data.
 */
export async function buildCbtgenPackage({ xmlText, assets = [] }) {
  if (typeof xmlText !== 'string' || !xmlText.trim()) throw new Error('A validated CBTGen XML document is required.')
  if (!xmlText.includes('<cbtgen') || !xmlText.includes('</cbtgen>')) throw new Error('Package XML must have a cbtgen root element.')
  if (xmlText.includes('<!DOCTYPE') || xmlText.includes('<!ENTITY')) throw new Error('DTD and entity declarations are not allowed in package XML.')

  const seenIds = new Set()
  const seenPaths = new Set([PACKAGE_XML_NAME])
  const entries = [{ path: PACKAGE_XML_NAME, bytes: encoder.encode(xmlText) }]
  const manifestAssets = [...xmlText.matchAll(/<asset\b([^>]*?)\/?\s*>/g)].map(match => match[1])
  const declared = new Map()
  for (const attributes of manifestAssets) {
    const id = attributes.match(/\bid\s*=\s*(["'])(.*?)\1/)?.[2]
    const src = attributes.match(/\bsrc\s*=\s*(["'])(.*?)\1/)?.[2]
    if (id && src) declared.set(id, safePath(src))
  }

  for (const asset of assets) {
    const id = String(asset?.id || '').trim()
    if (!id || seenIds.has(id)) throw new Error(`Missing or duplicate package asset id: ${id || '(empty)'}`)
    seenIds.add(id)
    const path = safePath(asset.packagePath || declared.get(id) || '')
    if (!path.startsWith('assets/')) throw new Error(`Asset "${id}" must be stored under assets/.`)
    if (declared.get(id) && declared.get(id) !== path) throw new Error(`Asset "${id}" path does not match the XML manifest.`)
    if (!declared.has(id)) throw new Error(`Asset "${id}" is not declared in the XML assets manifest.`)
    if (seenPaths.has(path)) throw new Error(`Duplicate package path: ${path}`)
    seenPaths.add(path)
    entries.push({ path, bytes: await assetBytes(asset) })
  }

  for (const [id, path] of declared) {
    if (!seenIds.has(id)) throw new Error(`XML manifest asset "${id}" is missing binary content (${path}).`)
  }

  const referencedIds = [...xmlText.matchAll(/\bassetRef\s*=\s*(["'])(.*?)\1/g)].map(match => match[2])
  for (const id of referencedIds) {
    if (!seenIds.has(id) && !xmlText.includes(`<image id="${id}" encoding="base64"`)) {
      throw new Error(`XML references missing package asset "${id}".`)
    }
  }

  return makeZip(entries)
}

export { crc32 as cbtgenCrc32 }
