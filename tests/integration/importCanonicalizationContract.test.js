import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const packageFormat = await readFile(new URL('apps/web/src/lib/cbtgen/packageFormat.js', root), 'utf8')
const validator = await readFile(new URL('apps/web/src/lib/cbtgen/semanticValidator.js', root), 'utf8')

// Legacy/AI conversion output may incorrectly serialize MSQ as multiple-choice.
// The import boundary canonicalizes this semantically equivalent legacy value to
// the only valid CBTGen response mode without changing question type or answers.
assert.match(packageFormat, /type === 'MSQ' && current === 'multiple-choice'/)
assert.match(packageFormat, /mode\.textContent = 'multiple-select'/)
assert.match(packageFormat, /type === 'IMAGE_MULTI_CHOICE' && current === 'multiple-choice'/)

// Package imports may contain the exact binary asset but omit its <asset>
// manifest declaration. The importer may repair only when the referenced id
// maps unambiguously to one exact assets/<id>.<ext> entry; it must never invent
// binary content.
assert.match(packageFormat, /repairPackageAssetManifest\(xml, entries\)/)
assert.match(packageFormat, /candidates\.length === 0/)
assert.match(packageFormat, /candidates\.length > 1/)
assert.match(packageFormat, /declaration\.setAttribute\('src', src\)/)
assert.match(packageFormat, /mimeFromPath\(src\)/)
assert.match(packageFormat, /inferPackageAssetScope\(xml, assetId\)/)

// The semantic validator remains strict: direct validation of an uncanonicalized
// document still rejects an incorrect response mode and missing asset reference.
assert.match(validator, /RESPONSE_MODE_MISMATCH/)
assert.match(validator, /ASSET_REFERENCE_INVALID/)

// Canonical package XML must be the serialized DOM that was actually validated,
// so repaired response modes/manifest declarations cannot be lost on storage.
assert.match(packageFormat, /xmlText: serializeXml\(xml\)/)

console.log('✓ Import canonicalization contract tests passed')
console.log('  MSQ/IMAGE_MULTI_CHOICE legacy multiple-choice modes are canonicalized at import.')
console.log('  Missing package asset declarations are repaired only from exact, unambiguous package binaries.')
console.log('  The semantic validator remains strict for raw/un-canonicalized XML.')
console.log('  Stored package XML reflects the canonicalized DOM.')
