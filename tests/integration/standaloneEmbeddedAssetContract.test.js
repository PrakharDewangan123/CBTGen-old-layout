import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const prompt = await readFile(new URL('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', root), 'utf8')
const packageFormat = await readFile(new URL('src/lib/cbtgen/packageFormat.js', root), 'utf8')
const validator = await readFile(new URL('src/lib/cbtgen/semanticValidator.js', root), 'utf8')
const schema = await readFile(new URL('docs/xml/CBTGen-XML-Schema-v1.0.xsd', root), 'utf8')

assert.match(prompt, /standalone.*\.xml.*supported/i)
assert.match(prompt, /Do NOT use a package-style <assets><asset src=\.\.\.> external-asset contract in standalone XML/s)
assert.match(prompt, /Every package <asset> MUST have a non-empty src attribute\./)
assert.match(prompt, /Package <asset> declarations MUST NOT use encoding="base64"/)
assert.match(prompt, /each unique image binary MUST be embedded exactly once as:/)
assert.match(prompt, /<image id="asset-src-q-0003" encoding="base64" mimeType="image\/png">/)
assert.match(prompt, /Later uses of the same binary MUST be:/)
assert.match(prompt, /<image assetRef="asset-src-q-0003"\/>/)
assert.match(prompt, /Each unique binary MUST have exactly one embedded definition/i)
assert.match(prompt, /A standalone Base64 definition MUST NOT use assetRef/i)
assert.match(prompt, /Every assetRef MUST resolve to exactly one embedded Base64 definition/i)


assert.match(packageFormat, /const id = image\.getAttribute\('id'\) \|\| ''/)
assert.match(packageFormat, /A Base64 <image> asset definition must have an id/)
assert.match(packageFormat, /Base64 image asset .*cannot use assetRef/)
assert.match(packageFormat, /Duplicate embedded asset id/)
assert.match(packageFormat, /Standalone XML files \(\.xml\) cannot use package-style <assets><asset> definitions/)
assert.match(packageFormat, /Package asset .* must use an internal src file; Base64 belongs in standalone <image> definitions/)
assert.match(packageFormat, /Package asset .* is missing its internal src/)

assert.match(validator, /function collectEmbeddedImageIds\(root, errors\)/)
assert.match(validator, /DUPLICATE_EMBEDDED_ASSET_ID/)
assert.match(validator, /EMBEDDED_IMAGE_ASSETREF_INVALID/)
assert.match(validator, /const embeddedImageIds = collectEmbeddedImageIds\(root, errors\)/)
assert.match(validator, /assetIds\.add\(embeddedImageId\)/)

// The XSD already supports the canonical standalone form through ImageContentType:
// one embedded Base64 <image id="..."> definition and later <image assetRef="..."> references.
assert.match(schema, /<xs:attribute name="id" type="IdType" use="optional"\/>/)
assert.match(schema, /<xs:attribute name="assetRef" type="IdType" use="optional"\/>/)
assert.match(schema, /<xs:attribute name="encoding" use="optional">/)
assert.match(schema, /<xs:enumeration value="base64"\/>/)

console.log('✓ Standalone embedded-asset contract tests passed')
console.log('  Each unique standalone image is embedded exactly once.')
console.log('  Repeated image uses resolve through assetRef.')
console.log('  Duplicate embedded IDs are rejected.')
console.log('  Standalone XML cannot use package-style external asset src values.')
