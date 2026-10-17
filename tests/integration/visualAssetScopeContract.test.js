import fs from 'node:fs'
import assert from 'node:assert/strict'

const prompt = fs.readFileSync('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', 'utf8')
const schema = fs.readFileSync('docs/xml/CBTGen-XML-Schema-v1.0.xsd', 'utf8')
const validator = fs.readFileSync('src/lib/cbtgen/semanticValidator.js', 'utf8')

assert.match(prompt, /Every image asset MUST declare one allowed visual scope:/)
assert.match(prompt, /question-visual\n- option-visual\n- source-page/)
assert.match(prompt, /A source-page asset is NOT normal question\/option content/)
assert.match(prompt, /allowFullPage="true"/)
assert.match(prompt, /source-page fallback/)

assert.match(schema, /name="scope"/)
assert.match(schema, /value="question-visual"/)
assert.match(schema, /value="option-visual"/)
assert.match(schema, /value="source-page"/)
assert.match(schema, /name="allowFullPage" type="xs:boolean"/)

assert.match(validator, /SOURCE_PAGE_ASSET_IN_QUESTION/)
assert.match(validator, /FULL_PAGE_VISUAL_FALLBACK/)
assert.match(validator, /FULL_PAGE_FLAG_SCOPE_INVALID/)
assert.match(validator, /ASSET_SCOPE_INVALID/)
assert.match(validator, /assetScopes/)
assert.match(validator, /VISUAL_ASSET_UNREFERENCED/)
assert.match(validator, /declared but not referenced by question\/option content/)

console.log('Visual asset scope contract test passed.')
console.log('  Question/option visuals are distinguished from source-page fallback assets.')
console.log('  Full-page fallback requires explicit allowFullPage="true".')
console.log('  Unsupported image scopes are rejected.')
