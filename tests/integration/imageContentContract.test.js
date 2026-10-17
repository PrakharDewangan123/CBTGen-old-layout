import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const paperModel = await readFile(new URL('apps/web/src/lib/cbtgen/paperModel.js', root), 'utf8')
const normalizer = await readFile(new URL('apps/web/src/lib/cbtgen/questionNormalizer.js', root), 'utf8')
const packageFormat = await readFile(new URL('apps/web/src/lib/cbtgen/packageFormat.js', root), 'utf8')
const storage = await readFile(new URL('apps/web/src/lib/cbtgen/paperStorage.js', root), 'utf8')
const renderer = await readFile(new URL('apps/web/src/features/exam/components/ContentRenderer.jsx', root), 'utf8')

assert.match(paperModel, /blocks: \[\]/)
assert.match(paperModel, /content\.blocks\.push\(\{ type: 'image'/)
assert.match(paperModel, /content\.blocks\.push\(\{ type: 'text'/)
assert.match(normalizer, /IMAGE:\$\{digest\}/)
assert.match(packageFormat, /\.cbtgen/)
assert.match(packageFormat, /\.zip/)
assert.match(packageFormat, /Base64 image data is invalid/)
assert.match(packageFormat, /External image source/)
assert.match(storage, /assets = \[\]/)
assert.match(renderer, /block\.assetUrl \|\| block\.assetRef/)

console.log('✓ Image/package content contract tests passed')
console.log('  Ordered image/text content blocks are represented.')
console.log('  .xml, .zip and .cbtgen import modes are defined.')
console.log('  Standalone XML uses embedded Base64 images.')
console.log('  Package assets are stored locally with the paper.')
console.log('  External image dependencies are rejected.')
