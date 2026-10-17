import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const prompt = await readFile(new URL('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', root), 'utf8')
const schema = await readFile(new URL('docs/xml/CBTGen-XML-Schema-v1.0.xsd', root), 'utf8')
const validator = await readFile(new URL('src/lib/cbtgen/semanticValidator.js', root), 'utf8')
const packageFormat = await readFile(new URL('src/lib/cbtgen/packageFormat.js', root), 'utf8')
const paperModel = await readFile(new URL('src/lib/cbtgen/paperModel.js', root), 'utf8')

assert.match(prompt, /IMAGE-BASED OPTIONS/)
assert.match(prompt, /Every selectable image option MUST be:/)
assert.match(prompt, /<image assetRef="\.\.\."\/>/)
assert.match(prompt, /MIME type matches actual binary/i)
assert.match(prompt, /mimeType="image\/png"/)
assert.doesNotMatch(prompt, /<asset[^\n]+\bmime=/)

assert.match(schema, /<xs:attribute name="mimeType" type="NonEmptyString" use="optional"\/>/)
assert.doesNotMatch(schema, /<xs:attribute name="mime" type="NonEmptyString" use="optional"\/>/)
assert.match(schema, /<xs:element name="option" type="OptionType" minOccurs="2"/)

assert.match(validator, /OPTIONS_MISSING/)
assert.match(validator, /Every.*mimeType|must declare an image mimeType/i)
assert.doesNotMatch(validator, /getAttribute\('mime'\) \|\| getAttribute\('mimeType'\)/)

assert.match(packageFormat, /asset\.getAttribute\('mimeType'\) \|\| mimeFromPath\(src\)/)
assert.doesNotMatch(packageFormat, /asset\.getAttribute\('mime'\) \|\| asset\.getAttribute\('mimeType'\)/)
assert.match(paperModel, /asset\.getAttribute\(\s*'mimeType'\s*\)/)

console.log('✓ Image-option contract tests passed')
console.log('  Image-only options must be represented by real <option> elements.')
console.log('  Package image assets use canonical mimeType metadata.')
console.log('  Empty selectable option collections remain invalid.')
console.log('  Asset declarations cannot use the legacy mime attribute.')
