/**
 * CBTGen canonical rich-content contract.
 *
 * Content blocks describe what the source contains; question types describe how
 * candidates respond. Unknown blocks are retained by normalization so importers
 * never silently discard a newly encountered content type.
 */
export const CONTENT_BLOCK_TYPES = Object.freeze([
  'text', 'heading', 'paragraph', 'list', 'quote', 'callout', 'math', 'code',
  'image', 'diagram', 'chart', 'table', 'audio', 'video', 'file', 'link',
  'page-break', 'separator', 'group', 'unknown',
])

const asArray = (value) => Array.isArray(value) ? value : []

export function normalizeContentBlock(input, index = 0) {
  if (typeof input === 'string' || typeof input === 'number') {
    return { id: `content-${index + 1}`, type: 'text', value: String(input) }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { id: `content-${index + 1}`, type: 'unknown', originalType: 'invalid', value: '' }
  }
  const originalType = String(input.type || input.kind || 'text').trim().toLowerCase()
  const aliases = {
    p: 'paragraph', para: 'paragraph', plain_text: 'text', 'plain-text': 'text',
    equation: 'math', formula: 'math', image_asset: 'image', figure: 'image',
    plot: 'chart', graph: 'chart', data_table: 'table', 'data-table': 'table',
    ordered_list: 'list', unordered_list: 'list', ul: 'list', ol: 'list',
    hr: 'separator', pagebreak: 'page-break', audio_clip: 'audio', video_clip: 'video',
  }
  const mappedType = aliases[originalType] || originalType
  const type = CONTENT_BLOCK_TYPES.includes(mappedType) ? mappedType : 'unknown'
  const block = { ...input, id: String(input.id || `content-${index + 1}`), type }
  if (type === 'unknown') block.originalType = originalType
  if (type === 'group') block.blocks = asArray(input.blocks).map(normalizeContentBlock)
  if (type === 'table') {
    block.headers = asArray(input.headers)
    block.rows = asArray(input.rows).map((row) => asArray(row))
    block.caption = input.caption == null ? '' : String(input.caption)
  }
  if (type === 'list') {
    block.items = asArray(input.items).map((item) => item && typeof item === 'object' ? item : String(item ?? ''))
    block.ordered = Boolean(input.ordered || originalType === 'ordered_list' || originalType === 'ol')
  }
  if (type === 'chart') {
    block.chartType = ['bar', 'line', 'pie', 'scatter', 'area'].includes(input.chartType || input.chart_type)
      ? (input.chartType || input.chart_type) : 'unknown'
    block.series = asArray(input.series)
    block.data = asArray(input.data)
  }
  return block
}

export function normalizeRichContent(input) {
  if (Array.isArray(input)) return { blocks: input.map(normalizeContentBlock) }
  if (!input || typeof input !== 'object') {
    return { blocks: input == null || input === '' ? [] : [normalizeContentBlock(input)] }
  }
  if (Array.isArray(input.blocks) && input.blocks.length) return { ...input, blocks: input.blocks.map(normalizeContentBlock) }
  const blocks = [
    ...(input.text ? [{ type: 'text', value: input.text }] : []),
    ...(input.assertion ? [{ type: 'text', role: 'assertion', value: input.assertion.text || '' }] : []),
    ...(input.reason ? [{ type: 'text', role: 'reason', value: input.reason.text || '' }] : []),
    ...asArray(input.math).map((item) => ({ type: 'math', ...item })),
    ...asArray(input.code).map((item) => ({ type: 'code', ...item })),
    ...asArray(input.images).map((item) => ({ type: 'image', ...item })),
    ...asArray(input.tables).map((item) => ({ type: 'table', ...item })),
    ...asArray(input.charts).map((item) => ({ type: 'chart', ...item })),
    ...asArray(input.diagrams).map((item) => ({ type: 'diagram', ...item })),
  ]
  return { ...input, blocks: blocks.map(normalizeContentBlock) }
}
