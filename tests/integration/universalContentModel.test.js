import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeContentBlock, normalizeRichContent, CONTENT_BLOCK_TYPES } from '../../src/lib/cbtgen/contentModel.js'

const normalized = normalizeRichContent({
  text: 'Question intro',
  tables: [{ caption: 'Measurements', headers: ['x', 'y'], rows: [[1, 2], [{ text: 'merged', colSpan: 2 }]] }],
  charts: [{ chart_type: 'line', xKey: 'time', series: [{ dataKey: 'value' }], data: [{ time: 't0', value: 1 }] }],
  diagrams: [{ src: 'assets/diagram.svg', alt: 'Circuit' }],
})
assert.equal(normalized.blocks[0].type, 'text')
assert.equal(normalized.blocks[1].type, 'table')
assert.equal(normalized.blocks[1].rows[1][0].colSpan, 2)
assert.equal(normalized.blocks[2].type, 'chart')
assert.equal(normalized.blocks[2].chartType, 'line')
assert.equal(normalized.blocks[3].type, 'diagram')

const alias = normalizeContentBlock({ type: 'plot', chartType: 'bar', data: [] })
assert.equal(alias.type, 'chart')
const future = normalizeContentBlock({ type: 'future-special-object', value: 'do not drop me' })
assert.equal(future.type, 'unknown')
assert.equal(future.originalType, 'future-special-object')
assert.equal(future.value, 'do not drop me')
assert.ok(CONTENT_BLOCK_TYPES.includes('chart'))

const renderer = fs.readFileSync('src/features/exam/components/ContentRenderer.jsx', 'utf8')
for (const token of ['function RichTable', 'function DataChart', "block.type === 'diagram'", "block.type === 'audio'", "block.type === 'video'"]) assert.ok(renderer.includes(token), `renderer should support ${token}`)
const css = fs.readFileSync('src/features/exam/styles/Examination.css', 'utf8')
assert.match(css, /content-table-scroll/)
assert.match(css, /content-chart-scroll/)
console.log('Universal content model regression tests passed.')
console.log('  Table spans, chart aliases/data, diagram assets, unknown-type retention and responsive styles verified.')
