import assert from 'node:assert/strict'
import fs from 'node:fs'

const validator = fs.readFileSync('src/lib/cbtgen/semanticValidator.js', 'utf8')
const prompt = fs.readFileSync('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', 'utf8')

assert.match(validator, /PAGE_IMAGE_AS_QUESTION_ASSET/)
assert.match(validator, /pageLikeAsset/)
assert.match(validator, /asset-page-\\d\+/)
assert.match(validator, /page-level image asset/)
assert.match(validator, /segment the exact question, option, or MATCH visual/)

assert.match(prompt, /Never do:/)
assert.match(prompt, /Q1 -> page-01.*Q2 -> page-01.*Q3 -> page-01/s)
assert.match(prompt, /merely because they appear on that page/)
assert.match(prompt, /A source-page asset is NOT normal question\/option content/i)
assert.match(prompt, /Mathematical expressions requiring structure MUST NOT be flattened into ordinary text/)

console.log('Page-level asset attachment contract passed.')
console.log('  Page images cannot be silently used as normal question/option visuals.')
console.log('  Conversion is fail-closed when exact semantic assets are missing.')
