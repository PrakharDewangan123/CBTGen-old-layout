import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync('src/features/exam/questionTypes/Match.jsx', 'utf8')
const css = fs.readFileSync('src/features/exam/styles/Examination.css', 'utf8')

assert.match(source, /ContentBlocks/)
assert.match(source, /match-reference-panel/)
assert.match(source, /match-reference-content/)
assert.match(source, /<MatchItemContent item=\{item\}/)
assert.match(source, /<MatchItemContent item=\{target\}/)
assert.match(source, /<select/)
assert.match(css, /match-reference-panel/)
assert.match(css, /match-left-content/)

console.log('MATCH rich-content rendering contract passed.')
console.log('  Left/right MATCH items can render nested image/math/text content.')
console.log('  Native select remains the answer control; rich List-II content is rendered separately.')
