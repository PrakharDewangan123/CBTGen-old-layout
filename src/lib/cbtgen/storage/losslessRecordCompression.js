const FORMAT = 'gzip-json-v1'
const MIN_INPUT_BYTES = 4096
const MIN_SAVINGS_RATIO = 0.05

function streamTransform(bytes, TransformClass) {
  const stream = new Blob([bytes]).stream().pipeThrough(new TransformClass('gzip'))
  return new Response(stream).arrayBuffer().then(buffer => new Uint8Array(buffer))
}

export async function gzipBytes(bytes) {
  if (typeof CompressionStream !== 'function') throw new Error('Lossless compression is unavailable in this runtime.')
  return streamTransform(bytes, CompressionStream)
}

export async function gunzipBytes(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('Lossless decompression is unavailable in this runtime.')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Compresses only JSON-serializable structured paper content. Binary/image assets
 * remain byte-for-byte unchanged and are deliberately stored outside this payload.
 * If compression is unavailable or does not save enough space, the record remains plain.
 */
export async function encodePaperContent(record) {
  const content = { xmlText: record.xmlText, paper: record.paper }
  const json = JSON.stringify(content)
  const plainBytes = new TextEncoder().encode(json)
  if (plainBytes.byteLength < MIN_INPUT_BYTES || typeof CompressionStream !== 'function') {
    return { ...record, storageEncoding: 'plain-json-v1' }
  }

  try {
    const compressed = await gzipBytes(plainBytes)
    const requiredSavings = plainBytes.byteLength * MIN_SAVINGS_RATIO
    if (compressed.byteLength >= plainBytes.byteLength - requiredSavings) {
      return { ...record, storageEncoding: 'plain-json-v1' }
    }
    const metadata = { ...record }
    delete metadata.xmlText
    delete metadata.paper
    return {
      ...metadata,
      storageEncoding: FORMAT,
      compressedContent: compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength),
      uncompressedBytes: plainBytes.byteLength,
      compressedBytes: compressed.byteLength,
    }
  } catch {
    // Compression must never make saving a valid paper fail.
    return { ...record, storageEncoding: 'plain-json-v1' }
  }
}

export async function decodePaperContent(record) {
  if (!record || record.storageEncoding !== FORMAT) return record
  if (!(record.compressedContent instanceof ArrayBuffer) && !ArrayBuffer.isView(record.compressedContent)) {
    throw new Error('Compressed paper content is missing or invalid.')
  }
  const compressed = record.compressedContent instanceof ArrayBuffer
    ? new Uint8Array(record.compressedContent)
    : new Uint8Array(record.compressedContent.buffer, record.compressedContent.byteOffset, record.compressedContent.byteLength)
  const bytes = await gunzipBytes(compressed)
  if (record.uncompressedBytes && bytes.byteLength !== record.uncompressedBytes) {
    throw new Error('Decompressed paper content failed its length integrity check.')
  }
  let content
  try {
    content = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new Error('Decompressed paper content is not valid UTF-8 JSON.')
  }
  if (typeof content.xmlText !== 'string' || !content.paper || typeof content.paper !== 'object') {
    throw new Error('Decompressed paper content is incomplete.')
  }
  const metadata = { ...record }
  delete metadata.compressedContent
  delete metadata.uncompressedBytes
  delete metadata.compressedBytes
  delete metadata.storageEncoding
  return {
    ...metadata,
    ...content,
    storageEncoding: record.storageEncoding,
    compression: {
      algorithm: 'gzip',
      uncompressedBytes: record.uncompressedBytes,
      compressedBytes: record.compressedBytes,
    },
  }
}

export const PAPER_COMPRESSION_FORMAT = FORMAT
